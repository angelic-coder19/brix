"use client";
import { useEffect } from "react";

/**
 * Fades sections in as they scroll into view. Content stays visible without
 * JavaScript or with reduced motion, because the hidden state only applies
 * once this script opts the page in.
 */
export default function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    // Children of a stagger group get an index so CSS can delay each one.
    document
      .querySelectorAll<HTMLElement>("[data-reveal-stagger]")
      .forEach((group) => {
        Array.from(group.children).forEach((child, i) =>
          (child as HTMLElement).style.setProperty(
            "--i",
            String(Math.min(i, 8)),
          ),
        );
      });
    const items = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    for (const item of items) {
      const box = item.getBoundingClientRect();
      if (box.top < window.innerHeight) item.classList.add("is-visible");
      else observer.observe(item);
    }
    root.classList.add("reveal-ready");
    return () => {
      observer.disconnect();
      root.classList.remove("reveal-ready");
    };
  }, []);
  return null;
}
