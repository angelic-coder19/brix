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

const SEMESTER_MONTHS = 4;
const SECOND_SEMESTER_START = 5;

/**
 * What forgotten trials have cost by each month of the school year. Trials
 * start spread across each semester, then bill monthly until noticed, so the
 * total climbs, steepens as charges overlap, and levels off.
 */
export function costByMonth(
  trials: number,
  price: number,
  months: number,
  semesters = SEMESTERS,
) {
  const bills: number[] = [];
  for (let sem = 0; sem < semesters; sem++)
    for (let i = 0; i < trials; i++) {
      const start =
        sem * SECOND_SEMESTER_START + (i * SEMESTER_MONTHS) / Math.max(1, trials);
      for (let k = 1; k <= months; k++) bills.push(start + k);
    }
  const end = Math.ceil(Math.max(...bills, SECOND_SEMESTER_START + 4));
  return Array.from({ length: end + 1 }, (_, m) => ({
    month: m,
    total: bills.filter((b) => b <= m).length * price,
  }));
}

/** A smooth path through points that never overshoots (monotone cubic). */
function smooth(points: [number, number][]) {
  const n = points.length;
  if (n < 2) return "";
  const dx = points.slice(1).map((p, i) => p[0] - points[i][0]);
  const m = points.slice(1).map((p, i) => (p[1] - points[i][1]) / dx[i]);
  const t = points.map((_, i) =>
    i === 0
      ? m[0]
      : i === n - 1
        ? m[n - 2]
        : m[i - 1] * m[i] <= 0
          ? 0
          : (m[i - 1] + m[i]) / 2,
  );
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i],
      b = t[i + 1] / m[i],
      h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i],
      [x1, y1] = points[i + 1],
      h = dx[i] / 3;
    d += ` C${(x0 + h).toFixed(1)},${(y0 + t[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - t[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
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
      <div
        className="calc__track"
        style={{ "--pct": `${pct}%`, "--p": pct / 100 } as React.CSSProperties}
      >
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
  const ceiling = Math.max(50, Math.ceil(year / 100) * 100);
  const chart = { left: 52, right: 454, top: 24, bottom: 210 };
  const both = costByMonth(trials, price, months);
  const first = costByMonth(trials, price, months, 1);
  const last = both.at(-1)!.month;
  const x = (month: number) =>
    chart.left + (month / last) * (chart.right - chart.left);
  const y = (amount: number) =>
    chart.bottom - (amount / ceiling) * (chart.bottom - chart.top);
  const curve = (rows: { month: number; total: number }[]) =>
    smooth(
      [...rows, ...both.slice(rows.length)].map((r, i) => [
        x(r.month),
        y(i < rows.length ? r.total : rows.at(-1)!.total),
      ]),
    );
  const yearPath = curve(both);
  const semesterPath = curve(first);
  const ticks = [0, Math.round(last / 2), last];

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
        <output
          className="calc__total"
          htmlFor={`${id}-t ${id}-p ${id}-m`}
          aria-live="polite"
        >
          <span className="sr-only">{money(year)} per school year</span>
          <span aria-hidden="true">{money(shownYear)}</span>
        </output>
        <span className="calc__per">
          per school year · {money(shownSemester)} a semester
        </span>

        <figure className="calc-chart" aria-labelledby={`${id}-chart-title`}>
          <figcaption id={`${id}-chart-title`}>
            The longer it runs, the more it adds up.
          </figcaption>
          <svg
            viewBox="0 0 480 254"
            role="img"
            aria-labelledby={`${id}-chart-desc`}
          >
            <title id={`${id}-chart-desc`}>
              {`${trials} trials at ${money(price)} per month cost ${money(semester)} per semester, or ${money(year)} across two semesters, after ${months} paid months each.`}
            </title>
            {[0, 0.5, 1].map((fraction) => (
              <g key={fraction}>
                <line
                  className="calc-chart__grid"
                  x1={chart.left}
                  x2={chart.right}
                  y1={y(ceiling * fraction)}
                  y2={y(ceiling * fraction)}
                />
                <text
                  className="calc-chart__label"
                  x={chart.left - 10}
                  y={y(ceiling * fraction) + 4}
                  textAnchor="end"
                >
                  {money(ceiling * fraction)}
                </text>
              </g>
            ))}
            <path
              className="calc-chart__area"
              d={`${yearPath} L${chart.right},${chart.bottom} L${chart.left},${chart.bottom} Z`}
            />
            <path
              className="calc-chart__line calc-chart__line--semester"
              d={semesterPath}
            />
            <path className="calc-chart__line" d={yearPath} />
            <circle
              className="calc-chart__point"
              cx={x(last)}
              cy={y(year)}
              r="5"
            />
            {ticks.map((month) => (
              <text
                className="calc-chart__label"
                key={month}
                x={x(month)}
                y="234"
                textAnchor="middle"
              >
                {month}
              </text>
            ))}
          </svg>
          <div className="calc-chart__axis">Months into the school year</div>
          <div className="calc-chart__legend">
            <span>
              <i />
              Whole school year
            </span>
            <span>
              <i />
              First semester only
            </span>
          </div>
        </figure>

        <p className="calc__with">
          {headsUps} reminders across two semesters. More chances to decide
          before a trial bills.
        </p>
        <p className="calc__formula">
          {trials} {trials === 1 ? "trial" : "trials"} × ${price}/mo × {months}{" "}
          {months === 1 ? "month" : "months"} = {money(semester)} per semester ×{" "}
          {SEMESTERS} semesters = {money(year)} per school year
        </p>
      </div>
      <p className="calc__note">
        Illustration, not a savings promise. Assumes the same trials each
        semester and the selected number of paid months per trial.
      </p>
    </div>
  );
}
