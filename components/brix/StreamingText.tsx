"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Reveals a finished reply word by word, the way a chat assistant streams.
 * Screen readers get the full text once (the animated copy is aria-hidden),
 * and reduced-motion users see it immediately.
 */
export default function StreamingText({
  text,
  onDone,
}: {
  text: string;
  onDone: () => void;
}) {
  const words = text.split(/(\s+)/);
  const [count, setCount] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const instant = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const step = instant ? words.length : Math.max(1, Math.ceil(words.length / 60));
    const id = setInterval(
      () =>
        setCount((n) => {
          const next = Math.min(words.length, n + step);
          if (next >= words.length) {
            clearInterval(id);
            setTimeout(() => done.current(), 0);
          }
          return next;
        }),
      instant ? 0 : 28,
    );
    return () => clearInterval(id);
  }, [words.length]);
  if (count >= words.length) return <>{text}</>;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.slice(0, count).join("")}
        <span className="stream-caret" />
      </span>
    </>
  );
}
