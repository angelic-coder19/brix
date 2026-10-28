import { HttpError, isDemo } from "../auth";
import { runAnthropicTurn } from "../agent/anthropic";
import { sourcesFor } from "../agent/sources";
import { executeTool } from "../tools";
import { BENCHMARK, findSecurity, type Security } from "../market/universe";
import { getQuotes } from "../market/quotes";
import { getPortfolio } from "../store";
import { valuation } from "./engine";

// A pre-trade check shown in the review step. It explains and simulates; it
// never recommends a security or tells the student to buy or sell. The
// allocation and what-if lines are computed here from real numbers; the
// model only writes the two plain-language lines, and only from these facts.

export interface CoachTrade {
  symbol: string;
  side: "buy" | "sell";
  amount: number;
}
export interface CoachFacts {
  symbol: string;
  name: string;
  kind: Security["kind"];
  side: "buy" | "sell";
  amount: number;
  price: number;
  total: number;
  cash: number;
  symbolBefore: number;
  symbolAfter: number;
  /** Percent of the practice portfolio, before and after the trade. */
  symbolPctBefore: number;
  symbolPctAfter: number;
  cashPctBefore: number;
  cashPctAfter: number;
  holdingsAfter: number;
  dropPct: number;
  dropLoss: number;
  totalAfterDrop: number;
  portfolioDropPct: number;
}
export interface CoachCheck {
  bet: string | null;
  risk: string | null;
  allocation: string;
  whatIf: string;
  /** False when the agent could not write its lines; the trade still works. */
  available: boolean;
  sources: string[];
}

const DROP = 20;
// Read-only tools the coach may use. Everything else, including any tool
// that would propose an action, is refused before it runs.
const COACH_TOOLS = new Set(["get_portfolio", "get_stock_news"]);
const round = (n: number) => Math.round(n * 100) / 100;
const pct1 = (n: number) => Math.round(n * 10) / 10;
const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Allocation and a 20% drop for the pending trade, from the real portfolio. */
export function coachFacts(
  portfolio: ReturnType<typeof valuation>,
  trade: CoachTrade,
  price: number,
): CoachFacts {
  const security = findSecurity(trade.symbol);
  if (!security) throw new HttpError(400, "Choose a symbol from the list.");
  const total = portfolio.total;
  const held =
    portfolio.positions.find((p) => p.symbol === security.symbol)?.value ?? 0;
  const amount =
    trade.side === "buy"
      ? Math.min(trade.amount, Math.max(0, portfolio.cash))
      : Math.min(trade.amount, held);
  const symbolAfter = round(
    trade.side === "buy" ? held + amount : held - amount,
  );
  const cashAfter = round(
    trade.side === "buy" ? portfolio.cash - amount : portfolio.cash + amount,
  );
  const share = (n: number) => (total > 0 ? pct1((n / total) * 100) : 0);
  const others = portfolio.positions.filter(
    (p) => p.symbol !== security.symbol && p.value > 0,
  ).length;
  const dropLoss = round((symbolAfter * DROP) / 100);
  return {
    symbol: security.symbol,
    name: security.name,
    kind: security.kind,
    side: trade.side,
    amount: round(amount),
    price,
    total,
    cash: portfolio.cash,
    symbolBefore: round(held),
    symbolAfter,
    symbolPctBefore: share(held),
    symbolPctAfter: share(symbolAfter),
    cashPctBefore: share(portfolio.cash),
    cashPctAfter: share(cashAfter),
    holdingsAfter: others + (symbolAfter > 0 ? 1 : 0),
    dropPct: DROP,
    dropLoss,
    totalAfterDrop: round(total - dropLoss),
    portfolioDropPct: share(dropLoss),
  };
}

export function allocationLine(f: CoachFacts) {
  return `${f.symbol} goes from ${f.symbolPctBefore}% to ${f.symbolPctAfter}% of your practice portfolio, and cash goes from ${f.cashPctBefore}% to ${f.cashPctAfter}%. You'd own ${f.holdingsAfter} ${f.holdingsAfter === 1 ? "thing" : "things"} after this.`;
}

export function whatIfLine(f: CoachFacts) {
  if (f.symbolAfter <= 0)
    return `After this you'd own no ${f.symbol}, so a ${f.dropPct}% drop in it wouldn't change your ${usd(f.total)} portfolio.`;
  return `If ${f.symbol} falls ${f.dropPct}%, your ${usd(f.symbolAfter)} in it drops about ${usd(f.dropLoss)}, and your portfolio goes from ${usd(f.total)} to about ${usd(f.totalAfterDrop)} (down ${f.portfolioDropPct}%).`;
}

