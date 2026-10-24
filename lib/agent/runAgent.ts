import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { getState, updateState } from "../store";
import { HttpError, isDemo } from "../auth";
import { confirmAction, executeTool, proposeAction } from "../tools";
import { systemPrompt } from "./systemPrompt";
import { toolSchemas } from "./toolSchemas";
import type { Channel, Charge } from "../types";

let client: Anthropic | undefined;

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
        .map((c) => `${c.merchant}, $${c.amount.toFixed(2)} on ${c.nextDate}`)
        .join("; ")}. Ask me to set a reminder or mark a charge to cancel.`
    : "No upcoming charges in the next 14 days. Add a trial or connect your bank to get started.";
}

export async function runAgent(
  uid: string,
  message: string,
  channel: Channel = "web",
) {
  if (typeof message !== "string" || !message.trim() || message.length > 2000)
    throw new HttpError(400, "Send a message of 1–2,000 characters.");
  const input = message.trim();
  let reply: string;
  if (/^(yes|yes please|confirm|go ahead)[.!]?$/i.test(input))
    reply = await confirmAction(uid, channel);
  else if (/^(no|never mind|nevermind|stop)[.!]?$/i.test(input)) {
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
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...history,
      { role: "user", content: input },
    ];
    reply =
      "I couldn't complete that request. Please try one action at a time.";
    const deadline = Date.now() + 10000;
    for (let turn = 0; turn < 4 && Date.now() < deadline; turn++) {
      let response: Anthropic.Beta.BetaMessage;
      try {
        response = await (client ??= new Anthropic()).beta.messages.create(
          {
            model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
            max_tokens: 16000,
            system: `${systemPrompt}\nToday: ${new Date().toISOString().slice(0, 10)}. Channel: ${channel}.`,
            messages,
            tools: toolSchemas,
            tool_choice: { type: "auto", disable_parallel_tool_use: true },
            output_config: { effort: "low" },
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          },
          {
            timeout: Math.max(1, deadline - Date.now()),
            maxRetries: 0,
          },
        );
      } catch {
        throw new HttpError(
          502,
          "The assistant provider is unavailable. Please try again.",
        );
      }
      if (response.stop_reason === "refusal") {
        reply = "I can't help with that one. Try asking about your charges.";
        break;
      }
      const calls = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
      );
      if (response.stop_reason !== "tool_use" || !calls.length) {
        const text = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
        reply = text || reply;
        break;
      }
      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        let output: unknown;
        let failed = false;
        try {
          output = await executeTool(
            uid,
            channel,
            call.name,
            call.input as Record<string, unknown>,
          );
        } catch (error) {
          failed = true;
          output = {
            error:
              error instanceof HttpError
                ? error.message
                : "That action failed. Try again.",
          };
        }
        if (
          output &&
          typeof output === "object" &&
          "confirmationRequired" in output &&
          "reply" in output
        ) {
          reply = String(output.reply);
          turn = 4;
          break;
        }
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(output),
          is_error: failed,
        });
      }
      if (turn >= 4) break;
      messages.push({ role: "user", content: results });
    }
  }
  await updateState(uid, (s) => {
    const createdAt = new Date().toISOString();
    s.events.unshift(
      {
        id: randomUUID(),
        type: "agent_message",
        role: "assistant",
        channel,
        text: reply,
        createdAt,
      },
      {
        id: randomUUID(),
        type: "agent_message",
        role: "user",
        channel,
        text: input,
        createdAt,
      },
    );
  });
  return reply;
}
