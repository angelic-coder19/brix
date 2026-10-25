"use client";

import { useEffect, useState } from "react";

// The first phrase is the longest; the reserved line is sized to it.
const phrases = ["it catches you.", "the trial ends.", "renewal day."];

/**
 * Only the ending changes. The second line never wraps and a reserved copy of
 * the longest phrase holds its width, so the headline stays on two lines.
 */
export default function HeroTypewriter() {
  const [text, setText] = useState(phrases[0]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    let phrase = 0;
    let length = phrases[0].length;
    let deleting = true;
    const tick = () => {
      if (preference.matches) return;
      if (deleting) {
        length -= 1;
        setText(phrases[phrase].slice(0, length));
        if (length === 0) {
          deleting = false;
          phrase = (phrase + 1) % phrases.length;
          timer = setTimeout(tick, 250);
        } else timer = setTimeout(tick, 35);
      } else {
        length += 1;
        setText(phrases[phrase].slice(0, length));
        if (length === phrases[phrase].length) {
          deleting = true;
          timer = setTimeout(tick, 2400);
        } else timer = setTimeout(tick, 80);
      }
    };
    const sync = () => {
      clearTimeout(timer);
      if (!preference.matches) timer = setTimeout(tick, 2400);
    };
    sync();
    preference.addEventListener("change", sync);
    return () => {
      clearTimeout(timer);
      preference.removeEventListener("change", sync);
    };
  }, []);

  return (
    <span className="accent-text hero__accent hero-type">
      <span className="sr-only">before it catches you.</span>
      <span className="hero-type__reserve" aria-hidden="true">
        before it catches you.
      </span>
      <span className="hero-type__text" aria-hidden="true">
        before {text}
        <span className="hero-type__caret" />
      </span>
      <span className="hero-type__still" aria-hidden="true">
        before it catches you.
      </span>
    </span>
  );
}
