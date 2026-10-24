import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  MessageCircle,
  PhoneCall,
  Landmark,
  BellRing,
  MousePointer2,
} from "lucide-react";
import BrixBuddy from "@/components/brix/BrixBuddy";
export default function Home() {
  return (
    <main className="landing">
      <nav className="marketing-nav">
        <Link href="/" className="wordmark">
          <span className="brand-block" />
          brix<span className="brand-period">.</span>
        </Link>
        <div className="marketing-links">
          <a href="#how-it-works">How it works</a>
          <a href="#anywhere">Made for your life</a>
        </div>
        <Link href="/dashboard" className="button">
          Meet your Brix <ArrowUpRight size={17} />
        </Link>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">SMALL CHARGES. BIG FEELINGS.</span>
          <h1>
            Keep your money.
            <br />
            <em>Lose the surprises.</em>
          </h1>
          <p>
            Free trials. Forgotten subscriptions. Brix catches the little
            charges before they become a big deal.
          </p>
          <Link className="button primary" href="/dashboard">
            Let’s build better habits <ArrowRight size={19} />
          </Link>
        </div>
        <div className="hero-art">
          <div className="hero-orbit" />
          <BrixBuddy />
          <div className="hero-note">
            <BellRing size={21} />
            <div>
              <strong>A little heads-up.</strong>
              <span>Your next charge deserves a choice.</span>
            </div>
          </div>
        </div>
      </section>
      <div className="trust-line">
        <ShieldCheck size={19} />
        <span>Your bank is read-only. Your decisions are always yours.</span>
        <span className="trust-small">Built for student life</span>
      </div>
      <section id="how-it-works" className="how-section">
        <div className="section-intro">
          <h2>
            A little more aware.
            <br />A lot more in control.
          </h2>
          <p>
            No spreadsheets. No financial jargon. Just a friendly heads-up when
            it matters.
          </p>
        </div>
        <div className="steps">
          <article>
            <Landmark />
            <span>01 / CONNECT</span>
            <h3>Give Brix a look.</h3>
            <p>
              Link your bank securely. Brix spots your recurring charges, with
              read-only access.
            </p>
          </article>
          <article>
            <BellRing />
            <span>02 / GET A HEADS-UP</span>
            <h3>Before the “oh, no.”</h3>
            <p>
              See what’s coming and add free trials before they turn into
              subscriptions.
            </p>
          </article>
          <article>
            <MousePointer2 />
            <span>03 / MAKE YOUR CALL</span>
            <h3>You’re in charge.</h3>
            <p>
              Set a reminder or find the cancellation link. Every action starts
              with your say-so.
            </p>
          </article>
        </div>
      </section>
      <section className="channels-section" id="anywhere">
        <div>
          <h2>
            Same buddy.
            <br />
            Wherever you are.
          </h2>
          <p>
            Check in on the web, send a WhatsApp message, or have a quick call.
          </p>
          <Link href="/connect" className="text-link">
            Find your connection <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="channel-list">
          <div>
            <MessageCircle />
            <span>“What’s coming up this week?”</span>
            <small>WhatsApp</small>
          </div>
          <div>
            <PhoneCall />
            <span>“Remind me before my trial ends.”</span>
            <small>Phone call</small>
          </div>
        </div>
      </section>
      <footer className="marketing-footer">
        <Link href="/" className="wordmark">
          brix.
        </Link>
        <span>Your money, brick by brick.</span>
        <span>Made at HackPSU · 2026</span>
      </footer>
    </main>
  );
}
