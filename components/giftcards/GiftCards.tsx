"use client";
import { useState } from "react";
import { Gift, Plus, Trash2 } from "lucide-react";
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

/** Gift card balances in one place, so they get spent instead of forgotten. */
export default function GiftCards({
  cards,
  request,
  action,
  busy,
}: {
  cards: GiftCard[];
  request: RequestFn;
  action: (work: () => Promise<void>) => Promise<void>;
  busy: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const active = cards.filter((g) => g.status === "active" && g.balance > 0);
  const total = active.reduce((s, g) => s + g.balance, 0);

  return (
    <section className="card form-card gift-cards" aria-labelledby="gift-title">
      <div className="gift-head">
        <div>
          <Gift size={26} />
          <h2 id="gift-title">Gift cards</h2>
          <p>
            {active.length
              ? `${usd(total)} unspent across ${active.length} card${active.length === 1 ? "" : "s"}. Brix reminds you before any expire.`
              : "Billions in gift card balances go unspent every year. Add yours and Brix reminds you to use them."}
          </p>
        </div>
        <button
          className="btn"
          type="button"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus size={16} /> Add a gift card
        </button>
      </div>

      {adding && (
        <form
          className="gift-form"
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
              setAdding(false);
            });
          }}
        >
          <label className="field">
            Store
            <input
              name="merchant"
              required
              maxLength={60}
              placeholder="e.g. Target"
            />
          </label>
          <label className="field">
            Balance (USD)
            <input
              name="balance"
              type="number"
              min="0.01"
              max="5000"
              step="0.01"
              required
            />
          </label>
          <label className="field">
            Expires (optional)
            <input
              name="expiresOn"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <button className="btn btn--primary" disabled={busy}>
            Save card
          </button>
        </form>
      )}

      {active.length > 0 && (
        <ul className="gift-list">
          {active.map((g) => {
            const days = g.expiresOn ? daysLeft(g.expiresOn) : null;
            return (
              <li key={g.id}>
                <div className="gift-list__main">
                  <strong>{g.merchant}</strong>
                  <span className="gift-list__balance">{usd(g.balance)}</span>
                  {days !== null ? (
                    <span
                      className={`badge ${days <= 14 ? "badge--accent" : ""}`}
                    >
                      {days <= 0
                        ? "Expires today"
                        : `Expires in ${days} day${days === 1 ? "" : "s"}`}
                    </span>
                  ) : (
                    <span className="badge">No expiry</span>
                  )}
                </div>
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
            );
          })}
        </ul>
      )}
    </section>
  );
}
