import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeCharges } from "../lib/summary";
import type { Charge } from "../lib/types";

const charge = (over: Partial<Charge>): Charge =>
  ({
    id: Math.random().toString(36),
    kind: "subscription",
    merchant: "Spotify",
    amount: 10,
    frequency: "monthly",
    nextDate: "2026-11-01",
    status: "active",
    source: "manual",
    ...over,
  }) as Charge;

test("marking a charge to cancel lowers both the count and the monthly total", () => {
  const charges = [
    charge({ merchant: "Spotify", amount: 11.99 }),
    charge({ merchant: "Netflix", amount: 15.49 }),
    charge({ merchant: "Adobe", amount: 120, frequency: "annual" }),
  ];
  const before = summarizeCharges(charges);
  assert.equal(before.subscriptionCount, 3);
  assert.equal(before.monthly.toFixed(2), "37.48");

  charges[0].status = "to_cancel";
  charges[1].status = "cancelled";
  const after = summarizeCharges(charges);
  assert.equal(after.subscriptionCount, 1);
  assert.equal(after.monthly.toFixed(2), "10.00");
});

test("trials are counted separately and drop out once marked to cancel", () => {
  const charges = [
    charge({ kind: "trial", status: "trial", merchant: "Notion" }),
    charge({ kind: "trial", status: "to_cancel", merchant: "Max" }),
    charge({ merchant: "Spotify" }),
  ];
  const s = summarizeCharges(charges);
  assert.equal(s.trialCount, 1);
  assert.equal(s.subscriptionCount, 1);
  assert.equal(s.monthly, 10);
});
