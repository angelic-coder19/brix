import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { isTapback } from "@/lib/agent/persona";
import { readJsonObject } from "@/lib/http";
import { updateState } from "@/lib/store";
export const runtime = "nodejs";
/** Lets a user tap back an emoji onto one of Brix's chat messages. */
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await readJsonObject(request);
    const { eventId, emoji } = body;
    if (typeof eventId !== "string" || eventId.length > 100)
      throw new HttpError(400, "Choose a message to react to.");
    if (emoji !== null && !isTapback(emoji))
      throw new HttpError(400, "That reaction isn't available.");
    let found = false;
    await updateState(uid, (s) => {
      const event = s.events.find(
        (e) =>
          e.id === eventId &&
          e.type === "agent_message" &&
          e.role === "assistant",
      );
      if (!event) return;
      found = true;
      if (emoji) event.reaction = emoji;
      else delete event.reaction;
    });
    if (!found) throw new HttpError(404, "That message no longer exists.");
    return Response.json({ eventId, reaction: emoji });
  } catch (error) {
    return errorResponse(error);
  }
}
