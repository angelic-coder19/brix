"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Activity,
  Briefcase,
  Copy,
  ExternalLink,
  Landmark,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Dropdown } from "../ui/Dropdown";
import { InvestingNews } from "./InvestingNews";
import { ConfirmAction } from "../ui/ConfirmAction";
import type { RequestFn } from "../brix/useBrixChat";
import type { AutoRule, Order } from "@/lib/practice/engine";
import type { Quote } from "@/lib/market/quotes";
import type { Security } from "@/lib/market/universe";
import {
  brokerHandoffs,
  brokerLinks,
  type BrokerHandoff,
} from "@/lib/market/brokers";
import type { CoachCheck } from "@/lib/practice/coach";
import type { RealHolding } from "@/lib/practice/real";
import { Leaderboard, PriceChart } from "./PracticeInsights";
import { MenuButton } from "../ui/MenuButton";
import { CopyVibes, useCopyFlow } from "./CopyTrading";
import { setPendingTrade } from "./pendingTrade";
import { BrixLoader } from "../ui/BrixLoader";
import { HeadingAside } from "../ui/HeadingAside";
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
    shareMix?: boolean;
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
  imageUrl?: string;
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
  stop_loss: "Stop (auto-sell)",
  take_profit: "Target (auto-sell)",
};
const TERMS = {
  sp500:
    "A basket of the 500 biggest US companies. Most people use it to check if they're beating the market. Brix compares you with the same money in VOO over the same dates.",
  etf: "A fund you buy like one stock that holds lots of companies at once. VOO is an ETF that tracks the S&P 500.",
  dca: "Investing the same amount on a schedule, whatever the price. Some buys land high, some low, and it evens out.",
  stop: "Short for stop-loss. If the price falls to this, Brix sells so a dip doesn't get worse.",
  target:
    "Short for take-profit. If the price rises to this, Brix sells and locks in the gain.",
};
// Matches the auto-invest form's defaults.
const PLAN = {
  symbol: "VOO",
  amount: 25,
  cadence: "weekly" as AutoRule["cadence"],
};
const today = () => new Date().toISOString().slice(0, 10);
// The daily job only runs on weekday mornings, so a rule can show a date that
// already passed until the next run picks it up.
const nextBuy = (date: string) =>
  date < today()
    ? "next weekday morning"
    : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
/** "every Tuesday", "every other Friday", "on the 3rd of each month". */
function schedule(cadence: AutoRule["cadence"], from: string) {
  const d = new Date(`${from}T12:00:00Z`);
  const day = d.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  // Rules run on weekday mornings only, so a weekend date can't name the day.
  const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
  if (cadence === "monthly")
    return `on the ${ordinal(d.getUTCDate())} of each month`;
  if (weekend) return cadence === "weekly" ? "every week" : "every 2 weeks";
  return cadence === "weekly" ? `every ${day}` : `every other ${day}`;
}

/**
 * A plain label with a "what's this?" bubble for the real term. The bubble
 * renders on <body> so sticky headers and clipped cards can't cover it, and
 * opens below the term when there isn't room above.
 */
function Term({ label, tip }: { label: string; tip: string }) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{
    x: number;
    y: number;
    below: boolean;
  } | null>(null);
  const show = () => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const below = box.top < 160;
    setPos({
      x: Math.max(8, Math.min(box.left, window.innerWidth - 276)),
      y: below ? box.bottom + 8 : box.top - 8,
      below,
    });
  };
  useEffect(() => {
    if (!pos) return;
    const hide = () => setPos(null);
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, { capture: true });
      window.removeEventListener("resize", hide);
    };
  }, [pos]);
  return (
    <span
      className="term"
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      onFocus={show}
      onBlur={() => setPos(null)}
      onKeyDown={(e) => e.key === "Escape" && setPos(null)}
    >
      {label}
      <button
        type="button"
        className="term__btn"
        aria-label={`What's ${label}?`}
        aria-describedby={id}
      >
        ?
      </button>
      <span id={id} className="sr-only">
        {tip}
      </span>
      {pos &&
        createPortal(
          <span
            className={`term__tip${pos.below ? " term__tip--below" : ""}`}
            aria-hidden="true"
            style={{ left: pos.x, top: pos.y }}
          >
            {tip}
          </span>,
          document.body,
        )}
    </span>
  );
}

export type PracticeSection = "trade" | "copy" | "real";

