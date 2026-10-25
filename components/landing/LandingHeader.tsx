"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MobileMenu from "./MobileMenu";
import { BrixMark } from "@/components/brand/BrixMark";
import { Wordmark } from "@/components/brand/Wordmark";
import PeekCta from "./PeekCta";

type NavLink = { href: string; label: string };

/**
 * Full-width sticky header. Highlights the section you're reading and runs Brix
 * along its bottom edge as a scroll progress bar.
 */
export default function LandingHeader({
  links,
  current,
}: {
  links: NavLink[];
  /** Path of the current page, for links that point at other pages. */
  current?: string;
}) {
  const header = useRef<HTMLElement>(null);
  const [riding, setRiding] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [active, setActive] = useState<string>("");

  // One rAF per scroll burst; the position itself is a CSS variable.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      header.current?.style.setProperty("--progress", p.toFixed(4));
      // The cart appears once you've scrolled a little and stays until you're
      // back at the top; it hops when it reaches the end.
      setRiding(y > 80);
      setArrived(p > 0.985);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Scroll-spy: the section crossing the upper third of the viewport is active.
  useEffect(() => {
    const sections = links
      .filter((l) => l.href.startsWith("#"))
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
      className="lp-nav"
      data-riding={riding ? "true" : "false"}
      data-arrived={arrived ? "true" : "false"}
    >
      <div className="lp-nav__bar">
        <Link href="/" className="wordmark" aria-label="Brix home">
          <Wordmark />
        </Link>
        <nav className="lp-nav__links" aria-label="Main">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={active === l.href || current === l.href ? "is-active" : undefined}
              aria-current={
                current === l.href ? "page" : active === l.href ? "location" : undefined
              }
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav__actions">
          <Link href="/dashboard" className="lp-nav__signin">
            Sign in
          </Link>
          <PeekCta size="sm" className="lp-nav__cta">
            <Link
              href="/dashboard"
              className="btn btn--dark"
              data-buddy-mood="happy"
              aria-label="Try now, the Brix demo"
            >
              Try now
            </Link>
          </PeekCta>
          <MobileMenu links={links} />
        </div>
        <div className="lp-progress" aria-hidden="true">
          <span className="lp-progress__fill" />
          <span className="lp-progress__train">
            <BrixMark className="lp-progress__rider" />
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
