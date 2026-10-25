import { randomUUID } from "node:crypto";
import { HttpError, isDemo } from "../auth";
import { getState, updateState } from "../store";
import { sendWhatsApp } from "../twilio";
import { planRefund } from "./plan";
import type {
  Channel,
  LoanType,
  Refund,
  RefundFunding,
  RefundPlanInputs,
} from "../types";

const FUNDING: RefundFunding[] = [
  "loan",
  "grant",
  "scholarship",
  "mixed",
  "unknown",
];
const LOAN_TYPES: LoanType[] = [
  "subsidized",
  "unsubsidized",
  "private",
  "parent_plus",
];
const NOTIFY_WITHIN_DAYS = 14;
const KEEP_WITHIN_DAYS = 180;
const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const daysAgo = (date: string) =>
  (Date.now() - Date.parse(`${date}T12:00:00Z`)) / 86400000;

function money(value: unknown, field: string, max = 100000) {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > max)
    throw new HttpError(
      400,
      `${field} must be a number from 0 to ${max.toLocaleString("en-US")}.`,
    );
  return Math.round(n * 100) / 100;
}

/**
 * Stores newly detected refunds once each. Returns the recent ones so the
 * caller can tell the student.
 */
export async function recordRefunds(
  uid: string,
  found: Refund[],
  channel: Channel,
) {
  const fresh: Refund[] = [];
  await updateState(uid, (s) => {
    s.refunds ??= [];
    for (const refund of found) {
      if (daysAgo(refund.receivedOn) > KEEP_WITHIN_DAYS) continue;
      if (s.refunds.some((r) => r.id === refund.id)) continue;
      const recent = daysAgo(refund.receivedOn) <= NOTIFY_WITHIN_DAYS;
      const stored = {
        ...refund,
        status: recent ? "new" : "dismissed",
      } as Refund;
      s.refunds.unshift(stored);
      if (recent) fresh.push(stored);
      s.events.unshift({
        id: randomUUID(),
        type: "refund_detected",
        channel,
        text: `A ${usd(refund.amount)} school refund arrived${refund.descriptor ? ` (${refund.descriptor})` : ""}. Plan it before it disappears.`,
        createdAt: new Date().toISOString(),
      });
    }
  });
  return fresh;
}

/** Tells the student on WhatsApp when they turned it on; in-app otherwise. */
export async function notifyRefunds(uid: string, refunds: Refund[]) {
  if (!refunds.length || isDemo()) return;
  const { user } = await getState(uid);
  if (!user.whatsappOptIn || !user.phoneE164) return;
  const total = refunds.reduce((sum, r) => sum + r.amount, 0);
  try {
    await sendWhatsApp(
      user.phoneE164,
      `Your ${usd(total)} school refund arrived. Some refunds are borrowed money that's cheaper to return early. Open Brix to plan it: ${process.env.APP_URL ?? ""}/refunds`,
    );
  } catch {
    // The in-app banner still shows; delivery failures never block a sync.
  }
}

export async function addManualRefund(
  uid: string,
  body: Record<string, unknown>,
) {
  const amount = money(body.amount, "Amount");
  if (amount < 1) throw new HttpError(400, "Enter the refund amount.");
  const receivedOn = typeof body.receivedOn === "string" ? body.receivedOn : "";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(receivedOn) ||
    !Number.isFinite(Date.parse(receivedOn)) ||
    daysAgo(receivedOn) < -1 ||
    daysAgo(receivedOn) > 365
  )
    throw new HttpError(
      400,
      "Enter the date the refund arrived (within the last year).",
    );
  const refund: Refund = {
    id: `manual-${randomUUID()}`,
    amount,
    receivedOn,
    source: "manual",
    funding: FUNDING.includes(body.funding as RefundFunding)
      ? (body.funding as RefundFunding)
      : "unknown",
    status: "new",
  };
  applyLoanDetails(refund, body);
  await updateState(uid, (s) => {
    s.refunds ??= [];
    s.refunds.unshift(refund);
    s.events.unshift({
      id: randomUUID(),
      type: "refund_added",
      channel: "web",
      text: `Added a ${usd(amount)} refund to plan.`,
      createdAt: new Date().toISOString(),
    });
  });
  return refund;
}

function applyLoanDetails(refund: Refund, body: Record<string, unknown>) {
  if (body.funding !== undefined) {
    if (!FUNDING.includes(body.funding as RefundFunding))
      throw new HttpError(400, "Choose where the refund came from.");
    refund.funding = body.funding as RefundFunding;
  }
  if (
    body.loanAmount !== undefined &&
    body.loanAmount !== null &&
    body.loanAmount !== ""
  )
    refund.loanAmount = Math.min(
      refund.amount,
      money(body.loanAmount, "Loan amount"),
    );
  if (
    body.loanRate !== undefined &&
    body.loanRate !== null &&
    body.loanRate !== ""
  )
    refund.loanRate = money(body.loanRate, "Interest rate", 30);
  if (
    body.loanType !== undefined &&
    body.loanType !== null &&
    body.loanType !== ""
  ) {
    if (!LOAN_TYPES.includes(body.loanType as LoanType))
      throw new HttpError(400, "Choose a loan type.");
    refund.loanType = body.loanType as LoanType;
  }
}

export async function updateRefund(
  uid: string,
  id: string,
  body: Record<string, unknown>,
) {
  let result: Refund | undefined;
  await updateState(uid, (s) => {
    const refund = s.refunds?.find((r) => r.id === id);
    if (!refund) throw new HttpError(404, "That refund doesn't exist.");
    applyLoanDetails(refund, body);
    if (body.status !== undefined) {
      if (body.status !== "dismissed" && body.status !== "new")
        throw new HttpError(400, "Status can be `dismissed` or `new`.");
      refund.status = body.status;
    }
    result = { ...refund };
  });
  return result!;
}

/** Computes the plan from the student's inputs and stores it on the refund. */
export async function planAndSave(
  uid: string,
  id: string,
  body: Record<string, unknown>,
) {
  const inputs: RefundPlanInputs = {
    monthsUntilNext: money(
      body.monthsUntilNext ?? 4,
      "Months until the next disbursement",
      12,
    ),
    monthlyLiving: money(
      body.monthlyLiving ?? 0,
      "Monthly living costs",
      20000,
    ),
    currentSavings: money(body.currentSavings ?? 0, "Current savings", 1000000),
    yearsUntilRepayment: money(
      body.yearsUntilRepayment ?? 4,
      "Years until repayment",
      10,
    ),
  };
  let result: Refund | undefined;
  await updateState(uid, (s) => {
    const refund = s.refunds?.find((r) => r.id === id);
    if (!refund) throw new HttpError(404, "That refund doesn't exist.");
    applyLoanDetails(refund, body);
    refund.plan = planRefund(refund, inputs, s.charges);
    refund.status = "planned";
    s.events.unshift({
      id: randomUUID(),
      type: "refund_planned",
      channel: "web",
      text: `Planned your ${usd(refund.amount)} refund.`,
      createdAt: new Date().toISOString(),
    });
    result = { ...refund };
  });
  return result!;
}
