import { requireUser, errorResponse } from "@/lib/auth";
import { scanEmail } from "@/lib/email/service";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(await scanEmail(uid), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
