import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRecurring, predictNextDate } from "../lib/recurring";
test("monthly date prediction clamps end of month and skips past renewals", () => {
  assert.equal(
    predictNextDate("2026-01-31", "monthly", new Date("2026-02-01")),
    "2026-02-28",
  );
  assert.equal(
    predictNextDate("2026-01-31", "monthly", new Date("2026-03-01")),
    "2026-03-31",
  );
});
test("normalizes only active positive outflow streams and preserves provenance", () => {
  const input = {
    stream_id: "one",
    merchant_name: "Spotify",
    average_amount: { amount: 11.999 },
    frequency: "MONTHLY",
    last_date: "2026-10-01",
    predicted_next_date: "2026-11-01",
    is_active: true,
  };
  const charges = normalizeRecurring([
    input,
    { ...input, is_active: false },
    { ...input, average_amount: { amount: -10 } },
  ]);
  assert.equal(charges.length, 1);
  assert.equal(charges[0].amount, 12);
  assert.equal(charges[0].source, "plaid");
  assert.equal(charges[0].nextDate, "2026-11-01");
});

test("bank descriptors become readable merchant names", async () => {
  const { cleanDescriptor } = await import("../lib/recurring");
  assert.equal(cleanDescriptor("OPENAI *CHATGPT SUBSCR"), "ChatGPT");
  assert.equal(cleanDescriptor("NETFLIX.COM 866-579-7172"), "Netflix");
  assert.equal(cleanDescriptor("SQ *BLUE BOTTLE COFFEE"), "Blue Bottle Coffee");
  assert.equal(cleanDescriptor("GYM MEMBERSHIP PMT 0423"), "Gym Membership");
  assert.equal(cleanDescriptor(""), "");
});
