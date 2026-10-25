import test from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { runAnthropicTurn } from "../lib/agent/anthropic";

function message(
  content: Anthropic.Beta.BetaContentBlock[],
  stop_reason = "end_turn",
) {
  return { content, stop_reason } as Anthropic.Beta.BetaMessage;
}

test("Anthropic tool results return to the model with the original tool ID", async () => {
  let requests = 0;
  const reply = await runAnthropicTurn(
    "What's next?",
    "web",
    [],
    async (name, args) => {
      assert.equal(name, "get_upcoming_charges");
      assert.deepEqual(args, { days: 7 });
      return [{ merchant: "Spotify", amount: 11.99 }];
    },
    async (body, options) => {
      assert.equal(options.maxRetries, 0);
      assert.ok(options.timeout <= 10000);
      if (++requests === 1)
        return message(
          [
            {
              type: "tool_use",
              id: "tool-1",
              name: "get_upcoming_charges",
              input: { days: 7 },
            },
          ],
          "tool_use",
        );
      const last = body.messages.at(-1)!;
      assert.equal(last.role, "user");
      assert.deepEqual(last.content, [
        {
          type: "tool_result",
          tool_use_id: "tool-1",
          content: '[{"merchant":"Spotify","amount":11.99}]',
          is_error: false,
        },
      ]);
      return message([
        { type: "text", text: "Spotify: $11.99.", citations: null },
      ]);
    },
  );
  assert.equal(reply, "Spotify: $11.99.");
  assert.equal(requests, 2);
});

test("Anthropic proposals stop immediately for a separate user confirmation", async () => {
  let requests = 0;
  const reply = await runAnthropicTurn(
    "Cancel Spotify",
    "whatsapp",
    [],
    async () => ({
      confirmationRequired: true,
      reply: "Mark Spotify to cancel? Reply yes.",
    }),
    async () => {
      requests++;
      return message(
        [
          {
            type: "tool_use",
            id: "proposal",
            name: "mark_to_cancel",
            input: { merchant: "Spotify" },
          },
        ],
        "tool_use",
      );
    },
  );
  assert.equal(requests, 1);
  assert.equal(reply, "Mark Spotify to cancel? Reply yes.");
});

test("provider failures expose no provider secrets and refusals execute no tools", async () => {
  const execute = async () => {
    assert.fail("No tools should run");
  };
  await assert.rejects(
    runAnthropicTurn("Hi", "web", [], execute, async () => {
      throw new Error("sensitive provider detail");
    }),
    /assistant provider is unavailable/,
  );
  assert.match(
    await runAnthropicTurn("Hi", "web", [], execute, async () =>
      message([], "refusal"),
    ),
    /can't help/,
  );
});

test("assistant replies are plain text; WhatsApp keeps its bold", async () => {
  const { plainText } = await import("../lib/agent/anthropic");
  const raw = "## Coming up\n**Netflix** is $15.49\n- Spotify on Fri";
  assert.equal(
    plainText(raw, "web"),
    "Coming up\nNetflix is $15.49\n- Spotify on Fri",
  );
  assert.equal(
    plainText(raw, "whatsapp"),
    "Coming up\n*Netflix* is $15.49\n• Spotify on Fri",
  );
});
