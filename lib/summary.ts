import type { Charge } from "./types";

const live = (c: Charge) =>
  c.status !== "cancelled" && c.status !== "to_cancel";
const perMonth = (c: Charge) =>
  c.amount *
  (c.frequency === "annual" ? 1 / 12 : c.frequency === "weekly" ? 52 / 12 : 1);

/**
 * Dashboard totals. Charges marked to cancel or cancelled drop out of every
 * number, so the count and the monthly total always describe the same set.
 */
export function summarizeCharges(charges: Charge[]) {
  const subscriptions = charges.filter(
    (c) => c.kind !== "trial" && live(c) && c.frequency !== "unknown",
  );
  return {
    monthly: subscriptions.reduce((sum, c) => sum + perMonth(c), 0),
    subscriptionCount: subscriptions.length,
    trialCount: charges.filter((c) => c.kind === "trial" && live(c)).length,
  };
}
