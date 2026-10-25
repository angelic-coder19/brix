"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { VirtualCard } from "./brand/VirtualCard";

const designs = ["Graphite", "Clay", "Cobalt"];
export function CardShowcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      if (!motion.matches && !paused && !interacting)
        timer = setInterval(
          () => setIndex((i) => (i + 1) % designs.length),
          3000,
        );
    };
    start();
    motion.addEventListener("change", start);
    return () => {
      clearInterval(timer);
      motion.removeEventListener("change", start);
    };
  }, [paused, interacting]);
  return (
    <section
      className="card card-showcase"
      aria-label="Explore Brix card designs"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setInteracting(false);
      }}
    >
      <div className="card-showcase__heading">
        <h2>Your next Brix card</h2>
        <Link className="btn btn--primary btn--sm" href="/cards">
          Create now <ArrowUpRight size={15} />
        </Link>
        <button
          type="button"
          className="icon-btn"
          aria-label={paused ? "Play card slideshow" : "Pause card slideshow"}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>
      <div className="card-showcase__window">
        <div
          key={index}
          className={`card-showcase__slide card-showcase--${index}`}
        >
          <VirtualCard
            purpose={designs[index]}
            last4="0000"
            limit={25}
            expiry={null}
            note="Design preview · sandbox"
            tilt={false}
          />
        </div>
      </div>
      <div className="card-showcase__footer">
        <div className="card-showcase__choices" aria-label="Card design">
          {designs.map((name, i) => (
            <button
              type="button"
              key={name}
              aria-label={`${name} design`}
              aria-pressed={i === index}
              className={`swatch swatch--${i}`}
              onClick={() => {
                setIndex(i);
                setPaused(true);
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
