"use client";
import { useEffect, useId, useMemo, useState, type PointerEvent } from "react";
import { Coins, Trophy } from "lucide-react";
import type { RequestFn } from "../brix/useBrixChat";
import type { History, HistoryRange } from "@/lib/market/history";
import type { LeaderboardEntry } from "@/lib/practice/leaderboard";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
const RANGES: { id: HistoryRange; label: string }[] = [
  { id: "1mo", label: "1M" },
  { id: "6mo", label: "6M" },
  { id: "1y", label: "1Y" },
];
const W = 640,
  H = 220,
  PAD = { top: 14, right: 12, bottom: 24, left: 12 };

/** Catmull-Rom through the points, drawn as cubic Béziers: a smooth line. */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** A shaded price line for one security, with a hover crosshair. */
export function PriceChart({
  request,
  symbols,
}: {
  request: RequestFn;
  symbols: string[];
}) {
  const [symbol, setSymbol] = useState(symbols[0] ?? "VOO");
  const [range, setRange] = useState<HistoryRange>("1mo");
  const [data, setData] = useState<History | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId();
  const choices = useMemo(
    () => [...new Set(["VOO", ...symbols])].slice(0, 6),
    [symbols],
  );

  useEffect(() => {
    let alive = true;
    let timer = 0;
    let tries = 0;
    const load = () =>
      request<History>(`/api/market/history?symbol=${symbol}&range=${range}`)
        .then((h) => {
          if (!alive) return;
          setData(h);
          setFailed(false);
        })
        .catch(() => {
          if (!alive) return;
          setFailed(true);
          // Keep trying quietly: 5s, 10s, 20s, then every 30s.
          timer = window.setTimeout(
            () => void load(),
            Math.min(30_000, 5_000 * 2 ** tries++),
          );
        });
    void load();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [request, symbol, range]);

  const shown = data?.symbol === symbol && data.range === range ? data : null;
  const geo = useMemo(() => {
    if (!shown) return null;
    const closes = shown.points.map((p) => p.close);
    const min = Math.min(...closes),
      max = Math.max(...closes);
    const span = max - min || 1;
    const x = (i: number) =>
      PAD.left + (i / (closes.length - 1)) * (W - PAD.left - PAD.right);
    const y = (v: number) =>
      PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);
    const pts = closes.map((v, i) => [x(i), y(v)] as [number, number]);
    const line = smoothPath(pts);
    const area = `${line} L${pts.at(-1)![0]},${H - PAD.bottom} L${pts[0][0]},${H - PAD.bottom} Z`;
    const first = closes[0],
      last = closes.at(-1)!;
    return { pts, line, area, min, max, change: (last / first - 1) * 100 };
  }, [shown]);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!geo) return;
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    geo.pts.forEach((p, i) => {
      if (Math.abs(p[0] - fx) < Math.abs(geo.pts[best][0] - fx)) best = i;
    });
    setHover(best);
  };
  const point = hover !== null && shown ? shown.points[hover] : null;
  const date = (t: string) =>
    new Date(t).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(range === "1y" ? { year: "2-digit" } : {}),
    });

  return (
    <section className="card practice-line" aria-labelledby="price-line-title">
      <div className="practice-line__head">
        <div>
          <span className="practice-chart__eyebrow">Price history</span>
          <h2 id="price-line-title">
            {symbol}{" "}
            {geo && (
              <span className={geo.change >= 0 ? "is-up" : "is-down"}>
                {pct(geo.change)}
              </span>
            )}
          </h2>
          <p className="practice-line__value">
            {point
              ? `${usd(point.close)} · ${date(point.t)}`
              : shown
                ? `${usd(shown.points.at(-1)!.close)} latest close`
                : failed
                  ? "History unavailable · retrying"
                  : "Loading…"}
          </p>
        </div>
        <div className="practice-line__controls">
          <div className="segmented" role="group" aria-label="Security">
            {choices.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={s === symbol}
                className={s === symbol ? "is-active" : undefined}
                onClick={() => setSymbol(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === range}
                className={r.id === range ? "is-active" : undefined}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="practice-line__plot">
        {geo && shown ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`${symbol} closing prices from ${date(shown.points[0].t)} to ${date(shown.points.at(-1)!.t)}: ${usd(shown.points[0].close)} to ${usd(shown.points.at(-1)!.close)}, ${pct(geo.change)}.`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0"
                  stopColor="var(--color-accent)"
                  stopOpacity="0.28"
                />
                <stop
                  offset="1"
                  stopColor="var(--color-accent)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={PAD.left}
                x2={W - PAD.right}
                y1={PAD.top + f * (H - PAD.top - PAD.bottom)}
                y2={PAD.top + f * (H - PAD.top - PAD.bottom)}
                className="practice-line__grid"
              />
            ))}
            <path d={geo.area} fill={`url(#${gradient})`} />
            <path d={geo.line} className="practice-line__stroke" />
            {hover !== null && (
              <g className="practice-line__hover">
                <line
                  x1={geo.pts[hover][0]}
                  x2={geo.pts[hover][0]}
                  y1={PAD.top}
                  y2={H - PAD.bottom}
                />
                <circle cx={geo.pts[hover][0]} cy={geo.pts[hover][1]} r="5" />
              </g>
            )}
          </svg>
        ) : (
          <div className="practice-line__empty" role="status">
            {failed ? "Price history unavailable. Retrying…" : "Loading chart…"}
          </div>
        )}
        {geo && shown && (
          <div className="practice-line__axis" aria-hidden>
            <span>{date(shown.points[0].t)}</span>
            <span>
              Low {usd(geo.min)} · High {usd(geo.max)}
            </span>
            <span>{date(shown.points.at(-1)!.t)}</span>
          </div>
        )}
      </div>
      <p className="practice-line__explain">
        How the price moved over time. Hover or tap to see any day.
      </p>
      <p className="practice-chart__footnote">
        {shown?.sample
          ? "Sample history for the demo. Not real market data."
          : "Daily or weekly closes from Yahoo Finance. May be delayed."}
      </p>
    </section>
  );
}

