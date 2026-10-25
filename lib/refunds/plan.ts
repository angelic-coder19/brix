import { summarizeCharges } from "../summary";
import type {
  Charge,
  Refund,
  RefundPlan,
  RefundPlanInputs,
  RefundPlanStep,
} from "../types";

export const RETURN_WINDOW_DAYS = 120;
const STARTER_BUFFER = 500;
const DAY = 86400000;

const LINKS = {
  loans: {
    label: "Federal loans explained (studentaid.gov)",
    href: "https://studentaid.gov/understand-aid/types/loans/subsidized-unsubsidized",
  },
  taxes: {
    label: "IRS Publication 970: tax benefits for education",
    href: "https://www.irs.gov/publications/p970",
  },
  emergency: {
    label: "Building an emergency fund (CFPB)",
    href: "https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/",
  },
  investing: {
    label: "Introduction to investing (Investor.gov)",
    href: "https://www.investor.gov/introduction-investing",
  },
};

const cents = (n: number) => Math.max(0, Math.round(n * 100) / 100);
const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function returnDeadline(receivedOn: string) {
  return new Date(
    Date.parse(`${receivedOn}T12:00:00Z`) + RETURN_WINDOW_DAYS * DAY,
  )
    .toISOString()
    .slice(0, 10);
}

/** Interest a balance builds over `years` at `ratePercent`, compounded yearly. */
export function interestOver(
  amount: number,
  ratePercent: number,
  years: number,
) {
  if (!(amount > 0) || !(ratePercent > 0) || !(years > 0)) return 0;
  return cents(amount * ((1 + ratePercent / 100) ** years - 1));
}

/**
 * Splits a refund into plain steps: essentials until the next disbursement,
 * a starter emergency buffer, returning unused borrowed money while it's
 * still free to return, and saving the rest. Investing is practice only.
 */
export function planRefund(
  refund: Refund,
  inputs: RefundPlanInputs,
  charges: Charge[],
  today = new Date(),
): RefundPlan {
  const months = Math.min(12, Math.max(0, inputs.monthsUntilNext));
  const subscriptions = summarizeCharges(charges).monthly;
  const monthly = Math.max(0, inputs.monthlyLiving) + subscriptions;
  const loanPart = Math.min(
    refund.amount,
    Math.max(
      0,
      refund.loanAmount ?? (refund.funding === "loan" ? refund.amount : 0),
    ),
  );
  const steps: RefundPlanStep[] = [];
  const notes: string[] = [];
  let left = refund.amount;

  const essentials = cents(Math.min(left, monthly * months));
  if (essentials > 0) {
    steps.push({
      key: "essentials",
      label: `Essentials for ${months} month${months === 1 ? "" : "s"}`,
      amount: essentials,
      reason: `Living costs plus ${usd(subscriptions)}/month in subscriptions Brix already tracks, until your next disbursement.`,
    });
    left -= essentials;
  }

  const bufferTarget = Math.max(STARTER_BUFFER, monthly);
  const emergency = cents(
    Math.min(
      left,
      Math.max(0, bufferTarget - Math.max(0, inputs.currentSavings)),
    ),
  );
  if (emergency > 0) {
    steps.push({
      key: "emergency",
      label: "Starter emergency fund",
      amount: emergency,
      reason: `A cushion of about ${usd(bufferTarget)} keeps a surprise bill from going on a credit card.`,
      link: LINKS.emergency,
    });
    left -= emergency;
  }

  let returnBy: string | undefined;
  let interestAvoided: number | undefined;
  const unusedLoan = cents(Math.min(left, loanPart));
  if (unusedLoan > 0) {
    const deadline = returnDeadline(refund.receivedOn);
    const open = today.toISOString().slice(0, 10) <= deadline;
    const federal = refund.loanType !== "private";
    if (refund.loanRate && refund.loanType !== "subsidized")
      interestAvoided = interestOver(
        unusedLoan,
        refund.loanRate,
        Math.max(0, inputs.yearsUntilRepayment),
      );
    if (open && federal) {
      returnBy = deadline;
      steps.push({
        key: "return_loan",
        label: "Return unused loan money",
        amount: unusedLoan,
        reason: `This part is borrowed. Federal Direct Loan money returned by ${deadline} is cancelled with no interest or fees${interestAvoided ? `; otherwise it could grow by about ${usd(interestAvoided)} before repayment starts` : ""}. Ask your financial aid office how to return it.`,
        link: LINKS.loans,
      });
    } else {
      steps.push({
        key: "prepay_loan",
        label: "Pay down your loan early",
        amount: unusedLoan,
        reason: `${federal ? `The ${RETURN_WINDOW_DAYS}-day window to cancel without interest has passed, but` : "For private loans,"} paying early still cuts interest${interestAvoided ? ` (about ${usd(interestAvoided)} by the time repayment starts)` : ""}. Ask your servicer to apply it to the highest-rate loan.`,
        link: LINKS.loans,
      });
    }
    if (refund.loanType === "subsidized")
      notes.push(
        "Subsidized loans don't build interest while you're in school, but returning unused money still means less to repay.",
      );
    if (!refund.loanRate)
      notes.push(
        "Add your loan's interest rate (on studentaid.gov or your servicer's site) to see how much interest this avoids.",
      );
    left -= unusedLoan;
  }

  const save = cents(left);
  if (save > 0)
    steps.push({
      key: "save",
      label: "Save the rest",
      amount: save,
      reason:
        "Money that isn't borrowed and isn't needed this semester. A high-yield savings account keeps it safe and earning while you decide.",
      link: LINKS.investing,
    });

  if (["grant", "scholarship", "mixed"].includes(refund.funding))
    notes.push(
      "Grant or scholarship money spent on rent, food or travel (anything besides tuition, fees and required books) can count as taxable income. Keep receipts.",
    );
  notes.push(
    "These are estimates to help you decide, not financial advice. Brix never moves your money.",
  );

  return {
    createdAt: today.toISOString(),
    inputs: { ...inputs, monthsUntilNext: months },
    steps,
    ...(returnBy ? { returnBy } : {}),
    ...(interestAvoided ? { interestAvoided } : {}),
    notes,
    // Practice uses virtual money, so it never competes with the real plan.
    practiceAmount: Math.max(100, Math.round(refund.amount)),
  };
}

export { LINKS as REFUND_LINKS };
