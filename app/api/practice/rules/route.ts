import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { addRule } from "@/lib/practice";
export const runtime = "nodejs";
/** Adds an auto-invest rule: `symbol`, `amount`, `cadence`, optional `startOn`. */
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const rule = await addRule(uid, await readJsonObject(request));
    return Response.json({ rule }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
