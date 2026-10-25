import Anthropic from "@anthropic-ai/sdk";
import { HttpError } from "../auth";
import { systemPrompt } from "./systemPrompt";
import { toolSchemas } from "./toolSchemas";
import type { Channel } from "../types";

let client: Anthropic | undefined;
/**
 * Time allowed for all model and tool rounds. WhatsApp replies go back in
 * Twilio's webhook response, which times out at 15 seconds, so 12 seconds
 * leaves room for storage and network overhead.
 */
export const budgetMs = (channel: Channel) =>
  channel === "whatsapp" ? 12000 : 10000;
export const DEFAULT_MODEL = "claude-opus-5-5";
type CreateMessage = (
  body: Anthropic.Beta.MessageCreateParamsNonStreaming,
  options: { timeout: number; maxRetries: number },
) => Promise<Anthropic.Beta.BetaMessage>;

/** Runs provider/tool turns; the caller retains identity and confirmation control. */
export async function runAnthropicTurn(
  input: string,
  channel: Channel,
  history: Anthropic.Beta.BetaMessageParam[],
  execute: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  create: CreateMessage = (body, options) =>
    (client ??= new Anthropic()).beta.messages.create(body, options),
): Promise<string> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history,
    { role: "user", content: input },
  ];
  let reply =
    "I couldn't complete that request. Please try one action at a time.";
  const deadline = Date.now() + budgetMs(channel);
  for (let turn = 0; turn < 4 && Date.now() < deadline; turn++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await create(
        {
          model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
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
      reply = text ? plainText(text, channel) : reply;
      break;
    }
    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      let output: unknown;
      let failed = false;
      try {
        output = await execute(
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
  return reply;
}

/** Chat surfaces show raw text, so strip Markdown; WhatsApp keeps its own *bold*. */
export function plainText(text: string, channel: Channel) {
  return text
    .replace(/\*\*(.+?)\*\*/g, channel === "whatsapp" ? "*$1*" : "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, channel === "whatsapp" ? "• " : "- ")
    .trim();
}
