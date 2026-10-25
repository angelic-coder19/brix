import { randomUUID } from "node:crypto";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { getSecret, getState, updateState } from "@/lib/store";
import { closeSandboxCard } from "@/lib/lithic";
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
/** Closes a card. Closing is permanent and needs no confirmation: it only removes spending ability. */
export async function PATCH(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await readJsonObject(request);
    if (typeof body.id !== "string" || body.state !== "CLOSED")
      throw new HttpError(400, 'Send the card `id` and `state: "CLOSED"`.');
    const card = (await getState(uid)).cards.find((c) => c.id === body.id);
    if (!card) throw new HttpError(404, "That card doesn't exist.");
    if (card.state !== "CLOSED") {
      const token = (await getSecret(uid))[`card_${card.id}`];
      if (card.source === "lithic") {
        if (typeof token !== "string")
          throw new HttpError(409, "This card's provider token is missing.");
        try {
          await closeSandboxCard(token);
        } catch {
          throw new HttpError(
            502,
            "The card provider couldn't close this card. Try again.",
          );
        }
      }
      await updateState(uid, (s) => {
        const target = s.cards.find((c) => c.id === card.id);
        if (target) target.state = "CLOSED";
        s.events.unshift({
          id: randomUUID(),
          type: "card_closed",
          channel: "web",
          text: `Closed the card for ${card.purpose}.`,
          createdAt: new Date().toISOString(),
        });
      });
    }
    return Response.json({ cards: (await getState(uid)).cards });
  } catch (error) {
    return errorResponse(error);
  }
}
