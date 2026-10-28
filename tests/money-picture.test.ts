import test from "node:test";
import assert from "node:assert/strict";
import { moneyPicture } from "../lib/money-picture";
import { parseIncome } from "../lib/income";
import { coachFacts, sizeLine } from "../lib/practice/coach";
import { newPortfolio, valuation } from "../lib/practice/engine";
import { emptyState } from "../lib/store";
import type { Charge } from "../lib/types";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const charge = (over: Partial<Charge>): Charge => ({
  id: "c",
  kind: "subscription",
  merchant: "Spotify",
  amount: 12,
  frequency: "monthly",
  lastDate: null,
  nextDate: "2026-11-05",
  status: "active",
  source: "manual",
  ...over,
});

test("money picture: in minus subscriptions out minus set aside equals left", () => {
  const s = emptyState("u");
  s.income = [
    { id: "a", kind: "paycheck", amount: 300, frequency: "biweekly", receivedOn: "2026-10-01" },
    { id: "b", kind: "scholarship", amount: 500, frequency: "once", receivedOn: "2026-10-10" },
    // A one-time amount from another month doesn't count this month.
    { id: "c", kind: "other", amount: 999, frequency: "once", receivedOn: "2026-09-10" },
  ];
  s.refunds = [
    {
      id: "r",
      amount: 1850,
      receivedOn: "2026-10-18",
      source: "plaid",
      funding: "mixed",
      loanAmount: 1200,
      status: "planned",
      plan: {
        createdAt: "2026-10-18",
        inputs: { monthsUntilNext: 2, monthlyLiving: 100, currentSavings: 0, yearsUntilRepayment: 4 },
        steps: [
          { key: "essentials", label: "", amount: 200, reason: "" },
          { key: "return_loan", label: "", amount: 1200, reason: "" },
          { key: "emergency", label: "", amount: 300, reason: "" },
        ],
        notes: [],
        practiceAmount: 0,
      },
    },
  ];
  s.charges = [
    charge({ id: "1", amount: 12 }),
    charge({ id: "2", amount: 120, frequency: "annual" }),
    // Rows the student hid as "not a subscription" never count.
    charge({ id: "3", amount: 400, status: "cancelled", notSubscription: true }),
  ];
  const m = moneyPicture(s, NOW);
  assert.equal(m.month, "2026-10");
  assert.equal(m.byKind.paycheck, 650);
  assert.equal(m.byKind.scholarship, 500);
  assert.equal(m.byKind.refund, 1850);
  assert.equal(m.byKind.other, undefined);
  assert.equal(m.in, 3000);
  assert.equal(m.borrowed, 1200);
  assert.equal(m.out, 22);
  assert.equal(m.aside, 1500);
  assert.equal(m.left, 1478);
});

test("money in: kind, amount and frequency are checked", () => {
  const ok = parseIncome(
    { kind: "side_hustle", amount: "45.5", frequency: "weekly" },
    "2026-10-28",
  );
  assert.equal(ok.kind, "side_hustle");
  assert.equal(ok.amount, 45.5);
  assert.equal(ok.receivedOn, "2026-10-28");
  for (const bad of [
    { kind: "lottery", amount: 5, frequency: "weekly" },
    { kind: "paycheck", amount: 0, frequency: "weekly" },
    { kind: "paycheck", amount: 5, frequency: "daily" },
  ])
    assert.throws(() => parseIncome(bad, "2026-10-28"));
});

test("coach shows the trade's share of cash and of the portfolio", () => {
  const p = newPortfolio(1000, 500);
  const f = coachFacts(
    valuation(p, {}),
    { symbol: "VOO", side: "buy", amount: 250 },
    500,
  );
  assert.equal(f.tradePctOfCash, 25);
  assert.equal(f.tradePctOfPortfolio, 25);
  assert.equal(
    sizeLine(f),
    "This buy uses 25% of your cash and is 25% of your practice portfolio.",
  );
});
