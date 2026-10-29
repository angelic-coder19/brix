"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const HEADING_ASIDE_ID = "page-heading-aside";

/** Renders beside the page title, in the slot the workspace heading leaves. */
export function HeadingAside({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const t = setTimeout(
      () => setSlot(document.getElementById(HEADING_ASIDE_ID)),
      0,
    );
    return () => clearTimeout(t);
  }, []);
  return slot ? createPortal(children, slot) : null;
}
