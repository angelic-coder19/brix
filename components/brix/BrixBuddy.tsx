"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import type { BuddyMood } from "@/lib/agent/persona";
import "./buddy.css";

/* One shared pointer listener drives every buddy on the page. */
type Watcher = (x: number, y: number, active: boolean) => void;
const watchers = new Set<Watcher>();
let frame = 0;
let last = { x: 0, y: 0, active: false };
function broadcast() {
  frame = 0;
  for (const watch of watchers) watch(last.x, last.y, last.active);
}
function onPointer(event: PointerEvent) {
  last = { x: event.clientX, y: event.clientY, active: true };
  if (!frame) frame = requestAnimationFrame(broadcast);
}
function onLeave() {
  last = { ...last, active: false };
  if (!frame) frame = requestAnimationFrame(broadcast);
}
function subscribe(watch: Watcher) {
  if (!watchers.size) {
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
  }
  watchers.add(watch);
  return () => {
    watchers.delete(watch);
    if (!watchers.size) {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    }
  };
}

const MOOD_LABEL: Record<BuddyMood, string> = {
  idle: "relaxed",
  listening: "listening closely",
  thinking: "thinking",
  talking: "talking",
  happy: "happy",
  celebrate: "celebrating",
  concerned: "concerned about an upcoming charge",
  error: "a little confused",
};

export default function BrixBuddy({
  mood = "idle",
  scale = 1,
  follow = true,
  label,
  className = "",
  decorative = false,
}: {
  mood?: BuddyMood;
  /** 1 = 260px wide hero size. */
  scale?: number;
  follow?: boolean;
  label?: string;
  className?: string;
  decorative?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !follow) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return subscribe((x, y, active) => {
      if (!active) {
        node.style.setProperty("--look-x", "0");
        node.style.setProperty("--look-y", "0");
        return;
      }
      const box = node.getBoundingClientRect();
      const cx = box.left + box.width / 2,
        cy = box.top + box.height * 0.4;
      const dx = x - cx,
        dy = y - cy;
      const reach = Math.max(260, box.width * 2);
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      node.style.setProperty("--look-x", clamp(dx / reach).toFixed(3));
      node.style.setProperty("--look-y", clamp(dy / reach).toFixed(3));
    });
  }, [follow]);
  return (
    <div
      ref={ref}
      className={`buddy buddy--${mood} ${className}`}
      style={{ "--buddy-scale": scale } as CSSProperties}
      data-mood={mood}
      {...(decorative
        ? { "aria-hidden": true }
        : {
            role: "img",
            "aria-label":
              label ?? `Brix, your orange brick buddy, ${MOOD_LABEL[mood]}`,
          })}
    >
      <div className="buddy-rig">
        <div className="buddy-shadow" />
        <div className="buddy-figure">
          <div className="buddy-arm left" />
          <div className="buddy-arm right" />
          <div className="buddy-foot left" />
          <div className="buddy-foot right" />
          <div className="buddy-body">
            <span className="buddy-brow left" />
            <span className="buddy-brow right" />
            <span className="buddy-eyes">
              <span className="buddy-eye left" />
              <span className="buddy-eye right" />
            </span>
            <span className="buddy-cheek left" />
            <span className="buddy-cheek right" />
            <span className="buddy-mouth" />
            <span className="buddy-sweat" />
          </div>
        </div>
        <div className="buddy-thought">
          <i />
          <i />
          <i />
        </div>
        <div className="buddy-alert">!</div>
        {mood === "celebrate" && (
          <div className="buddy-confetti">
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
