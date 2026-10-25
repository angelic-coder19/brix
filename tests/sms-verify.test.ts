import test from "node:test";
import assert from "node:assert/strict";
import {
  clientIp,
  normalizePhone,
  sendCode,
  checkCode,
} from "../lib/sms-verify";

test("phone numbers must be E.164; common separators are tolerated", () => {
  assert.equal(normalizePhone("+1 (814) 555-1234"), "+18145551234");
  assert.equal(normalizePhone("+234 808 903 1234"), "+2348089031234");
  for (const bad of ["", "8145551234", "+0123456789", "+1abc", 42, null])
    assert.throws(() => normalizePhone(bad), /country code/);
});

test("codes are validated before reaching Twilio; demo mode never texts", async () => {
  process.env.BRIX_DEMO_MODE = "true";
  await assert.rejects(checkCode("+18145551234", "abc"), /Enter the code/);
  await assert.rejects(sendCode("+18145551234", "1.2.3.4"), /aren't available/);
});

test("client IP comes from the first forwarded address", () => {
  const r = new Request("https://x.test", {
    headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" },
  });
  assert.equal(clientIp(r), "9.9.9.9");
});
