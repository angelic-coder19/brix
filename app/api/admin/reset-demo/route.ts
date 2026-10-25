import { requireAdmin, errorResponse, HttpError, isDemo } from "@/lib/auth";
import { demoState, saveState } from "@/lib/store";
import { deleteApiKeys } from "@/lib/api/keys";
export async function POST(request: Request) {
  try {
    const { uid } = await requireAdmin(request);
    if (!isDemo())
      throw new HttpError(
        403,
        "Reset is available only in explicit demo mode.",
      );
    await saveState(uid, demoState(uid));
    await deleteApiKeys(uid);
    return Response.json({ reset: true });
  } catch (e) {
    return errorResponse(e);
  }
}
