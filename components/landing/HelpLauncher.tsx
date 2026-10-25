"use client";
import { useEffect, useRef, useState } from "react";
import { Minus, X } from "lucide-react";
import BotDemo from "./BotDemo";
import { BrixMark } from "@/components/brand/BrixMark";
import type { BuddyMood } from "@/lib/agent/persona";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';

/**
 * Bottom-right help launcher for the landing page. Opens the sample-data Brix
 * chat in a small panel (a bottom sheet on phones). Minimize keeps the
 * conversation; close resets it. Escape minimizes; focus stays inside while open.
 */
export default function HelpLauncher() {
  const [state, setState] = useState<"closed" | "open" | "minimized">("closed");
  const panel = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const open = state === "open";
  const wasOpen = useRef(false);
  // The launcher's face mirrors the chat's mood, so a minimized chat that is
  // still thinking or celebrating shows it. Hovering the launcher cheers Brix up.
  const [chatMood, setChatMood] = useState<BuddyMood>("idle");
  const [hover, setHover] = useState(false);
  const mood: BuddyMood = hover && chatMood === "idle" ? "happy" : chatMood;

  // Match the section behind the launcher: sections mark themselves with
  // data-surface="dark" | "accent"; anything else counts as light.
  const [surface, setSurface] = useState<"light" | "dark" | "accent">("light");
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const btn = launcher.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const under = document
        .elementsFromPoint(x, y)
        .find((el) => !btn.contains(el) && el !== btn);
      const value =
        under?.closest<HTMLElement>("[data-surface]")?.dataset.surface;
      setSurface(value === "dark" || value === "accent" ? value : "light");
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [state]);

  // Hand focus back to the launcher whenever the panel goes away.
  useEffect(() => {
    if (!open && wasOpen.current) launcher.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = panel.current;
    node?.querySelector<HTMLElement>("input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".tapback__menu")) {
        e.preventDefault();
        setState("minimized");
      }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {state !== "closed" && (
        <div
          ref={panel}
          className="help-panel"
          role="dialog"
          aria-modal={open}
          aria-label="Brix help"
          hidden={!open}
        >
          <div className="help-panel__bar">
            <span className="help-panel__grip" aria-hidden="true" />
            <strong>Ask Brix</strong>
            <small>Sample data</small>
            <button
              type="button"
              className="icon-btn"
              aria-label="Minimize help"
              onClick={() => setState("minimized")}
            >
              <Minus size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Close help"
              onClick={() => {
                setState("closed");
                setChatMood("idle");
              }}
            >
              <X size={18} />
            </button>
          </div>
          <BotDemo
            variant="panel"
            label="Brix help chat with sample data"
            onMoodChange={setChatMood}
          />
        </div>
      )}
      {!open && (
        <button
          ref={launcher}
          type="button"
          className="chat-launcher help-launcher"
          aria-label="Questions? Open Brix help"
          aria-expanded={false}
          data-mood={mood}
          data-surface={surface}
          onClick={() => {
            setHover(false);
            setState("open");
          }}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
        >
          <span className="chat-launcher__face">
            <BrixMark className="chat-launcher__mark" mood={mood} decorative />
          </span>
          <span className="chat-launcher__label">Questions?</span>
          {state === "minimized" && (
            <span className="chat-launcher__dot" aria-hidden="true" />
          )}
        </button>
      )}
    </>
  );
}
