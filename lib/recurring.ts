import type { Charge } from "./types";
export interface RecurringStream {
  stream_id: string;
  merchant_name?: string;
  description?: string;
  average_amount: { amount: number };
  frequency: string;
  last_date: string;
  predicted_next_date?: string;
  is_active: boolean;
}
export function predictNextDate(
  last: string,
  frequency: Charge["frequency"],
  now = new Date(),
): string {
  const date = new Date(`${last}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid charge date.");
  const day = date.getUTCDate();
  const advance = () => {
    if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7);
    else {
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + (frequency === "annual" ? 12 : 1));
      const end = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
      ).getUTCDate();
      date.setUTCDate(Math.min(day, end));
    }
  };
  advance();
  for (let i = 0; date < now && i < 1000; i++) advance();
  return date.toISOString().slice(0, 10);
}
export function normalizeRecurring(
  streams: RecurringStream[],
  now = new Date(),
): Charge[] {
  return streams
    .filter(
      (s) =>
        s.is_active &&
        Number.isFinite(s.average_amount?.amount) &&
        s.average_amount.amount > 0,
    )
    .map((s) => {
      const frequency: Charge["frequency"] =
        (
          {
            WEEKLY: "weekly",
            MONTHLY: "monthly",
            ANNUALLY: "annual",
          } as Record<string, Charge["frequency"]>
        )[s.frequency] ?? "unknown";
      return {
        id: `plaid-${s.stream_id}`,
        plaidStreamId: s.stream_id,
        kind: "subscription",
        merchant:
          s.merchant_name ||
          cleanDescriptor(s.description) ||
          "Recurring charge",
        amount: Math.round(s.average_amount.amount * 100) / 100,
        frequency,
        lastDate: s.last_date,
        nextDate:
          s.predicted_next_date || predictNextDate(s.last_date, frequency, now),
        status: "active",
        source: "plaid",
        usageNote:
          frequency === "unknown"
            ? "Estimated date; verify with the merchant."
            : "Detected from bank transaction history.",
      };
    });
}

const BRANDS: Record<string, string> = {
  chatgpt: "ChatGPT",
  openai: "OpenAI",
  netflix: "Netflix",
  spotify: "Spotify",
  youtube: "YouTube",
  icloud: "iCloud+",
  apple: "Apple",
  hulu: "Hulu",
  disney: "Disney+",
  adobe: "Adobe",
  amazon: "Amazon",
  prime: "Amazon Prime",
  duolingo: "Duolingo",
  notion: "Notion",
  github: "GitHub",
};
const NOISE =
  /\b(subscr\w*|recurring|payment|pmt|purchase|debit|pos|ach|autopay|monthly|annual|bill|www|com|inc|llc)\b/gi;

/** Turns a bank descriptor like "OPENAI *CHATGPT SUBSCR" into "ChatGPT". */
export function cleanDescriptor(description?: string) {
  if (!description) return "";
  // Card processors put the product after "*", e.g. "SQ *COFFEE", "OPENAI *CHATGPT".
  const part = description.includes("*")
    ? description.split("*").pop()!
    : description;
  const words = part
    .replace(NOISE, " ")
    .replace(/[^\p{L}\p{N}+&' ]/gu, " ")
    .replace(/\b\d+\b/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return description.trim().slice(0, 60);
  const brand = BRANDS[words[0].toLowerCase()];
  if (brand) return brand;
  return words
    .slice(0, 4)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 60);
}
