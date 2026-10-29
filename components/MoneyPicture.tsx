"use client";
import { Dropdown } from "@/components/ui/Dropdown";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, PiggyBank, Trash2, Wallet } from "lucide-react";
import {
  INCOME_FREQUENCIES,
  INCOME_KINDS,
  moneyPicture,
} from "@/lib/money-picture";
import type { ClientState, RequestFn } from "./brix/useBrixChat";
import type { IncomeKind } from "@/lib/types";

const usd = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "This month: in, minus subscriptions, minus set aside, equals left." */
export function MoneyPicture({
  state,
  request,
  action,
  busy,
  now,
}: {
  state: ClientState;
  request: RequestFn;
  action: (work: () => Promise<void>) => Promise<void>;
  busy: boolean;
  now: number;
}) {
  const m = moneyPicture(state, now);
  const kinds = (Object.keys(m.byKind) as IncomeKind[]).filter(
    (k) => (m.byKind[k] ?? 0) > 0,
  );
  const month = new Date(`${m.month}-15T12:00:00Z`).toLocaleDateString(
    "en-US",
    { month: "long", timeZone: "UTC" },
  );
  const income = state.income ?? [];
  return (
    <section className="card money-picture" aria-labelledby="money-title">
      <div className="card-head">
        <div>
          <h2 id="money-title">This month</h2>
          <p>
            {usd(m.in)} in − {usd(m.out)} subscriptions out − {usd(m.aside)}{" "}
            set aside = <strong>{usd(m.left)} left</strong>
          </p>
        </div>
        <span className="badge">Estimate · {month}</span>
      </div>
      <div className="summary-row summary-row--tiles money-picture__row">
        <div className="summary-stat summary-stat--lead">
          <span className="summary-stat__label">
            <Wallet size={14} aria-hidden /> Left
          </span>
          <span className="summary-stat__value">{usd(m.left)}</span>
          <span className="summary-stat__sub">
            {m.left < 0
              ? "More going out than coming in"
              : "After subscriptions and what you set aside"}
          </span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat__label">
            <ArrowDownLeft size={14} aria-hidden /> In
          </span>
          <span className="summary-stat__value">{usd(m.in)}</span>
          <span className="summary-stat__sub">
            {kinds.length
              ? kinds
                  .map((k) => `${INCOME_KINDS[k]} ${usd(m.byKind[k]!)}`)
                  .join(" · ")
              : "Add what comes in below"}
          </span>
          {m.borrowed > 0 && (
            <span className="summary-stat__sub">
              {usd(m.borrowed)} of it is borrowed
            </span>
          )}
        </div>
        <div className="summary-stat">
          <span className="summary-stat__label">
            <ArrowUpRight size={14} aria-hidden /> Subscriptions out
          </span>
          <span className="summary-stat__value">{usd(m.out)}</span>
          <span className="summary-stat__sub">Monthly cost of what renews</span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat__label">
            <PiggyBank size={14} aria-hidden /> Set aside
          </span>
          <span className="summary-stat__value">{usd(m.aside)}</span>
          <span className="summary-stat__sub">
            {m.aside > 0 ? (
              "From your refund plan"
            ) : (
              <Link href="/refunds" className="text-link">
                Plan a refund to set money aside
              </Link>
            )}
          </span>
        </div>
      </div>
      <details className="money-in">
        <summary>
          Money in ({income.length}{" "}
          {income.length === 1 ? "source" : "sources"})
        </summary>
        {income.length > 0 && (
          <ul className="money-in__list">
            {income.map((s) => (
              <li key={s.id}>
                <span>
                  <strong>{INCOME_KINDS[s.kind]}</strong> {usd(s.amount)}{" "}
                  {s.frequency === "once"
                    ? `one time, ${s.receivedOn}`
                    : INCOME_FREQUENCIES[s.frequency].toLowerCase()}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${INCOME_KINDS[s.kind]} ${usd(s.amount)}`}
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await request(`/api/income/${s.id}`, "DELETE");
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="money-in__form"
          aria-label="Add money in"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            void action(async () => {
              await request("/api/income", "POST", {
                kind: f.get("kind"),
                amount: Number(f.get("amount")),
                frequency: f.get("frequency"),
              });
              form.reset();
            });
          }}
        >
          <label className="field">
            Source
            <Dropdown label="Income type" name="kind" defaultValue="paycheck" options={Object.entries(INCOME_KINDS).map(([value,label])=>({value,label}))} />
          </label>
          <label className="field">
            Amount
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </label>
          <label className="field">
            How often
            <Dropdown label="How often" name="frequency" defaultValue="monthly" options={Object.entries(INCOME_FREQUENCIES).map(([value,label])=>({value,label}))} />
          </label>
          <button className="btn" disabled={busy}>
            Add money in
          </button>
        </form>
        <p className="muted">
          School refunds from your bank count automatically in the month they
          land, so you don&apos;t need to add them here.
        </p>
      </details>
    </section>
  );
}
