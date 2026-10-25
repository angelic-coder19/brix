import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { runAnthropicTurn } from "./anthropic";
import { getState, updateState } from "../store";
import { HttpError, isDemo } from "../auth";
import { confirmAction, executeTool, proposeAction } from "../tools";
import { buildMeta, type AgentMeta, type AgentOutcome } from "./persona";
import type { Channel, Charge } from "../types";

export { DEFAULT_MODEL } from "./anthropic";

async function demoReply(uid: string, message: string, channel: Channel) {
  const state = await getState(uid);
  const lower = message.toLowerCase();
  const merchant = state.charges.find((c) =>
    lower.includes(c.merchant.toLowerCase()),
  );
  if (/cancel/.test(lower))
    return (
      await proposeAction(uid, channel, "mark_to_cancel", {
        merchant: merchant?.merchant || message.replace(/.*cancel\s*/i, ""),
      })
    ).reply;
  if (/remind/.test(lower)) {
    let when = message.match(/\d{4}-\d{2}-\d{2}|\d+ days? before/i)?.[0];
    if (!when) {
      const weekday = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ].findIndex((d) => lower.includes(d));
      if (weekday >= 0) {
        const date = new Date();
        date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7 || 7));
        when = date.toISOString().slice(0, 10);
      }
    }
    if (!merchant || !when)
      return "Which merchant and date? Try ‘remind me about Spotify Friday’.";
    return (
      await proposeAction(uid, channel, "set_reminder", {
        merchant: merchant.merchant,
        when,
      })
    ).reply;
  }
  if (/card/.test(lower))
    return "Use Cards to enter a purpose and spending limit. I'll ask you to confirm before creating a demo card.";
  if (/saved|avoid/.test(lower)) {
    const result = (await executeTool(uid, channel, "get_saved_summary")) as {
      amount: number;
    };
    return `You've marked $${result.amount.toFixed(2)} in charges to avoid this month (estimated). Finish any cancellations on the merchant sites.`;
  }
  if (/news/.test(lower)) return "Live news briefing isn't connected yet.";
  const charges = (await executeTool(
    uid,
    channel,
    "get_upcoming_charges",
  )) as Charge[];
  return charges.length
    ? `Coming up: ${charges
        .slice(0, 3)
        .map(
          (c) =>
            `${c.merchant}, $${c.amount.toFixed(2)} on ${friendlyDate(c.nextDate)}`,
        )
        .join("; ")}. Ask me to set a reminder or mark a charge to cancel.`
    : "No upcoming charges in the next 14 days. Add a trial or connect your bank to get started.";
}

function friendlyDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export interface AgentTurn {
  reply: string;
  meta: AgentMeta;
  userEventId: string;
  assistantEventId: string;
}

export async function runAgent(
  uid: string,
  message: string,
  channel: Channel = "web",
) {
  return (await runAgentTurn(uid, message, channel)).reply;
}

export async function runAgentTurn(
  uid: string,
  message: unknown,
  channel: Channel = "web",
): Promise<AgentTurn> {
  if (typeof message !== "string" || !message.trim() || message.length > 2000)
    throw new HttpError(400, "Send a message of 1–2,000 characters.");
  const input = message.trim();
  const before = (await getState(uid)).pendingActions?.[channel];
  let outcome: AgentOutcome = "answered";
  let action: string | undefined;
  let reply: string;
  if (/^(yes|yes please|confirm|go ahead)[.!]?$/i.test(input)) {
    try {
      reply = await confirmAction(uid, channel);
      outcome = "confirmed";
      action = before?.name;
    } catch (error) {
      // "yes" with nothing pending is a conversational slip, not a failure.
      if (!(error instanceof HttpError) || !/No pending/.test(error.message))
        throw error;
      reply = error.message;
    }
  } else if (/^(no|never mind|nevermind|stop)[.!]?$/i.test(input)) {
    outcome = "cleared";
    await updateState(uid, (s) => {
      if (s.pendingActions?.[channel]?.status)
        throw new HttpError(
          409,
          "A card request needs provider review before it can be cleared.",
        );
      if (s.pendingActions) delete s.pendingActions[channel];
    });
    reply = "Okay, I cleared the pending action.";
  } else if (isDemo()) reply = await demoReply(uid, input, channel);
  else {
    if (!process.env.ANTHROPIC_API_KEY)
      throw new HttpError(
        503,
        "The assistant needs ANTHROPIC_API_KEY configured.",
      );
    const state = await getState(uid);
    const history: Anthropic.Beta.BetaMessageParam[] = state.events
      .filter(
        (e) =>
          e.type === "agent_message" &&
          e.channel === channel &&
          (e.role === "user" || e.role === "assistant"),
      )
      .slice(0, 10)
      .reverse()
      .map((e) => ({ role: e.role as "user" | "assistant", content: e.text }));
    // The Messages API requires the conversation to open with a user turn.
    while (history[0]?.role === "assistant") history.shift();
    reply = await runAnthropicTurn(input, channel, history, (name, args) =>
      executeTool(uid, channel, name, args),
    );
  }
  const userEventId = randomUUID(),
    assistantEventId = randomUUID();
  let meta: AgentMeta | undefined;
  await updateState(uid, (s) => {
    const pending = s.pendingActions?.[channel];
    if (outcome === "answered" && pending && pending.id !== before?.id) {
      outcome = "proposed";
      action = pending.name;
    }
    meta = buildMeta({
      message: input,
      outcome,
      action,
      charges: s.charges,
      hasPending: !!s.pendingActions?.[channel],
    });
    const createdAt = new Date().toISOString();
    s.events.unshift(
      {
        id: assistantEventId,
        type: "agent_message",
        role: "assistant",
        channel,
        text: reply,
        createdAt,
      },
      {
        id: userEventId,
        type: "agent_message",
        role: "user",
        channel,
        text: input,
        createdAt,
        ...(meta.reaction ? { reaction: meta.reaction } : {}),
      },
    );
  });
  return { reply, meta: meta!, userEventId, assistantEventId };
}
