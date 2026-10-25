import type { ReactNode } from "react";
import { BrixMark } from "@/components/brand/BrixMark";

/**
 * Wraps a primary call to action. On hover or keyboard focus a small Brix
 * pops up from behind the button's top edge, grinning. Under reduced motion it
 * doesn't move; the hero Brix just changes expression.
 */
export default function PeekCta({ children }: { children: ReactNode }) {
  return (
    <span className="peek">
      <span className="peek__brix" aria-hidden="true">
        <BrixMark mood="celebrate" decorative />
      </span>
      {children}
    </span>
  );
}
