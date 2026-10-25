import { createHash } from "node:crypto";
import { isDemo } from "../auth";
import { adminDb } from "../firebase/admin";

// Two layers: this server's memory, then a Firestore document every server
// shares. When a refresh fails, the last good value is served as stale.
const memory = new Map<string, { at: number; value: unknown }>();
const MAX_ENTRIES = 500;

const docId = (key: string) =>
  createHash("sha256").update(key).digest("hex").slice(0, 40);

async function readShared(key: string) {
  if (isDemo()) return null;
  try {
    const data = (
      await adminDb()
        .doc(`newsCache/${docId(key)}`)
        .get()
    ).data();
    return data
      ? { at: Number(data.at), value: JSON.parse(String(data.value)) }
      : null;
  } catch {
    return null;
  }
}

async function writeShared(key: string, at: number, value: unknown) {
  if (isDemo()) return;
  try {
    await adminDb()
      .doc(`newsCache/${docId(key)}`)
      .set({ at, value: JSON.stringify(value) });
  } catch {
    // The memory layer still works; sharing is an optimisation.
  }
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<{ value: T; stale: boolean }> {
  const now = Date.now();
  let hit = memory.get(key) ?? null;
  if (!hit || now - hit.at >= ttlMs) {
    const shared = await readShared(key);
    if (shared && (!hit || shared.at > hit.at)) {
      hit = shared;
      memory.set(key, shared);
    }
  }
  if (hit && now - hit.at < ttlMs)
    return { value: hit.value as T, stale: false };
  try {
    const value = await load();
    if (memory.size >= MAX_ENTRIES) memory.delete(memory.keys().next().value!);
    memory.set(key, { at: now, value });
    await writeShared(key, now, value);
    return { value, stale: false };
  } catch (error) {
    if (hit) return { value: hit.value as T, stale: true };
    throw error;
  }
}
