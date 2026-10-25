"use client";
import { useRef, type PointerEvent } from "react";
import { BrixMark } from "./BrixMark";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * A Brix single-use virtual card. Used on the landing page and the Cards page
 * so both show the same card. Tilts slightly toward the pointer (off under
 * reduced motion).
 */
export function VirtualCard({
  purpose,
  last4,
  limit,
  expiry = "12/27",
  created,
  state = "OPEN",
  note,
  tilt = true,
  className = "",
}: {
  purpose: string;
  last4: string;
  limit: number;
  /** Pass null when the real expiry isn't known; `created` is shown instead. */
  expiry?: string | null;
  created?: string;
  state?: string;
  note?: string;
  tilt?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closed = state === "CLOSED";
  const paused = state === "PAUSED";
  const createdLabel = created
    ? new Date(created).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || !tilt || e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--tilt-x", `${(-y * 7).toFixed(2)}deg`);
    el.style.setProperty("--tilt-y", `${(x * 9).toFixed(2)}deg`);
    el.style.setProperty("--shine-x", `${((x + 0.5) * 100).toFixed(1)}%`);
  };
  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  };
  return (
    <div
      ref={ref}
      className={`vcard${closed ? " vcard--closed" : ""} ${className}`.trim()}
      onPointerMove={onMove}
      onPointerLeave={reset}
      role="img"
      aria-label={`Brix single-use card for ${purpose}, ending ${last4}, limit ${usd(limit)}, ${expiry ? `expires ${expiry}` : createdLabel ? `created ${createdLabel}` : ""}${closed ? ", closed" : paused ? ", paused" : ""}`}
    >
      <div className="vcard__face" aria-hidden="true">
        <div className="vcard__top">
          <span className="vcard__brand">
            <BrixMark className="vcard__mark" />
            brix<span className="brand-period">.</span>
          </span>
          <span className="vcard__type">{closed ? "Closed" : paused ? "Paused" : "Virtual · Single use"}</span>
        </div>
        <span className="vcard__chip" />
        <p className="vcard__number">
          <span>••••</span>
          <span>••••</span>
          <span>••••</span>
          <span>{last4}</span>
        </p>
        <div className="vcard__bottom">
          <div>
            <small>For</small>
            <span className="vcard__purpose">{purpose}</span>
          </div>
          {expiry ? (
            <div>
              <small>Expires</small>
              <span>{expiry}</span>
            </div>
          ) : createdLabel ? (
            <div>
              <small>Created</small>
              <span>{createdLabel}</span>
            </div>
          ) : null}
        </div>
        <span className="vcard__limit">
          Limit {usd(limit)} · single use
        </span>
        {note && <span className="vcard__note">{note}</span>}
      </div>
    </div>
  );
}
