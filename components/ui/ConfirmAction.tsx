"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A button that asks inline before it acts. Replaces window.confirm so the
 * question sits next to the thing it affects and can be styled and tested.
 */
export function ConfirmAction({
  label,
  question,
  confirmLabel,
  onConfirm,
  disabled,
  tone = "default",
  className = "btn",
  icon,
}: {
  label: ReactNode;
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  className?: string;
  icon?: ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);
  useEffect(() => {
    if (asking) confirmRef.current?.focus();
    else if (wasAsking.current) triggerRef.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  if (!asking)
    return (
      <button
        ref={triggerRef}
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => setAsking(true)}
      >
        {icon}
        {label}
      </button>
    );
  return (
    <div
      className={`confirm-inline confirm-inline--${tone}`}
      role="group"
      aria-label={question}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setAsking(false);
        }
      }}
    >
      <span className="confirm-inline__q">{question}</span>
      <span className="confirm-inline__btns">
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => setAsking(false)}>
          Cancel
        </button>
        <button
          ref={confirmRef}
          type="button"
          className={`btn btn--sm ${tone === "danger" ? "btn--danger-fill" : "btn--primary"}`}
          disabled={disabled}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
      </span>
    </div>
  );
}
