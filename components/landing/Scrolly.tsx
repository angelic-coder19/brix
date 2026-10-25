"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type ScrollyStep = {
  id: string;
  copy: ReactNode;
  media: ReactNode;
};

/**
 * "Screen by screen": on wide screens the media sits in a sticky column and
 * cross-fades to the step you're reading. On phones, and with reduced motion,
 * each step simply shows its own media under the text.
 */
export default function Scrolly({ steps }: { steps: ScrollyStep[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const items = Array.from(node.querySelectorAll<HTMLElement>("[data-step]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={root} className="scrolly" data-active={active}>
      <div className="scrolly__steps">
        {steps.map((s, i) => (
          <article
            key={s.id}
            data-step={i}
            className={`scrolly__step${i === active ? " is-active" : ""}`}
          >
            <div className="scrolly__copy">{s.copy}</div>
            <div className="scrolly__inline">{s.media}</div>
          </article>
        ))}
      </div>
      <div className="scrolly__stage" aria-hidden="true">
        <div className="scrolly__frames">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`scrolly__frame${i === active ? " is-on" : i < active ? " is-past" : ""}`}
            >
              {s.media}
            </div>
          ))}
        </div>
        <ol className="scrolly__dots">
          {steps.map((s, i) => (
            <li key={s.id} className={i === active ? "is-on" : undefined} />
          ))}
        </ol>
      </div>
    </div>
  );
}
