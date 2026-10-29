"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import "./dropdown.css";

export interface MenuItem {
  label: string;
  /** A link opens in a new tab; otherwise `onSelect` runs. */
  href?: string;
  hint?: string;
  icon?: ReactNode;
  onSelect?: () => void;
}

/**
 * A button that opens a small menu of actions or links, styled like Brix's
 * dropdowns. Arrow keys move, Escape closes and returns focus.
 */
export function MenuButton({
  label,
  items,
  className = "btn",
  align = "start",
  icon,
}: {
  label: ReactNode;
  items: MenuItem[];
  className?: string;
  align?: "start" | "end";
  icon?: ReactNode;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const menu = root.current?.querySelector<HTMLElement>("[role=menuitem]");
    menu?.focus();
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    const nodes = [
      ...(root.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []),
    ];
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next =
        (i + (e.key === "ArrowDown" ? 1 : -1) + nodes.length) % nodes.length;
      nodes[next]?.focus();
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div className="brix-menu" ref={root} onKeyDown={onKey}>
      <button
        ref={trigger}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
        {label}
        <ChevronDown size={15} aria-hidden className="brix-menu__chevron" />
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          className={`brix-menu__list brix-menu__list--${align}`}
        >
          {items.map((item) =>
            item.href ? (
              <a
                key={item.label}
                role="menuitem"
                className="brix-menu__item"
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                {item.icon}
                <span>
                  <strong>{item.label}</strong>
                  {item.hint && <small>{item.hint}</small>}
                </span>
              </a>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="brix-menu__item"
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
              >
                {item.icon}
                <span>
                  <strong>{item.label}</strong>
                  {item.hint && <small>{item.hint}</small>}
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
