import type { Charge } from "./types";
export interface RecurringStream {
  stream_id: string;
  merchant_name?: string;
  description?: string;
  average_amount: { amount: number };
  frequency: string;
  last_date: string;
  predicted_next_date?: string;
  is_active: boolean;
}
export function predictNextDate(
  last: string,
  frequency: Charge["frequency"],
  now = new Date(),
): string {
  const date = new Date(`${last}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid charge date.");
  const day = date.getUTCDate();
  const advance = () => {
    if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7);
    else {
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + (frequency === "annual" ? 12 : 1));
      const end = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
      ).getUTCDate();
      date.setUTCDate(Math.min(day, end));
    }
  };
  advance();
  for (let i = 0; date < now && i < 1000; i++) advance();
  return date.toISOString().slice(0, 10);
}
export function normalizeRecurring(
  streams: RecurringStream[],
  now = new Date(),
): Charge[] {
  return streams
    .filter(
      (s) =>
        s.is_active &&
        Number.isFinite(s.average_amount?.amount) &&
        s.average_amount.amount > 0,
    )
    .map((s) => {
      const frequency: Charge["frequency"] =
        (
          {
            WEEKLY: "weekly",
            MONTHLY: "monthly",
            ANNUALLY: "annual",
          } as Record<string, Charge["frequency"]>
        )[s.frequency] ?? "unknown";
      return {
        id: `plaid-${s.stream_id}`,
        plaidStreamId: s.stream_id,
        kind: "subscription",
        merchant: s.merchant_name || s.description || "Recurring charge",
        amount: Math.round(s.average_amount.amount * 100) / 100,
        frequency,
        lastDate: s.last_date,
        nextDate:
          s.predicted_next_date || predictNextDate(s.last_date, frequency, now),
        status: "active",
        source: "plaid",
        usageNote:
          frequency === "unknown"
            ? "Estimated date; verify with the merchant."
            : "Detected from bank transaction history.",
      };
    });
}
