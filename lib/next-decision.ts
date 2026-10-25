import type { AppState } from "./types";

// The one decision worth the student's attention right now, so the
// dashboard leads with an action instead of a wall of numbers.

export interface NextDecision {
  kind: "refund" | "trial" | "gift_card" | "charge" | "clear";
  title: string;
  detail: string;
  /** Where the primary button goes, or a chat prompt to send. */
  href?: string;
  ask?: string;
  cta: string;
}

const DAY = 86400000;
const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nice = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const daysUntil = (date: string, now: number) =>
  Math.round(
    (Date.parse(`${date}T00:00:00Z`) -
      Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`)) /
      DAY,
  );

export function nextDecision(state: AppState, now = Date.now()): NextDecision {
  const refund = (state.refunds ?? []).find((r) => r.status !== "dismissed");
  if (refund) {
    const borrowed =
      refund.loanAmount ?? (refund.funding === "loan" ? refund.amount : 0);
    const deadline = new Date(
      Date.parse(`${refund.receivedOn}T12:00:00Z`) + 120 * DAY,
    )
      .toISOString()
      .slice(0, 10);
    const open = daysUntil(deadline, now) >= 0;
    if (borrowed > 0 && open && refund.loanType !== "private")
      return {
        kind: "refund",
        title: `${usd(borrowed)} of your refund is borrowed`,
        detail: `Federal loan money you return by ${nice(deadline)} is cancelled with no interest or fees. Decide what to keep before it's spent.`,
        href: "/refunds",
        cta: "Plan my refund",
      };
    if (refund.status === "new")
      return {
        kind: "refund",
        title: `Your ${usd(refund.amount)} school refund arrived`,
        detail:
          "Cover the semester first, then decide what to save. It takes a minute.",
        href: "/refunds",
        cta: "Plan my refund",
      };
  }

  const live = state.charges.filter(
    (c) => c.status === "active" || c.status === "trial",
  );
  const trial = live
    .filter(
      (c) =>
        c.kind === "trial" &&
        daysUntil(c.nextDate, now) >= 0 &&
        daysUntil(c.nextDate, now) <= 7,
    )
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0];
  if (trial)
    return {
      kind: "trial",
      title: `${trial.merchant} starts billing ${usd(trial.amount)} on ${nice(trial.nextDate)}`,
      detail:
        "Your free trial ends soon. Keep it on purpose, or cancel before it charges you.",
      ask: `Should I keep my ${trial.merchant} trial?`,
      cta: "Decide now",
    };

  const card = (state.giftCards ?? [])
    .filter(
      (g) =>
        g.status === "active" &&
        g.balance > 0 &&
        g.expiresOn &&
        daysUntil(g.expiresOn, now) >= 0 &&
        daysUntil(g.expiresOn, now) <= 30,
    )
    .sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!))[0];
  if (card)
    return {
      kind: "gift_card",
      title: `Use your ${usd(card.balance)} ${card.merchant} gift card`,
      detail: `It expires ${nice(card.expiresOn!)}. Spend it before you pay with your own money.`,
      href: "/cards",
      cta: "See my gift cards",
    };

  const soon = live
    .filter(
      (c) => daysUntil(c.nextDate, now) >= 0 && daysUntil(c.nextDate, now) <= 3,
    )
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0];
  if (soon)
    return {
      kind: "charge",
      title: `${soon.merchant} charges ${usd(soon.amount)} on ${nice(soon.nextDate)}`,
      detail: "Still using it? Keep it, or mark it to cancel before it bills.",
      ask: `Do I still need ${soon.merchant}?`,
      cta: "Check with Brix",
    };

  return {
    kind: "clear",
    title: "Nothing needs a decision this week",
    detail: "Brix will message you 7 days and 2 days before anything bills.",
    href: "/subscriptions",
    cta: "See all charges",
  };
}
