"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ExternalLink,
  GraduationCap,
  Plus,
  TrendingUp,
} from "lucide-react";
import type { ClientState, RequestFn } from "../brix/useBrixChat";
import type { Refund } from "@/lib/types";
import "./refunds.css";

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const DAY = 86400000;
const deadline = (r: Refund) => {
  const end = Date.parse(`${r.receivedOn}T12:00:00Z`) + 120 * DAY;
  return {
    date: new Date(end).toISOString().slice(0, 10),
    days: Math.ceil((end - Date.now()) / DAY),
  };
};
const FUNDING = {
  unknown: "Not sure",
  loan: "Student loan",
  grant: "Grant (like Pell)",
  scholarship: "Scholarship",
  mixed: "A mix",
} as const;

export default function Refunds({
  state,
  request,
  action,
  busy,
}: {
  state: ClientState;
  request: RequestFn;
  action: (work: () => Promise<void>) => Promise<void>;
  busy: boolean;
}) {
  const router = useRouter();
  const refunds = (state.refunds ?? []).filter((r) => r.status !== "dismissed");
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const refund = refunds.find((r) => r.id === selected) ?? refunds[0];

  return (
    <div className="refunds">
      <section className="card refunds-intro">
        <GraduationCap size={26} />
        <div>
          <h2>Plan your school refund</h2>
          <p>
            Set aside essentials, identify borrowed money, and plan what’s left.
          </p>
        </div>
        <button
          className="btn"
          type="button"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus size={16} /> Add a refund
        </button>
      </section>

      {adding && (
        <form
          className="card form-card refund-add"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void action(async () => {
              const { refund: made } = await request<{ refund: Refund }>(
                "/api/refunds",
                "POST",
                {
                  amount: Number(f.get("amount")),
                  receivedOn: f.get("receivedOn"),
                  funding: f.get("funding"),
                  loanAmount: f.get("loanAmount")
                    ? Number(f.get("loanAmount"))
                    : undefined,
                },
              );
              setSelected(made.id);
              setAdding(false);
            });
          }}
        >
          <h2>Add a refund</h2>
          <div className="refund-grid">
            <label className="field">
              Amount (USD)
              <input name="amount" type="number" min="1" step="0.01" required />
            </label>
            <label className="field">
              Date it arrived
              <input
                name="receivedOn"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label className="field">
              Where it came from
              <select name="funding" defaultValue="unknown">
                {Object.entries(FUNDING).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Borrowed part (optional)
              <input
                name="loanAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </label>
          </div>
          <button className="btn btn--primary" disabled={busy}>
            Save refund
          </button>
        </form>
      )}

      {!refunds.length ? (
        <div className="card empty-state">
          <GraduationCap size={30} />
          <h3>No refunds yet.</h3>
          <p>
            When your school sends a refund to a linked bank, Brix spots it and
            lets you know. You can also add one yourself.
          </p>
        </div>
      ) : (
        <div className="refunds-layout">
          <ul className="refund-list" aria-label="Your refunds">
            {refunds.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={r.id === refund?.id ? "is-active" : undefined}
                  aria-current={r.id === refund?.id ? "true" : undefined}
                  onClick={() => setSelected(r.id)}
                >
                  <strong>{usd(r.amount)}</strong>
                  <span>
                    {new Date(`${r.receivedOn}T12:00:00Z`).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}{" "}
                    · {r.descriptor ?? "Added by you"}
                  </span>
                  <span
                    className={`badge ${r.status === "new" ? "badge--accent" : "badge--green"}`}
                  >
                    {r.status === "new" ? "Needs a plan" : "Planned"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {refund && (
            <RefundDetail
              key={refund.id}
              refund={refund}
              request={request}
              action={action}
              busy={busy}
              onPractice={() =>
                void action(async () => {
                  await request("/api/practice", "POST", {
                    refundId: refund.id,
                  }).catch((e: Error & { status?: number }) => {
                    if (e.status !== 409) throw e;
                  });
                  router.push("/practice");
                })
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

function RefundDetail({
  refund,
  request,
  action,
  busy,
  onPractice,
}: {
  refund: Refund;
  request: RequestFn;
  action: (work: () => Promise<void>) => Promise<void>;
  busy: boolean;
  onPractice: () => void;
}) {
  const borrowed =
    refund.loanAmount ?? (refund.funding === "loan" ? refund.amount : 0);
  const window = deadline(refund);
  const plan = refund.plan;
  const inputs = plan?.inputs;
  return (
    <section
      className="card form-card refund-detail"
      aria-labelledby="refund-title"
    >
      <div className="refund-head">
        <div>
          <h2 id="refund-title">{usd(refund.amount)} refund</h2>
          <p className="muted">
            Arrived {refund.receivedOn}
            {refund.descriptor ? ` · ${refund.descriptor}` : ""}
          </p>
        </div>
        {borrowed > 0 && window.days >= 0 && (
          <div className="countdown" role="status">
            <strong>{window.days}</strong>
            <span>
              days left to return
              <br />
              borrowed money free
            </span>
          </div>
        )}
      </div>

      <form
        className="refund-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const n = (k: string) =>
            f.get(k) === "" ? undefined : Number(f.get(k));
          void action(async () => {
            await request(
              `/api/refunds/${encodeURIComponent(refund.id)}/plan`,
              "POST",
              {
                funding: f.get("funding"),
                loanAmount: n("loanAmount"),
                loanRate: n("loanRate"),
                loanType: f.get("loanType") || undefined,
                monthsUntilNext: n("monthsUntilNext"),
                monthlyLiving: n("monthlyLiving"),
                currentSavings: n("currentSavings"),
                yearsUntilRepayment: n("yearsUntilRepayment"),
              },
            );
          });
        }}
      >
        <fieldset>
          <legend>Three quick questions</legend>
          <div className="refund-grid">
            <label className="field">
              Where it came from
              <select name="funding" defaultValue={refund.funding}>
                {Object.entries(FUNDING).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              How much was a loan? (USD)
              <input
                name="loanAmount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={refund.loanAmount ?? ""}
              />
            </label>
            <label className="field">
              Rent, food and bills per month
              <input
                name="monthlyLiving"
                type="number"
                min="0"
                step="1"
                defaultValue={inputs?.monthlyLiving ?? ""}
                placeholder="0"
              />
            </label>
          </div>
        </fieldset>
        <details className="refund-more" open={!!(refund.loanRate || plan)}>
          <summary>More details for a sharper plan (optional)</summary>
          <div className="refund-grid">
            <label className="field">
              Loan interest rate (%)
              <input
                name="loanRate"
                type="number"
                min="0"
                max="30"
                step="0.01"
                placeholder="On studentaid.gov"
                defaultValue={refund.loanRate ?? ""}
              />
            </label>
            <label className="field">
              Loan type
              <select name="loanType" defaultValue={refund.loanType ?? ""}>
                <option value="">Not sure</option>
                <option value="unsubsidized">Federal unsubsidized</option>
                <option value="subsidized">Federal subsidized</option>
                <option value="parent_plus">Parent PLUS</option>
                <option value="private">Private loan</option>
              </select>
            </label>
            <label className="field">
              Months until next aid
              <input
                name="monthsUntilNext"
                type="number"
                min="0"
                max="12"
                step="1"
                defaultValue={inputs?.monthsUntilNext ?? 4}
              />
            </label>
            <label className="field">
              Savings you already have
              <input
                name="currentSavings"
                type="number"
                min="0"
                step="1"
                defaultValue={inputs?.currentSavings ?? ""}
                placeholder="0"
              />
            </label>
            <label className="field">
              Years until loan repayment
              <input
                name="yearsUntilRepayment"
                type="number"
                min="0"
                max="10"
                step="0.5"
                defaultValue={inputs?.yearsUntilRepayment ?? 4}
              />
            </label>
          </div>
        </details>
        <button className="btn btn--primary" disabled={busy}>
          {plan ? "Update my plan" : "Make my plan"} <ArrowRight size={16} />
        </button>
      </form>

      {plan && (
        <div className="refund-plan" aria-live="polite">
          <h3>Your plan</h3>
          <ol>
            {plan.steps.map((s) => (
              <li key={s.key}>
                <div className="refund-plan__row">
                  <strong>{s.label}</strong>
                  <span>{usd(s.amount)}</span>
                </div>
                <p>{s.reason}</p>
                {s.link && (
                  <a
                    href={s.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link"
                  >
                    {s.link.label} <ExternalLink size={13} aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ol>
          {plan.notes.map((n) => (
            <p key={n} className="muted refund-note">
              {n}
            </p>
          ))}
          <div className="refund-practice">
            <TrendingUp size={22} />
            <div>
              <strong>Curious about investing?</strong>
              <p>
                Try it with {usd(plan.practiceAmount)} in <em>virtual</em> money
                first. Real prices, no real risk.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--dark"
              disabled={busy}
              onClick={onPractice}
            >
              Start practicing
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={busy}
        onClick={() =>
          void action(async () => {
            await request(
              `/api/refunds/${encodeURIComponent(refund.id)}`,
              "PATCH",
              {
                status: "dismissed",
              },
            );
          })
        }
      >
        This isn&apos;t a school refund
      </button>
    </section>
  );
}
