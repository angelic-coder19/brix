import { randomUUID } from "node:crypto";
import { HttpError } from "../auth";
import { findSecurity } from "../market/universe";
import { getQuotes } from "../market/quotes";
import { getRealHoldings, updateRealHoldings } from "../store";

// Real purchases the student made at a broker and typed in themselves. Brix
// never verifies, places, or moves anything here, and none of it feeds the
// practice portfolio, the benchmark, the leaderboard, or Brix coins.

export interface RealHolding {
  id: string;
  symbol: string;
  shares: number;
  pricePaid: number;
  boughtOn: string;
  broker: string;
  addedAt: string;
}

export const MAX_REAL_HOLDINGS = 50;
const round = (n: number) => Math.round(n * 100) / 100;

function positive(value: unknown, field: string, max: number, places: number) {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > max)
    throw new HttpError(
      400,
      `${field} must be more than 0 and at most ${max.toLocaleString("en-US")}.`,
    );
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/** Checks a "Log a real purchase" form and returns a clean holding. */
export function parseRealHolding(
  body: Record<string, unknown>,
  today = new Date().toISOString().slice(0, 10),
): Omit<RealHolding, "id" | "addedAt"> {
  const security = findSecurity(body.symbol);
  if (!security)
    throw new HttpError(400, "Choose a ticker from Brix's practice list.");
  const boughtOn = typeof body.boughtOn === "string" ? body.boughtOn : "";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(boughtOn) ||
    Number.isNaN(Date.parse(`${boughtOn}T00:00:00Z`)) ||
    boughtOn > today ||
    boughtOn < "1990-01-01"
  )
    throw new HttpError(400, "Enter the date you bought it, not in the future.");
  const broker = typeof body.broker === "string" ? body.broker.trim() : "";
  if (broker.length > 40)
    throw new HttpError(400, "Keep the broker name under 40 characters.");
  return {
    symbol: security.symbol,
    shares: positive(body.shares, "Shares", 1_000_000, 6),
    pricePaid: positive(body.pricePaid, "Price paid", 1_000_000, 2),
    boughtOn,
    broker,
  };
}

export async function addRealHolding(
  uid: string,
  body: Record<string, unknown>,
) {
  const clean = parseRealHolding(body);
  return updateRealHoldings(uid, (holdings) => {
    if (holdings.length >= MAX_REAL_HOLDINGS)
      throw new HttpError(
        409,
        `You can log up to ${MAX_REAL_HOLDINGS} real purchases.`,
      );
    const holding: RealHolding = {
      id: randomUUID(),
      ...clean,
      addedAt: new Date().toISOString(),
    };
    return { holdings: [holding, ...holdings], result: holding };
  });
}

export async function removeRealHolding(uid: string, id: string) {
  return updateRealHoldings(uid, (holdings) => {
    if (!holdings.some((h) => h.id === id))
      throw new HttpError(404, "That purchase is already gone.");
    return { holdings: holdings.filter((h) => h.id !== id), result: true };
  });
}

/** Each holding at its current price. Totals stay separate from practice. */
export async function realHoldingsView(uid: string) {
  const holdings = await getRealHoldings(uid);
  const quotes = await getQuotes(holdings.map((h) => h.symbol));
  const rows = holdings.map((h) => {
    const quote = quotes[h.symbol];
    const cost = round(h.shares * h.pricePaid);
    const value = quote ? round(h.shares * quote.price) : null;
    return {
      ...h,
      name: findSecurity(h.symbol)?.name ?? h.symbol,
      price: quote?.price ?? null,
      cost,
      value,
      gain: value === null ? null : round(value - cost),
    };
  });
  const priced = rows.filter((r) => r.value !== null);
  return {
    selfReported: true as const,
    holdings: rows,
    totals: {
      cost: round(priced.reduce((s, r) => s + r.cost, 0)),
      value: round(priced.reduce((s, r) => s + r.value!, 0)),
      gain: round(priced.reduce((s, r) => s + r.gain!, 0)),
    },
    sample: Object.values(quotes).some((q) => q.sample),
  };
}
