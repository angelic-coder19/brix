import { apiRoute } from "@/lib/api/v1";
import { practiceView } from "@/lib/practice";
export const runtime = "nodejs";
export const GET = apiRoute("practice:read", async ({ uid }) => {
  const view = await practiceView(uid);
  const p = view.portfolio;
  return {
    object: "practice_portfolio",
    virtual_money: true,
    portfolio: p && {
      cash: p.cash,
      total: p.total,
      gain: p.gain,
      gain_pct: p.gainPct,
      benchmark_pct: p.benchmarkPct,
      positions: p.positions.map((x) => ({
        symbol: x.symbol,
        name: x.name,
        shares: x.shares,
        avg_cost: x.avgCost,
        price: x.price,
        value: x.value,
        gain: x.gain,
        stop_loss: x.stopLoss ?? null,
        take_profit: x.takeProfit ?? null,
      })),
      rules: p.rules.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        amount: r.amount,
        cadence: r.cadence,
        next_run_on: r.nextRunOn,
        active: r.active,
      })),
      orders: p.orders.slice(0, 20).map((o) => ({
        id: o.id,
        symbol: o.symbol,
        side: o.side,
        shares: o.shares,
        price: o.price,
        notional: o.notional,
        at: o.at,
        source: o.source,
        status: o.status,
      })),
    },
  };
});
