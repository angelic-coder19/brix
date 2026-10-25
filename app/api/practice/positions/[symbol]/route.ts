import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { setStops } from "@/lib/practice";
export const runtime = "nodejs";
/** Sets or clears `stopLoss` and `takeProfit` (null clears) on a position. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  try {
    const { uid } = await requireUser(request);
    await setStops(uid, (await params).symbol, await readJsonObject(request));
    return Response.json({ saved: true });
  } catch (error) {
    return errorResponse(error);
  }
}
