"use client";

import { useEffect, useState } from "react";
import { Copy, Users } from "lucide-react";
import type { RequestFn } from "../brix/useBrixChat";
import { Modal } from "../ui/Modal";
import "./copy-trading.css";

export interface MixWeight {
  symbol: string;
  pct: number;
}
interface Strategy {
  id: string;
  name: string;
  vibe: string;
  blurb: string;
  risk: "chill" | "medium" | "spicy";
  mix: MixWeight[];
}
export interface CopySource {
  label: string;
  mix: MixWeight[];
  strategy?: string;
  player?: string;
}
type Run = (work: () => Promise<void>, done?: string) => Promise<void>;

const COLORS = [
  "#c8462a",
  "#292920",
  "#43705a",
  "#80662e",
  "#6b7891",
  "#aaa596",
];
const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** A mix as one stacked bar with its tickers and percentages underneath. */
export function MixBar({ mix }: { mix: MixWeight[] }) {
  return (
    <div className="mix">
      <div
        className="mix__bar"
        role="img"
        aria-label={mix.map((m) => `${m.symbol} ${m.pct}%`).join(", ")}
      >
        {mix.map((m, i) => (
          <span
            key={m.symbol}
            style={{
              width: `${m.pct}%`,
              background: COLORS[i % COLORS.length],
            }}
          />
        ))}
      </div>
      <ul className="mix__legend" aria-hidden>
        {mix.map((m, i) => (
          <li key={m.symbol}>
            <i style={{ background: COLORS[i % COLORS.length] }} />
            {m.symbol} <b>{m.pct}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The copy flow: pick an amount, see the split, confirm. Practice only. */
export function useCopyFlow({
  request,
  run,
  cash,
  busy,
}: {
  request: RequestFn;
  run: Run;
  cash: number;
  busy: boolean;
}) {
  const [source, setSource] = useState<CopySource | null>(null);
  const [amount, setAmount] = useState("100");
  const value = Number(amount);
  const valid = Number.isFinite(value) && value >= 5 && value <= cash;
  const modal = (
    <Modal
      open={!!source}
      title={source ? `Copy ${source.label}` : ""}
      description="Practice money only. Brix buys the same mix, by percent, at today's prices."
      onClose={() => setSource(null)}
    >
      {source && (
        <form
          className="copy-review"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            const s = source;
            setSource(null);
            void run(async () => {
              await request("/api/practice/copy", "POST", {
                ...(s.strategy
                  ? { strategy: s.strategy }
                  : { player: s.player }),
                amount: value,
                clientKey: `copy-${Date.now()}`,
              });
            }, `Copied ${s.label}. Check “What you own”.`);
          }}
        >
          <MixBar mix={source.mix} />
          <label className="field">
            How much practice money?
            <input
              data-autofocus
              type="number"
              inputMode="decimal"
              min="5"
              max={cash}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <ul className="copy-review__split">
            {source.mix.map((m) => (
              <li key={m.symbol}>
                <span>{m.symbol}</span>
                <span>{valid ? usd((value * m.pct) / 100) : "—"}</span>
              </li>
            ))}
          </ul>
          <p className="copy-review__note">
            You have {usd(cash)} to play with. Copying a mix isn&apos;t advice,
            and past results don&apos;t predict anything.
          </p>
          <div className="copy-review__actions">
            <button
              type="button"
              className="btn"
              onClick={() => setSource(null)}
            >
              Nah
            </button>
            <button className="btn btn--primary" disabled={!valid || busy}>
              <Copy size={16} aria-hidden /> Copy with{" "}
              {valid ? usd(value) : "…"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
  return { open: setSource, modal };
}

/** Ready-made mixes anyone can copy into their practice portfolio. */
export function CopyVibes({
  request,
  onPick,
}: {
  request: RequestFn;
  onPick: (s: CopySource) => void;
}) {
  const [strategies, setStrategies] = useState<Strategy[] | null>(null);
  useEffect(() => {
    let alive = true;
    void request<{ strategies: Strategy[] }>("/api/practice/copy")
      .then((r) => alive && setStrategies(r.strategies))
      .catch(() => alive && setStrategies([]));
    return () => {
      alive = false;
    };
  }, [request]);
  return (
    <section className="card copy-vibes" aria-labelledby="copy-title">
      <div className="copy-vibes__head">
        <Users size={22} aria-hidden />
        <div>
          <h2 id="copy-title">
            Copy a vibe <small className="term-real">copy trading</small>
          </h2>
          <p>
            Copy a classic strategy or a top player&apos;s mix into practice in
            one tap. Same percentages, your fake money.
          </p>
        </div>
      </div>
      {strategies === null ? (
        <p className="muted" role="status">
          Loading strategies…
        </p>
      ) : (
        <ul className="copy-vibes__grid">
          {strategies.map((s) => (
            <li key={s.id} className="copy-card">
              <div className="copy-card__top">
                <strong>{s.name}</strong>
                <span className={`copy-card__risk copy-card__risk--${s.risk}`}>
                  {s.risk}
                </span>
              </div>
              <span className="copy-card__vibe">{s.vibe}</span>
              <p>{s.blurb}</p>
              <MixBar mix={s.mix} />
              <button
                type="button"
                className="btn btn--sm"
                onClick={() =>
                  onPick({ label: s.name, mix: s.mix, strategy: s.id })
                }
              >
                <Copy size={14} aria-hidden /> Copy this
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
