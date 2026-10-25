import { apiRoute } from "@/lib/api/v1";
import { charge, list } from "@/lib/api/resources";
import { HttpError } from "@/lib/auth";
import { getState } from "@/lib/store";
import type { Charge } from "@/lib/types";
export const runtime = "nodejs";
const STATUSES = ["active", "trial", "to_cancel", "cancelled"];
const KINDS = ["subscription", "trial"];
export const GET = apiRoute("charges:read", async ({ uid, url }) => {
  const status = url.searchParams.get("status"),
    kind = url.searchParams.get("kind");
  if (status && !STATUSES.includes(status))
    throw new HttpError(
      400,
      `\`status\` must be one of ${STATUSES.join(", ")}.`,
    );
  if (kind && !KINDS.includes(kind))
    throw new HttpError(400, `\`kind\` must be one of ${KINDS.join(", ")}.`);
  const charges = (await getState(uid)).charges
    .filter(
      (c: Charge) =>
        (!status || c.status === status) && (!kind || c.kind === kind),
    )
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  return list(charges.map(charge));
});
