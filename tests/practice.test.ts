import test from "node:test";
import assert from "node:assert/strict";
import {
  checkTriggers,
  newPortfolio,
  nextRun,
  placeOrder,
  runRules,
  valuation,
} from "../lib/practice/engine";
import { getQuotes, parseChart, type Quote } from "../lib/market/quotes";
import { findSecurity } from "../lib/market/universe";

const q = (symbol: string, price: number, marketOpen = true): Quote => ({
  symbol,
  price,
  previousClose: price,
  at: new Date().toISOString(),
  marketOpen,
});

test("buys by dollars with fractional shares; sells track average cost and realised gain", () => {
  const p = newPortfolio(1000, 500);
  const buy = placeOrder(
    p,
    { symbol: "voo", side: "buy", amount: 100 },
    q("VOO", 600),
  );
  assert.equal(buy.shares, 0.1666);
  assert.equal(p.cash, 900.04);
  placeOrder(p, { symbol: "VOO", side: "buy", shares: 0.1666 }, q("VOO", 400));
  assert.equal(p.positions.VOO.avgCost, 500);
  const sell = placeOrder(
    p,
    { symbol: "VOO", side: "sell", shares: "all" },
    q("VOO", 550),
  );
  assert.equal(sell.realized, 16.66);
  assert.equal(p.positions.VOO, undefined);
  assert.equal(p.realized, 16.66);
  assert.equal(
    Math.round((p.cash - 1000) * 100) / 100,
    16.66,
    "cash reflects the gain",
  );
});

test("manual orders reject bad input; nothing fills without a price", () => {
  const p = newPortfolio(100);
  assert.throws(
    () =>
      placeOrder(p, { symbol: "GME", side: "buy", amount: 10 }, q("GME", 20)),
    /practice list/,
  );
  assert.throws(
    () => placeOrder(p, { symbol: "VOO", side: "buy", amount: 10 }, undefined),
    /No live price/,
  );
  assert.throws(
    () =>
      placeOrder(p, { symbol: "VOO", side: "buy", amount: 500 }, q("VOO", 600)),
    /Not enough practice cash/,
  );
  assert.throws(
    () =>
      placeOrder(p, { symbol: "VOO", side: "buy", amount: 0.5 }, q("VOO", 600)),
    /at least \$1/,
  );
  assert.throws(
    () =>
      placeOrder(p, { symbol: "VOO", side: "sell", amount: 5 }, q("VOO", 600)),
    /don't own/,
  );
  assert.equal(p.orders.length, 0);
  assert.equal(p.cash, 100);
  assert.throws(() => newPortfolio(50), /\$100/);
});

test("client keys make retries safe; after-hours fills are labelled", () => {
  const p = newPortfolio(1000);
  const a = placeOrder(
    p,
    { symbol: "AAPL", side: "buy", amount: 50, clientKey: "k1" },
    q("AAPL", 250, false),
  );
  const b = placeOrder(
    p,
    { symbol: "AAPL", side: "buy", amount: 50, clientKey: "k1" },
    q("AAPL", 250),
  );
  assert.equal(a.id, b.id);
  assert.equal(p.orders.length, 1);
  assert.equal(a.afterHours, true);
});

test("stop-loss and take-profit close positions; automated failures are recorded", () => {
  const p = newPortfolio(1000);
  placeOrder(p, { symbol: "NVDA", side: "buy", amount: 200 }, q("NVDA", 100));
  placeOrder(p, { symbol: "AAPL", side: "buy", amount: 200 }, q("AAPL", 100));
  p.positions.NVDA.stopLoss = 90;
  p.positions.AAPL.takeProfit = 120;
  assert.equal(
    checkTriggers(p, { NVDA: q("NVDA", 95), AAPL: q("AAPL", 110) }).length,
    0,
  );
  const fired = checkTriggers(p, { NVDA: q("NVDA", 89), AAPL: q("AAPL", 121) });
  assert.deepEqual(fired.map((o) => o.source).sort(), [
    "stop_loss",
    "take_profit",
  ]);
  assert.deepEqual(p.positions, {});
  const broke = newPortfolio(100);
  broke.rules.push({
    id: "r",
    symbol: "VOO",
    amount: 500,
    cadence: "weekly",
    nextRunOn: "2026-10-25",
    active: true,
    createdAt: "",
  });
  const [rejected] = runRules(broke, { VOO: q("VOO", 600) }, "2026-10-25");
  assert.equal(rejected.status, "rejected");
  assert.match(rejected.reason!, /Not enough/);
});

test("auto-invest rules run once per date and reschedule without back-filling", () => {
  const p = newPortfolio(1000);
  p.rules.push({
    id: "r1",
    symbol: "VOO",
    amount: 25,
    cadence: "weekly",
    nextRunOn: "2026-10-01",
    active: true,
    createdAt: "",
  });
  const first = runRules(p, { VOO: q("VOO", 500) }, "2026-10-25");
  assert.equal(first.length, 1, "missed weeks are not back-filled");
  assert.equal(p.rules[0].nextRunOn, "2026-10-29");
  assert.equal(
    runRules(p, { VOO: q("VOO", 500) }, "2026-10-25").length,
    0,
    "same day runs once",
  );
  assert.equal(nextRun("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(nextRun("2026-10-25", "biweekly"), "2026-11-08");
});

test("valuation compares against the S&P 500 benchmark", () => {
  const p = newPortfolio(1000, 500);
  placeOrder(p, { symbol: "AAPL", side: "buy", amount: 500 }, q("AAPL", 100));
  const v = valuation(p, { AAPL: q("AAPL", 110), VOO: q("VOO", 525) });
  assert.equal(v.total, 1050);
  assert.equal(v.gainPct, 5);
  assert.equal(v.benchmarkPct, 5);
  assert.equal(v.positions[0].gain, 50);
});

test("Yahoo chart parsing, unknown symbols, and demo sample prices", async () => {
  const quote = parseChart(
    "VOO",
    {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 698.58,
              chartPreviousClose: 702.3,
              regularMarketTime: 1792785600,
              currentTradingPeriod: { regular: { start: 100, end: 200 } },
            },
          },
        ],
      },
    },
    150_000,
  );
  assert.deepEqual(
    {
      price: quote?.price,
      prev: quote?.previousClose,
      open: quote?.marketOpen,
    },
    { price: 698.58, prev: 702.3, open: true },
  );
  assert.equal(
    parseChart("X", { chart: { result: null, error: { code: "Not Found" } } }),
    null,
  );
  assert.equal(findSecurity(" brk.b ")?.symbol, "BRK-B");
  process.env.BRIX_DEMO_MODE = "false";
  const live = await getQuotes(["VOO", "AAPL"], async (input) =>
    String(input).includes("/VOO?")
      ? Response.json({
          chart: { result: [{ meta: { regularMarketPrice: 600 } }] },
        })
      : new Response("down", { status: 503 }),
  );
  assert.deepEqual(Object.keys(live), ["VOO"], "no quote, no entry");
  process.env.BRIX_DEMO_MODE = "true";
  const demo = await getQuotes(["VOO"], async () =>
    assert.fail("demo must not fetch"),
  );
  assert.equal(demo.VOO.sample, true);
});
