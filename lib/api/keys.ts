import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpError, isDemo } from "../auth";
import { adminDb } from "../firebase/admin";

export const SCOPES = {
  "charges:read": "Read charges, upcoming charges, and the spending summary.",
  "charges:write": "Add trials and mark charges to cancel or active.",
  "reminders:read": "List reminders.",
  "reminders:write": "Create and delete reminders.",
  "cards:read": "List single-use cards (masked; never card numbers).",
  "news:read": "Read subscription news about your merchants.",
  "refunds:read": "Read school refunds and their plans.",
  "practice:read":
    "Read the practice portfolio (virtual money): value, positions, rules, orders.",
} as const;
export type Scope = keyof typeof SCOPES;
export const isScope = (s: unknown): s is Scope =>
  typeof s === "string" && Object.hasOwn(SCOPES, s);

export const KEY_PREFIX = "brix_sk_";
export const MAX_KEYS_PER_USER = 5;
export const RATE_LIMIT_PER_MINUTE = 120;

export interface ApiKey {
  id: string;
  uid: string;
  name: string;
  /** First characters of the secret, safe to display. */
  preview: string;
  scopes: Scope[];
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  /** Fixed-window rate limit bookkeeping. */
  window?: number;
  count?: number;
}
export type PublicApiKey = Omit<ApiKey, "uid" | "window" | "count">;
export const publicKey = (key: ApiKey): PublicApiKey => ({
  id: key.id,
  name: key.name,
  preview: key.preview,
  scopes: key.scopes,
  createdAt: key.createdAt,
  ...(key.lastUsedAt ? { lastUsedAt: key.lastUsedAt } : {}),
  ...(key.revokedAt ? { revokedAt: key.revokedAt } : {}),
});

export const hashKey = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");

// Demo mode keeps keys in one local file; production uses `apiKeys/{sha256}`.
const localFile = () =>
  path.join(
    process.cwd(),
    ".data",
    ...(process.env.BRIX_TEST_STORAGE === "true" ? ["browser-tests"] : []),
    "api-keys.json",
  );
let localQueue: Promise<unknown> = Promise.resolve();
async function readLocal(): Promise<Record<string, ApiKey>> {
  try {
    return JSON.parse(await readFile(localFile(), "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
}
function withLocal<T>(fn: (keys: Record<string, ApiKey>) => T): Promise<T> {
  const next = localQueue
    .catch(() => {})
    .then(async () => {
      const keys = await readLocal();
      const result = fn(keys);
      await mkdir(path.dirname(localFile()), { recursive: true });
      const temp = `${localFile()}.${randomUUID()}`;
      await writeFile(temp, JSON.stringify(keys, null, 2), { mode: 0o600 });
      await rename(temp, localFile());
      return result;
    });
  localQueue = next;
  return next;
}

export async function listApiKeys(uid: string): Promise<PublicApiKey[]> {
  const keys = isDemo()
    ? Object.values(await readLocal()).filter((k) => k.uid === uid)
    : (
        await adminDb().collection("apiKeys").where("uid", "==", uid).get()
      ).docs.map((d) => d.data() as ApiKey);
  return keys
    .filter((k) => !k.revokedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(publicKey);
}

/** Creates a key and returns its secret. The secret is never stored or shown again. */
export async function createApiKey(
  uid: string,
  name: unknown,
  scopes: unknown,
) {
  const label = typeof name === "string" ? name.trim().slice(0, 60) : "";
  if (!label)
    throw new HttpError(400, "Name the key so you can recognize it later.");
  if (
    !Array.isArray(scopes) ||
    !scopes.length ||
    !scopes.every(isScope) ||
    new Set(scopes).size !== scopes.length
  )
    throw new HttpError(
      400,
      `Choose at least one scope: ${Object.keys(SCOPES).join(", ")}.`,
    );
  if ((await listApiKeys(uid)).length >= MAX_KEYS_PER_USER)
    throw new HttpError(
      409,
      `You can have up to ${MAX_KEYS_PER_USER} active keys. Revoke one first.`,
    );
  const secret = KEY_PREFIX + randomBytes(24).toString("base64url");
  const key: ApiKey = {
    id: `key_${randomBytes(8).toString("hex")}`,
    uid,
    name: label,
    preview: `${secret.slice(0, KEY_PREFIX.length + 4)}…`,
    scopes: scopes as Scope[],
    createdAt: new Date().toISOString(),
  };
  const hash = hashKey(secret);
  if (isDemo())
    await withLocal((keys) => {
      keys[hash] = key;
    });
  else await adminDb().doc(`apiKeys/${hash}`).create(key);
  return { key: publicKey(key), secret };
}

export async function revokeApiKey(uid: string, id: string) {
  const now = new Date().toISOString();
  if (isDemo()) {
    const found = await withLocal((keys) => {
      const entry = Object.values(keys).find(
        (k) => k.uid === uid && k.id === id && !k.revokedAt,
      );
      if (entry) entry.revokedAt = now;
      return !!entry;
    });
    if (!found) throw new HttpError(404, "That key doesn't exist.");
    return;
  }
  const docs = (
    await adminDb()
      .collection("apiKeys")
      .where("uid", "==", uid)
      .where("id", "==", id)
      .get()
  ).docs.filter((d) => !d.data().revokedAt);
  if (!docs.length) throw new HttpError(404, "That key doesn't exist.");
  await Promise.all(docs.map((d) => d.ref.update({ revokedAt: now })));
}

/** Removes every key a user owns; used when the account is deleted. */
export async function deleteApiKeys(uid: string) {
  if (isDemo()) {
    await withLocal((keys) => {
      for (const [hash, k] of Object.entries(keys))
        if (k.uid === uid) delete keys[hash];
    });
    return;
  }
  const docs = (
    await adminDb().collection("apiKeys").where("uid", "==", uid).get()
  ).docs;
  await Promise.all(docs.map((d) => d.ref.delete()));
}

/**
 * Resolves a secret to its key and counts the request against a one-minute
 * window. Throws 401 for unknown or revoked keys and 429 when over the limit.
 */
export async function authenticateKey(secret: string) {
  if (!secret.startsWith(KEY_PREFIX) || secret.length > 100)
    throw new HttpError(401, "Invalid API key.");
  const hash = hashKey(secret),
    window = Math.floor(Date.now() / 60000),
    now = new Date().toISOString();
  const apply = (key: ApiKey | undefined) => {
    if (!key || key.revokedAt) throw new HttpError(401, "Invalid API key.");
    const count = key.window === window ? (key.count ?? 0) + 1 : 1;
    if (count > RATE_LIMIT_PER_MINUTE)
      throw new HttpError(429, "Rate limit exceeded. Retry after a minute.");
    key.window = window;
    key.count = count;
    key.lastUsedAt = now;
    return { ...key, remaining: RATE_LIMIT_PER_MINUTE - count };
  };
  if (isDemo()) return withLocal((keys) => apply(keys[hash]));
  const ref = adminDb().doc(`apiKeys/${hash}`);
  return adminDb().runTransaction(async (tx) => {
    const key = apply((await tx.get(ref)).data() as ApiKey | undefined);
    tx.update(ref, {
      window: key.window,
      count: key.count,
      lastUsedAt: key.lastUsedAt,
    });
    return key;
  });
}
