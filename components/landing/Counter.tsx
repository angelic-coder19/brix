"use client";
import { useEffect, useRef, useState } from "react";

/** Counts up to `value` the first time it scrolls into view. */
export default function Counter({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / 1200);
          setShown(value * (1 - Math.pow(1 - p, 3)));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);
  const text = `${prefix}${shown.toFixed(decimals)}${suffix}`;
  return (
    <span ref={ref}>
      <span className="sr-only">{`${prefix}${value.toFixed(decimals)}${suffix}`}</span>
      <span aria-hidden="true">{text}</span>
    </span>
  );
}
