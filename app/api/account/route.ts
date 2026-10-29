import { requireUser, errorResponse, isDemo } from "@/lib/auth";
import { disconnectPlaid } from "@/lib/plaid";
import { disconnectEmail } from "@/lib/email/service";
import { deleteData } from "@/lib/store";
import { adminAuth } from "@/lib/firebase/admin";
import { deleteApiKeys } from "@/lib/api/keys";
export async function DELETE(request: Request) {
  try {
    const { uid } = await requireUser(request);
    await disconnectPlaid(uid);
    await deleteApiKeys(uid);
    if (!isDemo()) await disconnectEmail(uid);
    await deleteData(uid);
    if (!isDemo()) await adminAuth().deleteUser(uid);
    return Response.json({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
