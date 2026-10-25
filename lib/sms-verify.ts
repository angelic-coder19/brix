import { createHash } from "node:crypto";
import twilio from "twilio";
import { HttpError, isDemo } from "./auth";
import { adminDb } from "./firebase/admin";

// Twilio Verify is the SMS fallback for sign-in and phone linking. Sending a
// text costs money, so every send is limited per phone number and per IP.
const LIMITS = { phone: 5, ip: 10 } as const; // sends per hour
const E164 = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(raw: unknown) {
  const phone = typeof raw === "string" ? raw.replace(/[\s().-]/g, "") : "";
  if (!E164.test(phone))
    throw new HttpError(
      400,
      "Enter your number with the country code, e.g. +1 555 123 4567.",
    );
  return phone;
}

function client() {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token } = process.env;
  const service = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (isDemo() || !sid || !token || !service)
    throw new HttpError(503, "Text-message codes aren't available right now.");
  return twilio(sid, token).verify.v2.services(service);
}

/** Fixed one-hour window per key, stored server-side only. */
async function limit(kind: keyof typeof LIMITS, value: string) {
  const id = `${kind}_${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
  const ref = adminDb().doc(`smsLimits/${id}`);
  const window = Math.floor(Date.now() / 3600000);
  await adminDb().runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    const count = data?.window === window ? Number(data.count) + 1 : 1;
    if (count > LIMITS[kind])
      throw new HttpError(
        429,
        "Too many codes requested. Try again in an hour.",
      );
    tx.set(ref, { window, count });
  });
}

export async function sendCode(phone: string, ip: string) {
  const service = client();
  await limit("phone", phone);
  await limit("ip", ip || "unknown");
  try {
    await service.verifications.create({ to: phone, channel: "sms" });
  } catch {
    throw new HttpError(
      502,
      "We couldn't text that number. Check it and try again.",
    );
  }
}

/** True when Twilio approves the code. Codes expire after 10 minutes. */
export async function checkCode(phone: string, code: unknown) {
  if (typeof code !== "string" || !/^\d{4,10}$/.test(code))
    throw new HttpError(400, "Enter the code from the text message.");
  try {
    const check = await client().verificationChecks.create({ to: phone, code });
    return check.status === "approved";
  } catch {
    // Twilio answers 404 once a code expired or was already used.
    return false;
  }
}

export const clientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "";
