"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PeekCta from "./PeekCta";
import { Menu, X } from "lucide-react";

export default function MobileMenu({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="mobile-menu">
      <button
        type="button"
        className="icon-btn icon-btn--outline"
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <div id="mobile-menu-panel" className="mobile-menu__panel">
          <nav aria-label="Mobile">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
          </nav>
          <PeekCta className="peek--block">
            <Link
              href="/dashboard"
              className="btn btn--primary btn--block btn--pill"
              onClick={() => setOpen(false)}
            >
              Try the demo
            </Link>
          </PeekCta>
        </div>
      )}
    </div>
  );
}
