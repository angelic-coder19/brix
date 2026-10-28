import { requireUser, errorResponse } from "@/lib/auth";
import { removeIncome } from "@/lib/income";
import { updateState } from "@/lib/store";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { uid } = await requireUser(request);
    const { id } = await params;
    await updateState(uid, (s) => removeIncome(s, id));
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
