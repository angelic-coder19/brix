import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { practiceView, startPractice } from "@/lib/practice";
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
