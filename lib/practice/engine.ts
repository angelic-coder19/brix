import { randomUUID } from "node:crypto";
import { HttpError } from "../auth";
import { findSecurity } from "../market/universe";
import type { Quote } from "../market/quotes";

// A paper-trading ledger. Virtual cash, real prices, no real orders.

export interface Position {
  shares: number;
  avgCost: number;
  stopLoss?: number;
  takeProfit?: number;
}
export type OrderSource = "manual" | "rule" | "stop_loss" | "take_profit";
export interface Order {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
  notional: number;
  at: string;
  source: OrderSource;
  status: "filled" | "rejected";
  reason?: string;
  realized?: number;
  /** Filled at the last price while the market was closed. */
  afterHours?: boolean;
  clientKey?: string;
}
export type Cadence = "weekly" | "biweekly" | "monthly";
export interface AutoRule {
  id: string;
  symbol: string;
  amount: number;
  cadence: Cadence;
  nextRunOn: string;
  active: boolean;
  createdAt: string;
}
export interface Portfolio {
  cash: number;
  startingCash: number;
  createdAt: string;
  refundId?: string;
  /** VOO's price when the portfolio started, to compare against. */
  benchmarkStart?: number;
  realized: number;
  positions: Record<string, Position>;
  orders: Order[];
  rules: AutoRule[];
  /** Opt-in: others on the leaderboard may copy this mix (percentages only). */
  shareMix?: boolean;
}

export const MAX_ORDERS = 200;
export const MAX_RULES = 5;
export const MIN_TRADE = 1;
export const MAX_STARTING_CASH = 100000;
const round = (n: number, places = 2) =>
  Math.round(n * 10 ** places) / 10 ** places;
const floorShares = (n: number) => Math.floor(n * 10000 + 1e-9) / 10000;

export function newPortfolio(
  startingCash: number,
  benchmarkPrice?: number,
  refundId?: string,
): Portfolio {
  if (!(startingCash >= 100 && startingCash <= MAX_STARTING_CASH))
    throw new HttpError(400, "Start with $100 to $100,000 in practice money.");
  return {
    cash: round(startingCash),
    startingCash: round(startingCash),
    createdAt: new Date().toISOString(),
    ...(refundId ? { refundId } : {}),
    ...(benchmarkPrice ? { benchmarkStart: benchmarkPrice } : {}),
    realized: 0,
    positions: {},
    orders: [],
    rules: [],
  };
}

export interface OrderRequest {
  symbol: string;
  side: "buy" | "sell";
  /** Dollars to buy or sell. */
  amount?: number;
  /** Exact shares; for sells, "all" closes the position. */
  shares?: number | "all";
  source?: OrderSource;
  clientKey?: string;
}

/**
 * Fills an order at the quote's price. Manual orders throw on bad input;
 * automated ones (rules, stops) record a rejected order so the student can
 * see what happened.
 */
export function placeOrder(
  p: Portfolio,
  req: OrderRequest,
  quote: Quote | undefined,
): Order {
  const source = req.source ?? "manual";
  if (req.clientKey) {
    const earlier = p.orders.find((o) => o.clientKey === req.clientKey);
    if (earlier) return earlier;
  }
  const security = findSecurity(req.symbol);
  const fail = (reason: string): Order => {
    if (source === "manual") throw new HttpError(400, reason);
    const order: Order = {
      id: randomUUID(),
      symbol: security?.symbol ?? String(req.symbol),
      side: req.side,
      shares: 0,
      price: quote?.price ?? 0,
      notional: 0,
      at: new Date().toISOString(),
      source,
      status: "rejected",
      reason,
      ...(req.clientKey ? { clientKey: req.clientKey } : {}),
    };
    record(p, order);
    return order;
  };
  if (!security) return fail("Choose a symbol from Brix's practice list.");
  if (req.side !== "buy" && req.side !== "sell")
    return fail("Choose buy or sell.");
  if (!quote || !(quote.price > 0))
    return fail(
      `No live price for ${security.symbol} right now, so nothing was filled. Try again soon.`,
    );
  const price = quote.price;
  const held = p.positions[security.symbol];
  let shares: number;
  if (req.shares === "all") {
    if (req.side !== "sell") return fail("Only sells can use all shares.");
    shares = held?.shares ?? 0;
  } else if (typeof req.shares === "number") shares = floorShares(req.shares);
  else if (typeof req.amount === "number" && Number.isFinite(req.amount))
    shares = floorShares(req.amount / price);
  else return fail("Enter a dollar amount or a number of shares.");
  if (!(shares > 0) || shares * price < MIN_TRADE - 1e-9)
    return fail(`Trades must be at least $${MIN_TRADE}.`);

  const notional = round(shares * price);
  let realized: number | undefined;
  if (req.side === "buy") {
    if (notional > p.cash + 1e-9)
      return fail(`Not enough practice cash: you have $${p.cash.toFixed(2)}.`);
    const before = held ?? { shares: 0, avgCost: 0 };
    const total = before.shares + shares;
    p.positions[security.symbol] = {
      ...before,
      shares: floorShares(total),
      avgCost: round(
        (before.shares * before.avgCost + shares * price) / total,
        4,
      ),
    };
    p.cash = round(p.cash - notional);
  } else {
    if (!held || held.shares <= 0)
      return fail(`You don't own any ${security.symbol}.`);
    shares = Math.min(shares, held.shares);
    realized = round((price - held.avgCost) * shares);
    const remaining = floorShares(held.shares - shares);
    if (remaining <= 0) delete p.positions[security.symbol];
    else p.positions[security.symbol] = { ...held, shares: remaining };
    p.cash = round(p.cash + round(shares * price));
    p.realized = round(p.realized + realized);
  }
  const order: Order = {
    id: randomUUID(),
    symbol: security.symbol,
    side: req.side,
    shares,
    price,
    notional: round(shares * price),
    at: new Date().toISOString(),
    source,
    status: "filled",
    ...(realized !== undefined ? { realized } : {}),
    ...(quote.marketOpen ? {} : { afterHours: true }),
    ...(req.clientKey ? { clientKey: req.clientKey } : {}),
  };
  record(p, order);
  return order;
}

