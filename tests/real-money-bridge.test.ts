import test from "node:test";
import assert from "node:assert/strict";
import { brokerLinks } from "../lib/market/brokers";
import { parseRealHolding } from "../lib/practice/real";
import {
  allocationLine,
  coachFacts,
  parseCoachReply,
  whatIfLine,
} from "../lib/practice/coach";
import { lineFacts, parseLines, templateLine } from "../lib/news/lines";
import { newPortfolio, valuation } from "../lib/practice/engine";
import type { Quote } from "../lib/market/quotes";

const q = (symbol: string, price: number, previousClose = price): Quote => ({
  symbol,
  price,
  previousClose,
  at: new Date().toISOString(),
  marketOpen: true,
});

test("broker links carry the ticker and use the broker's spelling", () => {
  const links = brokerLinks("brk-b");
  assert.deepEqual(
    links.map((l) => l.broker),
    ["Robinhood", "Fidelity", "Cash App"],
  );
  assert.equal(links[0].url, "https://robinhood.com/us/en/stocks/BRK.B/");
  assert.match(links[1].url, /symbol=BRK\.B$/);
});

test("a real purchase must use a listed ticker, positive numbers and a past date", () => {
  const ok = parseRealHolding(
    {
      symbol: " voo ",
      shares: "1.5",
      pricePaid: 500.129,
      boughtOn: "2026-10-01",
      broker: " Fidelity ",
    },
    "2026-10-28",
  );
  assert.deepEqual(ok, {
    symbol: "VOO",
    shares: 1.5,
    pricePaid: 500.13,
    boughtOn: "2026-10-01",
    broker: "Fidelity",
  });
  const base = {
    symbol: "VOO",
    shares: 1,
    pricePaid: 1,
    boughtOn: "2026-10-01",
  };
  for (const bad of [
    { symbol: "GME" },
    { shares: 0 },
    { pricePaid: -3 },
    { boughtOn: "2026-11-01" },
    { boughtOn: "10/01/2026" },
    { broker: "x".repeat(41) },
  ])
    assert.throws(() => parseRealHolding({ ...base, ...bad }, "2026-10-28"));
});

test("coach math: allocation before and after, and a 20% drop from real numbers", () => {
  const p = newPortfolio(1000, 500);
  p.cash = 700;
  p.positions.VOO = { shares: 0.5, avgCost: 600 };
  const view = valuation(p, { VOO: q("VOO", 600) });
  const f = coachFacts(view, { symbol: "VOO", side: "buy", amount: 100 }, 600);
  assert.equal(f.total, 1000);
  assert.equal(f.symbolPctBefore, 30);
  assert.equal(f.symbolPctAfter, 40);
  assert.equal(f.cashPctAfter, 60);
  assert.equal(f.dropLoss, 80);
  assert.equal(f.totalAfterDrop, 920);
  assert.equal(f.portfolioDropPct, 8);
  assert.match(allocationLine(f), /VOO goes from 30% to 40%/);
  assert.match(
    whatIfLine(f),
    /drops about \$80\.00.*\$1,000\.00 to about \$920\.00/,
  );
  // A buy larger than the cash is capped at the cash, never invented.
  const big = coachFacts(
    view,
    { symbol: "VOO", side: "buy", amount: 5000 },
    600,
  );
  assert.equal(big.amount, 700);
  // Selling everything leaves nothing to drop.
  const out = coachFacts(
    view,
    { symbol: "VOO", side: "sell", amount: 300 },
    600,
  );
  assert.equal(out.symbolAfter, 0);
  assert.match(whatIfLine(out), /own no VOO/);
});

test("coach lines that give advice or invent numbers are thrown away", () => {
  const p = newPortfolio(1000, 500);
  const f = coachFacts(
    valuation(p, { VOO: q("VOO", 500) }),
    { symbol: "VOO", side: "buy", amount: 100 },
    500,
  );
  assert.deepEqual(
    parseCoachReply(
      "BET: You're betting on the 500 biggest US companies.\nRISK: When the market drops, this drops too.",
      f,
    ),
    {
      bet: "You're betting on the 500 biggest US companies.",
      risk: "When the market drops, this drops too.",
    },
  );
  const bad = parseCoachReply(
    "BET: I'd recommend buying more of this.\nRISK: It could fall 37% next year.",
    f,
  );
  assert.deepEqual(bad, { bet: null, risk: null });
});

test("news lines use the holding and the quote, and drop invented numbers", () => {
  const f = lineFacts(
    1,
    {
      symbol: "AAPL",
      title: "Apple slips after earnings",
      url: "https://example.com/a",
      publishedAt: new Date().toISOString(),
      source: "Yahoo",
    },
    1,
    194,
    200,
  );
  assert.equal(f.holdingValue, 194);
  assert.equal(f.dayChangePct, -3);
  assert.equal(f.dayChangeDollars, -6);
  assert.equal(
    templateLine(f),
    "AAPL is down 3% today, so your $194.00 in it is about $6.00 down.",
  );
  const kept = parseLines(
    "1: Apple is down 3% today, about $6 off your $194 position.",
    [f],
  );
  assert.equal(
    kept.get(1),
    "Apple is down 3% today, about $6 off your $194 position.",
  );
  assert.equal(parseLines("1: You could lose $50 on this.", [f]).size, 0);
  assert.equal(parseLines("1: You should sell it now.", [f]).size, 0);
});
