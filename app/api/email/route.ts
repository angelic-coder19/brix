import { requireUser, errorResponse } from "@/lib/auth";
import { emailStatus, disconnectEmail } from "@/lib/email/service";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(await emailStatus(uid), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(await disconnectEmail(uid));
  } catch (error) {
    return errorResponse(error);
  }
}
