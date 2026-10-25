import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { runAnthropicTurn } from "./anthropic";
import { getState, updateState } from "../store";
import { HttpError, isDemo } from "../auth";
import { confirmAction, executeTool, proposeAction } from "../tools";
import { buildMeta, type AgentMeta, type AgentOutcome } from "./persona";
import { sourcesFor } from "./sources";
import type { Channel, Charge, Refund } from "../types";

const DAY = 86400000;

export { DEFAULT_MODEL } from "./anthropic";

/** Offline demo answers, with the tools they read so sources stay honest. */
async function demoReply(
  uid: string,
  message: string,
  channel: Channel,
): Promise<{ text: string; tools: string[] }> {
  const text = await demoText(uid, message, channel);
  return typeof text === "string" ? { text, tools: [] } : text;
}

async function demoText(
  uid: string,
  message: string,
  channel: Channel,
): Promise<string | { text: string; tools: string[] }> {
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
  if (/refund|borrow|loan/.test(lower)) {
    const { refunds } = (await executeTool(uid, channel, "get_refunds")) as {
      refunds: Refund[];
    };
    const r = refunds[0];
    if (!r)
      return "I don't see a school refund yet. Add one on the Refunds page and I'll help you plan it.";
    const due = new Date(Date.parse(`${r.receivedOn}T12:00:00Z`) + 120 * DAY)
      .toISOString()
      .slice(0, 10);
    return {
      text: r.loanAmount
        ? `Your $${r.amount.toFixed(2)} refund includes $${r.loanAmount.toFixed(2)} in loans. Federal loan money you return by ${friendlyDate(due)} is cancelled with no interest or fees. Want a plan on the Refunds page?`
        : `Your $${r.amount.toFixed(2)} refund arrived ${friendlyDate(r.receivedOn)}. Tell me if any of it was a loan and I'll show the return-by date.`,
      tools: ["get_refunds"],
    };
  }
  if (/gift/.test(lower)) {
    const g = (await executeTool(uid, channel, "get_gift_cards")) as {
      total: number;
      cards: { merchant: string }[];
      expiringSoon: { merchant: string; expiresOn?: string }[];
    };
    const soon = g.expiringSoon[0];
    return {
      text: g.cards.length
        ? `You have $${g.total.toFixed(2)} on ${g.cards.length} gift card${g.cards.length === 1 ? "" : "s"}.${soon?.expiresOn ? ` ${soon.merchant} expires ${friendlyDate(soon.expiresOn)}, so use it first.` : ""}`
        : "No gift cards tracked yet. Add them on the Cards page.",
      tools: ["get_gift_cards"],
    };
  }
  if (/portfolio|invest|stock|practice/.test(lower)) {
    const p = (await executeTool(uid, channel, "get_portfolio")) as {
      total?: number;
      gainPct?: number;
    };
    return {
      text:
        p.total !== undefined
          ? `Your practice portfolio is worth $${p.total.toFixed(2)} in virtual money (${p.gainPct! >= 0 ? "+" : ""}${p.gainPct!.toFixed(2)}%). It's practice only; no real money moves.`
          : "You haven't started a practice portfolio. Open Invest to try it with virtual money.",
      tools: ["get_portfolio"],
    };
  }
  if (/news/.test(lower)) return "Live news briefing isn't connected yet.";
  const charges = (await executeTool(
    uid,
    channel,
    "get_upcoming_charges",
  )) as Charge[];
  const upcoming = charges.length
    ? `Coming up: ${charges
        .slice(0, 3)
        .map(
          (c) =>
            `${c.merchant}, $${c.amount.toFixed(2)} on ${friendlyDate(c.nextDate)}`,
        )
        .join("; ")}. Ask me to set a reminder or mark a charge to cancel.`
    : "No upcoming charges in the next 14 days. Add a trial or connect your bank to get started.";
  return { text: upcoming, tools: ["get_upcoming_charges"] };
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
  const toolsUsed = new Set<string>();
  // Labels only for answers composed from data; confirmations speak for themselves.
  let sources: string[] | undefined;
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
  } else if (isDemo()) {
    const demo = await demoReply(uid, input, channel);
    reply = demo.text;
    if (demo.tools.length) sources = sourcesFor(demo.tools, true);
  } else {
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
    reply = await runAnthropicTurn(input, channel, history, (name, args) => {
      toolsUsed.add(name);
      return executeTool(uid, channel, name, args);
    });
    sources = sourcesFor(toolsUsed);
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
        ...(sources ? { sources } : {}),
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
