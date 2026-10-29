"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import "./dropdown.css";

export interface DropdownOption {
  value: string;
  label: string;
}
export function Dropdown({
  label,
  name,
  id,
  value,
  defaultValue,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: DropdownOption[];
  disabled?: boolean;
}) {
  const generated = useId(),
    listId = `${generated}-options`;
  const root = useRef<HTMLDivElement>(null);
  const [local, setLocal] = useState(defaultValue ?? options[0]?.value ?? "");
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const search = useRef({ text: "", at: 0 });
  const selected = value ?? local;
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === selected),
  );
  const choose = (position: number) => {
    const option = options[position];
    if (!option) return;
    if (value === undefined) setLocal(option.value);
    onChange?.(option.value);
    setOpen(false);
  };
  useEffect(() => {
    const element = root.current,
      form = element?.closest("form");
    const reset = () => {
      setLocal(defaultValue ?? options[0]?.value ?? "");
      setOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (!element?.contains(event.target as Node)) setOpen(false);
    };
    form?.addEventListener("reset", reset);
    document.addEventListener("pointerdown", outside);
    return () => {
      form?.removeEventListener("reset", reset);
      document.removeEventListener("pointerdown", outside);
    };
  }, [defaultValue, options]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${listId}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);
  return (
    <div
      className="brix-dropdown"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {name && (
        <input type="hidden" name={name} value={selected} disabled={disabled} />
      )}
      <button
        id={id}
        type="button"
        className="brix-dropdown__trigger"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled || !options.length}
        onClick={() => {
          setActive(index);
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (
            [
              "ArrowDown",
              "ArrowUp",
              "Home",
              "End",
              "Enter",
              " ",
              "Escape",
            ].includes(event.key)
          ) {
            event.preventDefault();
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              if (open) choose(active);
              else {
                setActive(index);
                setOpen(true);
              }
              return;
            }
            setOpen(true);
            setActive(
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : !open
                    ? index
                    : Math.max(
                        0,
                        Math.min(
                          options.length - 1,
                          active + (event.key === "ArrowDown" ? 1 : -1),
                        ),
                      ),
            );
          } else if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
            const text =
              Date.now() - search.current.at < 700
                ? search.current.text + event.key
                : event.key;
            search.current = { text, at: Date.now() };
            const found = options.findIndex((option) =>
              option.label.toLowerCase().startsWith(text.toLowerCase()),
            );
            if (found >= 0) {
              setActive(found);
              setOpen(true);
            }
          }
        }}
      >
        <span>
          {options.find((option) => option.value === selected)?.label ||
            "Choose one"}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={listId}
          className="brix-dropdown__options"
          role="listbox"
          aria-label={label}
        >
          {options.map((option, position) => (
            <li
              id={`${listId}-${position}`}
              key={option.value}
              role="option"
              aria-selected={option.value === selected}
              className={position === active ? "is-focused" : undefined}
              onPointerMove={() => setActive(position)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(position)}
            >
              <span>{option.label}</span>
              {option.value === selected && (
                <Check size={15} aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
