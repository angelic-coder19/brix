import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getSecret, setSecret } from "./store";
export function hashPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must contain four digits.");
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}
export async function verifyUserPin(uid: string, pin: string) {
  const secret = await getSecret(uid);
  if (Number(secret.pinBlockedUntil || 0) > Date.now()) return false;
  const [salt, hash] = (secret.pinHash || "").split(":");
  const valid =
    /^\d{4}$/.test(pin) &&
    !!salt &&
    /^[a-f0-9]{64}$/.test(hash || "") &&
    timingSafeEqual(scryptSync(pin, salt, 32), Buffer.from(hash, "hex"));
  const attempts = valid
    ? 0
    : (Number(secret.pinBlockedUntil || 0) > 0
        ? 0
        : Number(secret.pinAttempts || 0)) + 1;
  await setSecret(uid, {
    pinAttempts: attempts,
    pinBlockedUntil: attempts >= 5 ? Date.now() + 15 * 60000 : 0,
  });
  return valid;
}
