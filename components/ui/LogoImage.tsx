"use client";
import { useState, type ReactNode } from "react";

/** A merchant logo image that falls back to the tinted initial if it fails. */
export function LogoImage({
  src,
  size,
  className = "",
  fallback,
}: {
  src: string;
  size: number;
  className?: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return fallback;
  return (
    <span
      className={`merchant-logo merchant-logo--image ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external logo CDNs, tiny fixed size */}
      <img
        src={src}
        alt=""
        width={size * 0.62}
        height={size * 0.62}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
