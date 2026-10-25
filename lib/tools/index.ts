import { randomUUID } from "node:crypto";
import { getState, updateState, setSecret } from "../store";
import { HttpError } from "../auth";
import { issueSandboxCard } from "../lithic";
import { verifyUserPin } from "../identity";
import { getMoneyNews } from "./getMoneyNews";
import { findSecurity } from "../market/universe";
import { getQuotes } from "../market/quotes";
import { practiceOrder, practiceView } from "../practice";
import { getTickerNews } from "../news/tickers";
import { planRefund } from "../refunds/plan";
import { giftCardSummary } from "../giftcards";
import type { AppState, Charge, Channel, PendingAction } from "../types";
export const mutations = new Set([
  "mark_to_cancel",
  "set_reminder",
  "create_one_time_card",
  "practice_trade",
]);
const money = (n: number) => `$${n.toFixed(2)}`;
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export function matchCharge(charges: Charge[], merchant: string) {
  const needle = normalized(merchant);
  if (!needle) throw new HttpError(400, "Name a merchant first.");
  const active = charges.filter((c) => c.status !== "cancelled");
  const exact = active.filter((c) => normalized(c.merchant) === needle);
  const matches = exact.length
    ? exact
    : active.filter((c) => normalized(c.merchant).includes(needle));
  if (matches.length !== 1)
    throw new HttpError(
      400,
      matches.length
        ? `Which one: ${matches.map((c) => c.merchant).join(", ")}?`
        : "I couldn't find that merchant.",
    );
  return matches[0];
}
export function reminderDate(when: string, charge: Charge) {
  const relative = when.match(/^(\d{1,2}) days? before$/i);
  const date = relative
    ? new Date(
        new Date(`${charge.nextDate}T12:00:00Z`).getTime() -
          Number(relative[1]) * 86400000,
      )
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(when) ? `${when}T12:00:00Z` : when);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
    throw new HttpError(400, "Choose a future reminder date (YYYY-MM-DD).");
  return date.toISOString();
}
export async function proposeAction(
  uid: string,
  channel: Channel,
  name: string,
  args: Record<string, unknown>,
) {
  if (!mutations.has(name)) throw new HttpError(400, "Unknown action.");
  const state = await getState(uid);
  if (state.pendingActions?.[channel]?.status)
    throw new HttpError(
      409,
      "A card request needs review before another action. Check the card provider logs.",
    );
  let summary: string;
  let clean: Record<string, unknown>;
  if (name === "create_one_time_card") {
    const purpose = String(args.purpose || "")
        .trim()
        .slice(0, 120),
      limit = Number(args.spendLimit);
    if (
      !purpose ||
      !Number.isFinite(limit) ||
      limit <= 0 ||
      limit > 500 ||
      Math.abs(Math.round(limit * 100) - limit * 100) > 1e-8
    )
      throw new HttpError(
        400,
        "Provide a purpose and a limit from $0.01 to $500, with at most two decimals.",
      );
    clean = { purpose, spendLimit: limit };
    summary = `Create a ${process.env.BRIX_DEMO_MODE === "true" ? "demo" : "sandbox"} single-use card for ${purpose}, limited to ${money(limit)}?`;
  } else if (name === "practice_trade") {
    const security = findSecurity(args.symbol);
    if (!security)
      throw new HttpError(400, "Choose a symbol from Brix's practice list.");
    const side = args.side === "sell" ? "sell" : "buy";
    const all = side === "sell" && args.amount === "all";
    const amount = Number(args.amount);
    if (!all && !(Number.isFinite(amount) && amount >= 1 && amount <= 100000))
      throw new HttpError(400, "Give a dollar amount of at least $1.");
    const price = (await getQuotes([security.symbol]))[security.symbol]?.price;
    clean = { symbol: security.symbol, side, amount: all ? "all" : amount };
    summary = `Practice trade with virtual money: ${side} ${all ? "all your" : money(amount) + " of"} ${security.symbol}${price ? ` at about ${money(price)} a share` : ""}?`;
  } else {
    const charge = matchCharge(state.charges, String(args.merchant || ""));
    clean = { chargeId: charge.id, merchant: charge.merchant };
    if (name === "mark_to_cancel")
      summary = `Mark ${charge.merchant} (${money(charge.amount)}) to cancel? You'll still need to cancel on the merchant's site.`;
    else {
      clean.when = reminderDate(String(args.when || ""), charge);
      summary = `Remind you about ${charge.merchant} on ${String(clean.when).slice(0, 10)}?`;
    }
  }
  const action: PendingAction = {
    id: randomUUID(),
    name,
    args: clean,
    summary,
    expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
  };
  await updateState(uid, (s) => {
    if (s.pendingActions?.[channel]?.status)
      throw new HttpError(409, "A card request needs provider review.");
    s.pendingActions = { ...s.pendingActions, [channel]: action };
  });
  return {
    reply: `${summary} ${channel === "voice" ? `Confirm this request in the Brix app${name === "create_one_time_card" ? " with your PIN" : ""}. Spoken confirmation does not apply it.` : "Reply yes to confirm."}`,
    confirmationRequired: true,
  };
}
function event(
  state: AppState,
  channel: Channel,
  type: string,
  text: string,
  amountSaved?: number,
) {
  state.events.unshift({
    id: randomUUID(),
    type,
    text,
    channel,
    createdAt: new Date().toISOString(),
    ...(amountSaved !== undefined ? { amountSaved } : {}),
  });
}
export async function confirmAction(
  uid: string,
  channel: Channel,
  pin?: string,
) {
  const current = (await getState(uid)).pendingActions?.[channel];
  if (
    channel === "voice" &&
    current?.name === "create_one_time_card" &&
    (!pin || !(await verifyUserPin(uid, pin)))
  )
    throw new HttpError(
      403,
      "Confirm voice card creation in the app with your PIN.",
    );
  let claimed: PendingAction | undefined;
  await updateState(uid, (s) => {
    claimed = undefined;
    const pending = s.pendingActions?.[channel];
    if (!pending || pending.expiresAt <= new Date().toISOString())
      throw new HttpError(
        400,
        "No pending action. Ask me what you'd like to do first.",
      );
    if (
      channel === "voice" &&
      pending.name === "create_one_time_card" &&
      pending.id !== current?.id
    )
      throw new HttpError(
        409,
        "The proposal changed. Please confirm it again.",
      );
    if (pending.status)
      throw new HttpError(
        409,
        "This card request is processing or needs provider review. Do not create another card yet.",
      );
    claimed = { ...pending };
    if (pending.name === "create_one_time_card") pending.status = "processing";
    else delete s.pendingActions![channel];
  });
  const pending = claimed!;
  if (pending.name === "practice_trade") {
    const order = await practiceOrder(uid, {
      symbol: pending.args.symbol,
      side: pending.args.side,
      ...(pending.args.amount === "all"
        ? { shares: "all" }
        : { amount: pending.args.amount }),
      clientKey: pending.id,
    });
    const reply = `Practice ${order.side === "buy" ? "bought" : "sold"} ${order.shares} ${order.symbol} at ${money(order.price)} (${money(order.notional)} of virtual money)${order.afterHours ? ", at the last price since the market is closed" : ""}.`;
    await updateState(uid, (s) => event(s, channel, "practice_trade", reply));
    return reply;
  }
  if (pending.name === "create_one_time_card") {
    try {
      const card = await issueSandboxCard(
        String(pending.args.purpose),
        Number(pending.args.spendLimit),
        pending.id,
      );
      await setSecret(uid, { [`card_${pending.id}`]: card.lithicToken });
      await updateState(uid, (s) => {
        if (s.pendingActions?.[channel]?.id === pending.id)
          delete s.pendingActions[channel];
        s.cards.unshift({
          id: pending.id,
          purpose: String(pending.args.purpose),
          spendLimit: Number(pending.args.spendLimit),
          last4: card.last4,
          source: card.source,
          state: "OPEN",
          createdAt: new Date().toISOString(),
        });
        event(
          s,
          channel,
          "card_created",
          `${card.source === "mock" ? "Demo" : "Sandbox"} card created for ${pending.args.purpose}.`,
        );
      });
      return `${card.source === "mock" ? "Demo" : "Sandbox"} card ending ${card.last4} created. View it in Cards.`;
    } catch (error) {
      await updateState(uid, (s) => {
        if (s.pendingActions?.[channel]?.id === pending.id)
          s.pendingActions[channel]!.status = "failed";
      });
      throw error;
    }
  }
  let reply = "";
  await updateState(uid, (s) => {
    const charge = s.charges.find((c) => c.id === pending.args.chargeId);
    if (!charge) throw new HttpError(404, "That charge no longer exists.");
    reply =
      pending.name === "mark_to_cancel"
        ? markToCancel(s, channel, charge)
        : addReminder(s, channel, charge, String(pending.args.when)).reply;
  });
  return reply;
}
/** Marks a charge to cancel inside a state update. Shared by confirmations and the public API. */
export function markToCancel(s: AppState, channel: Channel, charge: Charge) {
  if (charge.status === "to_cancel" || charge.status === "cancelled")
    return `${charge.merchant} is already marked to cancel.`;
  charge.status = "to_cancel";
  const saved =
    charge.nextDate > new Date().toISOString().slice(0, 10) ? charge.amount : 0;
  const reply = `${charge.merchant} is marked to cancel. Finish cancellation on the merchant's site${charge.cancelUrl ? `: ${charge.cancelUrl}` : "."}`;
  event(s, channel, "marked_cancel", reply, saved);
  return reply;
}
/** Undoes a mark-to-cancel. Trials return to trial status. */
export function reactivate(s: AppState, channel: Channel, charge: Charge) {
  if (charge.status === "active" || charge.status === "trial")
    return `${charge.merchant} is already active.`;
  charge.status = charge.kind === "trial" ? "trial" : "active";
  const reply = `${charge.merchant} is active again.`;
  event(s, channel, "reactivated", reply);
  return reply;
}
/** Adds a reminder inside a state update; `when` is an ISO timestamp from reminderDate. */
export function addReminder(
  s: AppState,
  channel: Channel,
  charge: Charge,
  when: string,
) {
  const id = `manual:${charge.id}:${when}`;
  const viaWhatsApp =
    process.env.BRIX_DEMO_MODE !== "true" && s.user.whatsappOptIn;
  let reminder = s.reminders.find((r) => r.id === id);
  if (!reminder) {
    reminder = {
      id,
      chargeId: charge.id,
      remindAt: when,
      channel: viaWhatsApp ? "whatsapp" : "push",
      sent: false,
      createdBy: channel,
    };
    s.reminders.push(reminder);
  }
  const reply = `Reminder set for ${charge.merchant} on ${when.slice(0, 10)}${viaWhatsApp ? " via WhatsApp" : " in the app"}.`;
  event(s, channel, "reminder_created", reply);
  return { reply, reminder };
}
export async function executeTool(
  uid: string,
  channel: Channel,
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  if (mutations.has(name)) return proposeAction(uid, channel, name, args);
  const state = await getState(uid);
  const active = state.charges.filter(
    (c) => c.status === "active" || c.status === "trial",
  );
  switch (name) {
    case "get_upcoming_charges": {
      const days = Math.min(90, Math.max(1, Number(args.days) || 14));
      const start = new Date().toISOString().slice(0, 10),
        end = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      return active
        .filter((c) => c.nextDate >= start && c.nextDate <= end)
        .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
    }
    case "get_subscriptions":
      return {
        charges: active,
        monthlyTotal:
          Math.round(
            active
              .filter((c) => c.kind === "subscription")
              .reduce(
                (sum, c) =>
                  sum +
                  c.amount *
                    (c.frequency === "annual"
                      ? 1 / 12
                      : c.frequency === "weekly"
                        ? 52 / 12
                        : c.frequency === "monthly"
                          ? 1
                          : 0),
                0,
              ) * 100,
          ) / 100,
      };
    case "get_saved_summary":
      return {
        estimated: true,
        amount: state.events
          .filter(
            (e) =>
              e.createdAt.slice(0, 7) === new Date().toISOString().slice(0, 7),
          )
          .reduce((sum, e) => sum + (e.amountSaved || 0), 0),
      };
    case "get_money_news":
      return getMoneyNews(state.charges);
    case "get_gift_cards": {
      const g = giftCardSummary(state);
      return g.cards.length
        ? g
        : {
            ...g,
            message: "No gift cards tracked. Add them on the Cards page.",
          };
    }
    case "get_refunds":
      return {
        refunds: (state.refunds ?? []).filter((r) => r.status !== "dismissed"),
      };
    case "plan_refund": {
      const refunds = (state.refunds ?? []).filter(
        (r) => r.status !== "dismissed",
      );
      const refund = refunds.find((r) => r.id === args.refund_id) ?? refunds[0];
      if (!refund)
        return {
          message:
            "No refund to plan. The student can add one on the Refunds page.",
        };
      const num = (v: unknown, d: number) =>
        Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d;
      return planRefund(
        refund,
        {
          monthsUntilNext: num(args.months_until_next, 4),
          monthlyLiving: num(args.monthly_living, 0),
          currentSavings: num(args.current_savings, 0),
          yearsUntilRepayment: num(args.years_until_repayment, 4),
        },
        state.charges,
      );
    }
    case "get_portfolio": {
      const view = await practiceView(uid);
      return view.portfolio
        ? {
            practice: true,
            virtualMoney: true,
            ...view.portfolio,
            orders: view.portfolio.orders.slice(0, 5),
          }
        : {
            message: "No practice portfolio yet.",
            suggestedStart: view.suggestedStart,
          };
    }
    case "get_stock_news": {
      const symbols = (
        Array.isArray(args.symbols) ? args.symbols : [args.symbol]
      )
        .map((x) => findSecurity(x)?.symbol)
        .filter((x): x is string => !!x);
      return getTickerNews(symbols.length ? symbols : ["VOO"]);
    }
    default:
      throw new HttpError(400, "Unknown tool.");
  }
}
