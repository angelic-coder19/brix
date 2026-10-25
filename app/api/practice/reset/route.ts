import { requireUser, errorResponse } from "@/lib/auth";
import { resetPractice } from "@/lib/practice";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    await resetPractice(uid);
    return Response.json({ reset: true });
  } catch (error) {
    return errorResponse(error);
  }
}
