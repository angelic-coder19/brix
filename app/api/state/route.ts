import { requireUser, errorResponse, isDemo } from "@/lib/auth";
import { getState } from "@/lib/store";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(
      { ...(await getState(uid)), demo: isDemo() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
