"use client";
import { useId, useState } from "react";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

/** Estimates what forgotten free trials cost in a school year. */
export default function TrialCalculator() {
  const id = useId();
  const [trials, setTrials] = useState(3);
  const [price, setPrice] = useState(12);
  const [months, setMonths] = useState(3);
  const yearly = trials * 2 * price * months;
  const warned = trials * 2;
  const pct = Math.min(100, (yearly / 1500) * 100);
  return (
    <div className="calc card" data-buddy-mood="thinking">
      <div className="calc__inputs">
        <label className="calc__field" htmlFor={`${id}-t`}>
          <span>
            Free trials you start per semester <strong>{trials}</strong>
          </span>
          <input
            id={`${id}-t`}
            type="range"
            min={1}
            max={10}
            value={trials}
            onChange={(e) => setTrials(Number(e.target.value))}
          />
        </label>
        <label className="calc__field" htmlFor={`${id}-p`}>
          <span>
            Average price after the trial <strong>{money(price)}/mo</strong>
          </span>
          <input
            id={`${id}-p`}
            type="range"
            min={3}
            max={40}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </label>
        <label className="calc__field" htmlFor={`${id}-m`}>
          <span>
            Months before you notice <strong>{months}</strong>
          </span>
          <input
            id={`${id}-m`}
            type="range"
            min={1}
            max={12}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          />
        </label>
      </div>
      <output className="calc__result" htmlFor={`${id}-t ${id}-p ${id}-m`}>
        <span className="eyebrow eyebrow--plain">Forgotten trials could cost</span>
        <strong aria-live="polite">{money(yearly)}</strong>
        <span className="muted">per school year</span>
        <span className="calc__bar" aria-hidden="true">
          <i style={{ width: `${Math.max(4, pct)}%` }} />
        </span>
        <span className="calc__with">
          With Brix: <b>{warned * 2} heads-ups</b> (7 and 2 days before each
          trial ends), so every charge is a choice.
        </span>
      </output>
      <p className="calc__note">
        Estimate for illustration. Your numbers depend on your trials.
      </p>
    </div>
  );
}
