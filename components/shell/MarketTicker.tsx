"use client";

import { useEffect, useState } from "react";
import type { RequestFn } from "@/components/brix/useBrixChat";
import type { Quote } from "@/lib/market/quotes";
import { BrixMark } from "@/components/brand/BrixMark";
import "./market-ticker.css";

const SYMBOLS = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMZN"];
const price = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Uses the same authenticated, source-labelled quotes as practice investing. */
export function MarketTicker({ request }: { request: RequestFn }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  useEffect(() => {
    let stopped = false;
    let running = false;
    let failures = 0;
    let timer = 0;
    // Healthy quotes refresh every minute. When prices can't be loaded, keep
    // trying sooner (5s, 10s, 20s, then every 30s) instead of giving up.
    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      if (!stopped) timer = window.setTimeout(() => void refresh(), ms);
    };
    const refresh = async () => {
      if (running) return;
      if (document.hidden) return schedule(60_000);
      running = true;
      let ok = false;
      try {
        const response = await request<{ quotes: Record<string, Quote> }>(
          `/api/market/quote?symbols=${SYMBOLS.join(",")}`,
        );
        const next = SYMBOLS.map((symbol) => response.quotes[symbol]).filter(
          (quote): quote is Quote =>
            !!quote && Number.isFinite(quote.price) && quote.price > 0,
        );
        ok = next.length > 0;
        if (!stopped && ok) {
          setQuotes(next);
          setStatus("ready");
        }
      } catch {}
      running = false;
      if (stopped) return;
      if (ok) failures = 0;
      else {
        failures += 1;
        // Keep the last good prices on screen; only say "unavailable" when
        // there is nothing to show.
        setStatus((s) => (s === "ready" ? s : "unavailable"));
      }
      schedule(ok ? 60_000 : Math.min(30_000, 5_000 * 2 ** (failures - 1)));
    };
    void refresh();
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    const onOnline = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [request]);

  const sample = quotes.some((quote) => quote.sample);
  const label = sample ? "Demo prices" : "Market · delayed";
  const renderQuotes = (duplicate = false) => (
    <div className="market-ticker__group" aria-hidden={duplicate || undefined}>
      {quotes.map((quote) => {
        const change =
          quote.previousClose > 0
            ? ((quote.price - quote.previousClose) / quote.previousClose) * 100
            : null;
        return (
          <span
            className="market-ticker__quote"
            key={quote.symbol}
            title={`${quote.symbol} · ${quote.sample ? "Fixed demo price" : `Quote as of ${new Date(quote.at).toLocaleString()}`}`}
          >
            <strong>{quote.symbol}</strong>
            <span>{price.format(quote.price)}</span>
            {change !== null && Number.isFinite(change) && (
              <span
                className={
                  change >= 0 ? "market-ticker__up" : "market-ticker__down"
                }
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            )}
          </span>
        );
      })}
    </div>
  );

  return (
    <section className="market-ticker" aria-label="Market prices">
      <span className="market-ticker__label">
        {status === "ready" ? label : "Market"}
      </span>
      {status === "ready" ? (
        <div
          className="market-ticker__window"
          tabIndex={0}
          role="group"
          aria-label="Market prices"
        >
          <div className="market-ticker__track">
            {renderQuotes()}
            {renderQuotes(true)}
          </div>
        </div>
      ) : (
        <span className="market-ticker__message" role="status">
          {status === "loading"
            ? "Loading prices…"
            : "Prices unavailable · retrying"}
        </span>
      )}
    </section>
  );
}

/**
 * The Brix cart from the landing page's progress bar, riding the bottom edge
 * of the header on a loop. Decorative only; it stops for reduced motion.
 */
export function HeaderTrain() {
  return (
    <span className="header-train" aria-hidden="true">
      <span className="header-train__cart">
        <BrixMark className="header-train__rider" />
        <span className="header-train__car">
          <i />
          <i />
        </span>
      </span>
    </span>
  );
}