export default function Practice({
  request,
  section = "trade",
}: {
  request: RequestFn;
  section?: PracticeSection;
}) {
  const [view, setView] = useState<View | null>(null),
    [news, setNews] = useState<Headline[] | null>(null),
    [lines, setLines] = useState<Record<string, string>>({}),
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
    // One line per headline about the student's own position. Optional:
    // when it fails, headlines simply show on their own.
    if (holdings)
      void request<{ lines: Record<string, string> }>(
        `/api/market/news/lines?symbols=${encodeURIComponent(holdings)}`,
      )
        .then((r) => alive && setLines(r.lines))
        .catch(() => {});
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
    return error ? (
      <p className="alert alert--error" role="alert">
        {error}
      </p>
    ) : (
      <BrixLoader label="Loading your practice portfolio" />
    );

  return (
    <div className="practice">
      <p className="practice-disclaimer" role="note">
        Trade with virtual money here. When you’re ready, open your broker.
        Quotes can be delayed; demo prices are labeled.
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
          lines={lines}
          busy={busy}
          run={run}
          request={request}
          section={section}
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
      <div className="practice-insights practice-hero">
        <PriceChart request={request} symbols={["VOO", "QQQ", "VTI"]} />
        <Leaderboard request={request} />
      </div>
      <section className="card form-card practice-start">
        <TrendingUp size={28} />
        <h2>Learn investing without risking a dollar.</h2>
        <p>
          Buy real US stocks and index funds at real prices with fake money. Set
          up auto-invest like long-term investors do, and see how you stack up
          against the S&amp;P 500.
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
    </div>
  );
}

