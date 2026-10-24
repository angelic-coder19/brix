import { HttpError } from "./auth";
import { getSecret, setSecret, updateState } from "./store";
import { normalizeRecurring, type RecurringStream } from "./recurring";
export class PlaidError extends HttpError {
  constructor(public code: string) {
    super(502, "Plaid could not complete this request. Please try again.");
  }
}
export async function plaidRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T> {
  if (process.env.PLAID_ENV && process.env.PLAID_ENV !== "sandbox")
    throw new HttpError(503, "Brix currently supports Plaid sandbox only.");
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET)
    throw new HttpError(503, "Plaid sandbox credentials are not configured.");
  const result = await fetch(`https://sandbox.plaid.com${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      ...body,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!result.ok) {
    const failure = await result.json().catch(() => ({}));
    throw new PlaidError(String(failure.error_code ?? "UNKNOWN"));
  }
  return result.json();
}
export async function syncPlaid(uid: string) {
  const secret = await getSecret(uid);
  const items = Object.entries(secret.plaidAccessTokens ?? {});
  if (!items.length) throw new HttpError(400, "Link a sandbox bank first.");
  let count = 0;
  const cursors = { ...secret.plaidCursors };
  for (const [id, access_token] of items) {
    let cursor = cursors[id],
      hasMore = true,
      pages = 0,
      restarts = 0;
    while (hasMore) {
      if (++pages > 100)
        throw new HttpError(502, "Transaction sync exceeded its page limit.");
      try {
        const page = await plaidRequest<{
          next_cursor: string;
          has_more: boolean;
        }>("/transactions/sync", {
          access_token,
          count: 500,
          ...(cursor ? { cursor } : {}),
        });
        cursor = page.next_cursor;
        hasMore = page.has_more;
      } catch (error) {
        if (
          error instanceof PlaidError &&
          error.code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" &&
          restarts++ < 2
        ) {
          cursor = cursors[id];
          continue;
        }
        throw error;
      }
    }
    const streams = await plaidRequest<{ outflow_streams: RecurringStream[] }>(
      "/transactions/recurring/get",
      { access_token },
    );
    const charges = normalizeRecurring(streams.outflow_streams ?? []);
    count += charges.length;
    await updateState(uid, (state) => {
      for (const charge of charges) {
        const old = state.charges.find((c) => c.id === charge.id);
        if (old) Object.assign(old, { ...charge, status: old.status });
        else state.charges.push(charge);
      }
    });
    cursors[id] = cursor!;
  }
  await setSecret(uid, { plaidCursors: cursors });
  return { synced: count };
}
export async function disconnectPlaid(uid: string) {
  const secret = await getSecret(uid);
  for (const access_token of Object.values(secret.plaidAccessTokens ?? {}))
    await plaidRequest("/item/remove", { access_token });
  await setSecret(uid, { plaidAccessTokens: {}, plaidCursors: {} });
  await updateState(uid, (state) => {
    const ids = new Set(
      state.charges.filter((c) => c.source === "plaid").map((c) => c.id),
    );
    state.charges = state.charges.filter((c) => !ids.has(c.id));
    state.reminders = state.reminders.filter((r) => !ids.has(r.chargeId));
  });
}
