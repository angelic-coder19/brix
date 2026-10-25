// The one Brix mark: the tilted block with a face. Favicon, app icons, the
// share image and every in-page logo are rendered from this component
// (see scripts/build-icons.tsx), so they can't drift apart.
//
// Without a mood it is the neutral logo. With a mood (the chat launchers) the
// eyes and mouth follow the same BuddyMood values that drive BrixBuddy.
import { MOOD_LABEL, type BuddyMood } from "@/lib/agent/persona";

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
  /** Live face for the launchers. Omit for the neutral logo. */
  mood?: BuddyMood;
  /** Hide from assistive tech (e.g. inside an already-labelled button). */
  decorative?: boolean;
  className?: string;
  size?: number | string;
  title?: string;
};

const c = MARK_COLORS;
const stroke = {
  stroke: c.eye,
  strokeWidth: 2.6,
  fill: "none",
  strokeLinecap: "round",
} as const;
const mouthStroke = { ...stroke, stroke: c.mouth } as const;

function Eyes({ mood }: { mood?: BuddyMood }) {
  switch (mood) {
    case "happy":
    case "celebrate":
      return (
        <g className="brix-mark__eyes">
          <path d="M22 31q3-4.5 6 0" {...stroke} />
          <path d="M36 31q3-4.5 6 0" {...stroke} />
        </g>
      );
    case "listening":
      return (
        <g className="brix-mark__eyes">
          <ellipse cx="25" cy="29.5" rx="3.4" ry="4.6" fill={c.eye} />
          <ellipse cx="39" cy="29.5" rx="3.4" ry="4.6" fill={c.eye} />
        </g>
      );
    case "thinking":
      return (
        <g className="brix-mark__eyes">
          <ellipse cx="26.4" cy="28.4" rx="3" ry="3.8" fill={c.eye} />
          <ellipse cx="40.4" cy="28.4" rx="3" ry="3.8" fill={c.eye} />
        </g>
      );
    case "concerned":
      return (
        <g className="brix-mark__eyes">
          <path d="M21.5 25.6 27.5 23.6" {...stroke} strokeWidth={2.2} />
          <path d="M42.5 25.6 36.5 23.6" {...stroke} strokeWidth={2.2} />
          <ellipse cx="25" cy="30.5" rx="2.8" ry="3.4" fill={c.eye} />
          <ellipse cx="39" cy="30.5" rx="2.8" ry="3.4" fill={c.eye} />
        </g>
      );
    case "error":
      return (
        <g className="brix-mark__eyes">
          <ellipse cx="25" cy="30" rx="3" ry="4" fill={c.eye} />
          <ellipse cx="39" cy="30.5" rx="2" ry="2.5" fill={c.eye} />
        </g>
      );
    default:
      return (
        <g className="brix-mark__eyes">
          <ellipse cx="25" cy="30" rx="3" ry="4" fill={c.eye} />
          <ellipse cx="39" cy="30" rx="3" ry="4" fill={c.eye} />
        </g>
      );
  }
}

function Mouth({ mood }: { mood?: BuddyMood }) {
  switch (mood) {
    case "listening":
      return (
        <ellipse
          className="brix-mark__mouth"
          cx="32"
          cy="38.4"
          rx="1.9"
          ry="2.1"
          fill={c.mouth}
        />
      );
    case "thinking":
      return (
        <path
          className="brix-mark__mouth"
          d="M30.5 38.4h5.5"
          {...mouthStroke}
        />
      );
    case "talking":
      return (
        <ellipse
          className="brix-mark__mouth"
          cx="32"
          cy="38.2"
          rx="3"
          ry="2.4"
          fill={c.mouth}
        />
      );
    case "happy":
      return (
        <path
          className="brix-mark__mouth"
          d="M27 36q5 6 10 0"
          {...mouthStroke}
        />
      );
    case "celebrate":
      return (
        <path
          className="brix-mark__mouth"
          d="M26.5 35.4h11q-.8 7-5.5 7t-5.5-7z"
          fill={c.mouth}
        />
      );
    case "concerned":
      return (
        <path
          className="brix-mark__mouth"
          d="M28.5 40q3.5-3 7 0"
          {...mouthStroke}
        />
      );
    case "error":
      return (
        <path
          className="brix-mark__mouth"
          d="M27 38.6q1.5-2 3 0t3 0t3 0"
          {...mouthStroke}
          strokeWidth={2.2}
        />
      );
    default:
      return (
        <path
          className="brix-mark__mouth"
          d="M28 37q4 4 8 0"
          {...mouthStroke}
        />
      );
  }
}

export function BrixMark({
  tile = false,
  mood,
  decorative = false,
  className,
  size,
  title,
}: Props) {
  const live = mood !== undefined;
  const label = decorative
    ? undefined
    : (title ?? (live ? `Brix, ${MOOD_LABEL[mood]}` : undefined));
  const classes = [className, live && `brix-mark brix-mark--${mood}`]
    .filter(Boolean)
    .join(" ");
  const face = (
    <>
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
      {live ? (
        <>
          <Eyes mood={mood} />
          <Mouth mood={mood} />
        </>
      ) : (
        <>
          <ellipse cx="25" cy="30" rx="3" ry="4" fill={c.eye} />
          <ellipse cx="39" cy="30" rx="3" ry="4" fill={c.eye} />
          <path
            d="M28 37q4 4 8 0"
            stroke={c.mouth}
            strokeWidth="2.6"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}
    </>
  );
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={tile ? "0 0 64 64" : "8 10 48 44"}
      width={size}
      height={size}
      className={classes || undefined}
      data-mood={mood}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {tile && <rect width="64" height="64" rx="14" fill={c.tile} />}
      <g transform="rotate(-9 32 32)">
        {live ? <g className="brix-mark__body">{face}</g> : face}
      </g>
    </svg>
  );
}
