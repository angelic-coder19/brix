import type Anthropic from "@anthropic-ai/sdk";
const tool = (
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
): Anthropic.Beta.BetaTool => ({
  name,
  description,
  input_schema: {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  },
});
export const toolSchemas: Anthropic.Beta.BetaTool[] = [
  tool("get_upcoming_charges", "Read upcoming charges", {
    days: { type: "number" },
  }),
  tool(
    "get_subscriptions",
    "Read active subscriptions and monthly equivalent total",
  ),
  tool("get_saved_summary", "Read estimated charges avoided"),
  tool("get_money_news", "Read relevant subscription news"),
  tool(
    "mark_to_cancel",
    "Propose marking a charge to cancel; never actually cancels at merchant",
    { merchant: { type: "string" } },
    ["merchant"],
  ),
  tool(
    "set_reminder",
    "Propose a reminder; when must be an ISO date or N days before",
    { merchant: { type: "string" }, when: { type: "string" } },
    ["merchant", "when"],
  ),
  tool(
    "create_one_time_card",
    "Propose sandbox single-use card",
    { purpose: { type: "string" }, spendLimit: { type: "number" } },
    ["purpose", "spendLimit"],
  ),
];
