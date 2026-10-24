import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMeta,
  daysUntil,
  isChargeImminent,
  isTapback,
  moodFor,
  reactionFor,
  suggestionsFor,
} from "../lib/agent/persona";

const NOW = Date.parse("2026-10-24T15:00:00Z");
const charges = [
  { merchant: "Netflix", nextDate: "2026-11-01", status: "active" },
  { merchant: "Spotify", nextDate: "2026-10-26", status: "active" },
  { merchant: "Hulu", nextDate: "2026-10-25", status: "to_cancel" },
  { merchant: "Old", nextDate: "2026-10-01", status: "active" },
];

test("daysUntil counts calendar days", () => {
  assert.equal(daysUntil("2026-10-24", NOW), 0);
  assert.equal(daysUntil("2026-10-27", NOW), 3);
  assert.equal(daysUntil("2026-10-20", NOW), -4);
});

test("imminence ignores cancelled and past charges", () => {
  assert.equal(isChargeImminent(charges, NOW), true);
  assert.equal(isChargeImminent(charges.slice(0, 1), NOW), false);
  assert.equal(isChargeImminent([], NOW), false);
});

test("tapbacks are a closed set", () => {
  assert.equal(isTapback("❤️"), true);
  assert.equal(isTapback("🎉"), false);
  assert.equal(isTapback(null), false);
  assert.equal(isTapback("<script>"), false);
});

test("bot reacts to confirmations and tone", () => {
  assert.equal(reactionFor("yes", "confirmed", "mark_to_cancel"), "🎉");
  assert.equal(reactionFor("yes", "confirmed", "set_reminder"), "⏰");
  assert.equal(reactionFor("no", "cleared"), "🫡");
  assert.equal(reactionFor("thanks Brix!", "answered"), "🙏");
  assert.equal(reactionFor("lol ok", "answered"), "😂");
  assert.equal(reactionFor("cancel spotify", "proposed"), "👀");
  assert.equal(reactionFor("what's coming up", "answered"), undefined);
});

test("mood tracks outcome and upcoming money", () => {
  assert.equal(moodFor("confirmed", "mark_to_cancel", charges, NOW), "celebrate");
  assert.equal(moodFor("proposed", undefined, charges, NOW), "listening");
  assert.equal(moodFor("answered", undefined, charges, NOW), "concerned");
  assert.equal(moodFor("answered", undefined, [], NOW), "happy");
});

test("suggestions offer yes/no while a proposal is pending", () => {
  assert.deepEqual(suggestionsFor(charges, true, NOW), ["Yes", "No"]);
  const list = suggestionsFor(charges, false, NOW);
  assert.ok(list.includes("Mark Spotify to cancel"));
  assert.ok(list.every((s) => s.length < 60));
});

test("buildMeta celebrates a confirmed cancellation only", () => {
  const meta = buildMeta({
    message: "yes",
    outcome: "confirmed",
    action: "mark_to_cancel",
    charges,
    hasPending: false,
    now: NOW,
  });
  assert.equal(meta.celebrate, true);
  assert.equal(meta.reaction, "🎉");
  assert.equal(
    buildMeta({ message: "hi", outcome: "answered", charges, hasPending: false, now: NOW })
      .celebrate,
    false,
  );
});