// Phrases that would turn an explanation into advice. A reply with any of
// them is thrown away rather than shown.
export const ADVICE =
  /\b(you should|i('d| would)? (recommend|suggest)|recommend(ed)? (buying|selling|holding)|consider (buying|selling)|go ahead and|(good|bad|smart|great) (buy|pick|time to buy)|don'?t (buy|sell)|(buy|sell) (it|now|more))\b/i;

/** Every number the model writes must already be in the facts or the name. */
export function onlyKnownNumbers(text: string, facts: CoachFacts | string) {
  const source = typeof facts === "string" ? facts : JSON.stringify(facts);
  const known = new Set(
    (source.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => Number(n)),
  );
  return (text.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? []).every((n) =>
    known.has(Number(n)),
  );
}

export function parseCoachReply(reply: string, facts: CoachFacts) {
  const line = (label: string) =>
    reply
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.toUpperCase().startsWith(`${label}:`))
      ?.slice(label.length + 1)
      .trim() || null;
  const safe = (text: string | null) =>
    text &&
    text.length <= 400 &&
    !ADVICE.test(text) &&
    onlyKnownNumbers(text, facts)
      ? text
      : null;
  return { bet: safe(line("BET")), risk: safe(line("RISK")) };
}

/** Offline lines for the demo, by kind of security. Always labelled sample. */
function demoLines(f: CoachFacts) {
  if (f.kind === "bond fund")
    return {
      bet: `With ${f.name} you're betting on steady interest from lots of loans to governments and companies.`,
      risk: "When interest rates rise, bond prices usually dip, and over long stretches bonds tend to grow slower than stocks.",
    };
  if (f.kind === "index fund")
    return {
      bet: `With ${f.name} you're betting on a whole basket of companies, so no single one makes or breaks it.`,
      risk: "When the whole market drops, this drops with it, and recoveries can take months or years.",
    };
  return {
    bet: `With ${f.name} you're betting on one company: that its business keeps growing and people keep wanting to own it.`,
    risk: "One company can fall hard on a single bad earnings report, lawsuit, or product miss, much faster than a broad fund.",
  };
}

const recent = new Map<string, { at: number; check: CoachCheck }>();
const CACHE_MS = 5 * 60 * 1000;

export async function coachCheck(
  uid: string,
  body: Record<string, unknown>,
): Promise<CoachCheck> {
  const security = findSecurity(body.symbol);
  const side = body.side;
  const amount = Number(body.amount);
  if (!security || (side !== "buy" && side !== "sell"))
    throw new HttpError(400, "Choose a symbol and buy or sell.");
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000)
    throw new HttpError(400, "Enter an amount above $0.");
  const p = await getPortfolio(uid);
  if (!p) throw new HttpError(409, "Start a practice portfolio first.");
  const quotes = await getQuotes([
    BENCHMARK,
    security.symbol,
    ...Object.keys(p.positions),
  ]);
  const price = quotes[security.symbol]?.price;
  if (!price) throw new HttpError(503, "No live price for that symbol yet.");
  const facts = coachFacts(
    valuation(p, quotes),
    { symbol: security.symbol, side, amount },
    price,
  );
  const base = {
    allocation: allocationLine(facts),
    whatIf: whatIfLine(facts),
  };
  const key = `${uid}|${JSON.stringify(facts)}`;
  const hit = recent.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.check;

  let check: CoachCheck;
  if (isDemo()) {
    check = {
      ...demoLines(facts),
      ...base,
      available: true,
      sources: [
        ...sourcesFor(["get_portfolio"], true),
        "Brix's math (estimate)",
        "General info, not your data",
      ],
    };
  } else {
    const used = new Set<string>();
    let lines: { bet: string | null; risk: string | null } = {
      bet: null,
      risk: null,
    };
    if (process.env.ANTHROPIC_API_KEY)
      try {
        const reply = await runAnthropicTurn(coachPrompt(facts), "system", [], (name, args) => {
          if (!COACH_TOOLS.has(name))
            throw new HttpError(400, "The coach can only read data.");
          used.add(name);
          return executeTool(uid, "system", name, args);
        });
        lines = parseCoachReply(reply, facts);
      } catch {
        // Fall through: the card says the check is unavailable.
      }
    const available = !!(lines.bet || lines.risk);
    check = {
      ...lines,
      ...base,
      available,
      sources: [
        ...new Set([
          ...sourcesFor(["get_portfolio"]),
          "Brix's math (estimate)",
          ...(available ? sourcesFor(used) : []),
        ]),
      ],
    };
  }
  if (recent.size > 500) recent.delete(recent.keys().next().value!);
  recent.set(key, { at: Date.now(), check });
  return check;
}

function coachPrompt(f: CoachFacts) {
  return [
    "Pre-trade check for the student's practice portfolio (virtual money, real prices). Explain and simulate only.",
    "Do not recommend any security. Do not tell the student to buy, sell, hold, or skip this or any trade.",
    `Facts computed by Brix (the only numbers you may use): ${JSON.stringify(f)}`,
    "You may read get_portfolio or get_stock_news if it helps; never propose an action.",
    "Reply with exactly two lines and nothing else:",
    `BET: one or two short sentences on what someone owning ${f.name} (${f.kind}) is betting on.`,
    "RISK: one or two short sentences on what could go wrong for it.",
    "Plain, friendly words for a college student. No numbers that are not in the facts.",
  ].join("\n");
}
