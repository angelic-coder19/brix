import { requireUser, errorResponse } from "@/lib/auth";
import { removeRealHolding } from "@/lib/practice/real";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { uid } = await requireUser(request);
    await removeRealHolding(uid, (await params).id);
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