function record(p: Portfolio, order: Order) {
  p.orders.unshift(order);
  if (p.orders.length > MAX_ORDERS) p.orders.length = MAX_ORDERS;
}

/** Sells any position whose stop-loss or take-profit price has been reached. */
export function checkTriggers(p: Portfolio, quotes: Record<string, Quote>) {
  const filled: Order[] = [];
  for (const [symbol, pos] of Object.entries(p.positions)) {
    const quote = quotes[symbol];
    if (!quote) continue;
    const source: OrderSource | null =
      pos.stopLoss !== undefined && quote.price <= pos.stopLoss
        ? "stop_loss"
        : pos.takeProfit !== undefined && quote.price >= pos.takeProfit
          ? "take_profit"
          : null;
    if (source)
      filled.push(
        placeOrder(p, { symbol, side: "sell", shares: "all", source }, quote),
      );
  }
  return filled;
}

export function nextRun(from: string, cadence: Cadence) {
  const d = new Date(`${from}T12:00:00Z`);
  if (cadence === "monthly") {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  } else d.setUTCDate(d.getUTCDate() + (cadence === "weekly" ? 7 : 14));
  return d.toISOString().slice(0, 10);
}

/** Runs each due auto-invest rule once per scheduled date, then reschedules it. */
export function runRules(
  p: Portfolio,
  quotes: Record<string, Quote>,
  today: string,
) {
  const orders: Order[] = [];
  for (const rule of p.rules) {
    if (!rule.active || rule.nextRunOn > today) continue;
    orders.push(
      placeOrder(
        p,
        {
          symbol: rule.symbol,
          side: "buy",
          amount: rule.amount,
          source: "rule",
          clientKey: `rule:${rule.id}:${rule.nextRunOn}`,
        },
        quotes[rule.symbol],
      ),
    );
    // Missed runs aren't back-filled: skip ahead to the next future date.
    while (rule.nextRunOn <= today)
      rule.nextRunOn = nextRun(rule.nextRunOn, rule.cadence);
  }
  return orders;
}

export function valuation(p: Portfolio, quotes: Record<string, Quote>) {
  const positions = Object.entries(p.positions).map(([symbol, pos]) => {
    const price = quotes[symbol]?.price;
    const value = price
      ? round(pos.shares * price)
      : round(pos.shares * pos.avgCost);
    return {
      symbol,
      name: findSecurity(symbol)?.name ?? symbol,
      ...pos,
      price: price ?? null,
      value,
      gain: round(value - pos.shares * pos.avgCost),
      dayChange: price
        ? round(pos.shares * (price - quotes[symbol].previousClose))
        : 0,
    };
  });
  const invested = positions.reduce((s, x) => s + x.value, 0);
  const total = round(p.cash + invested);
  const benchmarkNow = quotes.VOO?.price;
  return {
    cash: p.cash,
    invested: round(invested),
    total,
    gain: round(total - p.startingCash),
    gainPct: round(((total - p.startingCash) / p.startingCash) * 100),
    realized: p.realized,
    benchmarkPct:
      p.benchmarkStart && benchmarkNow
        ? round(((benchmarkNow - p.benchmarkStart) / p.benchmarkStart) * 100)
        : null,
    positions,
  };
}
