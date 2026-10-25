import { apiRoute } from "@/lib/api/v1";
import { charge } from "@/lib/api/resources";
import { HttpError } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { getState, updateState } from "@/lib/store";
import { markToCancel, reactivate } from "@/lib/tools";
import type { Charge } from "@/lib/types";
export const runtime = "nodejs";
export const GET = apiRoute("charges:read", async ({ uid, params }) => {
  const found = (await getState(uid)).charges.find((c) => c.id === params.id);
  if (!found) throw new HttpError(404, "No charge with that ID.");
  return charge(found);
});
/** Only `status` can change: `to_cancel` marks it, `active` undoes that. */
export const PATCH = apiRoute(
  "charges:write",
  async ({ uid, params, request }) => {
    const body = await readJsonObject(request);
    const extra = Object.keys(body).filter((k) => k !== "status");
    if (extra.length)
      throw new HttpError(
        400,
        `Only \`status\` can be updated (got ${extra.join(", ")}).`,
      );
    if (body.status !== "to_cancel" && body.status !== "active")
      throw new HttpError(400, "`status` must be `to_cancel` or `active`.");
    let updated: Charge | undefined;
    let message = "";
    await updateState(uid, (s) => {
      const found = s.charges.find((c) => c.id === params.id);
      if (!found) throw new HttpError(404, "No charge with that ID.");
      if (found.status === "cancelled")
        throw new HttpError(409, "That charge is already cancelled.");
      message =
        body.status === "to_cancel"
          ? markToCancel(s, "api", found)
          : reactivate(s, "api", found);
      updated = { ...found };
    });
    return { ...charge(updated!), message };
  },
);