/** Students ranked by Brix coins: habits count more than luck. */
export function Leaderboard({ request }: { request: RequestFn }) {
  const [board, setBoard] = useState<{
    entries: LeaderboardEntry[];
    hasSamples: boolean;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      request<{ entries: LeaderboardEntry[]; hasSamples: boolean }>(
        "/api/practice/leaderboard",
      )
        .then((b) => alive && (setBoard(b), setFailed(false)))
        .catch(() => alive && setFailed(true));
    void load();
    const id = window.setInterval(() => void load(), 120_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [request]);

  return (
    <section className="card leaderboard" aria-labelledby="leaderboard-title">
      <div className="leaderboard__head">
        <Trophy size={22} aria-hidden />
        <div>
          <h2 id="leaderboard-title">Leaderboard</h2>
          <p>Stack Brix coins by showing up, not by getting lucky.</p>
        </div>
      </div>
      {board ? (
        <>
          <ol className="leaderboard__list">
            {board.entries
              .filter((e) => !e.sample)
              .map((e) => (
                <BoardRow key={`${e.rank}-${e.name}`} e={e} />
              ))}
          </ol>
          {board.hasSamples && (
            <>
              <p className="leaderboard__tag">
                Made-up examples, not real students. Not ranked.
              </p>
              <ul
                className="leaderboard__list"
                aria-label="Example players, not real students"
              >
                {board.entries
                  .filter((e) => e.sample)
                  .map((e) => (
                    <BoardRow key={e.name} e={e} />
                  ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <p className="muted" role="status">
          {failed ? "Leaderboard unavailable right now." : "Loading…"}
        </p>
      )}
      <p className="practice-chart__footnote">
        Start: 100 · Trade: +10 · Auto-invest rule: +50 · Each 1% gained: +20 ·
        Losses never cost coins. Only first names and initials are shown.
        {board?.hasSamples &&
          " Example players only show how coins work until more students join."}
      </p>
    </section>
  );
}

function BoardRow({ e }: { e: LeaderboardEntry }) {
  return (
    <li
      className={`${e.you ? "is-you" : ""}${e.sample ? " is-sample" : ""}`}
    >
      <span className={`leaderboard__rank leaderboard__rank--${e.rank}`}>
        {e.sample ? "–" : e.rank}
      </span>
      <span className="leaderboard__name">
        <span className="leaderboard__who">
          {e.sample ? e.name.replace("Sample · ", "") : e.name}
          {e.you && <span className="badge badge--accent">You</span>}
        </span>
        {e.sample && (
          <small className="leaderboard__tag">Example, not a real person</small>
        )}
      </span>
      <span
        className={`leaderboard__gain ${e.gainPct >= 0 ? "is-up" : "is-down"}`}
      >
        {pct(e.gainPct)}
      </span>
      <span className="leaderboard__coins" title={`${e.coins} Brix coins`}>
        <Coins size={14} aria-hidden />
        {e.coins.toLocaleString("en-US")}
        <span className="sr-only"> coins</span>
      </span>
    </li>
  );
}
