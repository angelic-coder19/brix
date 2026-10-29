import { randomUUID } from "node:crypto";
import { HttpError } from "./auth";
import { INCOME_FREQUENCIES, INCOME_KINDS } from "./money-picture";
import type {
  AppState,
  IncomeFrequency,
  IncomeKind,
  IncomeSource,
} from "./types";

// The "Money in" list behind the Overview money picture. Server only.

export const MAX_INCOME = 20;
const round = (n: number) => Math.round(n * 100) / 100;

/** Checks the "Money in" form and returns a clean entry. */
export function parseIncome(
  body: Record<string, unknown>,
  today = new Date().toISOString().slice(0, 10),
): IncomeSource {
  const kind = body.kind as IncomeKind;
  if (!(kind in INCOME_KINDS))
    throw new HttpError(400, "Choose where the money comes from.");
  const frequency = body.frequency as IncomeFrequency;
  if (!(frequency in INCOME_FREQUENCIES))
    throw new HttpError(400, "Choose how often it comes in.");
  const n =
    typeof body.amount === "string" && body.amount.trim()
      ? Number(body.amount)
      : body.amount;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > 100000)
    throw new HttpError(400, "Amount must be between $0 and $100,000.");
  const receivedOn =
    typeof body.receivedOn === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.receivedOn) &&
    body.receivedOn <= today
      ? body.receivedOn
      : today;
  return { id: randomUUID(), kind, amount: round(n), frequency, receivedOn };
}

export function addIncome(state: AppState, body: Record<string, unknown>) {
  state.income ??= [];
  if (state.income.length >= MAX_INCOME)
    throw new HttpError(409, `You can list up to ${MAX_INCOME} sources.`);
  const entry = parseIncome(body);
  state.income.push(entry);
  return entry;
}

export function removeIncome(state: AppState, id: string) {
  const before = state.income?.length ?? 0;
  state.income = (state.income ?? []).filter((s) => s.id !== id);
  if (state.income.length === before)
    throw new HttpError(404, "That entry is already gone.");
}
