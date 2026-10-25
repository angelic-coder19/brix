import type { Charge } from "../types";
import { HttpError, isDemo } from "../auth";

type Article = {
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  source?: { name?: string };
};

// NewsAPI's free plan allows 100 requests a day, so identical merchant sets
// share one result per hour on each server instance.
const CACHE_MS = 60 * 60 * 1000;
export interface NewsHeadline {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  merchant: string;
  whyItMatters: string;
}
export interface NewsResult {
  headlines: NewsHeadline[];
  message: string;
}
const cache = new Map<string, { at: number; value: NewsResult }>();

export async function getMoneyNews(
  charges: Charge[],
  fetcher = fetch,
): Promise<NewsResult> {
  if (isDemo())
    return {
      headlines: [],
      message: "Live news is disabled in the local demo.",
    };
  if (!process.env.NEWS_API_KEY)
    return { headlines: [], message: "News is not configured yet." };
  const merchants = [
    ...new Set(
      charges
        .filter((c) => c.status === "active" || c.status === "trial")
        .sort((a, b) => b.amount - a.amount)
        .map((c) =>
          c.merchant
            .replace(/[^\p{L}\p{N} &+.-]/gu, "")
            .trim()
            .slice(0, 60),
        )
        .filter(Boolean),
    ),
  ].slice(0, 3);
  if (!merchants.length)
    return {
      headlines: [],
      message: "Add a charge or link a bank before checking merchant news.",
    };
  const key = merchants.join("|").toLowerCase();
  const hit = fetcher === fetch ? cache.get(key) : undefined;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const url = new URL("https://newsapi.org/v2/everything");
  url.search = new URLSearchParams({
    q: `(${merchants.map((m) => `"${m}"`).join(" OR ")}) AND (subscription OR pricing OR renewal)`,
    language: "en",
    sortBy: "publishedAt",
    pageSize: "20",
    searchIn: "title,description",
  }).toString();
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { "X-Api-Key": process.env.NEWS_API_KEY },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new HttpError(
      502,
      "News is temporarily unavailable. Your expected charges are unchanged.",
    );
  }
  if (!response.ok)
    throw new HttpError(
      502,
      "News is unavailable for this account. Check the news provider plan and key.",
    );
  const body = (await response.json()) as {
    status?: string;
    articles?: Article[];
  };
  if (body.status !== "ok" || !Array.isArray(body.articles))
    throw new HttpError(502, "The news provider returned an invalid response.");
  const seen = new Set<string>();
  const headlines = body.articles
    .flatMap((article) => {
      if (
        typeof article.title !== "string" ||
        typeof article.url !== "string" ||
        typeof article.publishedAt !== "string"
      )
        return [];
      const text = `${article.title} ${typeof article.description === "string" ? article.description : ""}`;
      const merchant = merchants.find((m) =>
        text.toLowerCase().includes(m.toLowerCase()),
      );
      if (!merchant || !/subscription|pricing|renewal|price/i.test(text))
        return [];
      let link: URL;
      try {
        link = new URL(article.url);
      } catch {
        return [];
      }
      if (
        link.protocol !== "https:" ||
        link.username ||
        link.password ||
        seen.has(link.href)
      )
        return [];
      const published = Date.parse(article.publishedAt);
      if (
        !Number.isFinite(published) ||
        published > Date.now() ||
        published < Date.now() - 31 * 86400000
      )
        return [];
      seen.add(link.href);
      return [
        {
          title: article.title.slice(0, 240),
          url: link.href,
          publishedAt: article.publishedAt,
          source:
            typeof article.source?.name === "string"
              ? article.source.name.slice(0, 100)
              : "News source",
          merchant,
          whyItMatters: `Mentions ${merchant} and subscription pricing or renewals. This does not verify a change to your own plan.`,
        },
      ];
    })
    .slice(0, 3);
  const result: NewsResult = {
    headlines,
    message: headlines.length
      ? "Recent merchant news; check the publisher and your own plan before acting."
      : "No recent subscription news matching your merchants was found.",
  };
  if (fetcher === fetch) cache.set(key, { at: Date.now(), value: result });
  return result;
}
