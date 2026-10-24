import { randomUUID } from "node:crypto";
import { getState, updateState } from "../store";
import { HttpError, isDemo } from "../auth";
import { confirmAction, executeTool, proposeAction } from "../tools";
import { systemPrompt } from "./systemPrompt";
import { toolSchemas } from "./toolSchemas";
import type { Channel, Charge } from "../types";

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
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL)
      throw new HttpError(
        503,
        "The assistant needs OPENAI_API_KEY and OPENAI_MODEL configured.",
      );
    const state = await getState(uid);
    type Message = {
      role: string;
      content: string | null;
      tool_call_id?: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
    const history: Message[] = state.events
      .filter(
        (e) => e.type === "agent_message" && e.channel === channel && e.role,
      )
      .slice(0, 10)
      .reverse()
      .map((e) => ({ role: e.role!, content: e.text }));
    const messages: Message[] = [
      {
        role: "system",
        content: `${systemPrompt}\nToday: ${new Date().toISOString().slice(0, 10)}. Channel: ${channel}.`,
      },
      ...history,
      { role: "user", content: input },
    ];
    reply =
      "I couldn't complete that request. Please try one action at a time.";
    const deadline = Date.now() + 10000;
    for (let turn = 0; turn < 4 && Date.now() < deadline; turn++) {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL,
            messages,
            tools: toolSchemas,
            parallel_tool_calls: false,
          }),
          signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
        },
      );
      if (!response.ok)
        throw new HttpError(
          502,
          "The assistant provider is unavailable. Please try again.",
        );
      const result = await response.json();
      const answer = result.choices?.[0]?.message as Message | undefined;
      if (!answer)
        throw new HttpError(502, "The assistant returned no answer.");
      if (!answer.tool_calls?.length) {
        reply = answer.content || reply;
        break;
      }
      messages.push(answer);
      for (const call of answer.tool_calls) {
        let output: unknown;
        try {
          output = await executeTool(
            uid,
            channel,
            call.function.name,
            JSON.parse(call.function.arguments),
          );
        } catch (error) {
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
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(output),
        });
      }
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
