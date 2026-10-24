import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { proposeAction, confirmAction } from "@/lib/tools";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await request.json();
    if (body.name === "confirm_voice_action")
      return Response.json({
        reply: await confirmAction(
          uid,
          "voice",
          typeof body.pin === "string" ? body.pin : undefined,
        ),
      });
    if (!body.args || typeof body.args !== "object")
      throw new HttpError(400, "Action arguments are required.");
    return Response.json(await proposeAction(uid, "web", body.name, body.args));
  } catch (error) {
    return errorResponse(error);
  }
}
