import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { practiceView, startPractice } from "@/lib/practice";
import { updatePortfolio } from "@/lib/store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(await practiceView(uid), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
/** Starts a portfolio with `startingCash` or the size of a refund (`refundId`). */
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(
      await startPractice(
        uid,
        await readJsonObject(request, { optional: true }),
      ),
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
/** `{ shareMix: boolean }`: let leaderboard players copy your mix (percentages only). */
export async function PATCH(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await readJsonObject(request);
    if (typeof body.shareMix !== "boolean")
      throw new HttpError(400, "Send `shareMix` as true or false.");
    const shareMix = body.shareMix;
    await updatePortfolio(uid, (p) => {
      if (!p) throw new HttpError(409, "Start a practice portfolio first.");
      return { portfolio: { ...p, shareMix }, result: null };
    });
    return Response.json({ shareMix });
  } catch (error) {
    return errorResponse(error);
  }
}
