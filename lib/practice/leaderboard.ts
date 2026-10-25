import { getQuotes } from "../market/quotes";
import { getPortfolio, getState, listPortfolioOwners } from "../store";
import { valuation, type Portfolio } from "./engine";

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
  { name: "Sample · Jordan K.", gainPct: 4.1, trades: 14, rules: 2 },
  { name: "Sample · Priya S.", gainPct: 2.6, trades: 9, rules: 1 },
  { name: "Sample · Leo M.", gainPct: -1.4, trades: 22, rules: 0 },
  { name: "Sample · Ava T.", gainPct: 0.8, trades: 5, rules: 1 },
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
    portfolios.map(async ({ uid, p }) => {
      const v = valuation(p, quotes);
      const trades = p.orders.filter((o) => o.status === "filled").length;
      const rules = p.rules.filter((r) => r.active).length;
      const name = publicName((await getState(uid)).user.displayName ?? "");
      return {
        uid,
        name,
        gainPct: v.gainPct,
        trades,
        rules,
        coins: coinsFor(v.gainPct, trades, rules),
      };
    }),
  );
  cached = { at: Date.now(), rows };
  return rows;
}

/** The top 10 by coins, plus your own row if you're further down. */
export async function leaderboard(uid: string) {
  const real = await players();
  const samples =
    real.length < 5
      ? SAMPLES.map((s) => ({
          ...s,
          coins: coinsFor(s.gainPct, s.trades, s.rules),
          sample: true,
        }))
      : [];
  const ranked = [...real, ...samples]
    .sort((a, b) => b.coins - a.coins || b.gainPct - a.gainPct)
    .map((row, i) => {
      const { uid: owner, ...rest } = row as typeof row & { uid?: string };
      return { ...rest, rank: i + 1, ...(owner === uid ? { you: true } : {}) };
    });
  const top = ranked.slice(0, 10);
  const mine = ranked.find((r) => r.you);
  return {
    entries: mine && mine.rank > 10 ? [...top, mine] : top,
    players: real.length,
    hasSamples: samples.length > 0,
  };
}
