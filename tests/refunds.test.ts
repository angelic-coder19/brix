import test from "node:test";
import assert from "node:assert/strict";
import { detectRefund, guessFunding } from "../lib/refunds/detect";
import { interestOver, planRefund, returnDeadline } from "../lib/refunds/plan";
import type { Charge, Refund } from "../lib/types";

const deposit = (name: string, amount = -1850, primary?: string) => ({
  transaction_id: "tx1",
  amount,
  date: "2026-10-15",
  name,
  personal_finance_category: primary ? { primary } : null,
});

test("school aid refunds are detected; other deposits are not", () => {
  for (const name of [
    "PENN STATE BURSAR REFUND",
    "BANKMOBILE DISBURSEMENT",
    "UNIV OF MARYLAND FIN AID REFUND",
    "NELNET STUDENT ACCT REFUND",
    "TEMPLE UNIVERSITY STUDENT REFUND",
    "SCHOLARSHIP DISB COLLEGE OF NJ",
  ])
    assert.ok(detectRefund(deposit(name)), name);
  assert.ok(
    detectRefund(deposit("ROWAN COLLEGE ACH CREDIT", -900, "INCOME")),
    "school income",
  );
  for (const [name, amount] of [
    ["IRS TREAS 310 TAX REF", -1850],
    ["AMAZON REFUND", -250],
    ["VENMO CASHOUT REFUND", -400],
    ["PENN STATE BURSAR REFUND", -150], // too small
    ["PENN STATE BURSAR REFUND", 1850], // money out
    ["PAYROLL DIRECT DEP", -1850],
  ] as const)
    assert.equal(detectRefund(deposit(name, amount)), null, name);
  const r = detectRefund(deposit("PENN STATE BURSAR REFUND"))!;
  assert.deepEqual(
    { id: r.id, amount: r.amount, status: r.status, source: r.source },
    { id: "plaid-tx1", amount: 1850, status: "new", source: "plaid" },
  );
});

test("funding is guessed from the descriptor", () => {
  assert.equal(guessFunding("DIRECT LOAN REFUND"), "loan");
  assert.equal(guessFunding("PELL GRANT DISB"), "grant");
  assert.equal(guessFunding("SCHOLARSHIP REFUND"), "scholarship");
  assert.equal(guessFunding("LOAN AND GRANT REFUND"), "mixed");
  assert.equal(guessFunding("BURSAR REFUND"), "unknown");
});

const charges: Charge[] = [
  {
    id: "c1",
    kind: "subscription",
    merchant: "Spotify",
    amount: 12,
    frequency: "monthly",
    lastDate: null,
    nextDate: "2026-11-01",
    status: "active",
    source: "manual",
  },
];
const refund = (over: Partial<Refund> = {}): Refund => ({
  id: "r1",
  amount: 3000,
  receivedOn: "2026-10-15",
  source: "plaid",
  funding: "mixed",
  loanAmount: 1500,
  loanRate: 6,
  loanType: "unsubsidized",
  status: "new",
  ...over,
});
const inputs = {
  monthsUntilNext: 2,
  monthlyLiving: 300,
  currentSavings: 0,
  yearsUntilRepayment: 4,
};

test("plan covers essentials, buffer, returns borrowed money in the window, saves the rest", () => {
  const plan = planRefund(
    refund(),
    inputs,
    charges,
    new Date("2026-10-25T12:00:00Z"),
  );
  const by = Object.fromEntries(plan.steps.map((s) => [s.key, s.amount]));
  assert.equal(by.essentials, 624); // (300 + 12) * 2
  assert.equal(by.emergency, 500); // starter buffer, no savings yet
  assert.equal(by.return_loan, 1500);
  assert.equal(by.save, 376);
  const total = plan.steps.reduce((s, x) => s + x.amount, 0);
  assert.equal(
    Math.round(total * 100) / 100,
    3000,
    "every dollar is placed exactly once",
  );
  assert.equal(plan.returnBy, "2027-02-12");
  assert.equal(plan.interestAvoided, interestOver(1500, 6, 4));
  assert.ok(
    plan.notes.some((n) => /taxable/.test(n)),
    "grant/scholarship tax note",
  );
  assert.equal(
    plan.practiceAmount,
    3000,
    "practice is virtual and sized to the refund",
  );
});

test("after 120 days the plan suggests prepaying instead of returning", () => {
  const plan = planRefund(
    refund(),
    inputs,
    charges,
    new Date("2027-02-13T12:00:00Z"),
  );
  assert.ok(plan.steps.some((s) => s.key === "prepay_loan"));
  assert.ok(!plan.steps.some((s) => s.key === "return_loan"));
  assert.equal(plan.returnBy, undefined);
  const lastDay = planRefund(
    refund(),
    inputs,
    charges,
    new Date("2027-02-12T23:00:00Z"),
  );
  assert.ok(
    lastDay.steps.some((s) => s.key === "return_loan"),
    "deadline day counts",
  );
});

test("subsidized loans show no interest; missing rate asks for it; small refunds stay whole", () => {
  const sub = planRefund(
    refund({ loanType: "subsidized" }),
    inputs,
    charges,
    new Date("2026-10-20"),
  );
  assert.equal(sub.interestAvoided, undefined);
  assert.ok(sub.notes.some((n) => /Subsidized/.test(n)));
  const noRate = planRefund(
    refund({ loanRate: undefined }),
    inputs,
    charges,
    new Date("2026-10-20"),
  );
  assert.ok(noRate.notes.some((n) => /interest rate/.test(n)));
  const small = planRefund(
    refund({ amount: 400, loanAmount: 0, funding: "grant" }),
    inputs,
    charges,
  );
  assert.deepEqual(
    small.steps.map((s) => s.key),
    ["essentials"],
  );
  assert.equal(small.steps[0].amount, 400, "never plans more than the refund");
  assert.equal(returnDeadline("2026-01-01"), "2026-05-01");
  assert.equal(interestOver(1000, 0, 4), 0);
});
