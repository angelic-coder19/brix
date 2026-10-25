import { randomUUID } from "node:crypto";
import { HttpError } from "./auth";
import { updateState } from "./store";
import type { Channel, Charge } from "./types";

/** Validates and stores a manually entered free trial. Shared by the app and the public API. */
export async function addTrial(
  uid: string,
  channel: Channel,
  body: Record<string, unknown>,
  /** When set, a repeated request returns the trial it created the first time. */
  requestId?: string,
): Promise<Charge> {
  const merchant =
    typeof body.merchant === "string" ? body.merchant.trim() : "";
  const rawDate = body.endDate ?? body.nextDate;
  const nextDate = typeof rawDate === "string" ? rawDate : "";
  const amount =
    typeof body.amount === "number" ||
    (typeof body.amount === "string" && body.amount.trim())
      ? Number(body.amount)
      : NaN;
  if (
    !merchant ||
    merchant.length > 100 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(nextDate) ||
    !Number.isFinite(Date.parse(nextDate)) ||
    new Date(nextDate).toISOString().slice(0, 10) !== nextDate ||
    nextDate < new Date().toISOString().slice(0, 10) ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 100000
  )
    throw new HttpError(
      400,
      "Enter a name, a future end date, and a valid price.",
    );
  const charge: Charge = {
    id: randomUUID(),
    kind: "trial",
    merchant,
    amount: Math.round(amount * 100) / 100,
    frequency: "monthly",
    lastDate: null,
    nextDate,
    status: "trial",
    source: "manual",
  };
  let result = charge;
  await updateState(uid, (state) => {
    const previous = requestId
      ? state.events.find((e) => e.requestId === requestId)
      : undefined;
    const existing = state.charges.find((c) => c.id === previous?.chargeId);
    if (existing) {
      result = existing;
      return;
    }
    result = charge;
    state.charges.push(charge);
    state.events.unshift({
      id: randomUUID(),
      type: "trial_added",
      channel,
      text: `Added ${merchant} trial.`,
      createdAt: new Date().toISOString(),
      chargeId: charge.id,
      ...(requestId ? { requestId } : {}),
    });
  });
  return result;
}
