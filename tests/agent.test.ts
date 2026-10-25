import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { proposeAction, confirmAction, matchCharge } from "../lib/tools";
import { getState, deleteData, updateState, setSecret } from "../lib/store";
import { runReminders } from "../lib/tools/reminders";
import { hashPin } from "../lib/identity";
import { verifyVapi } from "../lib/vapi";

test("actions require a separate persisted confirmation, consumed once", async () => {
  process.env.BRIX_DEMO_MODE = "true";
  const uid = `test-${randomUUID()}`;
  try {
    await assert.rejects(confirmAction(uid, "web"), /No pending/);
    await proposeAction(uid, "web", "mark_to_cancel", {
      merchant: "Spotify",
      confirmed: true,
    });
    assert.equal((await getState(uid)).charges[0].status, "active");
    await assert.rejects(confirmAction(uid, "whatsapp"), /No pending/);
    const results = await Promise.allSettled([
      confirmAction(uid, "web"),
      confirmAction(uid, "web"),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const state = await getState(uid);
    assert.equal(state.charges[0].status, "to_cancel");
    assert.equal(
      state.events.filter((e) => e.type === "marked_cancel").length,
      1,
    );
  } finally {
    await deleteData(uid);
  }
});

test("card decimals accepted; voice requires PIN; only masked demo card is persisted", async () => {
  process.env.BRIX_DEMO_MODE = "true";
  const uid = `test-${randomUUID()}`;
  try {
    await setSecret(uid, { pinHash: hashPin("1234") });
    const proposal = await proposeAction(uid, "voice", "create_one_time_card", {
      purpose: "Trial",
      spendLimit: 1.1,
    });
    assert.match(
      proposal.reply,
      /Confirm this request in the Brix app with your PIN/,
    );
    assert.doesNotMatch(proposal.reply, /Reply yes/);
    await assert.rejects(confirmAction(uid, "voice"), /PIN/);
    await assert.rejects(confirmAction(uid, "voice", "0000"), /PIN/);
    assert.equal((await getState(uid)).cards.length, 0);
    await confirmAction(uid, "voice", "1234");
    const card = (await getState(uid)).cards[0];
    assert.equal(card.source, "mock");
    assert.equal(card.spendLimit, 1.1);
    assert.equal("lithicToken" in card, false);
  } finally {
    await deleteData(uid);
  }
});

test("expired confirmations cannot mutate; fuzzy ambiguity asks which merchant", async () => {
  process.env.BRIX_DEMO_MODE = "true";
  const uid = `test-${randomUUID()}`;
  try {
    await proposeAction(uid, "web", "mark_to_cancel", { merchant: "Spotify" });
    await updateState(uid, (s) => {
      s.pendingActions!.web!.expiresAt = "2000-01-01T00:00:00.000Z";
      s.charges.push({
        ...s.charges[0],
        id: "other",
        merchant: "Spotify Family",
      });
    });
    await assert.rejects(confirmAction(uid, "web"), /No pending/);
    const charges = (await getState(uid)).charges;
    assert.throws(() => matchCharge(charges, "spot"), /Which one/);
  } finally {
    await deleteData(uid);
  }
});

test("demo reminder jobs are idempotent and do not contact opted-in phones", async () => {
  process.env.BRIX_DEMO_MODE = "true";
  const uid = `test-${randomUUID()}`;
  try {
    await updateState(uid, (s) => {
      s.user.whatsappOptIn = true;
      s.user.phoneE164 = "+15555550100";
    });
    const results = await Promise.all([runReminders(uid), runReminders(uid)]);
    assert.equal(
      results.reduce((sum, r) => sum + r.sent, 0),
      0,
    );
    assert.equal(
      results.reduce((sum, r) => sum + r.inApp, 0),
      1,
    );
    assert.equal((await runReminders(uid)).inApp, 0);
  } finally {
    await deleteData(uid);
  }
});

test("Vapi rejects Unicode secret with mismatched byte length without throwing", () => {
  process.env.VAPI_SERVER_SECRET = "aa";
  assert.equal(
    verifyVapi(
      new Request("http://localhost", { headers: { "x-vapi-secret": "éé" } }),
    ),
    false,
  );
  assert.equal(
    verifyVapi(
      new Request("http://localhost", { headers: { "x-vapi-secret": "aa" } }),
    ),
    true,
  );
  delete process.env.VAPI_SERVER_SECRET;
});
