"use client";

import { useEffect, useId, useState } from "react";
import { ArrowUpRight, Newspaper } from "lucide-react";
import type { RequestFn } from "../brix/useBrixChat";
import "./investing-news.css";

export interface InvestingHeadline {
  symbol: string;
  title: string;
  url: string;
  publishedAt: string;
  source: string;
  imageUrl?: string;
}
const httpsUrl = (value?: string) => {
  if (!value) return undefined;
  // The demo's labelled sample photos are served by Brix itself.
  if (value.startsWith("/images/")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
};
function StoryImage({ story }: { story: InvestingHeadline }) {
  const [failed, setFailed] = useState(false);
  const image = httpsUrl(story.imageUrl);
  return image && !failed ? (
    // Publisher images are optional remote URLs; never invent a replacement photo.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="investing-news__image"
      src={image}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="investing-news__placeholder" aria-hidden="true">
      <Newspaper size={25} />
      <span>{story.symbol}</span>
    </div>
  );
}
export function InvestingNews({
  headlines,
  lines = {},
  error = false,
  stale = false,
  title = "What's moving your stocks",
}: {
  headlines: InvestingHeadline[] | null;
  lines?: Record<string, string>;
  error?: boolean;
  stale?: boolean;
  title?: string;
}) {
  const id = useId();
  const stories = headlines
    ?.filter((story) => httpsUrl(story.url))
    .slice(0, 10);
  return (
    <section className="card investing-news" aria-labelledby={id}>
      <div className="investing-news__heading">
        <div>
          <span className="investing-news__eyebrow">
            The market, in context
          </span>
          <h2 id={id}>{title}</h2>
        </div>
        <Newspaper size={20} aria-hidden="true" />
      </div>
      {headlines === null ? (
        <p className="muted" role="status">
          Finding the latest stories…
        </p>
      ) : error ? (
        <p className="muted" role="status">
          News is taking a minute. Check back soon.
        </p>
      ) : stories?.length ? (
        <div
          className="investing-news__marquee"
          role="region"
          aria-label="Latest stories"
          tabIndex={0}
        >
          <ul
            className="investing-news__track"
            style={
              {
                "--news-duration": `${Math.max(28, stories.length * 9)}s`,
              } as React.CSSProperties
            }
          >
            {[...stories, ...stories].map((story, i) => {
              const date = new Date(story.publishedAt);
              const copy = i >= stories.length;
              return (
                <li
                  key={`${i}:${story.url}`}
                  className="investing-news__item"
                  aria-hidden={copy || undefined}
                >
                  <a
                    className="investing-news__story"
                    href={httpsUrl(story.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={copy ? -1 : undefined}
                  >
                    <StoryImage
                      key={story.imageUrl || story.url}
                      story={story}
                    />
                    <div className="investing-news__copy">
                      <div className="investing-news__meta">
                        <span>{story.symbol}</span>
                        <span>{story.source}</span>
                        {Number.isFinite(date.getTime()) && (
                          <time dateTime={story.publishedAt}>
                            {date.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </time>
                        )}
                      </div>
                      <h3>
                        {story.title}{" "}
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </h3>
                      {lines[story.url] && (
                        <p className="investing-news__context">
                          <strong>For you:</strong> {lines[story.url]}
                        </p>
                      )}
                    </div>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="muted">
          No fresh stories right now. Your next update will show up here.
        </p>
      )}
      {stale && (
        <p className="investing-news__note">
          Showing the last available headlines while the feed catches up.
        </p>
      )}
    </section>
  );
}

/** Also usable on the overview: the endpoint defaults to the user's holdings. */
export function InvestingNewsPanel({
  request,
  symbols,
  title,
}: {
  request: RequestFn;
  symbols?: string;
  title?: string;
}) {
  const [result, setResult] = useState<{
    headlines: InvestingHeadline[];
    stale?: boolean;
    error?: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void request<{ headlines: InvestingHeadline[]; stale?: boolean }>(
      `/api/market/news${symbols ? `?symbols=${encodeURIComponent(symbols)}` : ""}`,
    )
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active) setResult({ headlines: [], error: true });
      });
    return () => {
      active = false;
    };
  }, [request, symbols]);
  return (
    <InvestingNews
      headlines={result?.headlines ?? null}
      error={result?.error}
      stale={result?.stale}
      title={title}
    />
  );
}
