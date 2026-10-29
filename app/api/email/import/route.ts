import { requireUser, errorResponse } from "@/lib/auth";
import { importEmailCandidates } from "@/lib/email/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(
      await importEmailCandidates(uid, await request.json()),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
