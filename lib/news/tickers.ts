import { HttpError, isDemo } from "../auth";
import { cached } from "./cache";
import { fetchFeed, yahooTickerUrl, type Fetcher } from "./sources";

export interface TickerHeadline {
  symbol: string;
  title: string;
  url: string;
  publishedAt: string;
  source: string;
}

const TTL_MS = 15 * 60 * 1000;
const PER_SYMBOL = 3;
const MAX_AGE_MS = 14 * 86400000;

/** Recent Yahoo Finance headlines for up to three portfolio symbols. */
export async function getTickerNews(
  symbols: string[],
  fetcher: Fetcher = fetch,
): Promise<{ headlines: TickerHeadline[]; stale?: boolean }> {
  const list = [...new Set(symbols.map((s) => s.toUpperCase()))].slice(0, 3);
  if (!list.length) return { headlines: [] };
  if (isDemo())
    return {
      headlines: list.map((symbol) => ({
        symbol,
        title: `Sample: what moved ${symbol} this week`,
        url: "https://www.investor.gov/introduction-investing",
        publishedAt: new Date(Date.now() - 86400000).toISOString(),
        source: "Sample news (demo)",
      })),
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
      .map(({ symbol, title, link, publishedAt, source }) => ({
        symbol,
        title: title.slice(0, 240),
        url: link,
        publishedAt,
        source,
      })),
  );
  if (failed === list.length)
    throw new HttpError(502, "Stock news is temporarily unavailable.");
  return { headlines, ...(stale ? { stale } : {}) };
}
