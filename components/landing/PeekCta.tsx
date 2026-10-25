import type { ReactNode } from "react";
import { BrixMark } from "@/components/brand/BrixMark";

/**
 * Wraps a call to action. On hover or keyboard focus a small Brix pops up
 * from behind the button's top edge. Under reduced motion it doesn't move.
 */
export default function PeekCta({
  children,
  size = "md",
  className = "",
}: {
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span className={`peek peek--${size} ${className}`.trim()}>
      <span className="peek__brix" aria-hidden="true">
        <BrixMark mood="celebrate" decorative />
      </span>
      {children}
    </span>
  );
}
