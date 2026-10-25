"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Newspaper,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { ConfirmAction } from "../ui/ConfirmAction";
import type { RequestFn } from "../brix/useBrixChat";
import type { AutoRule, Order } from "@/lib/practice/engine";
import type { Quote } from "@/lib/market/quotes";
import type { Security } from "@/lib/market/universe";
import { Leaderboard, PriceChart } from "./PracticeInsights";
import "./practice.css";

interface PositionView {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  price: number | null;
  value: number;
  gain: number;
  dayChange: number;
  stopLoss?: number;
  takeProfit?: number;
}
interface View {
  portfolio: {
    cash: number;
    invested: number;
    total: number;
    gain: number;
    gainPct: number;
    realized: number;
    benchmarkPct: number | null;
    startingCash: number;
    createdAt: string;
    positions: PositionView[];
    orders: Order[];
    rules: AutoRule[];
  } | null;
  quotes?: Record<string, Quote>;
  universe: Security[];
  sample?: boolean;
  suggestedStart?: { amount: number; refundId: string | null };
}
interface Headline {
  symbol: string;
  title: string;
  url: string;
  publishedAt: string;
  source: string;
}

const usd = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
const tone = (n: number) => (n > 0 ? "is-up" : n < 0 ? "is-down" : undefined);
const CADENCE = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
};
const SOURCE = {
  manual: "You",
  rule: "Auto-invest",
  stop_loss: "Stop-loss",
  take_profit: "Take-profit",
};

export default function Practice({ request }: { request: RequestFn }) {
  const [view, setView] = useState<View | null>(null),
    [news, setNews] = useState<Headline[] | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setView(await request<View>("/api/practice"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request]);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), 60000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  const holdings =
    view?.portfolio?.positions.map((p) => p.symbol).join(",") ?? "";
  useEffect(() => {
    if (!view?.portfolio) return;
    let alive = true;
    void request<{ headlines: Headline[] }>(
      `/api/market/news${holdings ? `?symbols=${encodeURIComponent(holdings)}` : ""}`,
    )
      .then((r) => alive && setNews(r.headlines))
      .catch(() => alive && setNews([]));
    return () => {
      alive = false;
    };
  }, [request, holdings, view?.portfolio]);

  async function run(work: () => Promise<void>, done?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await load();
      if (done) setNotice(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!view)
    return (
      <div className="card" role="status">
        {error || "Loading your practice portfolio…"}
      </div>
    );

  return (
    <div className="practice">
      <p className="practice-disclaimer" role="note">
        Practice with virtual money. Quotes may be delayed; sample data is
        labeled. Educational only. Brix never places real trades.
      </p>
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert alert--success" role="status">
          {notice}
        </p>
      )}
      {!view.portfolio ? (
        <Start view={view} busy={busy} run={run} request={request} />
      ) : (
        <Portfolio
          view={view}
          news={news}
          busy={busy}
          run={run}
          request={request}
        />
      )}
    </div>
  );
}

type Run = (work: () => Promise<void>, done?: string) => Promise<void>;

function Start({
  view,
  busy,
  run,
  request,
}: {
  view: View;
  busy: boolean;
  run: Run;
  request: RequestFn;
}) {
  const start = view.suggestedStart;
  return (
    <div className="practice-intro-grid">
      <section className="card form-card practice-start">
        <TrendingUp size={28} />
        <h2>Learn investing without risking a dollar.</h2>
        <p>
          Buy and sell real US stocks and index funds at real prices with
          virtual money. Set up auto-invest the way long-term investors do, and
          see how you compare with the S&amp;P 500.
        </p>
        <form
          className="practice-start__form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const fromRefund = f.get("from") === "refund" && start?.refundId;
            void run(async () => {
              await request(
                "/api/practice",
                "POST",
                fromRefund
                  ? { refundId: start!.refundId }
                  : { startingCash: Number(f.get("cash")) },
              );
            }, "Your practice portfolio is ready.");
          }}
        >
          {start?.refundId && (
            <label className="scope-option">
              <input type="radio" name="from" value="refund" defaultChecked />
              <span>
                <strong>Practice with my refund amount</strong>
                <small>
                  {usd(start.amount)} in virtual money, the same size as your
                  school refund.
                </small>
              </span>
            </label>
          )}
          <label className="scope-option">
            <input
              type="radio"
              name="from"
              value="custom"
              defaultChecked={!start?.refundId}
            />
            <span>
              <strong>Choose an amount</strong>
              <input
                name="cash"
                type="number"
                min="100"
                max="100000"
                step="100"
                defaultValue={1000}
                aria-label="Starting virtual money"
              />
            </span>
          </label>
          <button className="btn btn--primary" disabled={busy}>
            Start practicing
          </button>
        </form>
      </section>
      <MarketSnapshot request={request} />
      <div className="practice-insights">
        <PriceChart request={request} symbols={["VOO", "QQQ", "VTI"]} />
        <Leaderboard request={request} />
      </div>
    </div>
  );
}

