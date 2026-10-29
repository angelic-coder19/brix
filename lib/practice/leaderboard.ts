import { getQuotes, type Quote } from "../market/quotes";
import { getPortfolio, getState, listPortfolioOwners } from "../store";
import { valuation, type Portfolio } from "./engine";
import { copyIdFor, mixOf, type MixWeight } from "./copy";

export interface LeaderboardEntry {
  rank: number;
  name: string;
  coins: number;
  gainPct: number;
  trades: number;
  rules: number;
  you?: boolean;
  /** A labelled example player, shown while the real board is small. */
  sample?: boolean;
  /** Present only when the player opted in: tickers and percentages, no dollars. */
  mix?: MixWeight[];
  /** Opaque id for copying this mix; never the player's account id. */
  copyId?: string;
}

const MAX_PLAYERS = 200;
const TTL_MS = 5 * 60 * 1000;
let cached: {
  at: number;
  rows: (Omit<LeaderboardEntry, "rank"> & { uid?: string })[];
} | null = null;

// Example players so a small board still teaches what earns coins. Always
// marked as samples in the API and the UI.
const SAMPLES = [
  {
    name: "Sample · Jordan K.",
    gainPct: 4.1,
    trades: 14,
    rules: 2,
    copyId: "sample_jordan",
    mix: [
      { symbol: "VOO", pct: 60 },
      { symbol: "QQQ", pct: 25 },
      { symbol: "NVDA", pct: 15 },
    ],
  },
  {
    name: "Sample · Priya S.",
    gainPct: 2.6,
    trades: 9,
    rules: 1,
    copyId: "sample_priya",
    mix: [
      { symbol: "VTI", pct: 70 },
      { symbol: "VXUS", pct: 20 },
      { symbol: "BND", pct: 10 },
    ],
  },
  {
    name: "Sample · Leo M.",
    gainPct: -1.4,
    trades: 22,
    rules: 0,
    copyId: "sample_leo",
    mix: [
      { symbol: "TSLA", pct: 40 },
      { symbol: "AMD", pct: 30 },
      { symbol: "QQQ", pct: 30 },
    ],
  },
  {
    name: "Sample · Ava T.",
    gainPct: 0.8,
    trades: 5,
    rules: 1,
    copyId: "sample_ava",
    mix: [
      { symbol: "SCHD", pct: 60 },
      { symbol: "VOO", pct: 40 },
    ],
  },
];

/**
 * Brix coins reward habits more than luck: 100 for starting, 10 per trade
 * (up to 30), 50 per active auto-invest rule (up to 3), and 20 per percent
 * gained. Losses never take coins away.
 */
export function coinsFor(gainPct: number, trades: number, rules: number) {
  return (
    100 +
    10 * Math.min(trades, 30) +
    50 * Math.min(rules, 3) +
    Math.max(0, Math.round(gainPct * 20))
  );
}

/** "Maya Chen" → "Maya C." Only a first name and initial are ever shown. */
export function publicName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A Brix student";
  const first = parts[0].slice(0, 20);
  return parts.length > 1
    ? `${first} ${parts.at(-1)![0].toUpperCase()}.`
    : first;
}

async function rowFor(
  uid: string,
  p: Portfolio,
  quotes: Record<string, Quote>,
) {
  const v = valuation(p, quotes);
  const mix = p.shareMix ? mixOf(v.positions) : [];
  const trades = p.orders.filter((o) => o.status === "filled").length;
  const rules = p.rules.filter((r) => r.active).length;
  return {
    uid,
    name: publicName((await getState(uid)).user.displayName ?? ""),
    gainPct: v.gainPct,
    trades,
    rules,
    coins: coinsFor(v.gainPct, trades, rules),
    ...(mix.length ? { mix, copyId: copyIdFor(uid) } : {}),
  };
}

async function players() {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.rows;
  const owners = (await listPortfolioOwners()).slice(0, MAX_PLAYERS);
  const portfolios = (
    await Promise.all(
      owners.map(async (uid) => ({ uid, p: await getPortfolio(uid) })),
    )
  ).filter((x): x is { uid: string; p: Portfolio } => !!x.p);
  const quotes = await getQuotes([
    ...new Set(portfolios.flatMap(({ p }) => Object.keys(p.positions))),
  ]);
  const rows = await Promise.all(
    portfolios.map(({ uid, p }) => rowFor(uid, p, quotes)),
  );
  cached = { at: Date.now(), rows };
  return rows;
}

/** The top 10 by coins, plus your own row if you're further down. */
export async function leaderboard(uid: string) {
  // Everyone else may be up to 5 minutes old; your own row is always fresh.
  const mine = await getPortfolio(uid);
  const real = [
    ...(await players()).filter((r) => r.uid !== uid),
    ...(mine
      ? [await rowFor(uid, mine, await getQuotes(Object.keys(mine.positions)))]
      : []),
  ];
  const samples =
    real.length < 5
      ? SAMPLES.map((s) => ({
          ...s,
          coins: coinsFor(s.gainPct, s.trades, s.rules),
          sample: true,
        }))
      : [];
  // Only real students are ranked. Sample players are listed apart, unranked
  // (rank 0), so nobody mistakes a made-up player for a real person.
  const ranked = real
    .sort((a, b) => b.coins - a.coins || b.gainPct - a.gainPct)
    .map((row, i) => {
      const { uid: owner, ...rest } = row as typeof row & { uid?: string };
      return { ...rest, rank: i + 1, ...(owner === uid ? { you: true } : {}) };
    });
  const top = ranked.slice(0, 10);
  const you = ranked.find((r) => r.you);
  return {
    entries: [
      ...(you && you.rank > 10 ? [...top, you] : top),
      ...samples
        .sort((a, b) => b.coins - a.coins)
        .map((s) => ({ ...s, rank: 0 })),
    ],
    players: real.length,
    hasSamples: samples.length > 0,
  };
}

/** The opted-in mix behind a copy id, or null. Sample ids map to examples. */
export async function mixForCopyId(
  copyId: string,
): Promise<MixWeight[] | null> {
  const sample = SAMPLES.find((s) => s.copyId === copyId);
  if (sample) return sample.mix;
  const row = (await players()).find((r) => r.copyId === copyId);
  return row?.mix ?? null;
}
