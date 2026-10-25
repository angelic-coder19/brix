import { apiRoute } from "@/lib/api/v1";
import { list } from "@/lib/api/resources";
import { getState } from "@/lib/store";
export const runtime = "nodejs";
export const GET = apiRoute("refunds:read", async ({ uid }) =>
  list(
    ((await getState(uid)).refunds ?? []).map((r) => ({
      object: "refund" as const,
      id: r.id,
      amount: r.amount,
      received_on: r.receivedOn,
      source: r.source,
      funding: r.funding,
      loan_amount: r.loanAmount ?? null,
      status: r.status,
      return_by: r.plan?.returnBy ?? null,
      plan:
        r.plan?.steps.map((s) => ({
          step: s.key,
          label: s.label,
          amount: s.amount,
        })) ?? null,
    })),
  ),
);
