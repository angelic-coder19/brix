import type { Refund, RefundFunding } from "../types";

/** The fields Brix reads from a Plaid `/transactions/sync` added transaction. */
export interface IncomingTransaction {
  transaction_id: string;
  amount: number;
  date: string;
  name?: string;
  merchant_name?: string | null;
  personal_finance_category?: { primary?: string; detailed?: string } | null;
}

const MIN_AMOUNT = 200;
// How schools and their refund processors label aid refunds on bank statements.
const REFUND =
  /\b(financial aid|fin ?aid|student (aid|account|acct|refund)|stu ?acct|bursar|tuition refund|scholarships?|disburs\w*|disb|title iv|bankmobile|nelnet|higher one|cashnet|transact campus|refund (from|disb))\b|\b(univ|university|college|state u)\b.*\brefund\b|\brefund\b.*\b(univ|university|college)\b/i;
// Deposits that mention "refund" but aren't aid.
const NOT_AID =
  /\b(tax|irs|treas(ury)? 310|amazon|walmart|target|venmo|zelle|paypal|cash app|return|chargeback|uber|lyft|airline)\b/i;
const SCHOOLISH = /\b(univ|university|college|state|school|campus|bursar)\b/i;

export function guessFunding(text: string): RefundFunding {
  const loan = /\b(loan|direct ?loan|dl|stafford|plus)\b/i.test(text);
  const grant = /\b(grant|pell)\b/i.test(text);
  const scholarship = /\bscholar/i.test(text);
  const kinds = [loan, grant, scholarship].filter(Boolean).length;
  if (kinds > 1) return "mixed";
  return loan
    ? "loan"
    : grant
      ? "grant"
      : scholarship
        ? "scholarship"
        : "unknown";
}

/** Returns a refund when a deposit looks like a school aid refund. */
export function detectRefund(tx: IncomingTransaction): Refund | null {
  const amount = -tx.amount; // Plaid: negative amounts are money in.
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) return null;
  const text = `${tx.name ?? ""} ${tx.merchant_name ?? ""}`.trim();
  if (!text || NOT_AID.test(text)) return null;
  const income = /^INCOME|TRANSFER_IN/.test(
    tx.personal_finance_category?.primary ?? "",
  );
  if (!REFUND.test(text) && !(income && SCHOOLISH.test(text))) return null;
  return {
    id: `plaid-${tx.transaction_id}`,
    amount: Math.round(amount * 100) / 100,
    receivedOn: tx.date,
    source: "plaid",
    descriptor: text.slice(0, 120),
    funding: guessFunding(text),
    status: "new",
  };
}
