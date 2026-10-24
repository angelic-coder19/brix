import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { proposeAction, confirmAction } from "@/lib/tools";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await readJsonObject(request);
    if (body.name === "confirm_voice_action")
      return Response.json({
        reply: await confirmAction(
          uid,
          "voice",
          typeof body.pin === "string" ? body.pin : undefined,
        ),
      });
    if (typeof body.name !== "string")
      throw new HttpError(400, "Choose an action.");
    if (!body.args || typeof body.args !== "object" || Array.isArray(body.args))
      throw new HttpError(400, "Action arguments are required.");
    return Response.json(
      await proposeAction(
        uid,
        "web",
        body.name,
        body.args as Record<string, unknown>,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
