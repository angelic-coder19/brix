import { apiRoute } from "@/lib/api/v1";
import { executeTool } from "@/lib/tools";
import type { Charge } from "@/lib/types";
export const runtime = "nodejs";
export const GET = apiRoute("charges:read", async ({ uid }) => {
  const [subs, saved, upcoming] = await Promise.all([
    executeTool(uid, "api", "get_subscriptions") as Promise<{
      charges: Charge[];
      monthlyTotal: number;
    }>,
    executeTool(uid, "api", "get_saved_summary") as Promise<{ amount: number }>,
    executeTool(uid, "api", "get_upcoming_charges", { days: 14 }) as Promise<
      Charge[]
    >,
  ]);
  return {
    object: "summary",
    currency: "usd",
    monthly_subscription_total: subs.monthlyTotal,
    active_subscriptions: subs.charges.filter((c) => c.kind === "subscription")
      .length,
    active_trials: subs.charges.filter((c) => c.kind === "trial").length,
    upcoming_14_days: {
      count: upcoming.length,
      amount:
        Math.round(upcoming.reduce((s, c) => s + c.amount, 0) * 100) / 100,
    },
    avoided_this_month: { amount: saved.amount, estimated: true },
  };
});
