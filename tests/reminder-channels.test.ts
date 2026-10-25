import test from "node:test";
import assert from "node:assert/strict";
import { channelAllowed, pickChannel } from "../lib/tools/reminders";
import { emptyState } from "../lib/store";

test("reminders call at 2 days when allowed, else WhatsApp, else in-app", () => {
  process.env.BRIX_DEMO_MODE = "false";
  const s = emptyState("u");
  assert.equal(pickChannel(s, 2), "push");
  s.user.phoneE164 = "+15555550100";
  s.user.whatsappOptIn = true;
  assert.equal(pickChannel(s, 7), "whatsapp");
  assert.equal(pickChannel(s, 2), "whatsapp");
  s.user.callOptIn = true;
  assert.equal(pickChannel(s, 2), "call");
  assert.equal(pickChannel(s, 7), "whatsapp");
  s.user.callOptIn = false;
  assert.equal(channelAllowed(s, "call"), false);
  delete s.user.phoneE164;
  assert.equal(channelAllowed(s, "whatsapp"), false);
  assert.equal(channelAllowed(s, "push"), true);
  process.env.BRIX_DEMO_MODE = "true";
  s.user.callOptIn = true;
  assert.equal(pickChannel(s, 2), "push");
});
