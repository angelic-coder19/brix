import { isDemo } from "../auth";
import { samplePrice, type Fetcher } from "./quotes";

export const HISTORY_RANGES = ["1mo", "6mo", "1y"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];
export interface History {
  symbol: string;
  range: HistoryRange;
  /** Daily (1mo) or weekly closes, oldest first. `t` is ISO date. */
  points: { t: string; close: number }[];
  sample?: boolean;
}

const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; history: History }>();
const INTERVAL: Record<HistoryRange, string> = {
  "1mo": "1d",
  "6mo": "1wk",
  "1y": "1wk",
};
const COUNT: Record<HistoryRange, number> = { "1mo": 22, "6mo": 26, "1y": 52 };
const STEP_DAYS: Record<HistoryRange, number> = {
  "1mo": 1,
  "6mo": 7,
  "1y": 7,
};

/** Parses Yahoo's chart response into closes, skipping empty sessions. */
export function parseHistory(
  symbol: string,
  range: HistoryRange,
  body: unknown,
): History | null {
  const result = (
    body as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
      };
    }
  )?.chart?.result?.[0];
  const times = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const points = times
    .map((t, i) => ({ t: new Date(t * 1000).toISOString(), close: closes[i] }))
    .filter(
      (p): p is { t: string; close: number } =>
        typeof p.close === "number" && p.close > 0,
    )
    .map((p) => ({ t: p.t, close: Math.round(p.close * 100) / 100 }));
  return points.length >= 2 ? { symbol, range, points } : null;
}

/**
 * Demo history: a repeatable walk that ends on the demo price, so the chart
 * matches the sample quote everywhere else.
 */
export function sampleHistory(
  symbol: string,
  range: HistoryRange,
  now = Date.now(),
): History | null {
  const end = samplePrice(symbol);
  if (!end) return null;
  let seed = 0;
  for (const c of symbol + range) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const n = COUNT[range];
  const drift = range === "1mo" ? 0.0012 : 0.004;
  const vol = range === "1mo" ? 0.011 : 0.022;
  const values = [end];
  for (let i = 1; i < n; i++)
    values.unshift(values[0] / (1 + drift + (rand() - 0.5) * 2 * vol));
  const step = STEP_DAYS[range] * 86400000;
  return {
    symbol,
    range,
    sample: true,
    points: values.map((v, i) => ({
      t: new Date(now - (n - 1 - i) * step).toISOString(),
      close: Math.round(v * 100) / 100,
    })),
  };
}

/** Closing prices over a range, cached for 15 minutes. */
export async function getHistory(
  symbol: string,
  range: HistoryRange,
  fetcher: Fetcher = fetch,
): Promise<History | null> {
  if (isDemo()) return sampleHistory(symbol, range);
  const key = `${symbol}:${range}`;
  const hit = cache.get(key);
  if (fetcher === fetch && hit && Date.now() - hit.at < TTL_MS)
    return hit.history;
  try {
    const res = await fetcher(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${INTERVAL[range]}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Brix/1.0)" },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return hit?.history ?? null;
    const history = parseHistory(symbol, range, await res.json());
    if (history && fetcher === fetch)
      cache.set(key, { at: Date.now(), history });
    return history ?? hit?.history ?? null;
  } catch {
    return hit?.history ?? null;
  }
}
