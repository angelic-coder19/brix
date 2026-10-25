import { randomUUID } from "node:crypto";
import { HttpError } from "./auth";
import { updateState } from "./store";
import type { AppState, Channel, GiftCard } from "./types";

const DAY = 86400000;
const usd = (n: number) => `$${n.toFixed(2)}`;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const daysUntil = (date: string, now = Date.now()) =>
  Math.round(
    (Date.parse(`${date}T00:00:00Z`) -
      Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`)) /
      DAY,
  );

function parseBalance(value: unknown) {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 5000)
    throw new HttpError(400, "Balance must be between $0 and $5,000.");
  return Math.round(n * 100) / 100;
}

/** Gift card totals, cards expiring within 30 days, and cards that match a bill. */
export function giftCardSummary(state: AppState, now = Date.now()) {
  const active = (state.giftCards ?? []).filter(
    (g) => g.status === "active" && g.balance > 0,
  );
  const expiringSoon = active
    .filter(
      (g) =>
        g.expiresOn &&
        daysUntil(g.expiresOn, now) >= 0 &&
        daysUntil(g.expiresOn, now) <= 30,
    )
    .sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!));
  const matches = active.flatMap((g) =>
    state.charges
      .filter(
        (c) =>
          (c.status === "active" || c.status === "trial") &&
          (norm(c.merchant).includes(norm(g.merchant)) ||
            norm(g.merchant).includes(norm(c.merchant))),
      )
      .map((c) => ({
        giftCard: g.merchant,
        balance: g.balance,
        charge: c.merchant,
        amount: c.amount,
        nextDate: c.nextDate,
      })),
  );
  return {
    cards: active,
    total: Math.round(active.reduce((s, g) => s + g.balance, 0) * 100) / 100,
    expiringSoon,
    matches,
  };
}

export async function addGiftCard(
  uid: string,
  body: Record<string, unknown>,
  channel: Channel = "web",
) {
  const merchant =
    typeof body.merchant === "string" ? body.merchant.trim().slice(0, 60) : "";
  if (!merchant) throw new HttpError(400, "Which store is the gift card for?");
  const balance = parseBalance(body.balance);
  if (balance <= 0)
    throw new HttpError(400, "Enter the card's remaining balance.");
  let expiresOn: string | undefined;
  if (
    body.expiresOn !== undefined &&
    body.expiresOn !== null &&
    body.expiresOn !== ""
  ) {
    if (
      typeof body.expiresOn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.expiresOn) ||
      !Number.isFinite(Date.parse(body.expiresOn)) ||
      daysUntil(body.expiresOn) < 0
    )
      throw new HttpError(
        400,
        "Enter a future expiry date, or leave it blank if the card doesn't expire.",
      );
    expiresOn = body.expiresOn;
  }
  const card: GiftCard = {
    id: randomUUID(),
    merchant,
    balance,
    ...(expiresOn ? { expiresOn } : {}),
    addedOn: new Date().toISOString().slice(0, 10),
    status: "active",
  };
  await updateState(uid, (s) => {
    s.giftCards ??= [];
    if (s.giftCards.filter((g) => g.status === "active").length >= 50)
      throw new HttpError(409, "You can track up to 50 gift cards.");
    s.giftCards.unshift(card);
    s.events.unshift({
      id: randomUUID(),
      type: "gift_card_added",
      channel,
      text: `Tracking a ${usd(balance)} ${merchant} gift card${expiresOn ? ` (expires ${expiresOn})` : ""}.`,
      createdAt: new Date().toISOString(),
    });
  });
  return card;
}

/** Spend part of a card (`spent`), correct its `balance`, or mark it `used`. */
export async function updateGiftCard(
  uid: string,
  id: string,
  body: Record<string, unknown>,
) {
  let result: GiftCard | undefined;
  await updateState(uid, (s) => {
    const card = s.giftCards?.find((g) => g.id === id);
    if (!card) throw new HttpError(404, "That gift card doesn't exist.");
    if (body.spent !== undefined) {
      const spent = parseBalance(body.spent);
      if (spent > card.balance)
        throw new HttpError(
          400,
          `This card only has ${usd(card.balance)} left.`,
        );
      card.balance = Math.round((card.balance - spent) * 100) / 100;
    }
    if (body.balance !== undefined) card.balance = parseBalance(body.balance);
    if (body.status === "used" || card.balance === 0) card.status = "used";
    else if (body.status === "active") card.status = "active";
    s.events.unshift({
      id: randomUUID(),
      type: "gift_card_updated",
      channel: "web",
      text:
        card.status === "used"
          ? `${card.merchant} gift card used up.`
          : `${card.merchant} gift card now has ${usd(card.balance)}.`,
      createdAt: new Date().toISOString(),
    });
    result = { ...card };
  });
  return result!;
}

export async function deleteGiftCard(uid: string, id: string) {
  await updateState(uid, (s) => {
    if (!s.giftCards?.some((g) => g.id === id))
      throw new HttpError(404, "That gift card doesn't exist.");
    s.giftCards = s.giftCards.filter((g) => g.id !== id);
  });
}

/** Expiry alerts at 14 and 3 days, each once per card. Returns the new alert texts. */
export function giftCardAlerts(s: AppState, now = Date.now()) {
  const texts: string[] = [];
  for (const g of s.giftCards ?? []) {
    if (g.status !== "active" || g.balance <= 0 || !g.expiresOn) continue;
    const days = daysUntil(g.expiresOn, now);
    if (days < 0 || days > 14) continue;
    const threshold = days <= 3 ? 3 : 14;
    const key = `gift:${g.id}:${threshold}`;
    if (s.events.some((e) => e.requestId === key)) continue;
    const text = `Your ${usd(g.balance)} ${g.merchant} gift card expires ${g.expiresOn}${days <= 3 ? " — this week" : ""}. Use it before you pay with your own money.`;
    s.events.unshift({
      id: randomUUID(),
      requestId: key,
      type: "gift_card_expiring",
      channel: "system",
      text,
      createdAt: new Date(now).toISOString(),
    });
    texts.push(text);
  }
  return texts;
}
