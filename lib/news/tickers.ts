import { HttpError, isDemo } from "../auth";
import { cached } from "./cache";
import { fetchFeed, yahooTickerUrl, type Fetcher } from "./sources";
import { previewImage } from "./preview";

export interface TickerHeadline {
  symbol: string;
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  imageUrl?: string;
}

const TTL_MS = 15 * 60 * 1000;
const PER_SYMBOL = 3;
const MAX_SYMBOLS = 5;
const MAX_STORIES = 10;
// Labelled sample photos for the offline demo, so the strip looks real
// without pretending any story is live.
const SAMPLE_PHOTOS = [
  "/images/laptop-window.webp",
  "/images/card-and-phone.webp",
  "/images/paying-at-home.webp",
  "/images/friends-cafe.webp",
];
const SAMPLE_TITLES = [
  (s: string) => `Sample: what moved ${s} this week`,
  (s: string) => `Sample: ${s} in 60 seconds, the plain-English version`,
];
const MAX_AGE_MS = 14 * 86400000;

/** Recent Yahoo Finance headlines, with publisher preview images. */
export async function getTickerNews(
  symbols: string[],
  fetcher: Fetcher = fetch,
  /** Fetch publisher preview photos (the news strip); off for chat tools. */
  { images = false }: { images?: boolean } = {},
): Promise<{ headlines: TickerHeadline[]; stale?: boolean }> {
  const list = [...new Set(symbols.map((s) => s.toUpperCase()))].slice(
    0,
    MAX_SYMBOLS,
  );
  if (!list.length) return { headlines: [] };
  if (isDemo())
    return {
      headlines: list.flatMap((symbol, i) =>
        SAMPLE_TITLES.map((title, j) => ({
          symbol,
          title: title(symbol),
          url: "https://www.investor.gov/introduction-investing",
          publishedAt: new Date(
            Date.now() - (i * 2 + j + 1) * 3600000 * 5,
          ).toISOString(),
          source: "Sample news (demo)",
          imageUrl: SAMPLE_PHOTOS[(i * 2 + j) % SAMPLE_PHOTOS.length],
        })),
      ),
    };
  let stale = false,
    failed = 0;
  const results = await Promise.all(
    list.map(async (symbol) => {
      const load = async () =>
        (await fetchFeed(yahooTickerUrl(symbol), fetcher)).slice(0, 10);
      try {
        const got =
          fetcher === fetch
            ? await cached(`ticker:${symbol}`, TTL_MS, load)
            : { value: await load(), stale: false };
        stale ||= got.stale;
        return got.value.map((item) => ({ ...item, symbol }));
      } catch {
        failed++;
        return [];
      }
    }),
  );
  const now = Date.now(),
    seen = new Set<string>();
  const headlines = results.flatMap((items) =>
    items
      .filter((item) => {
        const at = Date.parse(item.publishedAt);
        const ok =
          item.link.startsWith("https://") &&
          Number.isFinite(at) &&
          at > now - MAX_AGE_MS &&
          !seen.has(item.link);
        if (ok) seen.add(item.link);
        return ok;
      })
      .slice(0, PER_SYMBOL)
      .map(({ symbol, title, link, publishedAt, source, imageUrl }) => ({
        symbol,
        title: title.slice(0, 240),
        url: link,
        publishedAt,
        source,
        ...(imageUrl ? { imageUrl } : {}),
      })),
  );
  if (failed === list.length)
    throw new HttpError(502, "Stock news is temporarily unavailable.");
  const newest = headlines
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_STORIES);
  // Fill in preview photos from each publisher's page; a miss just means no photo.
  await Promise.all(
    newest.map(async (h) => {
      if (images && !h.imageUrl && fetcher === fetch) {
        const image = await previewImage(h.url);
        if (image) h.imageUrl = image;
      }
    }),
  );
  return { headlines: newest, ...(stale ? { stale } : {}) };
}
