"use client";
import { useEffect, useId, useRef, useState } from "react";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export const SEMESTERS = 2;
export const REMINDERS_PER_TRIAL = 2;
export function estimate(trials: number, price: number, months: number) {
  const semester = trials * price * months;
  return {
    semester,
    year: semester * SEMESTERS,
    headsUps: trials * SEMESTERS * REMINDERS_PER_TRIAL,
  };
}

/** Counts toward a new value; jumps straight there under reduced motion. */
function useTween(value: number, ms = 450) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      const t = setTimeout(() => setShown(value), 0);
      return () => clearTimeout(t);
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(start + (value - start) * eased);
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  ticks,
  format,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  ticks: number[];
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="calc__field">
      <label htmlFor={id}>{label}</label>
      <div className="calc__track" style={{ "--pct": `${pct}%`, "--p": pct / 100 } as React.CSSProperties}>
        <output className="calc__bubble" htmlFor={id} aria-hidden="true">
          {format(value)}
        </output>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          aria-valuetext={format(value)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <div className="calc__ticks" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: `${((t - min) / (max - min)) * 100}%` }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Estimates what forgotten free trials cost in a school year. */
export default function TrialCalculator() {
  const id = useId();
  const [trials, setTrials] = useState(3);
  const [price, setPrice] = useState(12);
  const [months, setMonths] = useState(3);
  const { semester, year, headsUps } = estimate(trials, price, months);
  const shownYear = useTween(year);
  const shownSemester = useTween(semester);
  // A fixed $800 scale keeps typical answers readable; bigger ones fill the bar.
  const barPct = Math.max(2, Math.min(100, (year / 800) * 100));

  return (
    <div className="calc" data-buddy-mood="thinking">
      <div className="calc__inputs">
        <Slider
          id={`${id}-t`}
          label="Free trials you start per semester"
          value={trials}
          min={1}
          max={10}
          ticks={[1, 4, 7, 10]}
          format={(n) => `${n} ${n === 1 ? "trial" : "trials"}`}
          onChange={setTrials}
        />
        <Slider
          id={`${id}-p`}
          label="Price once the trial ends"
          value={price}
          min={3}
          max={40}
          ticks={[3, 10, 20, 30, 40]}
          format={(n) => `$${n}/mo`}
          onChange={setPrice}
        />
        <Slider
          id={`${id}-m`}
          label="Months before you notice the charge"
          value={months}
          min={1}
          max={12}
          ticks={[1, 3, 6, 9, 12]}
          format={(n) => `${n} ${n === 1 ? "month" : "months"}`}
          onChange={setMonths}
        />
      </div>

      <div className="calc__result">
        <span className="calc__kicker">Forgotten trials could cost you</span>
        <output className="calc__total" htmlFor={`${id}-t ${id}-p ${id}-m`} aria-live="polite">
          <span className="sr-only">{money(year)} per school year</span>
          <span aria-hidden="true">{money(shownYear)}</span>
        </output>
        <span className="calc__per">
          per school year · {money(shownSemester)} a semester
        </span>

        <div className="calc__compare" aria-hidden="true">
          <div className="calc__row">
            <span>Without Brix</span>
            <span className="calc__bar">
              <i style={{ width: `${barPct}%` }} />
            </span>
            <b>{money(shownYear)}</b>
          </div>
          <div className="calc__row calc__row--with">
            <span>With Brix</span>
            <span className="calc__pings">
              {Array.from({ length: Math.min(headsUps, 40) }, (_, i) => (
                <i key={i} />
              ))}
            </span>
            <b>{headsUps} heads-ups</b>
          </div>
        </div>

        <p className="calc__with">
          Brix reminds you 7 days and 2 days before each trial ends. That’s {headsUps}{" "}
          heads-ups a year, so every charge is one you chose.
        </p>
        <p className="calc__formula">
          {trials} {trials === 1 ? "trial" : "trials"} × ${price}/mo × {months}{" "}
          {months === 1 ? "month" : "months"} = {money(semester)} per semester × {SEMESTERS}{" "}
          semesters = {money(year)} per school year
        </p>
      </div>
      <p className="calc__note">Estimate for illustration. Your numbers depend on your trials.</p>
    </div>
  );
}
