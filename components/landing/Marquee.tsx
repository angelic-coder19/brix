import type { ReactNode } from "react";

/** Seamless loop: the list renders twice and slides by exactly one copy. */
export default function Marquee({
  items,
  label,
}: {
  items: { key: string; node: ReactNode }[];
  label: string;
}) {
  return (
    <div className="marquee" role="region" aria-label={label}>
      <div className="marquee__track">
        <ul className="marquee__list">
          {items.map((i) => (
            <li key={i.key}>{i.node}</li>
          ))}
        </ul>
        <ul className="marquee__list" aria-hidden="true">
          {items.map((i) => (
            <li key={i.key}>{i.node}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
