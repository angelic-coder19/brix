"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { RequestFn } from "@/components/brix/useBrixChat";
import type { Quote } from "@/lib/market/quotes";
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
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let stopped = false;
    let running = false;
    const refresh = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const response = await request<{ quotes: Record<string, Quote> }>(
          `/api/market/quote?symbols=${SYMBOLS.join(",")}`,
        );
        const next = SYMBOLS.map((symbol) => response.quotes[symbol]).filter(
          (quote): quote is Quote =>
            !!quote && Number.isFinite(quote.price) && quote.price > 0,
        );
        if (!stopped) {
          setQuotes(next);
          setStatus(next.length ? "ready" : "unavailable");
        }
      } catch {
        if (!stopped) {
          setQuotes([]);
          setStatus("unavailable");
        }
      } finally {
        running = false;
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
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
    <section
      className="market-ticker"
      aria-label="Market prices"
      data-paused={paused}
    >
      <span className="market-ticker__label">
        {status === "ready" ? label : "Market"}
      </span>
      {status === "ready" ? (
        <>
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
          <button
            type="button"
            className="market-ticker__pause"
            onClick={() => setPaused((value) => !value)}
            aria-label={paused ? "Resume market ticker" : "Pause market ticker"}
          >
            {paused ? (
              <Play size={12} aria-hidden />
            ) : (
              <Pause size={12} aria-hidden />
            )}
          </button>
        </>
      ) : (
        <span className="market-ticker__message" role="status">
          {status === "loading" ? "Loading prices…" : "Prices unavailable"}
        </span>
      )}
    </section>
  );
}
