import { createHash, randomBytes, randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../firebase/admin";
import { HttpError, isDemo } from "../auth";
import { emptyState } from "../store";
import type { AppState, Charge } from "../types";
import {
  configured,
  decrypt,
  emailConfig,
  encrypt,
  equal,
  GMAIL_SCOPE,
  hash,
  OAUTH_COOKIE,
  requireLiveEmail,
} from "./security";
import { parseSubscriptionEmail, type GmailMessage } from "./parser";
import type { EmailCandidate, EmailStatus, GmailConnection } from "./types";

const secretRef = (uid: string) => adminDb().doc(`secrets/${uid}`);
async function connection(uid: string): Promise<GmailConnection | null> {
  return (await secretRef(uid).get()).data()?.gmail ?? null;
}
async function googleToken(
  params: Record<string, string>,
): Promise<{ access_token: string; refresh_token?: string; scope?: string }> {
  const { clientId, clientSecret } = emailConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...params,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new HttpError(
      502,
      "Google authorization is unavailable or expired. Reconnect Gmail and try again.",
    );
  const result = await response.json();
  if (typeof result.access_token !== "string")
    throw new HttpError(502, "Google did not return an access token.");
  return result;
}
async function gmail<T>(token: string, path: string): Promise<T> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/${path}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok)
    throw new HttpError(
      502,
      "Gmail could not be read. Check your permission or reconnect and try again.",
    );
  return response.json();
}
export async function emailStatus(uid: string): Promise<EmailStatus> {
  const ready = configured(),
    demo = isDemo();
  const value = demo ? null : await connection(uid);
  return {
    configured: ready,
    connected: !!value,
    demo,
    candidates: value?.candidates ?? [],
    ...(value
      ? {
          email: value.email,
          ...(value.lastScannedAt
            ? { lastScannedAt: value.lastScannedAt }
            : {}),
        }
      : {}),
    ...(!ready
      ? { setupRequired: "Gmail OAuth is not configured yet." }
      : demo
        ? {
            setupRequired:
              "Sign in with demo mode disabled to connect your own Gmail.",
          }
        : {}),
  };
}
export async function beginEmailConnect(uid: string) {
  requireLiveEmail();
  const config = emailConfig(),
    state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(32).toString("base64url"),
    expiresAt = Date.now() + 600000;
  await secretRef(uid).set(
    { gmailOAuth: { stateHash: hash(state), verifier, expiresAt } },
    { mergeFields: ["gmailOAuth"] },
  );
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callback,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    cookie: encrypt(JSON.stringify({ uid, state, expiresAt }), "gmail-oauth"),
  };
}
export async function finishEmailConnect(
  request: Request,
): Promise<"connected" | "denied"> {
  requireLiveEmail();
  const url = new URL(request.url),
    state = url.searchParams.get("state") ?? "";
  const raw = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${OAUTH_COOKIE}=`))
    ?.slice(OAUTH_COOKIE.length + 1);
  if (!raw || !state)
    throw new HttpError(
      400,
      "Gmail authorization was not started in this browser.",
    );
  const pending = JSON.parse(decrypt(raw, "gmail-oauth")) as {
    uid: string;
    state: string;
    expiresAt: number;
  };
  if (
    typeof pending.uid !== "string" ||
    pending.uid.includes("/") ||
    !equal(state, pending.state) ||
    pending.expiresAt < Date.now()
  )
    throw new HttpError(400, "Gmail authorization expired or is invalid.");
  const ref = secretRef(pending.uid);
  const verifier = await adminDb().runTransaction(async (tx) => {
    const stored = (await tx.get(ref)).data()?.gmailOAuth;
    if (
      !stored ||
      stored.consumed ||
      stored.expiresAt < Date.now() ||
      !equal(stored.stateHash, hash(state))
    )
      throw new HttpError(
        400,
        "Gmail authorization was already used or expired.",
      );
    tx.update(ref, { "gmailOAuth.consumed": true });
    return String(stored.verifier);
  });
  if (url.searchParams.has("error")) return "denied";
  const code = url.searchParams.get("code");
  if (!code || code.length > 4096)
    throw new HttpError(400, "Missing Google authorization code.");
  const token = await googleToken({
    code,
    grant_type: "authorization_code",
    redirect_uri: emailConfig().callback,
    code_verifier: verifier,
  });
  if (!token.scope?.split(" ").includes(GMAIL_SCOPE) || !token.refresh_token)
    throw new HttpError(
      400,
      "Gmail read-only permission and offline access are required. Reconnect and approve that permission.",
    );
  const profile = await gmail<{ emailAddress: string }>(
    token.access_token,
    "profile",
  );
  if (
    typeof profile.emailAddress !== "string" ||
    profile.emailAddress.length > 254
  )
    throw new HttpError(502, "Google did not identify the connected mailbox.");
  const value: GmailConnection = {
    email: profile.emailAddress,
    encryptedRefreshToken: encrypt(
      token.refresh_token,
      `gmail-token:${pending.uid}`,
    ),
    connectedAt: new Date().toISOString(),
    candidates: [],
  };
  await adminDb().runTransaction(async (tx) => {
    const stored = (await tx.get(ref)).data()?.gmailOAuth;
    if (!stored?.consumed || !equal(stored.stateHash, hash(state)))
      throw new HttpError(
        409,
        "Gmail connection changed while authorizing. Start again.",
      );
    tx.update(ref, { gmail: value, gmailOAuth: FieldValue.delete() });
  });
  return "connected";
}
export async function scanEmail(uid: string) {
  requireLiveEmail();
  const value = await connection(uid);
  if (!value)
    throw new HttpError(
      409,
      "Connect Gmail before scanning for subscriptions.",
    );
  if (
    value.lastScannedAt &&
    Date.now() - Date.parse(value.lastScannedAt) < 60000
  )
    throw new HttpError(429, "Wait a minute before scanning Gmail again.");
  const token = await googleToken({
    grant_type: "refresh_token",
    refresh_token: decrypt(value.encryptedRefreshToken, `gmail-token:${uid}`),
  });
  // Bounded scan. Search is a narrowing mechanism, not a permission restriction.
  const query =
    'newer_than:90d -in:spam -in:trash {subscription membership renewal "free trial" "trial ends"}';
  const listed = await gmail<{
    messages?: { id: string }[];
    nextPageToken?: string;
  }>(
    token.access_token,
    `messages?${new URLSearchParams({ q: query, maxResults: "30" })}`,
  );
  const candidates: EmailCandidate[] = [];
  const messages = (listed.messages ?? []).slice(0, 30);
  for (let i = 0; i < messages.length; i += 5) {
    const batch = await Promise.all(
      messages
        .slice(i, i + 5)
        .map(async (message) =>
          parseSubscriptionEmail(
            await gmail<GmailMessage>(
              token.access_token,
              `messages/${encodeURIComponent(message.id)}?format=full`,
            ),
          ),
        ),
    );
    for (const candidate of batch) if (candidate) candidates.push(candidate);
  }
  candidates.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const unique = candidates.filter(
    (candidate, index, all) =>
      all.findIndex((other) => other.merchant === candidate.merchant) === index,
  );
  const now = new Date().toISOString();
  await adminDb().runTransaction(async (tx) => {
    const ref = secretRef(uid),
      current = (await tx.get(ref)).data()?.gmail as
        GmailConnection | undefined;
    if (
      !current ||
      current.encryptedRefreshToken !== value.encryptedRefreshToken
    )
      throw new HttpError(409, "Your Gmail connection changed. Scan again.");
    tx.update(ref, { "gmail.candidates": unique, "gmail.lastScannedAt": now });
  });
  return {
    candidates: unique,
    scanned: messages.length,
    limited: !!listed.nextPageToken,
    lastScannedAt: now,
  };
}
export async function importEmailCandidates(uid: string, body: unknown) {
  requireLiveEmail();
  const items = (body as { candidates?: unknown })?.candidates;
  if (!Array.isArray(items) || !items.length || items.length > 30)
    throw new HttpError(
      400,
      "Select up to 30 reviewed subscription suggestions.",
    );
  const today = new Date().toISOString().slice(0, 10);
  const reviewed = items.map((item: Record<string, unknown>) => {
    if (!item || typeof item !== "object")
      throw new HttpError(400, "Invalid subscription suggestion.");
    const { id, merchant, amount, nextDate, frequency, kind } = item;
    if (
      typeof id !== "string" ||
      typeof merchant !== "string" ||
      !merchant.trim() ||
      merchant.length > 100 ||
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 100000 ||
      typeof nextDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(nextDate) ||
      !Number.isFinite(Date.parse(nextDate)) ||
      new Date(nextDate).toISOString().slice(0, 10) !== nextDate ||
      nextDate < today ||
      !["weekly", "monthly", "annual", "unknown"].includes(String(frequency)) ||
      !["subscription", "trial"].includes(String(kind))
    )
      throw new HttpError(
        400,
        "Review the merchant, USD price, billing frequency, and next charge date before importing.",
      );
    return {
      id,
      merchant: merchant.trim(),
      amount: Math.round(amount * 100) / 100,
      nextDate,
      frequency: frequency as Charge["frequency"],
      kind: kind as Charge["kind"],
    };
  });
  return adminDb().runTransaction(async (tx) => {
    const privateRef = secretRef(uid),
      userRef = adminDb().doc(`users/${uid}`);
    const [privateDoc, userDoc] = await Promise.all([
      tx.get(privateRef),
      tx.get(userRef),
    ]);
    const value = privateDoc.data()?.gmail as GmailConnection | undefined;
    if (!value) throw new HttpError(409, "Connect Gmail before importing.");
    const state: AppState = userDoc.data()?.state ?? emptyState(uid);
    let imported = 0,
      skipped = 0;
    for (const item of reviewed) {
      const candidate = value.candidates.find((c) => c.id === item.id);
      if (!candidate)
        throw new HttpError(
          409,
          "A suggestion changed. Scan and review again.",
        );
      const chargeId = `email-${item.id}`;
      if (
        state.charges.some(
          (c) =>
            c.id === chargeId ||
            (c.merchant.toLowerCase() === item.merchant.toLowerCase() &&
              c.status !== "cancelled"),
        )
      ) {
        skipped++;
        continue;
      }
      state.charges.push({
        id: chargeId,
        merchant: item.merchant,
        amount: item.amount,
        nextDate: item.nextDate,
        frequency: item.frequency,
        kind: item.kind,
        lastDate: null,
        status: item.kind === "trial" ? "trial" : "active",
        source: "manual",
        usageNote: `Reviewed import from Gmail (${candidate.senderDomain}). Verify details with the merchant.`,
      });
      state.events.unshift({
        id: randomUUID(),
        type: "email_imported",
        channel: "web",
        text: `Reviewed and added ${item.merchant} from Gmail.`,
        chargeId,
        createdAt: new Date().toISOString(),
      });
      imported++;
    }
    if (Buffer.byteLength(JSON.stringify(state)) > 750000)
      throw new HttpError(
        413,
        "Account history has reached the prototype storage limit.",
      );
    const ids = new Set(reviewed.map((item) => item.id));
    tx.set(userRef, { state });
    tx.update(privateRef, {
      "gmail.candidates": value.candidates.filter((c) => !ids.has(c.id)),
    });
    return { imported, skipped };
  });
}
export async function disconnectEmail(uid: string) {
  if (isDemo()) return { disconnected: true, revoked: true };
  const ref = secretRef(uid);
  const previous = await adminDb().runTransaction(async (tx) => {
    const doc = await tx.get(ref),
      value = doc.data()?.gmail as GmailConnection | undefined;
    if (doc.exists)
      tx.update(ref, {
        gmail: FieldValue.delete(),
        gmailOAuth: FieldValue.delete(),
      });
    return value;
  });
  if (!previous) return { disconnected: true, revoked: true };
  let revoked = false;
  try {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: decrypt(previous.encryptedRefreshToken, `gmail-token:${uid}`),
      }),
      signal: AbortSignal.timeout(12000),
    });
    revoked = response.ok;
  } catch {}
  return {
    disconnected: true,
    revoked,
    ...(!revoked
      ? {
          message:
            "Brix deleted its Gmail token and suggestions. Also remove Brix access in your Google Account permissions; Google revocation could not be confirmed.",
        }
      : {}),
  };
}
