import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { HttpError, isDemo } from "../auth";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const OAUTH_COOKIE = "brix_gmail_oauth";
export function emailConfig() {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET;
  const rawKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  const appUrl = process.env.APP_URL;
  if (!clientId || !clientSecret || !rawKey || !appUrl)
    throw new HttpError(
      503,
      "Gmail import needs server OAuth configuration. See docs/email-import.md.",
    );
  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32)
    throw new HttpError(
      503,
      "Gmail token encryption key is not configured correctly.",
    );
  const origin = new URL(appUrl);
  if (
    origin.protocol !== "https:" &&
    !(
      origin.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(origin.hostname)
    )
  )
    throw new HttpError(
      503,
      "Gmail requires an HTTPS app URL outside localhost.",
    );
  return {
    clientId,
    clientSecret,
    key,
    origin: origin.origin,
    callback: `${origin.origin}/api/email/callback`,
    secure: origin.protocol === "https:",
  };
}
export function configured() {
  try {
    emailConfig();
    return true;
  } catch {
    return false;
  }
}
export function requireLiveEmail() {
  if (isDemo())
    throw new HttpError(
      409,
      "Gmail import requires signing in to your own account with demo mode disabled.",
    );
}
export function encrypt(value: string, purpose: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", emailConfig().key, iv);
  cipher.setAAD(Buffer.from(purpose));
  return Buffer.concat([
    iv,
    cipher.update(value, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64url");
}
export function decrypt(value: string, purpose: string) {
  try {
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length < 29) throw new Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      emailConfig().key,
      bytes.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([
      decipher.update(bytes.subarray(12, -16)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new HttpError(
      400,
      "Gmail authorization expired or is invalid. Start again from Connections.",
    );
  }
}
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function equal(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function oauthCookie(value: string, maxAge = 600) {
  return `${OAUTH_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/api/email; Max-Age=${maxAge}${emailConfig().secure ? "; Secure" : ""}`;
}
