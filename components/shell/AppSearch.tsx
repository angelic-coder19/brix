"use client";
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowLeft,
  CornerDownLeft,
  CreditCard,
  Layers3,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { ActivityEvent, Charge, VirtualCard } from "@/lib/types";

export type SearchResult =
  | { type: "page"; id: string; title: string; sub: string; href: string }
  | { type: "charge"; id: string; title: string; sub: string; charge: Charge }
  | { type: "card"; id: string; title: string; sub: string; card: VirtualCard }
  | {
      type: "activity";
      id: string;
      title: string;
      sub: string;
      event: ActivityEvent;
    };

const GROUPS: {
  type: SearchResult["type"];
  label: string;
  icon: ComponentType<{ size?: number }>;
}[] = [
  { type: "page", label: "Go to", icon: CornerDownLeft },
  { type: "charge", label: "Charges and trials", icon: Layers3 },
  { type: "card", label: "One-time cards", icon: CreditCard },
  { type: "activity", label: "Activity", icon: Activity },
];
const PER_GROUP = 5;

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const day = (s: string) =>
  new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

export function highlight(text: string, q: string): ReactNode {
  const query = q.trim();
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

function score(hay: string, q: string) {
  const h = hay.toLowerCase();
  if (h.startsWith(q)) return 0;
  if (h.split(/\s+/).some((w) => w.startsWith(q))) return 1;
  return h.includes(q) ? 2 : -1;
}

export function searchAll(
  q: string,
  data: {
    pages: { href: string; label: string }[];
    charges: Charge[];
    cards: VirtualCard[];
    events: ActivityEvent[];
  },
): SearchResult[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const rank = <T,>(items: T[], text: (t: T) => string) =>
    items
      .map((item) => ({ item, s: score(text(item), query) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => a.s - b.s)
      .slice(0, PER_GROUP)
      .map((x) => x.item);
  return [
    ...rank(data.pages, (p) => p.label).map<SearchResult>((p) => ({
      type: "page",
      id: `page-${p.href}`,
      title: p.label,
      sub: "Page",
      href: `/${p.href}`,
    })),
    ...rank(data.charges, (c) => c.merchant).map<SearchResult>((c) => ({
      type: "charge",
      id: `charge-${c.id}`,
      title: c.merchant,
      sub: `${c.kind === "trial" ? "Free trial · ends" : c.status === "to_cancel" ? "Marked to cancel ·" : "Renews"} ${day(c.nextDate)} · ${usd(c.amount)}`,
      charge: c,
    })),
    ...rank(data.cards, (c) => `${c.purpose} ${c.last4}`).map<SearchResult>(
      (c) => ({
        type: "card",
        id: `card-${c.id}`,
        title: c.purpose,
        sub: `•••• ${c.last4} · ${usd(c.spendLimit)} limit · ${c.state === "OPEN" ? "Open" : c.state === "PAUSED" ? "Paused" : "Closed"}`,
        card: c,
      }),
    ),
    ...rank(
      data.events.filter((e) => e.type !== "agent_message" && e.text),
      (e) => e.text,
    ).map<SearchResult>((e) => ({
      type: "activity",
      id: `event-${e.id}`,
      title: e.text,
      sub: `Via ${e.channel}`,
      event: e,
    })),
  ];
}

/**
 * Search across the app's real data: pages, charges and trials, cards and
 * activity. "/" or Cmd/Ctrl+K focuses it; on phones it opens as a sheet.
 */
export function AppSearch({
  pages,
  charges,
  cards,
  events,
  onSelect,
}: {
  pages: { href: string; label: string }[];
  charges: Charge[];
  cards: VirtualCard[];
  events: ActivityEvent[];
  onSelect: (r: SearchResult) => void;
}) {
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // Debounce typing so results don't flicker on every key.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(value);
      setActive(0);
    }, 90);
    return () => clearTimeout(t);
  }, [value]);

  const results = useMemo(
    () => searchAll(query, { pages, charges, cards, events }),
    [query, pages, charges, cards, events],
  );

  const isNarrow = () => window.matchMedia("(max-width: 760px)").matches;
  const focusSearch = () => {
    if (isNarrow()) setSheet(true);
    setOpen(true);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
  };
  const focusRef = useRef(focusSearch);
  useEffect(() => {
    focusRef.current = focusSearch;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();
        focusRef.current();
      } else if (
        e.key === "/" &&
        !typing &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        focusRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const closeSheet = () => {
    setSheet(false);
    setOpen(false);
    trigger.current?.focus();
  };
  const choose = (r: SearchResult) => {
    onSelect(r);
    setOpen(false);
    setSheet(false);
    setValue("");
    input.current?.blur();
  };

  const showPanel = open && value.trim().length > 0;
  const pending = value.trim() !== query.trim();
  const activeId = results[active]
    ? `${listId}-${results[active].id}`
    : undefined;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="icon-btn icon-btn--outline search-trigger"
        aria-label="Search"
        onClick={focusSearch}
      >
        <Search size={19} />
      </button>
      <div
        ref={wrap}
        className={`app-search${sheet ? " is-sheet" : ""}`}
        role={sheet ? "dialog" : undefined}
        aria-modal={sheet ? true : undefined}
        aria-label={sheet ? "Search Brix" : undefined}
      >
        <div className="app-search__field">
          {sheet ? (
            <button
              type="button"
              className="icon-btn app-search__back"
              aria-label="Close search"
              onClick={closeSheet}
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <Search size={16} className="app-search__icon" aria-hidden />
          )}
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label="Search charges, trials, cards and activity"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showPanel ? activeId : undefined}
            placeholder="Search charges, cards, activity…"
            autoComplete="off"
            spellCheck={false}
            value={value}
            maxLength={80}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && results.length) {
                e.preventDefault();
                setOpen(true);
                setActive((a) => (a + 1) % results.length);
              } else if (e.key === "ArrowUp" && results.length) {
                e.preventDefault();
                setActive((a) => (a - 1 + results.length) % results.length);
              } else if (e.key === "Enter") {
                const r = results[active];
                if (r && !pending) {
                  e.preventDefault();
                  choose(r);
                }
              } else if (e.key === "Escape") {
                e.preventDefault();
                if (value) setValue("");
                else if (sheet) closeSheet();
                else {
                  setOpen(false);
                  input.current?.blur();
                }
              }
            }}
          />
          {value ? (
            <button
              type="button"
              className="app-search__clear"
              aria-label="Clear search"
              onClick={() => {
                setValue("");
                input.current?.focus();
              }}
            >
              <X size={14} />
            </button>
          ) : (
            !sheet && (
              <kbd className="app-search__kbd" aria-hidden>
                /
              </kbd>
            )
          )}
        </div>
        <div className="app-search__panel" hidden={!showPanel && !sheet}>
          <div id={listId} role="listbox" aria-label="Search results">
            {results.length > 0 &&
              GROUPS.map((g) => {
                const items = results.filter((r) => r.type === g.type);
                if (!items.length) return null;
                return (
                  <div
                    role="group"
                    aria-label={g.label}
                    key={g.type}
                    className="app-search__group"
                  >
                    <div className="app-search__label" aria-hidden>
                      {g.label}
                    </div>
                    {items.map((r) => {
                      const i = results.indexOf(r);
                      return (
                        <Fragment key={r.id}>
                          <div
                            id={`${listId}-${r.id}`}
                            role="option"
                            aria-selected={i === active}
                            className="app-search__option"
                            onPointerMove={() => setActive(i)}
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => choose(r)}
                          >
                            <span className="app-search__glyph" aria-hidden>
                              <g.icon size={15} />
                            </span>
                            <span className="app-search__text">
                              <strong>{highlight(r.title, query)}</strong>
                              <small>{r.sub}</small>
                            </span>
                            <CornerDownLeft
                              size={14}
                              className="app-search__enter"
                              aria-hidden
                            />
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                );
              })}
          </div>
          {showPanel && !pending && !results.length && (
            <div className="app-search__empty" role="status">
              <Sparkles size={16} aria-hidden /> Nothing matches “{value.trim()}
              ”. Try a merchant, a card or a page name.
            </div>
          )}
          {sheet && !value.trim() && (
            <p className="app-search__hint">
              Search your charges, free trials, cards and activity.
            </p>
          )}
          {showPanel && results.length > 0 && (
            <p className="app-search__foot" aria-hidden>
              <span>↑↓ to move</span> <span>Enter to open</span>{" "}
              <span>Esc to close</span>
            </p>
          )}
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {showPanel && !pending
            ? `${results.length} ${results.length === 1 ? "result" : "results"}`
            : ""}
        </span>
      </div>
    </>
  );
}
