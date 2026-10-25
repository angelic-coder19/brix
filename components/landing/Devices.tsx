import Image from "next/image";
import { PhoneOff } from "lucide-react";
import { BrixMark } from "@/components/brand/BrixMark";

function StatusBar({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <div
      className={`device-phone__status device-phone__status--${tone}`}
      aria-hidden="true"
    >
      <span className="device-phone__time" data-time="9:41" />
      <span className="device-phone__icons">
        <svg viewBox="0 0 18 12" width="17" height="11">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
          <rect x="10" y="3" width="3" height="9" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg viewBox="0 0 16 12" width="15" height="11">
          <path d="M8 2.6c2.3 0 4.4.9 6 2.4l1.3-1.4A10.4 10.4 0 0 0 8 .6C5.2.6 2.6 1.7.7 3.6L2 5c1.6-1.5 3.7-2.4 6-2.4Zm0 4c1.2 0 2.3.5 3.2 1.2l1.3-1.4A6.6 6.6 0 0 0 8 4.6c-1.7 0-3.3.7-4.5 1.8l1.3 1.4C5.7 7.1 6.8 6.6 8 6.6Zm0 4.8 2-2.1a2.9 2.9 0 0 0-4 0l2 2.1Z" />
        </svg>
        <svg viewBox="0 0 27 12" width="25" height="11">
          <rect
            x="0.5"
            y="0.5"
            width="22"
            height="11"
            rx="3.2"
            fill="none"
            stroke="currentColor"
            opacity=".4"
          />
          <rect x="2" y="2" width="17" height="8" rx="2" />
          <path d="M24 4v4c.8-.3 1.4-1.1 1.4-2S24.8 4.3 24 4Z" opacity=".45" />
        </svg>
      </span>
    </div>
  );
}

/**
 * A modern phone at true proportions: a 393×852 screen (19.5:9) inside a thin
 * bezel, with the island and status bar drawn over a full-screen 3x capture.
 * Every measurement is in container units, so it scales without distorting.
 */
export function Phone({
  src,
  alt,
  sizes = "(max-width: 640px) 70vw, 320px",
  preload = false,
  className = "",
}: {
  src: string;
  alt: string;
  sizes?: string;
  preload?: boolean;
  className?: string;
}) {
  return (
    <figure className={`device-phone ${className}`}>
      <div className="device-phone__frame">
        <div className="device-phone__screen">
          <Image
            src={src}
            alt={alt}
            width={1179}
            height={2556}
            sizes={sizes}
            preload={preload}
            loading={preload ? "eager" : "lazy"}
          />
          <StatusBar />
          <span className="device-phone__island" aria-hidden="true" />
          <span className="device-phone__home" aria-hidden="true" />
        </div>
      </div>
    </figure>
  );
}

/** A plain browser window around a desktop screenshot. */
export function Browser({
  src,
  alt,
  url,
  sizes = "(max-width: 900px) 100vw, 720px",
  className = "",
}: {
  src: string;
  alt: string;
  url: string;
  sizes?: string;
  className?: string;
}) {
  return (
    <figure className={`device-browser ${className}`}>
      <div className="device-browser__bar" aria-hidden="true">
        <span className="device-browser__lights">
          <i />
          <i />
          <i />
        </span>
        <span className="device-browser__url">{url}</span>
      </div>
      <Image src={src} alt={alt} width={1680} height={1050} sizes={sizes} />
    </figure>
  );
}

/** "+18703958999" → "+1 (870) 395-8999"; other formats are shown as given. */
export function formatUsPhone(e164: string) {
  const m = e164.replace(/[^\d+]/g, "").match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : e164;
}

/** The same phone frame, showing a live call with Brix and its real number. */
export function CallPhone({
  number,
  className = "",
}: {
  number: string;
  className?: string;
}) {
  return (
    <figure
      className={`device-phone device-call ${className}`}
      aria-label={`A phone on a call with Brix at ${number}`}
    >
      <div className="device-phone__frame">
        <div className="device-phone__screen device-call__screen">
          <StatusBar tone="dark" />
          <span className="device-phone__island" aria-hidden="true" />
          <div className="device-call__body">
            <span className="device-call__timer">02:14</span>
            <span className="device-call__face">
              <BrixMark decorative mood="talking" />
            </span>
            <strong className="device-call__name">Brix</strong>
            <span className="device-call__number">{number}</span>
            <p className="device-call__caption">
              “Spotify is marked to cancel. Here’s the link to finish.”
            </p>
            <span className="device-call__keys" aria-hidden="true">
              {["Mute", "Keypad", "Speaker"].map((k) => (
                <span key={k}>
                  <i />
                  {k}
                </span>
              ))}
            </span>
            <span className="device-call__end" aria-hidden="true">
              <PhoneOff />
            </span>
          </div>
          <span className="device-phone__home" aria-hidden="true" />
        </div>
      </div>
    </figure>
  );
}
