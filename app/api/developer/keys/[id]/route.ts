import { requireUser, errorResponse } from "@/lib/auth";
import { revokeApiKey } from "@/lib/api/keys";
export const runtime = "nodejs";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { uid } = await requireUser(request);
    await revokeApiKey(uid, (await params).id);
    return Response.json({ revoked: true });
  } catch (e) {
    return errorResponse(e);
  }
}
