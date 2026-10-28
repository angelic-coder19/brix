import { summarizeCharges } from "./summary";
import type { AppState, IncomeFrequency, IncomeKind } from "./types";

// "This month: $X in minus $Y subscriptions out minus $Z set aside = $W
// left." Money in is what the student typed plus any school refund that
// landed this month; out is the monthly cost of tracked subscriptions; set
// aside is what a refund plan already earmarked (loan to return, emergency
// fund, savings). Everything is an estimate built from the student's data.

export const INCOME_KINDS: Record<IncomeKind, string> = {
  paycheck: "Paycheck",
  refund: "Refund",
  scholarship: "Scholarship",
  side_hustle: "Side hustle",
  other: "Other",
};
export const INCOME_FREQUENCIES: Record<IncomeFrequency, string> = {
  once: "One time",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
};
const PER_MONTH: Record<IncomeFrequency, number> = {
  once: 1,
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
};
const ASIDE = new Set(["return_loan", "prepay_loan", "emergency", "save"]);
const round = (n: number) => Math.round(n * 100) / 100;

export interface MoneyPicture {
  month: string;
  in: number;
  /** Money in by kind; school refunds that landed this month count as refund. */
  byKind: Partial<Record<IncomeKind, number>>;
  /** The borrowed part of this month's refunds, already inside `in`. */
  borrowed: number;
  out: number;
  aside: number;
  left: number;
}

export function moneyPicture(state: AppState, now = Date.now()): MoneyPicture {
  const month = new Date(now).toISOString().slice(0, 7);
  const byKind: Partial<Record<IncomeKind, number>> = {};
  const add = (kind: IncomeKind, amount: number) =>
    (byKind[kind] = round((byKind[kind] ?? 0) + amount));
  for (const s of state.income ?? []) {
    if (s.frequency === "once" && s.receivedOn.slice(0, 7) !== month) continue;
    add(s.kind, s.amount * PER_MONTH[s.frequency]);
  }
  let borrowed = 0,
    aside = 0;
  for (const r of state.refunds ?? []) {
    if (r.status === "dismissed" || r.receivedOn.slice(0, 7) !== month)
      continue;
    add("refund", r.amount);
    borrowed += r.loanAmount ?? (r.funding === "loan" ? r.amount : 0);
    aside += (r.plan?.steps ?? [])
      .filter((s) => ASIDE.has(s.key))
      .reduce((sum, s) => sum + s.amount, 0);
  }
  const total = round(Object.values(byKind).reduce((s, n) => s + n, 0));
  const out = round(summarizeCharges(state.charges).monthly);
  aside = round(aside);
  return {
    month,
    in: total,
    byKind,
    borrowed: round(borrowed),
    out,
    aside,
    left: round(total - out - aside),
  };
}
