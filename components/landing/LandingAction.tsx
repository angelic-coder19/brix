"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowRight } from "lucide-react";
import { getClientAuth } from "@/lib/firebase/client";

/** All entry points follow the current Firebase session, including the mobile menu. */
export default function LandingAction({
  className = "",
  arrow = false,
  onClick,
}: {
  className?: string;
  arrow?: boolean;
  onClick?: () => void;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    const auth = getClientAuth();
    if (auth) return onAuthStateChanged(auth, (user) => setSignedIn(!!user));
    const timer = setTimeout(() => setSignedIn(false), 0);
    return () => clearTimeout(timer);
  }, []);
  const label =
    signedIn === null
      ? "Open Brix"
      : signedIn
        ? "Open dashboard"
        : process.env.NEXT_PUBLIC_BRIX_DEMO_MODE === "true"
          ? "Try the demo"
          : "Get started";
  return (
    <Link
      href="/dashboard"
      className={className}
      onClick={onClick}
      data-buddy-mood="happy"
    >
      {label}
      {arrow && <ArrowRight size={18} />}
    </Link>
  );
}
