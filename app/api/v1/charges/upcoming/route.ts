import { apiRoute, intParam } from "@/lib/api/v1";
import { charge, list } from "@/lib/api/resources";
import { executeTool } from "@/lib/tools";
import type { Charge } from "@/lib/types";
export const runtime = "nodejs";
export const GET = apiRoute("charges:read", async ({ uid, url }) => {
  const days = intParam(url, "days", 14, 1, 90);
  const charges = (await executeTool(uid, "api", "get_upcoming_charges", {
    days,
  })) as Charge[];
  return { ...list(charges.map(charge)), days };
});
