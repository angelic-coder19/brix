"use client";
import Link from "next/link";
import "./shell.css";
import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import {
  ChevronsUpDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { BrixMark } from "@/components/brand/BrixMark";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  badge?: { value: number; label: string };
};
export type NavGroup = { label: string; items: NavItem[] };

export const SIDEBAR_KEY = "brix.sidebar";

export function initials(name: string, email: string) {
  const source = name.trim() || email.split("@")[0] || "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : source.slice(0, 1);
  return (letters || "Y").toUpperCase();
}

/** Collapsed state, persisted, with `[` and Cmd/Ctrl+B shortcuts. */
export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "collapsed");
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
      } catch {}
      return next;
    });
  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      const mod = (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
      if (
        (mod && e.key.toLowerCase() === "b") ||
        (!typing && !mod && !e.altKey && e.key === "[")
      ) {
        if (typing && !mod) return;
        e.preventDefault();
        toggleRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { collapsed, toggle, drawerOpen, setDrawerOpen };
}

export function AppSidebar({
  view,
  groups,
  collapsed,
  onToggle,
  drawerOpen,
  onCloseDrawer,
  name,
  email,
  demo,
  canSignOut,
  onSignOut,
}: {
  view: string;
  groups: NavGroup[];
  collapsed: boolean;
  onToggle: () => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  name: string;
  email: string;
  demo: boolean;
  canSignOut: boolean;
  onSignOut: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const closeDrawerRef = useRef(onCloseDrawer);
  useEffect(() => {
    closeDrawerRef.current = onCloseDrawer;
  });
  useEffect(() => {
    if (!drawerOpen) return;
    const el = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    const main = document.querySelector<HTMLElement>(".app-main");
    const previousInert = main?.inert ?? false;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (main) main.inert = true;
    const focusable = () =>
      [
        ...(el?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]',
        ) ?? []),
      ].filter((node) => node.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawerRef.current();
      }
      if (event.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !el?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !el?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    const onResize = () => {
      if (window.matchMedia("(min-width: 761px)").matches)
        closeDrawerRef.current();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = previousOverflow;
      if (main) main.inert = previousInert;
      if (opener?.isConnected) opener.focus();
    };
  }, [drawerOpen]);

  const item = (n: NavItem) => {
    const active = view === n.href;
    return (
      <Link
        href={`/${n.href}`}
        key={n.href}
        className={active ? "nav-item is-active" : "nav-item"}
        aria-current={active ? "page" : undefined}
        data-tip={n.label}
        title={collapsed ? n.label : undefined}
        onClick={onCloseDrawer}
      >
        <n.icon size={18} aria-hidden />
        <span className="nav-item__label">{n.label}</span>
        {n.badge && n.badge.value > 0 && (
          <span className="nav-badge">
            <span aria-hidden>{n.badge.value}</span>
            <span className="sr-only">, {n.badge.label}</span>
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {drawerOpen && (
        <div className="sidebar-scrim" onClick={onCloseDrawer} aria-hidden />
      )}
      <aside
        ref={ref}
        id="app-sidebar"
        className="sidebar sidebar--stable"
        aria-label="Brix navigation"
        data-collapsed={collapsed ? "true" : "false"}
        data-drawer={drawerOpen ? "open" : "closed"}
        role={drawerOpen ? "dialog" : undefined}
        aria-modal={drawerOpen ? true : undefined}
      >
        <div className="sidebar-head">
          <Link
            href="/"
            className="wordmark sidebar-brand"
            aria-label="Brix home"
          >
            <span className="sidebar-brand__full">
              <Wordmark />
            </span>
            <span className="sidebar-brand__mark">
              <BrixMark decorative />
            </span>
          </Link>
          <button
            type="button"
            className="icon-btn sidebar-toggle"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-controls="app-sidebar"
            aria-expanded={!collapsed}
            data-tip={collapsed ? "Expand  [" : "Collapse  ["}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={onCloseDrawer}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {groups.map((g) => (
            <div
              className="nav-group"
              key={g.label}
              role="group"
              aria-label={g.label}
            >
              <span className="nav-group__label" aria-hidden>
                {g.label}
              </span>
              {g.items.map(item)}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-trust">
            <ShieldCheck size={16} aria-hidden />
            <p>
              <strong>Read-only banking.</strong> Brix spots charges and helps
              you plan. You finish cancellations with the merchant.
            </p>
          </div>
          <AccountMenu
            name={name}
            email={email}
            demo={demo}
            canSignOut={canSignOut}
            onSignOut={onSignOut}
            onNavigate={onCloseDrawer}
          />
        </div>
      </aside>
    </>
  );
}

function AccountMenu({
  name,
  email,
  demo,
  canSignOut,
  onSignOut,
  onNavigate,
}: {
  name: string;
  email: string;
  demo: boolean;
  canSignOut: boolean;
  onSignOut: () => void;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const secondary = demo ? "Demo account" : email || "Personal account";
  const display = name || (demo ? "Demo user" : email.split("@")[0]) || "You";

  const close = (refocus = true) => {
    setOpen(false);
    setConfirming(false);
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  useEffect(() => {
    if (confirming)
      menu.current
        ?.querySelector<HTMLElement>(".account-confirm button")
        ?.focus();
  }, [confirming]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      setConfirming(false);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = [
      ...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []),
    ];
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    items[next].focus();
  };

  return (
    <div className="account" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        data-tip={display}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="avatar" aria-hidden>
          {initials(name, email)}
        </span>
        <span className="account-trigger__text">
          <span className="sr-only">Account: </span>
          <strong>{display}</strong>
          <small>{secondary}</small>
        </span>
        <ChevronsUpDown
          size={16}
          className="account-trigger__icon"
          aria-hidden
        />
      </button>
      {open && (
        <div
          ref={menu}
          id={id}
          className="account-menu"
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
        >
          <div className="account-menu__who" aria-hidden>
            <strong>{display}</strong>
            <small>{email || secondary}</small>
          </div>
          <Link
            href="/settings"
            role="menuitem"
            className="account-menu__item"
            onClick={() => {
              close(false);
              onNavigate();
            }}
          >
            <Settings size={16} aria-hidden /> Settings
          </Link>
          <Link
            href="/onboarding"
            role="menuitem"
            className="account-menu__item"
            onClick={() => {
              close(false);
              onNavigate();
            }}
          >
            <Rocket size={16} aria-hidden /> Setup guide
          </Link>
          <div className="account-menu__sep" role="separator" />
          {canSignOut ? (
            confirming ? (
              <div
                className="account-confirm"
                role="group"
                aria-label="Log out of Brix?"
              >
                <span>Log out of Brix? Your data stays saved.</span>
                <div>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => setConfirming(false)}
                  >
                    Stay
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--primary"
                    onClick={() => {
                      close(false);
                      onSignOut();
                    }}
                  >
                    Log out
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="account-menu__item"
                onClick={() => setConfirming(true)}
              >
                <LogOut size={16} aria-hidden /> Log out
              </button>
            )
          ) : (
            <p className="account-menu__note">
              {demo
                ? "Demo account. No sign-in, nothing to log out of."
                : "You’re not signed in."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
