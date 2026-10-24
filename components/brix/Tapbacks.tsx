"use client";
import { useEffect, useRef, useState } from "react";
import { SmilePlus } from "lucide-react";
import { TAPBACKS, type Tapback } from "@/lib/agent/persona";

/** iMessage-style tapback picker for one of Brix's messages. */
export default function Tapbacks({
  message,
  onReact,
}: {
  message: { reaction?: string };
  onReact: (emoji: Tapback | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof PointerEvent && ref.current?.contains(e.target as Node))
        return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="tapback" ref={ref}>
      <button
        type="button"
        className="tapback__toggle"
        aria-label="React to this message"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <SmilePlus size={15} />
      </button>
      {open && (
        <div className="tapback__menu" role="group" aria-label="Reactions">
          {TAPBACKS.map((emoji) => (
            <button
              type="button"
              key={emoji}
              aria-label={`React with ${emoji}`}
              aria-pressed={message.reaction === emoji}
              className={message.reaction === emoji ? "is-active" : ""}
              onClick={() => {
                onReact(message.reaction === emoji ? null : emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

