import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { addRealHolding, realHoldingsView } from "@/lib/practice/real";
export const runtime = "nodejs";
/** Self-reported real holdings at current prices. Never mixed with practice. */
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(await realHoldingsView(uid), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
/** Logs a real purchase: `symbol`, `dollars`, `boughtOn`, `broker`, and optionally `pricePaid`. */
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const holding = await addRealHolding(uid, await readJsonObject(request));
    return Response.json({ holding }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
