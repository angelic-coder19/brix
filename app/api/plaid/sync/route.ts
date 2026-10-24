import { requireUser, errorResponse } from "@/lib/auth";
import { syncPlaid } from "@/lib/plaid";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(await syncPlaid(uid));
  } catch (e) {
    return errorResponse(e);
  }
}
