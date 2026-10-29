// Copy trading, practice only: copy a ready-made strategy or a player's
// opted-in mix into your practice portfolio with virtual money. Brix copies
// percentages, never dollar amounts, and never places a real trade.
import { createHash } from "node:crypto";
import { HttpError } from "../auth";
import { findSecurity } from "../market/universe";
import { MIN_TRADE } from "./engine";

export interface MixWeight {
  symbol: string;
  /** Whole-number percent of the mix; a mix sums to 100. */
  pct: number;
}

export interface Strategy {
  id: string;
  name: string;
  vibe: string;
  blurb: string;
  risk: "chill" | "medium" | "spicy";
  mix: MixWeight[];
}

/** Well-known, plain-English starting mixes. Education, not advice. */
export const STRATEGIES: Strategy[] = [
  {
    id: "sp500",
    name: "Just the S&P 500",
    vibe: "Set it, forget it",
    blurb: "One fund, 500 big US companies. The scoreboard most pros lose to.",
    risk: "medium",
    mix: [{ symbol: "VOO", pct: 100 }],
  },
  {
    id: "three-fund",
    name: "The three-fund classic",
    vibe: "Whole world, low drama",
    blurb: "US stocks, international stocks and a slice of bonds.",
    risk: "chill",
    mix: [
      { symbol: "VTI", pct: 60 },
      { symbol: "VXUS", pct: 30 },
      { symbol: "BND", pct: 10 },
    ],
  },
  {
    id: "tech-tilt",
    name: "Tech tilt",
    vibe: "Main character energy",
    blurb: "An index base with extra weight on big tech. Bigger swings.",
    risk: "spicy",
    mix: [
      { symbol: "VOO", pct: 50 },
      { symbol: "QQQ", pct: 30 },
      { symbol: "NVDA", pct: 10 },
      { symbol: "MSFT", pct: 10 },
    ],
  },
  {
    id: "dividend",
    name: "Dividend chill",
    vibe: "Paid to wait",
    blurb: "Companies that pay you part of their profits, plus the index.",
    risk: "chill",
    mix: [
      { symbol: "SCHD", pct: 60 },
      { symbol: "VOO", pct: 30 },
      { symbol: "KO", pct: 10 },
    ],
  },
];

/** An opaque id for a player's mix, so their account id is never exposed. */
export const copyIdFor = (uid: string) =>
  `p_${createHash("sha256").update(`brix-copy:${uid}`).digest("hex").slice(0, 16)}`;

/** Holdings as whole-number percentages of the invested value (no cash). */
export function mixOf(positions: { symbol: string; value: number }[]) {
  const invested = positions.reduce((s, p) => s + Math.max(0, p.value), 0);
  if (invested <= 0) return [];
  const raw = positions
    .filter((p) => p.value > 0)
    .map((p) => ({ symbol: p.symbol, pct: (p.value / invested) * 100 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);
  const total = raw.reduce((s, r) => s + r.pct, 0);
  const rounded = raw.map((r) => ({
    symbol: r.symbol,
    pct: Math.round((r.pct / total) * 100),
  }));
  // Keep the sum at exactly 100 after rounding.
  const drift = 100 - rounded.reduce((s, r) => s + r.pct, 0);
  if (rounded[0]) rounded[0].pct += drift;
  return rounded.filter((r) => r.pct > 0);
}

/**
 * Splits an amount across a mix. Every slice must clear the minimum trade,
 * and the mix must only use symbols from the practice list.
 */
export function planCopy(mix: MixWeight[], amount: number) {
  if (!mix.length) throw new HttpError(400, "That mix is empty.");
  const total = mix.reduce((s, m) => s + m.pct, 0);
  if (Math.abs(total - 100) > 1)
    throw new HttpError(400, "That mix doesn't add up to 100%.");
  return mix.map((m) => {
    const security = findSecurity(m.symbol);
    if (!security)
      throw new HttpError(400, `${m.symbol} isn't on the practice list.`);
    const slice = Math.floor(amount * (m.pct / total) * 100) / 100;
    if (slice < MIN_TRADE)
      throw new HttpError(
        400,
        `Copy at least $${Math.ceil((MIN_TRADE * 100) / Math.min(...mix.map((x) => x.pct)))} so every slice is a real trade.`,
      );
    return { symbol: security.symbol, amount: slice, pct: m.pct };
  });
}
