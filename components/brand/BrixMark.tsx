// The one Brix mark: the tilted block with a face. Favicon, app icons, the
// share image and every in-page logo are rendered from this component
// (see scripts/build-icons.tsx), so they can't drift apart.

export const MARK_COLORS = {
  body: "#c8462a",
  edge: "#a9321d",
  eye: "#292920",
  mouth: "#532819",
  tile: "#f7f5ef",
} as const;

type Props = {
  /** Draw the cream rounded tile behind the mark (app icons). */
  tile?: boolean;
  className?: string;
  size?: number | string;
  title?: string;
};

export function BrixMark({ tile = false, className, size, title }: Props) {
  const c = MARK_COLORS;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={tile ? "0 0 64 64" : "8 10 48 44"}
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {tile && <rect width="64" height="64" rx="14" fill={c.tile} />}
      <g transform="rotate(-9 32 32)">
        <rect x="12" y="16" width="40" height="32" rx="9" fill={c.body} />
        <rect
          x="12"
          y="16"
          width="40"
          height="32"
          rx="9"
          fill="none"
          stroke={c.edge}
          strokeWidth="3"
          strokeDasharray="0 40 72"
        />
        <ellipse cx="25" cy="30" rx="3" ry="4" fill={c.eye} />
        <ellipse cx="39" cy="30" rx="3" ry="4" fill={c.eye} />
        <path
          d="M28 37q4 4 8 0"
          stroke={c.mouth}
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
