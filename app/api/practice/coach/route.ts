import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { coachCheck } from "@/lib/practice/coach";
export const runtime = "nodejs";
/** Pre-trade check for `symbol`, `side`, `amount`. Explains; never advises. */
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(await coachCheck(uid, await readJsonObject(request)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
