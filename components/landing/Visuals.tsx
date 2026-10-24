import { Bell, Check, ShieldCheck } from "lucide-react";

/* Static UI mockups and charts for the landing page (server-rendered SVG/CSS). */

export function PhoneMockup() {
  const rows = [
    { m: "Spotify", d: "Renews in 2 days", a: "$11.99", tone: "1", soon: true },
    { m: "Netflix", d: "Renews in 5 days", a: "$15.49", tone: "0" },
    { m: "Notion AI", d: "Trial ends in 12 days", a: "$10.00", tone: "5", trial: true },
    { m: "Adobe", d: "Renews in 9 days", a: "$9.99", tone: "2" },
  ];
  return (
    <div className="phone" aria-hidden="true">
      <div className="phone__notch" />
      <div className="phone__screen">
        <div className="phone__status">
          <span>9:41</span>
          <span className="phone__dots" />
        </div>
        <div className="phone__header">
          <span className="wordmark wordmark--sm">
            <span className="brand-block" />
            brix<span className="brand-period">.</span>
          </span>
          <span className="phone__avatar">M</span>
        </div>
        <div className="phone__total">
          <small>Monthly recurring</small>
          <strong>$54.45</strong>
          <span className="badge badge--green">
            <ShieldCheck size={12} /> $15.49 avoided
          </span>
        </div>
        <div className="phone__spark">
          <svg viewBox="0 0 220 50" preserveAspectRatio="none">
            <path
              d="M0 38 C30 30 40 42 70 30 S120 10 150 22 S200 8 220 12"
              fill="none"
              stroke="#c8462a"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M0 38 C30 30 40 42 70 30 S120 10 150 22 S200 8 220 12 V50 H0Z"
              fill="url(#spark)"
            />
            <defs>
              <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#c8462a" stopOpacity=".22" />
                <stop offset="1" stopColor="#c8462a" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="phone__label">Coming up next</div>
        {rows.map((r) => (
          <div className={`phone__row${r.soon ? " is-soon" : ""}`} key={r.m}>
            <span className="merchant-icon" data-tone={r.tone}>
              {r.m[0]}
            </span>
            <span className="phone__row-name">
              <b>{r.m}</b>
              <small>{r.d}</small>
            </span>
            <span className="phone__row-amt">{r.a}</span>
          </div>
        ))}
        <div className="phone__nav">
          <i className="is-on" />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

export function FloatingChip({
  icon,
  title,
  sub,
  className = "",
  mood,
}: {
  icon: "bell" | "check" | "shield";
  title: string;
  sub?: string;
  className?: string;
  mood?: string;
}) {
  const Icon = icon === "bell" ? Bell : icon === "check" ? Check : ShieldCheck;
  return (
    <div className={`float-chip ${className}`} data-buddy-mood={mood}>
      <span className={`float-chip__icon float-chip__icon--${icon}`}>
        <Icon size={16} />
      </span>
      <span>
        <strong>{title}</strong>
        {sub && <small>{sub}</small>}
      </span>
    </div>
  );
}

export function BarChart() {
  const bars = [42, 55, 48, 61, 38, 30];
  const labels = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  return (
    <svg
      className="chart"
      viewBox="0 0 300 150"
      role="img"
      aria-label="Sample bar chart: monthly recurring spend falls from $61 in August to $30 in October"
    >
      {[30, 70, 110].map((y) => (
        <line key={y} x1="0" x2="300" y1={y} y2={y} className="chart__grid" />
      ))}
      {bars.map((v, i) => {
        const h = v * 1.8;
        return (
          <g key={labels[i]}>
            <rect
              x={14 + i * 48}
              y={130 - h}
              width="30"
              height={h}
              rx="7"
              className={i === bars.length - 1 ? "chart__bar is-hl" : "chart__bar"}
            />
            <text x={29 + i * 48} y="146" textAnchor="middle" className="chart__label chart__label--sm">
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart() {
  return (
    <svg
      className="chart"
      viewBox="0 0 300 130"
      role="img"
      aria-label="Sample line chart: estimated savings rising over the semester"
    >
      {[25, 65, 105].map((y) => (
        <line key={y} x1="0" x2="300" y1={y} y2={y} className="chart__grid" />
      ))}
      <path
        d="M0 110 L40 102 L80 104 L120 80 L160 84 L200 56 L240 50 L300 22 V130 H0Z"
        className="chart__area"
      />
      <path
        d="M0 110 L40 102 L80 104 L120 80 L160 84 L200 56 L240 50 L300 22"
        className="chart__line"
      />
      <circle cx="300" cy="22" r="6" className="chart__dot" />
    </svg>
  );
}

export function Donut() {
  const r = 52,
    c = 2 * Math.PI * r;
  const subs = 0.72;
  return (
    <svg
      className="chart chart--donut"
      viewBox="0 0 140 140"
      role="img"
      aria-label="Sample donut chart: 72% subscriptions, 28% free trials"
    >
      <circle cx="70" cy="70" r={r} className="chart__track" />
      <circle
        cx="70"
        cy="70"
        r={r}
        className="chart__seg"
        strokeDasharray={`${c * subs} ${c}`}
        transform="rotate(-90 70 70)"
      />
      <circle
        cx="70"
        cy="70"
        r={r}
        className="chart__seg chart__seg--2"
        strokeDasharray={`${c * (1 - subs) - 6} ${c}`}
        strokeDashoffset={-c * subs - 3}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="68" textAnchor="middle" className="chart__big">
        6
      </text>
      <text x="70" y="88" textAnchor="middle" className="chart__label">
        charges
      </text>
    </svg>
  );
}

export function CardStack() {
  return (
    <div className="card-stack" aria-hidden="true">
      <div className="card-stack__back" />
      <div className="card-stack__mid" />
      <div className="virtual-card card-stack__front">
        <div className="virtual-card__top">
          <strong>brix.</strong>
          <span className="badge">Single use</span>
        </div>
        <span className="chip-icon" />
        <small>Spending limit</small>
        <p className="card-stack__amount">$10.00</p>
        <div className="virtual-card__bottom">
          <span>Notion AI trial</span>
          <span>•••• 4242</span>
        </div>
      </div>
    </div>
  );
}