function Portfolio({
  view,
  news,
  busy,
  run,
  request,
}: {
  view: View;
  news: Headline[] | null;
  busy: boolean;
  run: Run;
  request: RequestFn;
}) {
  const p = view.portfolio!;
  const [symbol, setSymbol] = useState("VOO");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [review, setReview] = useState<{
    symbol: string;
    side: "buy" | "sell";
    amount: number;
  } | null>(null);
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());
  const [looked, setLooked] = useState<Record<string, Quote>>({});
  useEffect(() => {
    if (view.quotes?.[symbol]) return;
    let alive = true;
    void request<{ quotes: Record<string, Quote> }>(
      `/api/market/quote?symbols=${encodeURIComponent(symbol)}`,
    )
      .then((r) => alive && setLooked((q) => ({ ...q, ...r.quotes })))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [request, symbol, view.quotes]);
  const quoteFor = (s: string) => view.quotes?.[s] ?? looked[s];
  const price = quoteFor(symbol)?.price;
  // The practice list is already ordered: broad index funds first.
  const sorted = view.universe;

  return (
    <>
      <section
        className="summary-grid practice-summary"
        aria-label="Portfolio summary"
      >
        <div className="card stat-card">
          <div className="stat-card__label">Portfolio value</div>
          <div className="stat-card__value">{usd(p.total)}</div>
          <p className={tone(p.gain)}>
            {usd(p.gain)} ({pct(p.gainPct)}) since you started with{" "}
            {usd(p.startingCash)}
          </p>
        </div>
        <div className="card stat-card">
          <div className="stat-card__label">Compared with the S&amp;P 500</div>
          <div className="stat-card__value">
            {p.benchmarkPct === null ? "—" : pct(p.benchmarkPct)}
          </div>
          <p>
            What the same money in VOO did over the same time.{" "}
            {p.benchmarkPct !== null &&
              (p.gainPct >= p.benchmarkPct
                ? "You're ahead so far."
                : "Most people trail the index; that's the lesson.")}
          </p>
        </div>
        <div className="card stat-card">
          <div className="stat-card__label">Virtual cash</div>
          <div className="stat-card__value">{usd(p.cash)}</div>
          <p>Realized gain: {usd(p.realized)}</p>
        </div>
      </section>

      <div className="practice-insights">
        <PriceChart
          request={request}
          symbols={p.positions.map((x) => x.symbol)}
        />
        <Leaderboard request={request} />
      </div>

      <AllocationChart portfolio={p} sample={view.sample} />

      <div className="practice-columns">
        <div className="practice-stack">
          <section className="card" aria-labelledby="holdings">
            <div className="card-head">
              <h2 id="holdings">Holdings</h2>
            </div>
            {p.positions.length ? (
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Holdings table"
              >
                <table className="practice-table">
                  <thead>
                    <tr>
                      <th scope="col">Symbol</th>
                      <th scope="col">Shares</th>
                      <th scope="col">Value</th>
                      <th scope="col">Gain</th>
                      <th scope="col">Stop / target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.positions.map((pos) => (
                      <tr key={pos.symbol}>
                        <th scope="row">
                          {pos.symbol}
                          <small>{pos.name}</small>
                        </th>
                        <td>{pos.shares}</td>
                        <td>
                          {usd(pos.value)}
                          <small>
                            {pos.price
                              ? `at ${usd(pos.price)}`
                              : "no live price"}
                          </small>
                        </td>
                        <td className={tone(pos.gain)}>{usd(pos.gain)}</td>
                        <td>
                          <form
                            className="stops"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              const v = (k: string) =>
                                f.get(k) === "" ? null : Number(f.get(k));
                              void run(async () => {
                                await request(
                                  `/api/practice/positions/${pos.symbol}`,
                                  "PATCH",
                                  {
                                    stopLoss: v("stopLoss"),
                                    takeProfit: v("takeProfit"),
                                  },
                                );
                              }, `Saved stops for ${pos.symbol}.`);
                            }}
                          >
                            <input
                              name="stopLoss"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Stop"
                              aria-label={`Stop-loss price for ${pos.symbol}`}
                              defaultValue={pos.stopLoss ?? ""}
                            />
                            <input
                              name="takeProfit"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Target"
                              aria-label={`Take-profit price for ${pos.symbol}`}
                              defaultValue={pos.takeProfit ?? ""}
                            />
                            <button className="btn btn--sm" disabled={busy}>
                              Save
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted practice-empty">
                Nothing yet. Many people start with a broad index fund like VOO
                or VTI.
              </p>
            )}
          </section>

          <section className="card form-card" aria-labelledby="rules">
            <h2 id="rules">Auto-invest</h2>
            <p className="muted">
              Buy a fixed amount on a schedule (dollar-cost averaging). Brix
              runs due rules each weekday morning.
            </p>
            {p.rules.length > 0 && (
              <ul className="rule-list">
                {p.rules.map((r) => (
                  <li key={r.id}>
                    <div>
                      <strong>
                        {usd(r.amount)} of {r.symbol}
                      </strong>
                      <small>
                        {CADENCE[r.cadence]} ·{" "}
                        {r.active ? `next ${r.nextRunOn}` : "paused"}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`${r.active ? "Pause" : "Resume"} ${r.symbol} rule`}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await request(
                            `/api/practice/rules/${r.id}`,
                            "PATCH",
                            {
                              active: !r.active,
                            },
                          );
                        })
                      }
                    >
                      {r.active ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete ${r.symbol} rule`}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await request(
                            `/api/practice/rules/${r.id}`,
                            "DELETE",
                          );
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="rule-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  f = new FormData(form);
                void run(async () => {
                  await request("/api/practice/rules", "POST", {
                    symbol: f.get("symbol"),
                    amount: Number(f.get("amount")),
                    cadence: f.get("cadence"),
                  });
                  form.reset();
                }, "Auto-invest rule added.");
              }}
            >
              <label className="field">
                Symbol
                <select name="symbol" defaultValue="VOO">
                  {sorted.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Each time
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue={25}
                  required
                />
              </label>
              <label className="field">
                How often
                <select name="cadence" defaultValue="weekly">
                  {Object.entries(CADENCE).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn" disabled={busy}>
                Add rule
              </button>
            </form>
          </section>
        </div>
        <div className="practice-stack">
          <section
            className="card form-card trade-ticket"
            aria-labelledby="trade"
          >
            <h2 id="trade">Trade</h2>
            {review ? (
              <div
                className="trade-review"
                role="group"
                aria-label="Review order"
              >
                <p>
                  {review.side === "buy" ? "Buy" : "Sell"}{" "}
                  <strong>{usd(review.amount)}</strong> of{" "}
                  <strong>{review.symbol}</strong>
                  {quoteFor(review.symbol)
                    ? ` at about ${usd(quoteFor(review.symbol)!.price)} a share`
                    : ""}{" "}
                  with virtual money?
                </p>
                <div className="button-row">
                  <button
                    className="btn btn--primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const { order } = await request<{ order: Order }>(
                          "/api/practice/orders",
                          "POST",
                          {
                            ...review,
                            clientKey,
                          },
                        );
                        setReview(null);
                        setClientKey(crypto.randomUUID());
                        if (order.status !== "filled")
                          throw new Error(order.reason || "Order not filled.");
                      }, "Order filled.")
                    }
                  >
                    Confirm
                  </button>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => setReview(null)}
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setReview({ symbol, side, amount: Number(f.get("amount")) });
                }}
              >
                <div
                  className="segmented"
                  role="group"
                  aria-label="Buy or sell"
                >
                  {(["buy", "sell"] as const).map((s) => (
                    <button
                      type="button"
                      key={s}
                      className={side === s ? "is-active" : undefined}
                      aria-pressed={side === s}
                      onClick={() => setSide(s)}
                    >
                      {s === "buy" ? "Buy" : "Sell"}
                    </button>
                  ))}
                </div>
                <label className="field">
                  Symbol
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                  >
                    {sorted.map((s) => (
                      <option key={s.symbol} value={s.symbol}>
                        {s.symbol} · {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Amount (USD)
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    defaultValue={100}
                  />
                </label>
                <p className="muted">
                  {price ? `Last price ${usd(price)}` : "Loading the price…"}
                </p>
                <button className="btn btn--primary">Review order</button>
              </form>
            )}
          </section>

          <section className="card news-card" aria-labelledby="stock-news">
            <h3 id="stock-news">
              <Newspaper size={17} /> News on your holdings
            </h3>
            {news === null ? (
              <p className="muted">Loading…</p>
            ) : news.length ? (
              <ul className="news-list">
                {news.map((h) => (
                  <li key={h.url}>
                    <a href={h.url} target="_blank" rel="noopener noreferrer">
                      {h.title} <ExternalLink size={13} aria-hidden />
                    </a>
                    <small>
                      {h.symbol} · {h.source} ·{" "}
                      {new Date(h.publishedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No recent headlines.</p>
            )}
          </section>
        </div>
      </div>

      <section className="card" aria-labelledby="orders">
        <div className="card-head">
          <h2 id="orders">Order history</h2>
          <ConfirmAction
            className="btn btn--sm"
            icon={<RotateCcw size={15} />}
            label="Reset portfolio"
            question="Start over? Your practice holdings, rules and history are cleared."
            confirmLabel="Reset"
            tone="danger"
            disabled={busy}
            onConfirm={() =>
              void run(async () => {
                await request("/api/practice/reset", "POST", {});
              }, "Practice portfolio reset.")
            }
          />
        </div>
        {p.orders.length ? (
          <ul className="order-list">
            {p.orders.map((o) => (
              <li
                key={o.id}
                className={o.status === "rejected" ? "is-rejected" : undefined}
              >
                <span>
                  {o.status === "filled"
                    ? `${o.side === "buy" ? "Bought" : "Sold"} ${o.shares} ${o.symbol} at ${usd(o.price)}`
                    : `${o.symbol}: ${o.reason}`}
                  {o.afterHours ? " (market closed: last price)" : ""}
                </span>
                <small>
                  {SOURCE[o.source]} ·{" "}
                  {new Date(o.at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {o.realized !== undefined
                    ? ` · realized ${usd(o.realized)}`
                    : ""}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted practice-empty">Your trades will show up here.</p>
        )}
      </section>
    </>
  );
}

function MarketSnapshot({ request }: { request: RequestFn }) {
  const [quotes, setQuotes] = useState<Record<string, Quote> | null>(null);
  const [group, setGroup] = useState<"funds" | "stocks">("funds");
  const symbols =
    group === "funds"
      ? ["VOO", "VTI", "QQQ", "VXUS", "BND"]
      : ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL"];
  const query = symbols.join(",");
  useEffect(() => {
    let active = true;
    void request<{ quotes: Record<string, Quote> }>(
      `/api/market/quote?symbols=${query}`,
    )
      .then((result) => {
        if (active) setQuotes(result.quotes);
      })
      .catch(() => {
        if (active) setQuotes({});
      });
    return () => {
      active = false;
    };
  }, [request, query]);
  const rows = symbols.map((symbol) => {
    const quote = quotes?.[symbol];
    const change =
      quote &&
      Number.isFinite(quote.price) &&
      Number.isFinite(quote.previousClose) &&
      quote.previousClose > 0
        ? (quote.price / quote.previousClose - 1) * 100
        : null;
    return { symbol, quote, change };
  });
  const available = rows.filter((row) => row.change !== null);
  const scale = Math.max(1, ...available.map((row) => Math.abs(row.change!)));
  const sample = rows.some((row) => row.quote?.sample);
  return (
    <section
      className="card practice-chart"
      aria-labelledby="market-chart-title"
    >
      <div className="card-head">
        <div>
          <span className="practice-chart__eyebrow">Explore the market</span>
          <h2 id="market-chart-title">A day in the market</h2>
        </div>
        <span className="practice-chart__tag">
          {sample ? "Sample prices" : "Quote snapshot"}
        </span>
      </div>
      <div
        className="segmented practice-chart__tabs"
        role="group"
        aria-label="Chart securities"
      >
        <button
          type="button"
          aria-pressed={group === "funds"}
          className={group === "funds" ? "is-active" : undefined}
          onClick={() => {
            if (group !== "funds") {
              setGroup("funds");
              setQuotes(null);
            }
          }}
        >
          Index funds
        </button>
        <button
          type="button"
          aria-pressed={group === "stocks"}
          className={group === "stocks" ? "is-active" : undefined}
          onClick={() => {
            if (group !== "stocks") {
              setGroup("stocks");
              setQuotes(null);
            }
          }}
        >
          Stocks
        </button>
      </div>
      <p className="practice-chart__caption">
        Latest quote compared with the previous close.
      </p>
      <ul
        className="practice-market-bars"
        aria-label="Price changes in percent"
      >
        {rows.map(({ symbol, quote, change }) => (
          <li key={symbol}>
            <div className="practice-market-bars__label">
              <strong>{symbol}</strong>
              <small>
                {quote
                  ? usd(quote.price)
                  : quotes === null
                    ? "Loading…"
                    : "Unavailable"}
              </small>
            </div>
            <div className="practice-market-bars__track" aria-hidden="true">
              {change !== null && (
                <span
                  className={change < 0 ? "is-negative" : "is-positive"}
                  style={{
                    width: `${(Math.abs(change) / scale) * 50}%`,
                    left: `${change < 0 ? 50 - (Math.abs(change) / scale) * 50 : 50}%`,
                  }}
                />
              )}
            </div>
            <strong
              className={`practice-market-bars__value ${change === null ? "" : tone(change) || ""}`}
            >
              {change === null ? "—" : pct(change)}
            </strong>
          </li>
        ))}
      </ul>
      <div className="practice-chart__axis" aria-hidden="true">
        <span>−{scale.toFixed(1)}%</span>
        <span>0</span>
        <span>+{scale.toFixed(1)}%</span>
      </div>
      <p className="practice-chart__footnote">
        {sample
          ? "Fixed demo quotes. These are not live market moves."
          : "Quotes may be delayed. Closed markets show the latest available session."}
        {quotes !== null && !available.length
          ? " No price changes are available right now."
          : ""}
      </p>
    </section>
  );
}

const ALLOCATION_COLORS = [
  "#43705a",
  "#c8462a",
  "#80662e",
  "#6b7891",
  "#897b8e",
  "#aaa596",
];
function AllocationChart({
  portfolio: p,
  sample,
}: {
  portfolio: NonNullable<View["portfolio"]>;
  sample?: boolean;
}) {
  const holdings = [...p.positions]
    .filter((position) => Number.isFinite(position.value) && position.value > 0)
    .sort((a, b) => b.value - a.value);
  const items = [
    { label: "Virtual cash", value: Math.max(0, p.cash) },
    ...holdings
      .slice(0, 4)
      .map((position) => ({ label: position.symbol, value: position.value })),
    ...(holdings.length > 4
      ? [
          {
            label: "Other holdings",
            value: holdings
              .slice(4)
              .reduce((sum, position) => sum + position.value, 0),
          },
        ]
      : []),
  ].filter((item) => item.value > 0);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const missingPrices = p.positions.some((position) => position.price === null);
  return (
    <section
      className="card practice-chart practice-allocation"
      aria-labelledby="allocation-title"
    >
      <div className="card-head">
        <div>
          <span className="practice-chart__eyebrow">Your virtual money</span>
          <h2 id="allocation-title">Portfolio allocation</h2>
        </div>
        <span className="practice-chart__tag">
          {sample ? "Sample valuation" : "Current allocation"}
        </span>
      </div>
      {total > 0 ? (
        <>
          <div className="practice-allocation__bar" aria-hidden="true">
            {items.map((item, index) => (
              <span
                key={item.label}
                style={{
                  width: `${(item.value / total) * 100}%`,
                  background: ALLOCATION_COLORS[index],
                }}
              />
            ))}
          </div>
          <ul
            className="practice-allocation__legend"
            aria-label="Portfolio allocation by value"
          >
            {items.map((item, index) => (
              <li key={item.label}>
                <span className="practice-allocation__label">
                  <i
                    aria-hidden="true"
                    style={{ background: ALLOCATION_COLORS[index] }}
                  />
                  {item.label}
                </span>
                <strong>{((item.value / total) * 100).toFixed(1)}%</strong>
                <small>{usd(item.value)}</small>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="muted">
          Allocation appears when your portfolio has a value.
        </p>
      )}
      <p className="practice-chart__footnote">
        {!holdings.length
          ? "All cash for now. Your first practice trade will appear here."
          : "Each segment shows its share of your portfolio value."}
        {missingPrices
          ? " Some quotes are unavailable; those holdings use their cost basis."
          : ""}
      </p>
    </section>
  );
}
