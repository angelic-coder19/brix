import { requireUser, errorResponse } from "@/lib/auth";
import { disconnectPlaid } from "@/lib/plaid";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    await disconnectPlaid(uid);
    return Response.json({ disconnected: true });
  } catch (e) {
    return errorResponse(e);
  }
}
