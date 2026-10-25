import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { deleteGiftCard, updateGiftCard } from "@/lib/giftcards";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
/** `spent` (subtract), `balance` (correct), or `status: "used" | "active"`. */
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { uid } = await requireUser(request);
    const card = await updateGiftCard(
      uid,
      (await params).id,
      await readJsonObject(request),
    );
    return Response.json({ card });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { uid } = await requireUser(request);
    await deleteGiftCard(uid, (await params).id);
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
