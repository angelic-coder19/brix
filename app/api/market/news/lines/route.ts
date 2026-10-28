import { requireUser, errorResponse } from "@/lib/auth";
import { newsLines } from "@/lib/news/lines";
export const runtime = "nodejs";
/** One line per headline in terms of the student's own holding, keyed by URL. */
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const raw = new URL(request.url).searchParams.get("symbols") ?? "";
    return Response.json(
      { lines: await newsLines(uid, raw.split(",")) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
