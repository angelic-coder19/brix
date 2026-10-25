import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { updateRefund } from "@/lib/refunds";
export const runtime = "nodejs";
/** Funding details (loan amount, rate, type) or dismissing the refund. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { uid } = await requireUser(request);
    const refund = await updateRefund(
      uid,
      (await params).id,
      await readJsonObject(request),
    );
    return Response.json({ refund });
  } catch (error) {
    return errorResponse(error);
  }
}