function Portfolio({
  view,
  news,
  lines,
  busy,
  run,
  request,
  section,
}: {
  view: View;
  news: Headline[] | null;
  lines: Record<string, string>;
  busy: boolean;
  run: Run;
  request: RequestFn;
  section: PracticeSection;
}) {
  const p = view.portfolio!;
  const copy = useCopyFlow({ request, run, cash: p.cash, busy });
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
  const lead = p.benchmarkPct === null ? null : p.gainPct - p.benchmarkPct;
  const [showReceipts, setShowReceipts] = useState(false);
  const symbolId = useId();
  // Real holdings load once here so the summary card and the section agree.
  const [real, setReal] = useState<RealView | null>(null);
  const [realError, setRealError] = useState("");
  const loadReal = useCallback(
    () =>
      request<RealView>("/api/practice/real-holdings")
        .then((r) => {
          setReal(r);
          setRealError("");
        })
        .catch((e: Error) => setRealError(e.message)),
    [request],
  );
  useEffect(() => {
    const first = setTimeout(() => void loadReal(), 0);
    return () => clearTimeout(first);
  }, [loadReal]);
  const brokerSymbol =
    [...(real?.holdings ?? [])].sort(
      (a, b) => (b.value ?? b.cost) - (a.value ?? a.cost),
    )[0]?.symbol ??
    [...p.positions].sort((a, b) => b.value - a.value)[0]?.symbol;
  const [amount, setAmount] = useState("100");
  const [plan, setPlan] = useState(PLAN);
  const nameOf = (s: string) =>
    view.universe.find((x) => x.symbol === s)?.name ?? s;
  // Ask Brix can explain the trade on screen; clear it when review closes.
  useEffect(() => {
    setPendingTrade(review);
    return () => setPendingTrade(null);
  }, [review]);

  return (
    <>
      <HeadingAside>
        <section className="practice-glance" aria-label="Portfolio summary">
          <div className="glance-tile glance-tile--lead">
            <span className="glance-tile__icon" aria-hidden="true">
              <Briefcase size={14} />
            </span>
            <span className="glance-tile__label">Your portfolio</span>
            <strong className="glance-tile__value">{usd(p.total)}</strong>
            <span className={`glance-tile__sub ${tone(p.gain) ?? ""}`}>
              {usd(p.gain)} ({pct(p.gainPct)})
            </span>
          </div>
          <div className="glance-tile glance-tile--blue">
            <span className="glance-tile__icon" aria-hidden="true">
              <Activity size={14} />
            </span>
            <span className="glance-tile__label">
              You vs. the <Term label="S&P 500" tip={TERMS.sp500} />
            </span>
            <strong className="glance-tile__value">
              {p.benchmarkPct === null ? "—" : pct(p.benchmarkPct)}
            </strong>
            <span className="glance-tile__sub">
              {lead === null
                ? "Shows up once prices load"
                : lead >= 0.005
                  ? "You're ahead so far"
                  : lead <= -0.005
                    ? "Most people trail it"
                    : "Neck and neck"}
            </span>
          </div>
          <div className="glance-tile glance-tile--green">
            <span className="glance-tile__icon" aria-hidden="true">
              <Wallet size={14} />
            </span>
            <span className="glance-tile__label">Cash to play with</span>
            <strong className="glance-tile__value">{usd(p.cash)}</strong>
            <span className="glance-tile__sub">
              Locked in {usd(p.realized)}
            </span>
          </div>
          <div className="glance-tile glance-tile--warm">
            <span className="glance-tile__icon" aria-hidden="true">
              <Landmark size={14} />
            </span>
            <span className="glance-tile__label">Real money</span>
            <strong className="glance-tile__value">
              {real === null
                ? "…"
                : !real.holdings.length
                  ? "—"
                  : real.totals.priced
                    ? usd(real.totals.value)
                    : usd(real.totals.spent)}
            </strong>
            <span className="glance-tile__links">
              {brokerSymbol && (
                <TakeLive
                  symbol={brokerSymbol}
                  label="Open in broker"
                  compact
                />
              )}
              <Link href="/practice/real" className="practice-real-link">
                {real?.holdings.length
                  ? `${real.holdings.length} logged`
                  : "Log a purchase"}
              </Link>
            </span>
          </div>
        </section>
      </HeadingAside>

      {section === "trade" && (
        <>
          <div className="practice-insights practice-hero">
            <PriceChart
              request={request}
              symbols={p.positions.map((x) => x.symbol)}
            />
            <AllocationChart portfolio={p} sample={view.sample} />
          </div>
          <div className="practice-trade-row">
            <section
              className="card form-card trade-ticket"
              aria-labelledby="trade"
            >
              <div className="trade-ticket__head">
                <h2 id="trade">
                  Make a move <small className="term-real">Trade</small>
                </h2>
                {!review && (
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
                )}
              </div>
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
                    with fake money?
                  </p>
                  <CoachCard
                    request={request}
                    trade={review}
                    name={
                      view.universe.find((s) => s.symbol === review.symbol)
                        ?.name ?? review.symbol
                    }
                    price={quoteFor(review.symbol)?.price ?? null}
                    cash={p.cash}
                    invested={p.invested}
                    held={
                      p.positions.find((x) => x.symbol === review.symbol)
                        ?.value ?? 0
                    }
                  />
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
                          setAmount("100");
                          setClientKey(crypto.randomUUID());
                          if (order.status !== "filled")
                            throw new Error(
                              order.reason || "Order not filled.",
                            );
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
                    setReview({ symbol, side, amount: Number(amount) });
                  }}
                >
                  <div className="field">
                    <span className="trade-ticket__label">
                      <label htmlFor={symbolId}>Symbol</label>
                      <small className="muted">
                        New here? Try an <Term label="ETF" tip={TERMS.etf} />{" "}
                        like VOO.
                      </small>
                    </span>
                    <Dropdown
                      id={symbolId}
                      label="Symbol"
                      value={symbol}
                      onChange={setSymbol}
                      options={sorted.map((s) => ({
                        value: s.symbol,
                        label: `${s.symbol} · ${s.name}`,
                      }))}
                    />
                  </div>
                  <label className="field">
                    Amount (USD)
                    <input
                      name="amount"
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <small className="muted">
                      {price
                        ? `One share costs about ${usd(price)}`
                        : "Loading the price…"}
                    </small>
                  </label>
                  <button className="btn btn--primary" disabled={busy}>
                    Review order
                  </button>
                  <RealBuy
                    symbol={symbol}
                    name={
                      sorted.find((s) => s.symbol === symbol)?.name ?? symbol
                    }
                    side={side}
                    amount={Number(amount)}
                  />
                </form>
              )}
            </section>

            <div className="practice-holdings-stack">
              <section
                className="card practice-holdings"
                aria-labelledby="holdings"
              >
                <div className="card-head">
                  <h2 id="holdings">
                    What you own <small className="term-real">Holdings</small>
                  </h2>
                </div>
                {p.positions.length ? (
                  <>
                    <div
                      className="table-wrap"
                      tabIndex={0}
                      role="region"
                      aria-label="Holdings table"
                    >
                      <table className="practice-table">
                        <thead>
                          <tr>
                            <th scope="col">Ticker</th>
                            <th scope="col">Shares</th>
                            <th scope="col">Value</th>
                            <th scope="col">Up / down</th>
                            <th scope="col">Auto-sell guardrails</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.positions.map((pos) => (
                            <tr key={pos.symbol}>
                              <th scope="row">
                                {pos.symbol}
                                <small>{pos.name}</small>
                                <TakeLive symbol={pos.symbol} compact />
                              </th>
                              <td>{pos.shares}</td>
                              <td>
                                {usd(pos.value)}
                                <small>
                                  {pos.price
                                    ? `at ${usd(pos.price)}`
                                    : "price not loading"}
                                </small>
                              </td>
                              <td className={tone(pos.gain)}>
                                {usd(pos.gain)}
                              </td>
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
                                    }, `Guardrails saved for ${pos.symbol}.`);
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
                                  <button
                                    className="btn btn--sm"
                                    disabled={busy}
                                  >
                                    Save
                                  </button>
                                </form>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="muted practice-help">
                      <Term label="Stop" tip={TERMS.stop} />: sell if the price
                      drops to this (bail out early).{" "}
                      <Term label="Target" tip={TERMS.target} />: sell when it
                      hits this (take the W). These are rules you set: Brix only
                      sells at the exact price you type, and leaves blank ones
                      alone.
                    </p>
                  </>
                ) : (
                  <p className="muted practice-empty">
                    Nothing yet. Lots of people start with a broad index fund
                    like VOO or VTI.
                  </p>
                )}
              </section>

              <InvestingNews headlines={news} lines={lines} />
            </div>
          </div>

          <section
            className="card form-card practice-rules"
            aria-labelledby="rules"
          >
            <h2 id="rules">
              Auto-invest{" "}
              <small className="term-real">set it and forget it</small>
            </h2>
            <p className="muted">
              A fixed recurring purchase: the same dollar amount of the same
              ticker on the same schedule, whatever the price. (This is called{" "}
              <Term label="dollar-cost averaging" tip={TERMS.dca} />
              .) Brix runs it on weekday mornings.
            </p>
            <p className="practice-disclaimer" role="note">
              Fixed schedule only. Auto-invest only buys. It never sells, never
              waits for a better price, and never tries to time the market.
            </p>
            {p.rules.length > 0 && (
              <ul className="rule-list">
                {p.rules.map((r) => (
                  <li key={r.id}>
                    <div>
                      <strong>
                        {usd(r.amount)} of {nameOf(r.symbol)}{" "}
                        {schedule(r.cadence, r.nextRunOn)}
                      </strong>
                      <small>
                        {r.symbol} · {CADENCE[r.cadence]} ·{" "}
                        {r.active
                          ? `next buy ${nextBuy(r.nextRunOn)}`
                          : "paused"}
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
              onChange={(e) => {
                const f = new FormData(e.currentTarget);
                setPlan({
                  symbol: String(f.get("symbol")),
                  amount: Number(f.get("amount")),
                  cadence: f.get("cadence") as AutoRule["cadence"],
                });
              }}
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
                  setPlan(PLAN);
                }, "Auto-invest is on.");
              }}
            >
              <label className="field">
                Ticker
                <Dropdown
                  name="symbol"
                  label="Auto-invest ticker"
                  defaultValue="VOO"
                  options={sorted.map((s) => ({
                    value: s.symbol,
                    label: s.symbol,
                  }))}
                />
              </label>
              <label className="field">
                Amount each time
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
                <Dropdown
                  name="cadence"
                  label="How often"
                  defaultValue="weekly"
                  options={Object.entries(CADENCE).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </label>
              <button className="btn" disabled={busy}>
                Turn on auto-invest
              </button>
            </form>
            <p className="muted" role="status">
              You&apos;re setting:{" "}
              <strong>
                {plan.amount > 0 ? usd(plan.amount) : "$—"} of{" "}
                {nameOf(plan.symbol)} {schedule(plan.cadence, today())}
              </strong>
              . Nothing else. Pause or delete it anytime.
            </p>
          </section>

          <section className="card practice-receipts" aria-labelledby="orders">
            <div className="card-head">
              <h2 id="orders">
                Your receipts <small className="term-real">Order history</small>
              </h2>
              <ConfirmAction
                className="btn btn--sm"
                icon={<RotateCcw size={15} />}
                label="Start over"
                question="Start over? Your practice holdings, rules and history are cleared."
                confirmLabel="Start over"
                tone="danger"
                disabled={busy}
                onConfirm={() =>
                  void run(async () => {
                    await request("/api/practice/reset", "POST", {});
                  }, "Fresh start. Your practice portfolio is reset.")
                }
              />
            </div>
            {p.orders.length ? (
              <details
                className="practice-receipts__more"
                onToggle={(e) => setShowReceipts(e.currentTarget.open)}
              >
                <summary>
                  {showReceipts
                    ? "Hide receipts"
                    : `Show ${p.orders.length} ${p.orders.length === 1 ? "receipt" : "receipts"}`}
                </summary>
                <ul className="order-list">
                  {p.orders.map((o) => (
                    <li
                      key={o.id}
                      className={
                        o.status === "rejected" ? "is-rejected" : undefined
                      }
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
                          ? ` · locked in ${usd(o.realized)}`
                          : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <p className="muted practice-empty">Your trades show up here.</p>
            )}
          </section>
        </>
      )}
      {section === "copy" && (
        <div className="practice-insights practice-hero practice-copy">
          <CopyVibes request={request} onPick={copy.open} />
          <Leaderboard
            request={request}
            onCopy={(e) =>
              e.mix &&
              e.copyId &&
              copy.open({
                label: `${e.sample ? e.name.replace("Sample · ", "") : e.name}'s mix`,
                mix: e.mix,
                player: e.copyId,
              })
            }
            share={{
              on: !!p.shareMix,
              busy,
              onChange: (on) =>
                void run(
                  async () => {
                    await request("/api/practice", "PATCH", { shareMix: on });
                  },
                  on
                    ? "Your mix is copyable now. Percentages only."
                    : "Your mix is private again.",
                ),
            }}
          />
        </div>
      )}
      {section === "real" && (
        <RealHoldings
          request={request}
          universe={sorted}
          data={real}
          loadError={realError}
          reload={loadReal}
        />
      )}
      {copy.modal}
    </>
  );
}

/** One button that opens the same ticker on a real broker. Brix never trades. */
function TakeLive({
  symbol,
  label = "Take this live",
  compact = false,
}: {
  symbol: string;
  label?: string;
  compact?: boolean;
}) {
  const hints: Record<string, string> = {
    Robinhood: `Opens ${symbol} on Robinhood`,
    Fidelity: `Opens the ${symbol} quote on Fidelity`,
    "Cash App": `Opens Cash App investing, then search ${symbol}`,
  };
  return (
    <div className={`take-live${compact ? " take-live--compact" : ""}`}>
      <div className="take-live__heading">
        <strong>Ready for the real thing?</strong>
        <span>Real money happens at your broker, not here.</span>
      </div>
      <MenuButton
        className="btn btn--sm take-live__trigger"
        icon={<ExternalLink size={14} aria-hidden />}
        label={label === "Take this live" ? `Take ${symbol} live` : label}
        items={brokerLinks(symbol).map((b) => ({
          label: b.broker,
          href: b.url,
          hint: hints[b.broker] ?? "Opens in a new tab",
          icon: <ExternalLink size={14} aria-hidden />,
        }))}
      />
    </div>
  );
}

/**
 * "Buy this stock for real": pick a broker, see exactly what to type, then
 * open the broker in a new tab. Brix never places the trade or moves money.
 */
function RealBuy({
  symbol,
  name,
  side,
  amount,
}: {
  symbol: string;
  name: string;
  side: "buy" | "sell";
  amount: number;
}) {
  const [stage, setStage] = useState<
    "closed" | "choose" | BrokerHandoff["broker"]
  >("closed");
  const [open, setOpen] = useState<"idle" | "opening" | "opened" | "failed">(
    "idle",
  );
  const [copied, setCopied] = useState<"" | "yes" | "no">("");
  const detailsId = useId();
  const hasAmount = Number.isFinite(amount) && amount > 0;
  const verb = side === "buy" ? "Buy" : "Sell";
  const label = `${verb} this stock for real`;
  const handoff = brokerHandoffs(symbol).find((b) => b.broker === stage);
  const dollars = usd(amount);
  const details = handoff
    ? `${verb} ${dollars} of ${symbol} (${name}) on ${handoff.broker}. Brix did not place this order.`
    : "";

  // Opening never takes long; after a moment, say where it went and offer help.
  useEffect(() => {
    if (open !== "opening") return;
    const t = setTimeout(() => setOpen("opened"), 1200);
    return () => clearTimeout(t);
  }, [open]);

  function reset(next: typeof stage) {
    setStage(next);
    setOpen("idle");
    setCopied("");
  }

  function openBroker(url: string) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOpen("failed");
      return;
    }
    const tab = window.open(url, "_blank");
    if (!tab) {
      setOpen("failed");
      return;
    }
    tab.opener = null;
    setOpen("opening");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(details);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  }

  if (stage === "closed")
    return (
      <div className="real-buy">
        <button
          type="button"
          className="btn btn--lg btn--block"
          disabled={!hasAmount}
          onClick={() => reset("choose")}
        >
          <ExternalLink size={16} aria-hidden /> {label}
        </button>
        <small className="muted">
          {hasAmount
            ? `Takes ${symbol} and ${dollars} to your broker. Real money, your account.`
            : "Enter an amount first."}
        </small>
      </div>
    );

  if (!handoff)
    return (
      <div className="real-buy real-buy--open" role="group" aria-label={label}>
        <h3>
          {verb} {symbol} for real: where do you have an account?
        </h3>
        <div className="real-buy__brokers">
          {brokerHandoffs(symbol).map((b) => (
            <button
              type="button"
              key={b.broker}
              className="btn"
              onClick={() => reset(b.broker)}
            >
              {b.broker}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => reset("closed")}
        >
          Cancel
        </button>
      </div>
    );

  const steps = handoff.steps(dollars, side);
  return (
    <div
      className="real-buy real-buy--open"
      role="group"
      aria-label={`Before you open ${handoff.broker}`}
    >
      <h3>Before you open {handoff.broker}</h3>
      <dl className="real-buy__details" id={detailsId}>
        <div>
          <dt>Stock</dt>
          <dd>
            {symbol} <small>{name}</small>
          </dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{dollars}</dd>
        </div>
        <div>
          <dt>Order</dt>
          <dd>{verb}, in dollars</dd>
        </div>
      </dl>
      <p className="muted">
        {handoff.carriesSymbol
          ? `${handoff.broker} opens on the ${symbol} page.`
          : `${handoff.broker} can't open a page for ${symbol}, so search for it there.`}{" "}
        The {dollars} does not carry over. Type it in yourself.
      </p>
      {open === "failed" ? (
        <div className="alert alert--error" role="alert">
          <p>
            <strong>{handoff.broker} didn&apos;t open.</strong> Your browser may
            have blocked the new tab, or you&apos;re offline. You can still do
            it by hand: open{" "}
            <a href={handoff.homeUrl} target="_blank" rel="noopener noreferrer">
              {handoff.homeUrl}
            </a>{" "}
            and follow the steps below.
          </p>
        </div>
      ) : open === "opening" ? (
        <p className="muted" role="status">
          Opening {handoff.broker} in a new tab…
        </p>
      ) : open === "opened" ? (
        <p className="muted" role="status">
          {handoff.broker} opened in a new tab. Finish there; this page stays
          here.{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => setOpen("failed")}
          >
            Page didn&apos;t load?
          </button>
        </p>
      ) : null}
      <ol className="real-buy__steps">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div className="button-row">
        <button
          type="button"
          className="btn btn--primary"
          disabled={open === "opening"}
          onClick={() =>
            openBroker(open === "failed" ? handoff.homeUrl : handoff.url)
          }
        >
          <ExternalLink size={16} aria-hidden />{" "}
          {open === "failed"
            ? `Try ${handoff.broker} again`
            : `Open ${handoff.broker}`}
        </button>
        <button
          type="button"
          className="btn"
          aria-describedby={detailsId}
          onClick={() => void copy()}
        >
          <Copy size={16} aria-hidden /> Copy trade details
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => reset("choose")}
        >
          Back
        </button>
      </div>
      {copied === "yes" && (
        <p className="muted" role="status">
          Copied: {details}
        </p>
      )}
      {copied === "no" && (
        <p className="muted" role="status">
          Couldn&apos;t copy. Select this instead: {details}
        </p>
      )}
      <p className="practice-disclaimer" role="note">
        This is your real money at {handoff.broker}. Brix never places real
        trades and can&apos;t see or undo what you do there.
      </p>
    </div>
  );
}

