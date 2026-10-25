/**
 * Brix's personality layer: moods, emoji reactions, and quick replies.
 * Pure functions with no server imports so the client, the API routes,
 * and tests all share one source of truth.
 */
export type BuddyMood =
  | "idle"
  | "listening"
  | "thinking"
  | "talking"
  | "happy"
  | "celebrate"
  | "concerned"
  | "error";

export const BUDDY_MOODS: readonly BuddyMood[] = [
  "idle",
  "listening",
  "thinking",
  "talking",
  "happy",
  "celebrate",
  "concerned",
  "error",
];

/** How each mood reads to a screen reader; shared by BrixBuddy and BrixMark. */
export const MOOD_LABEL: Record<BuddyMood, string> = {
  idle: "relaxed",
  listening: "listening closely",
  thinking: "thinking",
  talking: "talking",
  happy: "happy",
  celebrate: "celebrating",
  concerned: "concerned about an upcoming charge",
  error: "a little confused",
};

/** Reactions a user can tap back onto Brix's messages. */
export const TAPBACKS = ["❤️", "👍", "😂", "😮", "🙏", "👎"] as const;
export type Tapback = (typeof TAPBACKS)[number];
export const isTapback = (value: unknown): value is Tapback =>
  typeof value === "string" && (TAPBACKS as readonly string[]).includes(value);

/** Reactions Brix may put on a user's message. */
export const BOT_REACTIONS = [...TAPBACKS, "🎉", "⏰", "💳", "👀", "🫡"] as const;

export type AgentOutcome = "answered" | "proposed" | "confirmed" | "cleared";

export interface AgentMeta {
  outcome: AgentOutcome;
  action?: string;
  mood: BuddyMood;
  reaction?: string;
  celebrate: boolean;
  suggestions: string[];
}

export interface PersonaCharge {
  merchant: string;
  nextDate: string;
  status: string;
}

const DAY = 86400000;

export function daysUntil(isoDate: string, now = Date.now()) {
  const target = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((target - today) / DAY);
}

/** The soonest charge that is still live, if any. */
export function nextLiveCharge(charges: PersonaCharge[], now = Date.now()) {
  return charges
    .filter(
      (c) =>
        (c.status === "active" || c.status === "trial") &&
        daysUntil(c.nextDate, now) >= 0,
    )
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0];
}

/** Brix gets visibly concerned when money is about to leave in 3 days or fewer. */
export function isChargeImminent(charges: PersonaCharge[], now = Date.now()) {
  const next = nextLiveCharge(charges, now);
  return !!next && daysUntil(next.nextDate, now) <= 3;
}

export function reactionFor(
  message: string,
  outcome: AgentOutcome,
  action?: string,
): string | undefined {
  const text = message.toLowerCase();
  if (outcome === "confirmed") {
    if (action === "mark_to_cancel") return "🎉";
    if (action === "set_reminder") return "⏰";
    if (action === "create_one_time_card") return "💳";
    return "👍";
  }
  if (outcome === "cleared") return "🫡";
  if (/\b(thanks|thank you|thx|ty|appreciate)\b/.test(text)) return "🙏";
  if (/\b(lol|lmao|haha+)\b/.test(text)) return "😂";
  if (/\b(love|awesome|amazing|great|nice|cool)\b/.test(text)) return "❤️";
  if (/\b(broke|yikes|oh no|omg|wtf)\b/.test(text)) return "😮";
  if (outcome === "proposed") return "👀";
  return undefined;
}

export function moodFor(
  outcome: AgentOutcome,
  action: string | undefined,
  charges: PersonaCharge[],
  now = Date.now(),
): BuddyMood {
  if (outcome === "confirmed")
    return action === "mark_to_cancel" ? "celebrate" : "happy";
  if (outcome === "cleared") return "idle";
  if (outcome === "proposed") return "listening";
  return isChargeImminent(charges, now) ? "concerned" : "happy";
}

export function suggestionsFor(
  charges: PersonaCharge[],
  hasPending: boolean,
  now = Date.now(),
): string[] {
  if (hasPending) return ["Yes", "No"];
  const next = nextLiveCharge(charges, now);
  const list = ["What's coming up?"];
  if (next) {
    list.push(`Remind me about ${next.merchant} 2 days before`);
    list.push(`Mark ${next.merchant} to cancel`);
  }
  list.push("How much have I saved?");
  return list;
}

export function buildMeta(input: {
  message: string;
  outcome: AgentOutcome;
  action?: string;
  charges: PersonaCharge[];
  hasPending: boolean;
  now?: number;
}): AgentMeta {
  const now = input.now ?? Date.now();
  return {
    outcome: input.outcome,
    ...(input.action ? { action: input.action } : {}),
    mood: moodFor(input.outcome, input.action, input.charges, now),
    reaction: reactionFor(input.message, input.outcome, input.action),
    celebrate:
      input.outcome === "confirmed" &&
      (input.action === "mark_to_cancel" || input.action === "set_reminder"),
    suggestions: suggestionsFor(input.charges, input.hasPending, now),
  };
}
