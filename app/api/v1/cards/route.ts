import { apiRoute } from "@/lib/api/v1";
import { card, list } from "@/lib/api/resources";
import { getState } from "@/lib/store";
export const runtime = "nodejs";
export const GET = apiRoute("cards:read", async ({ uid }) =>
  list((await getState(uid)).cards.map(card)),
);
