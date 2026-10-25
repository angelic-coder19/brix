import { isDemo } from "../auth";

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number;
  /** When the price was set by the market (ISO). */
  at: string;
  marketOpen: boolean;
  /** Fixed prices used in the demo, never live ones. */
  sample?: boolean;
}
export type Fetcher = typeof fetch;

const TTL_MS = 60 * 1000;
const cache = new Map<string, { at: number; quote: Quote }>();
const inflight = new Map<string, Promise<Quote | null>>();

// Demo prices: realistic but fixed, so demos and tests are repeatable.
const SAMPLE: Record<string, number> = {
  VOO: 612.4,
  VTI: 318.2,
  SPY: 665.1,
  IVV: 668.3,
  QQQ: 598.7,
  VXUS: 71.9,
  VT: 133.5,
  SCHD: 27.8,
  VUG: 470.2,
  VTV: 182.6,
  IWM: 241.3,
  BND: 74.1,
  AGG: 99.6,
  SGOV: 100.4,
  AAPL: 251.3,
  MSFT: 512.9,
  NVDA: 183.4,
  AMZN: 224.6,
  GOOGL: 247.1,
  META: 735.2,
  TSLA: 433.8,
  "BRK-B": 498.7,
  JPM: 302.4,
  V: 344.9,
  MA: 571.3,
  COST: 921.6,
  WMT: 103.2,
  KO: 68.4,
  PEP: 147.9,
  MCD: 301.5,
  NKE: 69.8,
  DIS: 112.7,
  NFLX: 1189.4,
  SPOT: 701.2,
  AMD: 233.1,
  INTC: 37.4,
  JNJ: 187.6,
  PG: 151.3,
  XOM: 114.8,
  UBER: 96.2,
};

function sampleQuote(symbol: string): Quote | null {
  const price = SAMPLE[symbol];
  if (!price) return null;
  return {
    symbol,
    price,
    previousClose: Math.round(price * 0.994 * 100) / 100,
    at: new Date().toISOString(),
    marketOpen: true,
    sample: true,
  };
}

/** Parses Yahoo's chart response into a quote, or null if it has no price. */
export function parseChart(
  symbol: string,
  body: unknown,
  now = Date.now(),
): Quote | null {
  const meta = (
    body as {
      chart?: {
        result?: {
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            regularMarketTime?: number;
            currentTradingPeriod?: {
              regular?: { start?: number; end?: number };
            };
          };
        }[];
      };
    }
  )?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== "number" || !(price > 0)) return null;
  const regular = meta?.currentTradingPeriod?.regular;
  const seconds = now / 1000;
  return {
    symbol,
    price,
    previousClose: meta?.chartPreviousClose ?? meta?.previousClose ?? price,
    at: new Date((meta?.regularMarketTime ?? seconds) * 1000).toISOString(),
    marketOpen:
      !!regular?.start &&
      !!regular.end &&
      seconds >= regular.start &&
      seconds < regular.end,
  };
}

async function load(symbol: string, fetcher: Fetcher): Promise<Quote | null> {
  const res = await fetcher(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
    {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Brix/1.0)" },
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!res.ok) return null;
  return parseChart(symbol, await res.json());
}

/**
 * Current prices for listed symbols, cached for a minute. Symbols without a
 * price are left out: callers must never fill an order without one.
 */
export async function getQuotes(
  symbols: string[],
  fetcher: Fetcher = fetch,
): Promise<Record<string, Quote>> {
  const out: Record<string, Quote> = {};
  await Promise.all(
    [...new Set(symbols)].map(async (symbol) => {
      if (isDemo()) {
        const q = sampleQuote(symbol);
        if (q) out[symbol] = q;
        return;
      }
      const hit = cache.get(symbol);
      if (fetcher === fetch && hit && Date.now() - hit.at < TTL_MS) {
        out[symbol] = hit.quote;
        return;
      }
      let pending = fetcher === fetch ? inflight.get(symbol) : undefined;
      if (!pending) {
        pending = load(symbol, fetcher).catch(() => null);
        if (fetcher === fetch) {
          inflight.set(symbol, pending);
          void pending.finally(() => inflight.delete(symbol));
        }
      }
      const quote = await pending;
      if (quote) {
        out[symbol] = quote;
        if (fetcher === fetch) cache.set(symbol, { at: Date.now(), quote });
      }
    }),
  );
  return out;
}
