import type { Charge } from "../types";
import { HttpError, isDemo } from "../auth";
import { cached } from "../news/cache";
import {
  fetchFeed,
  googleNewsUrl,
  newsApiSearch,
  type Fetcher,
} from "../news/sources";
import type { FeedItem } from "../news/rss";

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
  /** True when providers failed and an older cached result is shown. */
  stale?: boolean;
}

const TTL_MS = 60 * 60 * 1000;
const MAX_AGE_MS = 31 * 86400000;
const MAX_HEADLINES = 5;
const PER_MERCHANT = 2;
// A pricing story names a cost; "renewed" alone is usually a TV season.
const PRICING =
  /\b(price[sd]?|pricing|subscription|fees?|hikes?|costs?|cheaper|pricier|expensive|billing|charges?|raises?|increase[sd]?|\$\d)/i;
// TV renewals and stock-market coverage ("price target", "shares") aren't
// about what a subscriber pays.
const OFF_TOPIC =
  /\b(season|episode|trailer|cast|box office|renewed for|price targets?|shares?|stocks?|analysts?|upgrades?|downgrades?|earnings|ratings?|investors?|market cap)\b/i;

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** True when the headline is about this merchant's pricing or plans. */
export function isPricingStory(title: string, merchant: string) {
  const t = ` ${words(title)} `;
  return (
    t.includes(` ${words(merchant)} `) &&
    PRICING.test(title) &&
    !OFF_TOPIC.test(title)
  );
}

export function topMerchants(charges: Charge[]) {
  return [
    ...new Set(
      charges
        .filter((c) => c.status === "active" || c.status === "trial")
        .sort((a, b) => b.amount - a.amount)
        .map((c) =>
          c.merchant
            .replace(/[^\p{L}\p{N} &+.'-]/gu, "")
            .trim()
            .slice(0, 60),
        )
        .filter(Boolean),
    ),
  ].slice(0, 3);
}

/** Keeps safe, recent, unique, on-topic items, newest first. */
export function selectHeadlines(
  found: { merchant: string; items: FeedItem[] }[],
  now = Date.now(),
): NewsHeadline[] {
  const seen = new Set<string>();
  const out: NewsHeadline[] = [];
  for (const { merchant, items } of found)
    for (const item of items) {
      if (!isPricingStory(item.title, merchant)) continue;
      let link: URL;
      try {
        link = new URL(item.link);
      } catch {
        continue;
      }
      if (link.protocol !== "https:" || link.username || link.password)
        continue;
      const published = Date.parse(item.publishedAt);
      if (
        !Number.isFinite(published) ||
        published > now + 3600000 ||
        published < now - MAX_AGE_MS
      )
        continue;
      const key = words(item.title);
      if (seen.has(key) || seen.has(link.href)) continue;
      seen.add(key);
      seen.add(link.href);
      out.push({
        title: item.title.slice(0, 240),
        url: link.href,
        publishedAt: new Date(published).toISOString(),
        source: item.source.slice(0, 100) || "News source",
        merchant,
        whyItMatters: `Mentions ${merchant} pricing or plans. It doesn't confirm a change to your own plan.`,
      });
    }
  const perMerchant = new Map<string, number>();
  return out
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .filter((h) => {
      const n = (perMerchant.get(h.merchant) ?? 0) + 1;
      perMerchant.set(h.merchant, n);
      return n <= PER_MERCHANT;
    })
    .slice(0, MAX_HEADLINES);
}

async function search(merchants: string[], fetcher: Fetcher) {
  const settled = await Promise.allSettled(
    merchants.map(async (merchant) => ({
      merchant,
      items: await fetchFeed(
        googleNewsUrl(
          `"${merchant}" (price OR subscription OR plan OR fee) when:30d`,
        ),
        fetcher,
      ),
    })),
  );
  const ok = settled.flatMap((r) =>
    r.status === "fulfilled" ? [r.value] : [],
  );
  if (ok.length) return ok;
  // Every Google request failed: fall back to NewsAPI when it is configured.
  const backup = await newsApiSearch(
    `(${merchants.map((m) => `"${m}"`).join(" OR ")}) AND (price OR pricing OR subscription)`,
    fetcher,
  );
  return merchants.map((merchant) => ({ merchant, items: backup }));
}

function sample(merchants: string[]): NewsResult {
  const at = new Date(Date.now() - 2 * 86400000).toISOString();
  return {
    headlines: merchants.slice(0, 2).map((merchant) => ({
      title: `Sample: ${merchant} adjusts its student plan pricing`,
      url: "https://www.usebrix.app/developers",
      publishedAt: at,
      source: "Sample news (demo)",
      merchant,
      whyItMatters: "Demo data, not a real article.",
    })),
    message: "Sample news for the demo. Live news runs in your real account.",
  };
}

export async function getMoneyNews(
  charges: Charge[],
  fetcher: Fetcher = fetch,
): Promise<NewsResult> {
  const merchants = topMerchants(charges);
  if (!merchants.length)
    return {
      headlines: [],
      message: "Add a charge or link a bank before checking merchant news.",
    };
  if (isDemo()) return sample(merchants);
  // Cache raw feed items, not filtered headlines, so filter changes and the
  // 31-day window apply on every read.
  const load = () => search(merchants, fetcher);
  let found: Awaited<ReturnType<typeof search>>,
    stale = false;
  try {
    // Tests inject a fetcher; only real fetches use the shared cache.
    if (fetcher === fetch)
      ({ value: found, stale } = await cached(
        `merchant-feeds:${merchants.join("|").toLowerCase()}`,
        TTL_MS,
        load,
      ));
    else found = await load();
  } catch {
    throw new HttpError(
      502,
      "News is temporarily unavailable. Your expected charges are unchanged.",
    );
  }
  const headlines = selectHeadlines(found);
  return {
    headlines,
    message: headlines.length
      ? `Recent merchant news${stale ? " (from earlier; sources are slow right now)" : ""}. Check the publisher and your own plan before acting.`
      : "No recent pricing news about your merchants.",
    ...(stale ? { stale } : {}),
  };
}
