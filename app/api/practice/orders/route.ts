import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { practiceOrder } from "@/lib/practice";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const order = await practiceOrder(uid, await readJsonObject(request));
    return Response.json({ order }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
