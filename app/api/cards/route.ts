import { randomUUID } from "node:crypto";
import { requireUser, errorResponse } from "@/lib/auth";
import { getState, updateState } from "@/lib/store";
import { proposeAction } from "@/lib/tools";
import { readJsonObject } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json({ cards: (await getState(uid)).cards });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const proposal = await proposeAction(
      uid,
      "web",
      "create_one_time_card",
      await readJsonObject(request),
    );
    // Put the proposal in the chat history so the user can answer "yes" there.
    const eventId = randomUUID();
    await updateState(uid, (s) => {
      s.events.unshift({
        id: eventId,
        type: "agent_message",
        role: "assistant",
        channel: "web",
        text: proposal.reply,
        createdAt: new Date().toISOString(),
      });
    });
    return Response.json({ ...proposal, eventId });
  } catch (error) {
    return errorResponse(error);
  }
}
