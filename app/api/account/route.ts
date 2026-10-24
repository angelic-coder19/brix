import { requireUser, errorResponse, isDemo } from "@/lib/auth";
import { disconnectPlaid } from "@/lib/plaid";
import { deleteData } from "@/lib/store";
import { adminAuth } from "@/lib/firebase/admin";
export async function DELETE(request: Request) {
  try {
    const { uid } = await requireUser(request);
    await disconnectPlaid(uid);
    await deleteData(uid);
    if (!isDemo()) await adminAuth().deleteUser(uid);
    return Response.json({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
