"use client";
import { useEffect, useState } from "react";

const NOTICES = [
  { title: "Spotify renews Friday", body: "$11.99 from checking. Reply “remind” or “cancel”." },
  { title: "Notion trial ends in 2 days", body: "Then $10.00/mo. Keep it or cancel?" },
  { title: "Netflix marked to cancel", body: "Finish on netflix.com to skip $15.49." },
];

/** A lock-screen style notification that rotates through real Brix messages. */
export default function HeroNotice() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % NOTICES.length), 4200);
    return () => clearInterval(id);
  }, []);
  const n = NOTICES[i];
  return (
    <div className="hero__notice" data-buddy-mood="concerned" aria-hidden="true">
      <div className="hero__notice-inner" key={i}>
        <span className="hero__notice-app">
          <span className="brand-block" /> Brix
          <time>now</time>
        </span>
        <strong>{n.title}</strong>
        <span>{n.body}</span>
      </div>
    </div>
  );
}
