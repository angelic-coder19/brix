"use client";
import { useEffect, useRef, useState } from "react";
import BrixBuddy from "@/components/brix/BrixBuddy";
import type { BuddyMood } from "@/lib/agent/persona";

const MOODS: BuddyMood[] = [
  "idle",
  "listening",
  "thinking",
  "talking",
  "happy",
  "celebrate",
  "concerned",
  "error",
];

/**
 * The hero buddy reacts to what you point at: anything on the page marked
 * with data-buddy-mood changes its expression, and a click makes it cheer.
 */
export default function HeroBuddy() {
  const [hover, setHover] = useState<BuddyMood | null>(null);
  const [cheer, setCheer] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const onOver = (e: Event) => {
      const target = (e.target as Element | null)?.closest?.(
        "[data-buddy-mood]",
      );
      const mood = target?.getAttribute("data-buddy-mood") as BuddyMood | null;
      setHover(mood && MOODS.includes(mood) ? mood : null);
    };
    // Keyboard focus counts too, so tabbing to a CTA gets the same reaction.
    const onBlur = () => setHover(null);
    document.addEventListener("pointerover", onOver);
    document.addEventListener("focusin", onOver);
    document.addEventListener("focusout", onBlur);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("focusin", onOver);
      document.removeEventListener("focusout", onBlur);
      clearTimeout(timer.current);
    };
  }, []);
  const mood: BuddyMood = cheer ? "celebrate" : (hover ?? "idle");
  return (
    <button
      type="button"
      className="hero-buddy"
      aria-label="Say hi to Brix"
      onClick={() => {
        setCheer(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCheer(false), 2400);
      }}
    >
      <BrixBuddy mood={mood} scale={0.78} decorative />
      <span className="sr-only" aria-live="polite">
        {cheer ? "Brix is celebrating with you." : ""}
      </span>
    </button>
  );
}
