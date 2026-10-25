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
  tool(
    "get_gift_cards",
    "Read the student's gift cards: unspent balances, cards expiring soon, and cards for a store they already pay",
  ),
  tool(
    "get_refunds",
    "Read school refunds (financial aid money sent back after tuition), including how much is borrowed",
  ),
  tool(
    "plan_refund",
    "Estimate a plan for a refund: essentials, emergency fund, returning unused loan money within 120 days, saving the rest. Read-only.",
    {
      refund_id: { type: "string" },
      monthly_living: { type: "number" },
      months_until_next: { type: "number" },
      current_savings: { type: "number" },
      years_until_repayment: { type: "number" },
    },
  ),
  tool(
    "get_portfolio",
    "Read the practice portfolio (virtual money, real prices): value, gain, positions, rules",
  ),
  tool("get_stock_news", "Read recent news for practice-list symbols", {
    symbols: { type: "array", items: { type: "string" } },
  }),
  tool(
    "practice_trade",
    'Propose a practice trade with virtual money; amount is dollars, or "all" to sell a whole position',
    {
      symbol: { type: "string" },
      side: { type: "string", enum: ["buy", "sell"] },
      amount: { type: ["number", "string"] },
    },
    ["symbol", "side", "amount"],
  ),
];
