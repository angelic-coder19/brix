"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import BrixBuddy from "@/components/brix/BrixBuddy";
import type { BuddyMood } from "@/lib/agent/persona";
import MobileMenu from "./MobileMenu";

type NavLink = { href: string; label: string };

/**
 * Sticky header that tucks into a floating pill once you scroll, highlights the
 * section you're reading, and runs Brix along a little track as a progress bar.
 */
export default function LandingHeader({ links }: { links: NavLink[] }) {
  const header = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const [active, setActive] = useState<string>("");
  const [mood, setMood] = useState<BuddyMood>("idle");

  // Progress + compact state: one rAF per scroll burst, writes a CSS variable.
  useEffect(() => {
    let raf = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      header.current?.style.setProperty("--progress", p.toFixed(4));
      setCompact(y > 24);
      setMood(p > 0.985 ? "celebrate" : y < 8 ? "idle" : "happy");
      clearTimeout(idle);
      idle = setTimeout(
        () => setMood((m) => (m === "happy" ? "idle" : m)),
        900,
      );
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Scroll-spy: the section crossing the upper third of the viewport is active.
  useEffect(() => {
    const sections = links
      .map((l) => document.querySelector<HTMLElement>(l.href))
      .filter((el): el is HTMLElement => !!el);
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(`#${e.target.id}`, e.isIntersecting);
        const current = links.find((l) => seen.get(l.href));
        setActive(current?.href ?? "");
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [links]);

  return (
    <header
      ref={header}
      className={`lp-nav${compact ? " is-compact" : ""}`}
      data-compact={compact ? "true" : "false"}
    >
      <div className="lp-nav__bar">
        <Link href="/" className="wordmark" aria-label="Brix home">
          <span className="brand-block" />
          brix<span className="brand-period">.</span>
        </Link>
        <nav className="lp-nav__links" aria-label="Main">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={active === l.href ? "is-active" : undefined}
              aria-current={active === l.href ? "location" : undefined}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav__actions">
          <Link href="/dashboard" className="lp-nav__signin">
            Sign in
          </Link>
          <Link href="/dashboard" className="btn btn--dark lp-nav__cta" data-buddy-mood="happy">
            Open the demo
          </Link>
          <MobileMenu links={links} />
        </div>
        <div className="lp-progress" aria-hidden="true">
          <span className="lp-progress__rail" />
          <span className="lp-progress__fill" />
          <span className="lp-progress__train">
            <span className="lp-progress__rider">
              <BrixBuddy mood={mood} scale={0.1} decorative follow={false} />
            </span>
            <span className="lp-progress__car">
              <i />
              <i />
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}
