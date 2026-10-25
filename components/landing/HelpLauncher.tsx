"use client";
import { useEffect, useRef, useState } from "react";
import { Minus, X } from "lucide-react";
import BotDemo from "./BotDemo";
import { BrixMark } from "@/components/brand/BrixMark";

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
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
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
              onClick={() => setState("closed")}
            >
              <X size={18} />
            </button>
          </div>
          <BotDemo variant="panel" label="Brix help chat with sample data" />
        </div>
      )}
      {!open && (
        <button
          ref={launcher}
          type="button"
          className="chat-launcher help-launcher"
          aria-label="Questions? Open Brix help"
          aria-expanded={false}
          onClick={() => setState("open")}
        >
          <span className="chat-launcher__face">
            <BrixMark className="chat-launcher__mark" />
          </span>
          <span className="chat-launcher__label">Questions?</span>
          {state === "minimized" && <span className="chat-launcher__dot" aria-hidden="true" />}
        </button>
      )}
    </>
  );
}
