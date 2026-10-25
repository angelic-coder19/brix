import type { Charge, Reminder, VirtualCard } from "../types";

// Public API shapes. Internal fields (Plaid stream IDs, provider tokens,
// delivery errors) never leave the server.

export const charge = (c: Charge) => ({
  object: "charge" as const,
  id: c.id,
  kind: c.kind,
  merchant: c.merchant,
  amount: c.amount,
  currency: "usd" as const,
  frequency: c.frequency,
  status: c.status,
  source: c.source,
  last_date: c.lastDate,
  next_date: c.nextDate,
  cancel_url: c.cancelUrl ?? null,
});

export const reminder = (r: Reminder) => ({
  object: "reminder" as const,
  id: r.id,
  charge_id: r.chargeId,
  remind_at: r.remindAt,
  channel: r.channel,
  status: r.sent ? "sent" : (r.status ?? "pending"),
  created_by: r.createdBy,
});

export const card = (c: VirtualCard) => ({
  object: "card" as const,
  id: c.id,
  last4: c.last4,
  purpose: c.purpose,
  spend_limit: c.spendLimit,
  currency: "usd" as const,
  state: c.state,
  source: c.source,
  created_at: c.createdAt ?? null,
});

export const list = <T>(data: T[]) => ({ object: "list" as const, data });
