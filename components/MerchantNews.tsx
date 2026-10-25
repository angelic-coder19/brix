"use client";
import { useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import type { RequestFn } from "./brix/useBrixChat";

interface Headline {
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  merchant: string;
  whyItMatters: string;
}

/** Pricing and renewal news about the user's merchants. Loads on request to respect the news quota. */
export default function MerchantNews({ request }: { request: RequestFn }) {
  const [news, setNews] = useState<{
    headlines: Headline[];
    message: string;
  } | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError("");
    try {
      setNews(await request("/api/news"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card news-card" aria-labelledby="merchant-news">
      <h3 id="merchant-news">
        <Newspaper size={17} /> Merchant news
      </h3>
      {!news && !error && (
        <p className="muted">
          Price hikes and renewal changes at the places you pay, checked when
          you ask.
        </p>
      )}
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
      {news && (
        <>
          {news.headlines.length ? (
            <ul className="news-list">
              {news.headlines.map((h) => (
                <li key={h.url}>
                  <a href={h.url} target="_blank" rel="noopener noreferrer">
                    {h.title} <ExternalLink size={13} aria-hidden />
                  </a>
                  <small>
                    {h.merchant} · {h.source} ·{" "}
                    {new Date(h.publishedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="muted">{news.message}</p>
        </>
      )}
      <button
        type="button"
        className="btn btn--block btn--sm"
        disabled={busy}
        onClick={() => void load()}
      >
        {busy ? "Checking…" : news ? "Check again" : "Check news"}
      </button>
    </section>
  );
}
