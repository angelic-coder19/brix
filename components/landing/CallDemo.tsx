"use client";
import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { BrixMark } from "@/components/brand/BrixMark";
import type { BuddyMood } from "@/lib/agent/persona";

type Phase = "ringing" | "asking" | "thinking" | "answering" | "giggle";
const SCRIPT: { phase: Phase; ms: number }[] = [
  { phase: "ringing", ms: 2400 },
  { phase: "asking", ms: 2200 },
  { phase: "thinking", ms: 900 },
  { phase: "answering", ms: 2800 },
  { phase: "giggle", ms: 1800 },
];
const MOOD: Record<Phase, BuddyMood> = {
  ringing: "idle",
  asking: "listening",
  thinking: "thinking",
  answering: "talking",
  giggle: "happy",
};

/**
 * A short looping phone call: it rings, Brix picks up, you ask what's due and
 * Brix answers. Plays only while on screen; a still frame under reduced motion.
 */
export default function CallDemo() {
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(3);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        // Start each viewing from the ring.
        if (entry.isIntersecting) setStep(0);
        setPlaying(entry.isIntersecting);
      },
      { threshold: 0.35 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(
      () => setStep((s) => (s + 1) % SCRIPT.length),
      SCRIPT[step].ms,
    );
    return () => clearTimeout(t);
  }, [playing, step]);

  const phase = SCRIPT[step].phase;
  const live = phase !== "ringing";
  return (
    <div
      ref={root}
      className={`call call--${phase}`}
      data-phase={phase}
      data-playing={playing ? "true" : "false"}
      aria-hidden="true"
    >
      <div className="call__screen">
        <span className="call__status">
          {live ? "On call" : "Incoming call…"}
        </span>
        <span className="call__face">
          <span className="call__rings">
            <i />
            <i />
          </span>
          <BrixMark mood={MOOD[phase]} decorative className="call__mark" />
        </span>
        <span className="call__name">Brix</span>
        {live ? (
          <span
            className={`call__wave${phase === "answering" || phase === "giggle" ? " is-speaking" : ""}`}
          >
            {Array.from({ length: 13 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${(i % 5) * -0.13}s` }} />
            ))}
          </span>
        ) : (
          <span className="call__buttons">
            <span className="call__btn call__btn--decline">
              <PhoneOff size={16} />
            </span>
            <span className="call__btn call__btn--accept">
              <Phone size={16} />
            </span>
          </span>
        )}
      </div>
      <div className="call__captions">
        <p className={`call__line call__line--you${step >= 1 ? " is-in" : ""}`}>
          <b>You</b> What’s due this week?
        </p>
        <p
          className={`call__line call__line--brix${step >= 3 ? " is-in" : ""}`}
        >
          <b>Brix</b> Netflix on Thursday, $15.49.
        </p>
      </div>
    </div>
  );
}
