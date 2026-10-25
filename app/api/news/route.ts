import { requireUser, errorResponse } from "@/lib/auth";
import { getState } from "@/lib/store";
import { getMoneyNews } from "@/lib/tools/getMoneyNews";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(await getMoneyNews((await getState(uid)).charges), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
