import { parseRss, type FeedItem } from "./rss";

export type Fetcher = typeof fetch;
const TIMEOUT_MS = 5000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; BrixNews/1.0; +https://www.usebrix.app)";

export const googleNewsUrl = (query: string) =>
  `https://news.google.com/rss/search?${new URLSearchParams({
    q: query,
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
  })}`;

export const yahooTickerUrl = (symbol: string) =>
  `https://feeds.finance.yahoo.com/rss/2.0/headline?${new URLSearchParams({
    s: symbol,
    region: "US",
    lang: "en-US",
  })}`;

/** Fetches and parses one RSS feed. Throws on network or HTTP failure. */
export async function fetchFeed(url: string, fetcher: Fetcher = fetch) {
  const res = await fetcher(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, text/xml",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Feed returned ${res.status}`);
  return parseRss(await res.text());
}

/** NewsAPI backup, used only when its key is configured. */
export async function newsApiSearch(
  query: string,
  fetcher: Fetcher = fetch,
): Promise<FeedItem[]> {
  const key = process.env.NEWS_API_KEY;
  if (!key) throw new Error("NewsAPI is not configured.");
  const url = new URL("https://newsapi.org/v2/everything");
  url.search = new URLSearchParams({
    q: query,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "20",
    searchIn: "title,description",
  }).toString();
  const res = await fetcher(url, {
    headers: { "X-Api-Key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`NewsAPI returned ${res.status}`);
  const body = (await res.json()) as {
    status?: string;
    articles?: {
      title?: unknown;
      url?: unknown;
      publishedAt?: unknown;
      source?: { name?: unknown };
    }[];
  };
  if (body.status !== "ok" || !Array.isArray(body.articles))
    throw new Error("NewsAPI returned an invalid response.");
  return body.articles.flatMap((a) =>
    typeof a.title === "string" &&
    typeof a.url === "string" &&
    typeof a.publishedAt === "string"
      ? [
          {
            title: a.title,
            link: a.url,
            publishedAt: a.publishedAt,
            source:
              typeof a.source?.name === "string"
                ? a.source.name
                : "News source",
          },
        ]
      : [],
  );
}
