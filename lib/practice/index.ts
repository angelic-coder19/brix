import { randomUUID } from "node:crypto";
import { HttpError } from "../auth";
import { BENCHMARK, findSecurity, UNIVERSE } from "../market/universe";
import { getQuotes } from "../market/quotes";
import {
  getPortfolio,
  getState,
  listPortfolioOwners,
  updatePortfolio,
  updateState,
} from "../store";
import {
  checkTriggers,
  MAX_RULES,
  MAX_STARTING_CASH,
  newPortfolio,
  placeOrder,
  runRules,
  valuation,
  type Cadence,
  type Order,
  type OrderRequest,
  type Portfolio,
} from "./engine";

const CADENCES: Cadence[] = ["weekly", "biweekly", "monthly"];
const today = () => new Date().toISOString().slice(0, 10);
const symbolsOf = (p: Portfolio) => [
  BENCHMARK,
  ...Object.keys(p.positions),
  ...p.rules.filter((r) => r.active).map((r) => r.symbol),
];

function money(value: unknown, field: string, min: number, max: number) {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
    throw new HttpError(
      400,
      `${field} must be between $${min} and $${max.toLocaleString("en-US")}.`,
    );
  return Math.round(n * 100) / 100;
}

/** Logs automated fills so they show up in the activity feed. */
async function logAutomated(uid: string, orders: Order[]) {
  const auto = orders.filter((o) => o.source !== "manual");
  if (!auto.length) return;
  await updateState(uid, (s) => {
    for (const o of auto)
      s.events.unshift({
        id: randomUUID(),
        type: "practice_auto",
        channel: "system",
        text:
          o.status === "filled"
            ? `Practice ${o.source === "rule" ? "auto-invest" : o.source.replace("_", "-")}: ${o.side === "buy" ? "bought" : "sold"} ${o.shares} ${o.symbol} at $${o.price.toFixed(2)}.`
            : `Practice ${o.source.replace("_", " ")} for ${o.symbol} didn't run: ${o.reason}`,
        createdAt: new Date().toISOString(),
      });
  });
}

/** The portfolio with live prices. Due stop-loss and take-profit orders run first. */
export async function practiceView(uid: string) {
  let portfolio = await getPortfolio(uid);
  if (!portfolio)
    return {
      portfolio: null,
      universe: UNIVERSE,
      suggestedStart: await suggestedStart(uid),
    };
  const quotes = await getQuotes(symbolsOf(portfolio));
  const triggered = await updatePortfolio(uid, (p) => {
    if (!p) return { portfolio: null, result: [] as Order[] };
    return { portfolio: p, result: checkTriggers(p, quotes) };
  });
  if (triggered.length) {
    await logAutomated(uid, triggered);
    portfolio = (await getPortfolio(uid))!;
  }
  return {
    portfolio: {
      ...valuation(portfolio, quotes),
      startingCash: portfolio.startingCash,
      createdAt: portfolio.createdAt,
      refundId: portfolio.refundId ?? null,
      orders: portfolio.orders.slice(0, 50),
      rules: portfolio.rules,
    },
    quotes,
    universe: UNIVERSE,
    sample: Object.values(quotes).some((q) => q.sample),
  };
}

async function suggestedStart(uid: string) {
  const refund = (await getState(uid)).refunds?.find(
    (r) => r.status !== "dismissed",
  );
  return refund
    ? { amount: Math.round(refund.amount), refundId: refund.id }
    : { amount: 1000, refundId: null };
}

export async function startPractice(
  uid: string,
  body: Record<string, unknown>,
) {
  let cash = 1000,
    refundId: string | undefined;
  if (typeof body.refundId === "string") {
    const refund = (await getState(uid)).refunds?.find(
      (r) => r.id === body.refundId,
    );
    if (!refund) throw new HttpError(404, "That refund doesn't exist.");
    cash = Math.min(
      MAX_STARTING_CASH,
      Math.max(100, Math.round(refund.amount)),
    );
    refundId = refund.id;
  } else if (body.startingCash !== undefined)
    cash = money(body.startingCash, "Practice money", 100, MAX_STARTING_CASH);
  const benchmark = (await getQuotes([BENCHMARK]))[BENCHMARK]?.price;
  await updatePortfolio(uid, (p) => {
    if (p)
      throw new HttpError(
        409,
        "You already have a practice portfolio. Reset it first.",
      );
    return { portfolio: newPortfolio(cash, benchmark, refundId), result: null };
  });
  return practiceView(uid);
}

export async function resetPractice(uid: string) {
  await updatePortfolio(uid, () => ({ portfolio: null, result: null }));
}

