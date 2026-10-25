import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  addGiftCard,
  giftCardAlerts,
  giftCardSummary,
  updateGiftCard,
} from "../lib/giftcards";
import { nextDecision } from "../lib/next-decision";
import { sourcesFor } from "../lib/agent/sources";
import { deleteData, demoState, emptyState, getState } from "../lib/store";
import type { Charge } from "../lib/types";

const NOW = Date.parse("2026-10-25T12:00:00Z");
const day = (n: number) =>
  new Date(NOW + n * 86400000).toISOString().slice(0, 10);
const trial = (over: Partial<Charge> = {}): Charge => ({
  id: "t1",
  kind: "trial",
  merchant: "Notion",
  amount: 10,
  frequency: "monthly",
  lastDate: null,
  nextDate: day(3),
  status: "trial",
  source: "manual",
  ...over,
});

test("next decision: borrowed refund > ending trial > expiring gift card > bill > all clear", () => {
  const s = emptyState("u");
  assert.equal(nextDecision(s, NOW).kind, "clear");
  s.charges.push({
    ...trial({
      id: "c",
      kind: "subscription",
      merchant: "Spotify",
      status: "active",
      nextDate: day(2),
    }),
  });
  assert.equal(nextDecision(s, NOW).kind, "charge");
  s.giftCards = [
    {
      id: "g",
      merchant: "Target",
      balance: 40,
      expiresOn: day(10),
      addedOn: day(-1),
      status: "active",
    },
  ];
  assert.equal(nextDecision(s, NOW).kind, "gift_card");
  s.charges.push(trial());
  const t = nextDecision(s, NOW);
  assert.equal(t.kind, "trial");
  assert.match(t.title, /Notion starts billing \$10\.00/);
  s.refunds = [
    {
      id: "r",
      amount: 1850,
      receivedOn: day(-10),
      source: "plaid",
      funding: "mixed",
      loanAmount: 1200,
      status: "new",
    },
  ];
  const r = nextDecision(s, NOW);
  assert.equal(r.kind, "refund");
  assert.match(r.title, /\$1,200\.00 of your refund is borrowed/);
  s.refunds[0].receivedOn = day(-130); // window closed, but still unplanned
  assert.match(nextDecision(s, NOW).title, /refund arrived/);
  s.refunds[0].status = "dismissed";
  assert.equal(nextDecision(s, NOW).kind, "trial");
});

test("gift cards: summary totals, matches a store you pay, alerts once per threshold", () => {
  const s = emptyState("u");
  s.charges.push(
    trial({
      merchant: "Target Circle 360",
      kind: "subscription",
      status: "active",
    }),
  );
  s.giftCards = [
    {
      id: "a",
      merchant: "Target",
      balance: 40,
      expiresOn: day(10),
      addedOn: day(-1),
      status: "active",
    },
    {
      id: "b",
      merchant: "Starbucks",
      balance: 12.35,
      addedOn: day(-1),
      status: "active",
    },
    { id: "c", merchant: "Old", balance: 0, addedOn: day(-1), status: "used" },
  ];
  const sum = giftCardSummary(s, NOW);
  assert.equal(sum.total, 52.35);
  assert.deepEqual(
    sum.expiringSoon.map((g) => g.id),
    ["a"],
  );
  assert.equal(sum.matches[0]?.charge, "Target Circle 360");
  assert.equal(giftCardAlerts(s, NOW).length, 1);
  assert.equal(giftCardAlerts(s, NOW).length, 0, "same threshold alerts once");
  assert.equal(
    giftCardAlerts(s, NOW + 8 * 86400000).length,
    1,
    "3-day alert is separate",
  );
});

test("gift card add/spend validation and use-up", async () => {
  process.env.BRIX_DEMO_MODE = "true";
  const uid = `gift-${randomUUID()}`;
  try {
    await assert.rejects(
      addGiftCard(uid, { merchant: "", balance: 5 }),
      /Which store/,
    );
    await assert.rejects(
      addGiftCard(uid, { merchant: "X", balance: 0 }),
      /remaining balance/,
    );
    await assert.rejects(
      addGiftCard(uid, { merchant: "X", balance: 5, expiresOn: "2001-01-01" }),
      /future expiry/,
    );
    const card = await addGiftCard(uid, {
      merchant: "Chipotle",
      balance: "25",
    });
    await assert.rejects(
      updateGiftCard(uid, card.id, { spent: 30 }),
      /only has \$25\.00/,
    );
    assert.equal(
      (await updateGiftCard(uid, card.id, { spent: 10 })).balance,
      15,
    );
    assert.equal(
      (await updateGiftCard(uid, card.id, { spent: 15 })).status,
      "used",
    );
    const state = await getState(uid);
    assert.ok(state.events.some((e) => e.type === "gift_card_added"));
  } finally {
    await deleteData(uid);
  }
});

test("reply sources separate your data, Brix's math, outside news and general info", () => {
  assert.deepEqual(sourcesFor([]), ["General info, not your data"]);
  assert.deepEqual(sourcesFor(["get_upcoming_charges", "get_subscriptions"]), [
    "Your charges",
  ]);
  assert.deepEqual(sourcesFor(["plan_refund", "get_money_news"]), [
    "Brix's math (estimate)",
    "News: Google News",
  ]);
  assert.deepEqual(sourcesFor(["mark_to_cancel"]), ["Waits for your yes"]);
  assert.deepEqual(sourcesFor(["get_gift_cards"], true), [
    "Your gift cards (sample)",
  ]);
  assert.equal(demoState().giftCards?.length, 2, "demo has gift cards to show");
});
