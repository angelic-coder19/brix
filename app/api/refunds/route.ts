import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { addManualRefund } from "@/lib/refunds";
import { getState } from "@/lib/store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(
      { refunds: (await getState(uid)).refunds ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
/** Records a refund the student tells Brix about. */
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const refund = await addManualRefund(uid, await readJsonObject(request));
    return Response.json({ refund }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
