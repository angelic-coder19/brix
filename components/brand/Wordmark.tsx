import type { BuddyMood } from "@/lib/agent/persona";
import { BrixMark } from "./BrixMark";

/**
 * The Brix wordmark: the mark, then "brix." with the i and the period in the
 * accent colour. Every place the name appears as a logo uses this.
 */
export function Wordmark({ mood }: { mood?: BuddyMood }) {
  return (
    <>
      <BrixMark className="brand-mark" mood={mood} decorative={!!mood} />
      <span className="wordmark__text">
        br<span className="brand-i">i</span>x
        <span className="brand-period">.</span>
      </span>
    </>
  );
}
