// Plain labels for where an assistant reply's facts came from. Shown under
// each reply so students can tell their own data from Brix's math, outside
// sources, and general knowledge.
const LABELS: Record<string, string> = {
  get_upcoming_charges: "Your charges",
  get_subscriptions: "Your charges",
  get_saved_summary: "Brix's estimate",
  get_money_news: "News: Google News",
  get_refunds: "Your refund",
  plan_refund: "Brix's math (estimate)",
  get_portfolio: "Practice portfolio · live prices",
  get_stock_news: "News: Yahoo Finance",
  get_gift_cards: "Your gift cards",
  mark_to_cancel: "Waits for your yes",
  set_reminder: "Waits for your yes",
  create_one_time_card: "Waits for your yes",
  practice_trade: "Waits for your yes",
};

export function sourcesFor(tools: Iterable<string>, demo = false): string[] {
  const labels = [...new Set([...tools].map((t) => LABELS[t]).filter(Boolean))];
  if (!labels.length) return ["General info, not your data"];
  return demo ? labels.map((l) => `${l} (sample)`) : labels;
}