/**
 * Plain facts about the pending trade before Confirm. The numbers are worked
 * out here from the portfolio already on screen, so review never waits on
 * the network; the written explainer loads below and never blocks the order.
 */
function CoachCard({
  request,
  trade,
  name,
  price,
  cash,
  invested,
  held,
}: {
  request: RequestFn;
  trade: { symbol: string; side: "buy" | "sell"; amount: number };
  name: string;
  price: number | null;
  cash: number;
  invested: number;
  held: number;
}) {
  const key = `${trade.side}|${trade.symbol}|${trade.amount}`;
  const [result, setResult] = useState<{
    key: string;
    check: CoachCheck | null;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    void request<CoachCheck>("/api/practice/coach", "POST", trade)
      .then((check) => alive && setResult({ key, check }))
      .catch(() => alive && setResult({ key, check: null }));
    return () => {
      alive = false;
    };
    // The key captures every field of the trade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, key]);
  const shown = result?.key === key ? result : null;
  const check = shown?.check;

  const buy = trade.side === "buy";
  // A sell can't be bigger than what you hold.
  const moved = buy ? trade.amount : Math.min(trade.amount, held);
  const cashAfter = buy ? cash - moved : cash + moved;
  const investedAfter = buy ? invested + moved : invested - moved;
  const heldAfter = buy ? held + moved : held - moved;
  const share = (part: number, whole: number) =>
    whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
  const before = share(held, invested);
  const after = share(heldAfter, investedAfter);
  const shares = price ? Math.round((moved / price) * 10000) / 10000 : null;

  return (
    <div className="coach" role="region" aria-label="Coach check">
      <h3>
        Coach check <small className="term-real">explains, never advises</small>
      </h3>
      <p>
        <strong>What you&apos;re {buy ? "buying" : "selling"}</strong>
        {shares !== null ? `About ${shares} shares of ` : ""}
        {trade.symbol} ({name}){price ? ` at about ${usd(price)} a share` : ""}
      </p>
      <p>
        <strong>{buy ? "Dollar cost" : "Dollars back"}</strong>
        {usd(moved)} of practice money
      </p>
      <p>
        <strong>Cash left after</strong>
        {cashAfter < 0
          ? `${usd(cashAfter)}. That's more than your ${usd(cash)} cash, so this won't fill.`
          : usd(cashAfter)}
      </p>
      <p>
        <strong>Share of your invested practice money</strong>
        {investedAfter > 0
          ? `${trade.symbol} goes from ${before}% to ${after}% of what you've invested.`
          : "Nothing left invested after this."}
      </p>
      <p>
        <strong>What could go wrong</strong>
        {buy
          ? `Prices can drop. If ${trade.symbol} fell 20%, this ${usd(moved)} would be worth about ${usd(moved * 0.8)}.`
          : `If ${trade.symbol} rises after you sell, you won't get that gain on the ${usd(moved)} you sold.`}
      </p>
      <details className="coach__more">
        <summary>Why this matters</summary>
        {!shown ? (
          <p className="muted" role="status">
            Loading the explainer… You can confirm without it.
          </p>
        ) : !check ? (
          <p className="muted">Coach check unavailable</p>
        ) : (
          <>
            {!check.available && (
              <p className="muted">Coach check unavailable</p>
            )}
            {check.bet && (
              <p>
                <strong>What you&apos;re betting on</strong>
                {check.bet}
              </p>
            )}
            {check.risk && (
              <p>
                <strong>More on the risk</strong>
                {check.risk}
              </p>
            )}
            <p>
              <strong>
                How your mix changes{" "}
                <small className="term-real">Allocation</small>
              </strong>
              {check.allocation}
            </p>
            <ul className="msg__sources" aria-label="Where this came from">
              {check.sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </>
        )}
      </details>
    </div>
  );
}

interface RealView {
  holdings: (RealHolding & {
    name: string;
    price: number | null;
    cost: number;
    value: number | null;
    gain: number | null;
  })[];
  totals: {
    spent: number;
    cost: number;
    value: number;
    gain: number;
    priced: number;
  };
  sample?: boolean;
}

/** Real purchases the student logged. Never part of practice totals. */
function RealHoldings({
  request,
  universe,
  data,
  loadError,
  reload,
}: {
  request: RequestFn;
  universe: Security[];
  data: RealView | null;
  loadError: string;
  reload: () => Promise<unknown>;
}) {
  const [actionError, setError] = useState("");
  const error = actionError || loadError;
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  async function act(work: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await reload();
      setNotice(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="card form-card practice-real"
      aria-labelledby="real-holdings"
    >
      <h2 id="real-holdings">
        Real money <small className="term-real">Self-reported</small>
      </h2>
      <p className="practice-disclaimer" role="note">
        Self-reported. Brix does not verify these with your broker. None of this
        counts toward your practice portfolio, cash to play with, or allocation.
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
      <h3>My real holdings</h3>
      {!data ? (
        <p className="muted" role="status">
          Loading…
        </p>
      ) : data.holdings.length ? (
        <>
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Real holdings table"
          >
            <table className="practice-table">
              <thead>
                <tr>
                  <th scope="col">Ticker</th>
                  <th scope="col">Spent</th>
                  <th scope="col">Value now</th>
                  <th scope="col">Up / down</th>
                  <th scope="col">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.holdings.map((h) => (
                  <tr key={h.id}>
                    <th scope="row">
                      {h.symbol}
                      <small>
                        {h.broker ? `${h.broker} · ` : ""}
                        {new Date(`${h.boughtOn}T12:00:00Z`).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "UTC",
                          },
                        )}
                      </small>
                    </th>
                    <td>
                      {usd(h.cost)}
                      {h.pricePaid !== null && h.shares !== null && (
                        <small>
                          {h.shares} at {usd(h.pricePaid)}
                        </small>
                      )}
                    </td>
                    <td>
                      {h.value === null ? "—" : usd(h.value)}
                      <small>
                        {h.shares === null
                          ? "add the price per share to see this"
                          : h.price
                            ? `at ${usd(h.price)}`
                            : "price not loading"}
                      </small>
                    </td>
                    <td className={h.gain === null ? undefined : tone(h.gain)}>
                      {h.gain === null ? "—" : usd(h.gain)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${h.symbol} purchase`}
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () =>
                              request(
                                `/api/practice/real-holdings/${h.id}`,
                                "DELETE",
                              ),
                            "Purchase removed.",
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            {usd(data.totals.spent)} spent in total.
            {data.totals.priced > 0 && (
              <>
                {" "}
                Where you gave a price per share: worth {usd(
                  data.totals.value,
                )}{" "}
                now, {usd(data.totals.cost)} paid (
                <span className={tone(data.totals.gain)}>
                  {usd(data.totals.gain)}
                </span>
                ).
              </>
            )}{" "}
            Kept apart from your practice money, the leaderboard and coins.
            {data.sample ? " Demo prices are samples." : ""}
          </p>
        </>
      ) : (
        <p className="muted">
          Bought something for real? Log it here to see what it&apos;s worth
          now.
        </p>
      )}
      <h3>Log a real purchase</h3>
      <form
        className="rule-form"
        aria-label="Log a real purchase"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form);
          void act(async () => {
            await request("/api/practice/real-holdings", "POST", {
              broker: f.get("broker"),
              symbol: f.get("symbol"),
              dollars: Number(f.get("dollars")),
              boughtOn: f.get("boughtOn"),
              pricePaid: f.get("pricePaid") || undefined,
            });
            form.reset();
          }, "Purchase logged in My real holdings.");
        }}
      >
        <label className="field">
          Broker
          <select name="broker" defaultValue="Robinhood">
            {["Robinhood", "Cash App", "Fidelity", "Other"].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Ticker
          <Dropdown
            name="symbol"
            label="Real holding ticker"
            defaultValue="VOO"
            options={universe.map((s) => ({
              value: s.symbol,
              label: s.symbol,
            }))}
          />
        </label>
        <label className="field">
          Dollars spent
          <input name="dollars" type="number" min="0.01" step="0.01" required />
        </label>
        <label className="field">
          Date
          <input
            name="boughtOn"
            type="date"
            max={today}
            defaultValue={today}
            required
          />
        </label>
        <label className="field">
          Price per share
          <input
            name="pricePaid"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Optional"
          />
        </label>
        <button className="btn" disabled={busy}>
          Log a real purchase
        </button>
      </form>
      <p className="muted">
        Add the price per share from your broker receipt to see what it&apos;s
        worth now. Brix won&apos;t guess it.
      </p>
    </section>
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
    { label: "Cash", value: Math.max(0, p.cash) },
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
          <h2 id="allocation-title">
            Where your money&apos;s at{" "}
            <small className="term-real">Portfolio allocation</small>
          </h2>
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
          ? "All cash for now. Make your first move and it shows up here."
          : "Each color is a slice of your portfolio."}
        {missingPrices
          ? " Some quotes are unavailable; those holdings use their cost basis."
          : ""}
      </p>
    </section>
  );
}
