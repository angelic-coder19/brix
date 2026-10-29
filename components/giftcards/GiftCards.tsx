"use client";
import { useState } from "react";
import { Gift, Trash2 } from "lucide-react";
import type { RequestFn } from "../brix/useBrixChat";
import type { GiftCard } from "@/lib/types";
import "./giftcards.css";

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const DAY = 86400000;
const daysLeft = (date: string) =>
  Math.round(
    (Date.parse(`${date}T00:00:00Z`) -
      Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) /
      DAY,
  );
const THEMES = ["berry", "forest", "gold", "ink", "clay"] as const;
type Theme = (typeof THEMES)[number];
/** Same store, same colour, everywhere it appears. */
function themeFor(merchant: string): Theme {
  let h = 0;
  for (const ch of merchant.trim().toLowerCase())
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return THEMES[h % THEMES.length];
}
const STORES = ["Target", "Amazon", "Starbucks", "Campus store"];

type Action = (work: () => Promise<void>) => Promise<void>;

function GiftFace({
  merchant,
  balance,
  expiresOn,
  children,
}: {
  merchant: string;
  balance?: number;
  expiresOn?: string;
  children?: React.ReactNode;
}) {
  const days = expiresOn ? daysLeft(expiresOn) : null;
  return (
    <div className={`giftface giftface--${themeFor(merchant || "gift")}`}>
      <div className="giftface__face">
        <span className="giftface__ribbon" aria-hidden />
        <span className="giftface__bow" aria-hidden />
        {children ?? (
          <>
            <span className="giftface__kind">Gift card</span>
            <strong className="giftface__store">{merchant}</strong>
            <span className="giftface__balance">{usd(balance ?? 0)}</span>
            <span className="giftface__expiry">
              {days === null
                ? "No expiry"
                : days <= 0
                  ? "Expires today"
                  : `Expires in ${days} day${days === 1 ? "" : "s"}`}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** Add a gift card by filling in a gift card. */
export function GiftCardStudio({
  request,
  action,
  busy,
}: {
  request: RequestFn;
  action: Action;
  busy: boolean;
}) {
  const [merchant, setMerchant] = useState("Target");
  return (
    <section className="card studio" aria-labelledby="add-gift-title">
      <div className="studio__head">
        <h2 id="add-gift-title">Add a gift card</h2>
        <p>That gift card is still money. Keep it on your radar.</p>
      </div>
      <div
        className="studio__templates"
        role="group"
        aria-label="Store templates"
      >
        {[...STORES, "Other"].map((s) => (
          <button
            key={s}
            type="button"
            className="studio-chip"
            aria-pressed={
              s === "Other" ? !STORES.includes(merchant) : merchant === s
            }
            onClick={() => setMerchant(s === "Other" ? "" : s)}
          >
            {s}
          </button>
        ))}
      </div>
      <form
        className="studio__form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form);
          void action(async () => {
            await request("/api/gift-cards", "POST", {
              merchant: f.get("merchant"),
              balance: Number(f.get("balance")),
              expiresOn: f.get("expiresOn") || undefined,
            });
            form.reset();
            setMerchant("Target");
          });
        }}
      >
        <GiftFace merchant={merchant || "Your store"} />
        <div className="studio-fields">
          <span className="giftface__kind">Gift card</span>
          <label className="field">
            <span className="sr-only">Store</span>
            <input
              name="merchant"
              aria-label="Store"
              required
              maxLength={60}
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Store name"
            />
          </label>
          <label className="field">
            <span aria-hidden>$</span>
            <input
              name="balance"
              aria-label="Balance (USD)"
              type="number"
              inputMode="decimal"
              min="0.01"
              max="5000"
              step="0.01"
              required
              placeholder="0.00"
            />
          </label>
          <label className="field">
            <small>Expires (optional)</small>
            <input
              name="expiresOn"
              aria-label="Expires (optional)"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
            />
          </label>
        </div>
        <p className="studio__hint">
          Most store cards never expire. Promo and reward cards often do.
        </p>
        <div className="studio__foot">
          <span />
          <button className="btn btn--primary" disabled={busy}>
            Save card
          </button>
        </div>
      </form>
      <small className="studio__note">
        Brix only tracks the balance. It never needs the card number.
      </small>
    </section>
  );
}

/** Saved gift cards, as cards, with a quick way to log spending. */
export function GiftCardWallet({
  cards,
  request,
  action,
  busy,
}: {
  cards: GiftCard[];
  request: RequestFn;
  action: Action;
  busy: boolean;
}) {
  const active = cards.filter((g) => g.status === "active" && g.balance > 0);
  const total = active.reduce((s, g) => s + g.balance, 0);
  return (
    <section className="wallet-group" aria-labelledby="gift-title">
      <div className="wallet-group__head">
        <h2 id="gift-title">Gift cards</h2>
        <p>
          {active.length
            ? `${usd(total)} unspent across ${active.length} card${active.length === 1 ? "" : "s"}.`
            : "No gift cards yet."}
        </p>
      </div>
      {active.length > 0 ? (
        <ul className="wallet-grid">
          {active.map((g) => (
            <li key={g.id} className="wallet-item">
              <GiftFace
                merchant={g.merchant}
                balance={g.balance}
                expiresOn={g.expiresOn}
              />
              <form
                className="gift-spend"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    f = new FormData(form);
                  void action(async () => {
                    await request(`/api/gift-cards/${g.id}`, "PATCH", {
                      spent: Number(f.get("spent")),
                    });
                    form.reset();
                  });
                }}
              >
                <input
                  name="spent"
                  type="number"
                  min="0.01"
                  max={g.balance}
                  step="0.01"
                  required
                  placeholder="Spent"
                  aria-label={`Amount spent from ${g.merchant} card`}
                />
                <button className="btn btn--sm" disabled={busy}>
                  Log spend
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${g.merchant} gift card`}
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await request(`/api/gift-cards/${g.id}`, "DELETE");
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <div className="wallet-empty">
          <Gift size={20} aria-hidden />
          <span>Add one above and its balance shows up here.</span>
        </div>
      )}
    </section>
  );
}
