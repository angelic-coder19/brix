import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { adminDb } from "./firebase/admin";
import { isDemo, HttpError } from "./auth";
import type { AppState, UserSecret } from "./types";
const folder = path.join(process.cwd(), ".data");
const filename = (uid: string, suffix = "state") =>
  path.join(folder, `${Buffer.from(uid).toString("hex")}.${suffix}.json`);
const locks = new Map<string, Promise<unknown>>();
async function locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(fn);
  locks.set(key, next);
  try {
    return await next;
  } finally {
    if (locks.get(key) === next) locks.delete(key);
  }
}
async function localRead<T>(uid: string, suffix: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filename(uid, suffix), "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
async function localWrite(uid: string, suffix: string, value: unknown) {
  await mkdir(folder, { recursive: true });
  const file = filename(uid, suffix),
    temp = `${file}.${randomUUID()}`;
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temp, file);
}
export function emptyState(uid: string): AppState {
  return {
    user: {
      uid,
      displayName: "Student",
      email: "",
      whatsappOptIn: false,
      callOptIn: false,
    },
    charges: [],
    reminders: [],
    cards: [],
    events: [],
  };
}
export function demoState(uid = "demo-maya"): AppState {
  const date = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const state = emptyState(uid);
  state.user = {
    uid,
    displayName: "Maya",
    email: "maya@example.com",
    whatsappOptIn: false,
    callOptIn: false,
  };
  state.charges = [
    ["Spotify", 11.99, 5, "https://www.spotify.com/account/subscription/"],
    ["Netflix", 15.49, 8, "https://www.netflix.com/cancelplan"],
    ["Adobe", 9.99, 12, "https://account.adobe.com/plans"],
    ["iCloud+", 2.99, 14, "https://support.apple.com/billing"],
    ["YouTube Premium", 13.99, 18, "https://www.youtube.com/paid_memberships"],
    ["Duolingo", 8.49, 23, "https://www.duolingo.com/settings"],
  ].map(([merchant, amount, days, cancelUrl], i) => ({
    id: `demo-${i + 1}`,
    kind: "subscription",
    merchant: String(merchant),
    amount: Number(amount),
    frequency: "monthly",
    lastDate: date(Number(days) - 30),
    nextDate: date(Number(days)),
    status: "active",
    source: "manual",
    cancelUrl: String(cancelUrl),
    usageNote: "Seeded demo data — usage is not tracked.",
  }));
  state.events = [
    {
      id: randomUUID(),
      type: "demo_seeded",
      channel: "system",
      text: "Maya’s sample subscriptions are ready. All charges are demo data.",
      createdAt: new Date().toISOString(),
    },
  ];
  return state;
}
export async function getState(uid: string): Promise<AppState> {
  if (isDemo())
    return (
      (await localRead<AppState>(uid, "state")) ??
      (await updateState(uid, () => {}))
    );
  return (
    (await adminDb().doc(`users/${uid}`).get()).data()?.state ?? emptyState(uid)
  );
}
function boundState(state: AppState) {
  const chat = state.events
    .filter((e) => e.type === "agent_message")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const retained = new Set(chat.slice(0, 100).map((e) => e.id));
  state.events = state.events.filter(
    (e) => e.type !== "agent_message" || retained.has(e.id),
  );
  if (Buffer.byteLength(JSON.stringify(state), "utf8") > 750000)
    throw new HttpError(
      413,
      "Account history has reached the prototype storage limit. Export or delete your data before adding more.",
    );
}
export async function updateState(
  uid: string,
  updater: (state: AppState) => void | Promise<void>,
): Promise<AppState> {
  if (isDemo())
    return locked(uid, async () => {
      const state = (await localRead<AppState>(uid, "state")) ?? demoState(uid);
      await updater(state);
      boundState(state);
      await localWrite(uid, "state", state);
      return state;
    });
  const ref = adminDb().doc(`users/${uid}`);
  return adminDb().runTransaction(async (tx) => {
    const state: AppState =
      (await tx.get(ref)).data()?.state ?? emptyState(uid);
    await updater(state);
    boundState(state);
    tx.set(ref, { state });
    return state;
  });
}
export async function saveState(uid: string, state: AppState) {
  await updateState(uid, (current) => {
    Object.assign(current, state);
  });
}
export async function getSecret(uid: string): Promise<UserSecret> {
  return isDemo()
    ? ((await localRead<UserSecret>(uid, "secret")) ?? {})
    : ((await adminDb().doc(`secrets/${uid}`).get()).data() ?? {});
}
export async function setSecret(uid: string, patch: Partial<UserSecret>) {
  if (isDemo())
    return locked(`${uid}-secret`, async () =>
      localWrite(uid, "secret", { ...(await getSecret(uid)), ...patch }),
    );
  await adminDb()
    .doc(`secrets/${uid}`)
    .set(patch, { mergeFields: Object.keys(patch) });
}
export async function listUserIds(): Promise<string[]> {
  if (isDemo()) return ["demo-maya"];
  return (await adminDb().collection("users").get()).docs.map((d) => d.id);
}
export async function findUserByPhone(phone: string): Promise<string | null> {
  if (isDemo()) {
    for (const uid of await listUserIds())
      if ((await getState(uid)).user.phoneE164 === phone) return uid;
    return null;
  }
  return (await adminDb().doc(`phoneIndex/${phone}`).get()).data()?.uid ?? null;
}
export async function registerPhone(uid: string, phone: string) {
  if (isDemo()) return;
  const db = adminDb();
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`phoneIndex/${phone}`),
      existing = await tx.get(ref);
    if (existing.exists && existing.data()?.uid !== uid)
      throw new Error("Phone already linked to another account.");
    const userRef = db.doc(`users/${uid}`),
      user = await tx.get(userRef);
    const old = user.data()?.state?.user?.phoneE164;
    if (old && old !== phone) tx.delete(db.doc(`phoneIndex/${old}`));
    tx.set(ref, { uid });
  });
}
export async function deleteData(uid: string) {
  const state = await getState(uid);
  if (isDemo()) {
    for (const suffix of ["state", "secret"])
      await unlink(filename(uid, suffix)).catch(() => {});
    return;
  }
  const db = adminDb();
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await db.doc(`secrets/${uid}`).delete();
  if (state.user.phoneE164)
    await db.doc(`phoneIndex/${state.user.phoneE164}`).delete();
}
export const getUserIdByPhone = findUserByPhone;