export async function practiceOrder(
  uid: string,
  body: Record<string, unknown>,
) {
  const security = findSecurity(body.symbol);
  if (!security)
    throw new HttpError(400, "Choose a symbol from Brix's practice list.");
  const req: OrderRequest = {
    symbol: security.symbol,
    side:
      body.side === "sell"
        ? "sell"
        : body.side === "buy"
          ? "buy"
          : (undefined as never),
    ...(body.shares === "all"
      ? { shares: "all" as const }
      : typeof body.shares === "number"
        ? { shares: body.shares }
        : { amount: money(body.amount, "Amount", 1, MAX_STARTING_CASH) }),
    ...(typeof body.clientKey === "string" &&
    /^[\w-]{1,100}$/.test(body.clientKey)
      ? { clientKey: body.clientKey }
      : {}),
  };
  if (!req.side) throw new HttpError(400, "Choose buy or sell.");
  const quote = (await getQuotes([security.symbol]))[security.symbol];
  return updatePortfolio(uid, (p) => {
    if (!p) throw new HttpError(409, "Start a practice portfolio first.");
    return { portfolio: p, result: placeOrder(p, req, quote) };
  });
}

export async function setStops(
  uid: string,
  symbol: string,
  body: Record<string, unknown>,
) {
  const security = findSecurity(symbol);
  if (!security) throw new HttpError(404, "Unknown symbol.");
  const price = (await getQuotes([security.symbol]))[security.symbol]?.price;
  const parse = (v: unknown, field: string) =>
    v === null || v === "" || v === undefined
      ? undefined
      : money(v, field, 0.01, 1000000);
  const stopLoss = parse(body.stopLoss, "Stop-loss");
  const takeProfit = parse(body.takeProfit, "Take-profit");
  if (price && stopLoss !== undefined && stopLoss >= price)
    throw new HttpError(
      400,
      `A stop-loss must be below today's price ($${price.toFixed(2)}).`,
    );
  if (price && takeProfit !== undefined && takeProfit <= price)
    throw new HttpError(
      400,
      `A take-profit must be above today's price ($${price.toFixed(2)}).`,
    );
  await updatePortfolio(uid, (p) => {
    const pos = p?.positions[security.symbol];
    if (!p || !pos)
      throw new HttpError(404, `You don't own any ${security.symbol}.`);
    if (stopLoss === undefined) delete pos.stopLoss;
    else pos.stopLoss = stopLoss;
    if (takeProfit === undefined) delete pos.takeProfit;
    else pos.takeProfit = takeProfit;
    return { portfolio: p, result: null };
  });
}

export async function addRule(uid: string, body: Record<string, unknown>) {
  const security = findSecurity(body.symbol);
  if (!security)
    throw new HttpError(400, "Choose a symbol from Brix's practice list.");
  const cadence = body.cadence as Cadence;
  if (!CADENCES.includes(cadence))
    throw new HttpError(400, "Choose weekly, every two weeks, or monthly.");
  const amount = money(body.amount, "Each purchase", 1, 10000);
  const startOn =
    typeof body.startOn === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.startOn) &&
    body.startOn >= today()
      ? body.startOn
      : today();
  return updatePortfolio(uid, (p) => {
    if (!p) throw new HttpError(409, "Start a practice portfolio first.");
    if (p.rules.length >= MAX_RULES)
      throw new HttpError(
        409,
        `You can have up to ${MAX_RULES} auto-invest rules.`,
      );
    const rule = {
      id: randomUUID(),
      symbol: security.symbol,
      amount,
      cadence,
      nextRunOn: startOn,
      active: true,
      createdAt: new Date().toISOString(),
    };
    p.rules.push(rule);
    return { portfolio: p, result: rule };
  });
}

export async function updateRule(
  uid: string,
  id: string,
  body: Record<string, unknown>,
) {
  return updatePortfolio(uid, (p) => {
    const rule = p?.rules.find((r) => r.id === id);
    if (!p || !rule) throw new HttpError(404, "That rule doesn't exist.");
    if (body.delete === true) {
      p.rules = p.rules.filter((r) => r.id !== id);
      return { portfolio: p, result: null };
    }
    if (typeof body.active === "boolean") rule.active = body.active;
    if (body.amount !== undefined)
      rule.amount = money(body.amount, "Each purchase", 1, 10000);
    return { portfolio: p, result: rule };
  });
}

/** Daily job: run due auto-invest rules and stop/take-profit orders for everyone. */
export async function runPracticeJob() {
  let filled = 0,
    rejected = 0;
  const day = today();
  for (const uid of await listPortfolioOwners()) {
    const p = await getPortfolio(uid);
    if (!p) continue;
    const quotes = await getQuotes(symbolsOf(p));
    const orders = await updatePortfolio(uid, (current) => {
      if (!current) return { portfolio: null, result: [] as Order[] };
      return {
        portfolio: current,
        result: [
          ...checkTriggers(current, quotes),
          ...runRules(current, quotes, day),
        ],
      };
    });
    filled += orders.filter((o) => o.status === "filled").length;
    rejected += orders.filter((o) => o.status === "rejected").length;
    await logAutomated(uid, orders);
  }
  return { filled, rejected };
}
