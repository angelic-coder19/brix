import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { updateRule } from "@/lib/practice";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { uid } = await requireUser(request);
    const rule = await updateRule(
      uid,
      (await params).id,
      await readJsonObject(request),
    );
    return Response.json({ rule });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { uid } = await requireUser(request);
    await updateRule(uid, (await params).id, { delete: true });
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
