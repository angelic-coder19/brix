import { requireUser, errorResponse } from "@/lib/auth";
import { leaderboard } from "@/lib/practice/leaderboard";
export const runtime = "nodejs";
/** Practice leaderboard: first names and initials only, ranked by coins. */
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(await leaderboard(uid), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
