import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  CreditCard,
  Landmark,
  MessageCircle,
  MousePointerClick,
  PhoneCall,
  Plus,
  Radar,
  Scissors,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Globe,
} from "lucide-react";
import BrixBuddy from "@/components/brix/BrixBuddy";
import BotDemo from "@/components/landing/BotDemo";
import Counter from "@/components/landing/Counter";
import HeroBuddy from "@/components/landing/HeroBuddy";
import MobileMenu from "@/components/landing/MobileMenu";
import Reveal from "@/components/landing/Reveal";
import TrialCalculator from "@/components/landing/TrialCalculator";
import {
  BarChart,
  CardStack,
  Donut,
  FloatingChip,
  LineChart,
  PhoneMockup,
} from "@/components/landing/Visuals";
import "./landing.css";

const links = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#demo", label: "Live demo" },
  { href: "#faq", label: "FAQ" },
];

const features = [
  {
    icon: Radar,
    title: "Finds what repeats",
    text: "Link a bank with Plaid (read-only) and Brix spots subscriptions and recurring charges for you.",
  },
  {
    icon: CalendarClock,
    title: "Trial radar",
    text: "Add a free trial in seconds. Brix keeps the end date in view so it never quietly turns into a bill.",
  },
  {
    icon: BellRing,
    title: "Heads-ups that land",
    text: "Reminders 7 days and 2 days before a charge, in the app or on WhatsApp if you opt in.",
  },
  {
    icon: Scissors,
    title: "Mark to cancel",
    text: "Flag a charge and get the merchant’s cancel link. You make the final call on their site.",
  },
  {
    icon: CreditCard,
    title: "One-time cards",
    text: "Spin up a single-use sandbox card with a hard limit for that next trial you want to try.",
  },
  {
    icon: MessageCircle,
    title: "Talk anywhere",
    text: "Ask on the web, text on WhatsApp, or call. Same buddy, same memory, every channel.",
  },
];

const steps = [
  {
    icon: Landmark,
    title: "Give Brix a look",
    text: "Connect a bank securely through Plaid. Access is read-only, always.",
  },
  {
    icon: BellRing,
    title: "Get a heads-up",
    text: "See the next 14 days at a glance and add trials before they bill.",
  },
  {
    icon: MousePointerClick,
    title: "Make your call",
    text: "Set a reminder or mark to cancel. Brix asks for your yes first.",
  },
  {
    icon: PhoneCall,
    title: "Ask from anywhere",
    text: "Keep the conversation going on WhatsApp or with a quick call.",
  },
];

const faqs = [
  {
    q: "Can Brix move my money?",
    a: "No. Brix connects with read-only access through Plaid. It can read recurring charges, but it can’t pay, transfer, or cancel anything on its own.",
  },
  {
    q: "Does Brix cancel subscriptions for me?",
    a: "Brix flags a charge as “marked to cancel” and gives you the merchant’s cancellation link. You finish the cancellation on the merchant’s site, so nothing happens without you.",
  },
  {
    q: "Why does Brix ask me to confirm everything?",
    a: "Every action is saved as a proposal first, then waits for a separate yes from you. Voice requests for cards also need your PIN in the app.",
  },
  {
    q: "Are the one-time cards real?",
    a: "They are sandbox cards for this prototype, so they can’t spend real money. They show how a single-use card with a hard limit keeps a trial from surprising you.",
  },
  {
    q: "How do WhatsApp and phone reminders work?",
    a: "Verify your phone, join the WhatsApp sandbox, and switch on the channels you want in Settings. You can turn them off any time.",
  },
  {
    q: "Can I delete my data?",
    a: "Yes. Settings lets you disconnect your bank or delete your Brix data entirely, whenever you want.",
  },
];

const builtWith = ["Plaid", "Twilio", "Vapi", "Firebase", "Anthropic", "Next.js"];

export default function Home() {
  return (
    <div className="landing">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="lp-nav">
        <div className="container lp-nav__inner">
          <Link href="/" className="wordmark" aria-label="Brix home">
            <span className="brand-block" />
            brix<span className="brand-period">.</span>
          </Link>
          <nav className="lp-nav__links" aria-label="Main">
            {links.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="lp-nav__actions">
            <Link href="/dashboard" className="lp-nav__signin">
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="btn btn--dark btn--pill lp-nav__cta"
              data-buddy-mood="happy"
            >
              Try the demo <ArrowUpRight size={16} />
            </Link>
            <MobileMenu links={links} />
          </div>
        </div>
      </header>

      <main id="main">
        <section className="hero container">
          <div className="hero__copy">
            <a href="#channels" className="pill-new">
              <span className="badge badge--solid">New</span>
              Talk to Brix on WhatsApp or by phone
              <ArrowRight size={15} />
            </a>
            <h1>
              Keep your money.{" "}
              <span className="serif hero__accent">Lose the surprises.</span>
            </h1>
            <p className="hero__lead">
              Free trials. Forgotten subscriptions. Brix is the friendly money
              buddy that catches the little charges before they become a big
              deal, and never moves a cent on its own.
            </p>
            <div className="hero__ctas">
              <Link
                href="/dashboard"
                className="btn btn--primary btn--lg btn--pill"
                data-buddy-mood="happy"
              >
                Try the live demo <ArrowRight size={18} />
              </Link>
              <a href="#how" className="btn btn--lg btn--pill">
                See how it works
              </a>
            </div>
            <div className="proof">
              <div className="proof__avatars" aria-hidden="true">
                <span style={{ background: "#f5e6dd", color: "#a9321d" }}>M</span>
                <span style={{ background: "#edf1e7", color: "#43705a" }}>J</span>
                <span style={{ background: "#f3ecd8", color: "#80662e" }}>A</span>
                <span style={{ background: "#e0e9f1", color: "#40648a" }}>
                  <Plus size={14} />
                </span>
              </div>
              <p>
                <strong>Made by students, for students</strong>
                <br />
                HackPSU Fall 2026 · FNB Challenge entry
              </p>
            </div>
          </div>
          <div className="hero__visual">
            <div className="hero__orbit" aria-hidden="true" />
            <PhoneMockup />
            <div className="hero__buddy">
              <HeroBuddy />
            </div>
            <FloatingChip
              icon="bell"
              title="Spotify renews in 2 days"
              sub="$11.99 · tap to set a reminder"
              className="hero__chip hero__chip--a"
              mood="concerned"
            />
            <FloatingChip
              icon="check"
              title="Notion AI trial flagged"
              sub="Ends Nov 5 · you’re covered"
              className="hero__chip hero__chip--b"
              mood="celebrate"
            />
            <FloatingChip
              icon="shield"
              title="Read-only bank access"
              className="hero__chip hero__chip--c"
              mood="happy"
            />
          </div>
        </section>

        <section className="built container" aria-label="Built with">
          <span>Built with</span>
          <ul>
            {builtWith.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        <section className="stats container" data-reveal aria-label="Brix by the numbers">
          <div>
            <strong>
              <Counter value={0} prefix="$" />
            </strong>
            <span>Money Brix can move. Ever.</span>
          </div>
          <div>
            <strong>
              <Counter value={14} />
            </strong>
            <span>Days of look-ahead on every charge</span>
          </div>
          <div>
            <strong>
              <Counter value={2} />
            </strong>
            <span>Heads-ups per charge, at 7 and 2 days out</span>
          </div>
          <div>
            <strong>
              <Counter value={3} />
            </strong>
            <span>Ways to reach Brix: web, WhatsApp, voice</span>
          </div>
        </section>

        <section id="features" className="section container" data-reveal>
          <div className="section-head section-head--center">
            <span className="eyebrow">What Brix does</span>
            <h2>Everything you need to stay ahead of the little charges.</h2>
            <p>
              No spreadsheets. No financial jargon. Just a friendly heads-up
              when it matters.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((f) => (
              <article className="feature card" key={f.title}>
                <span className="feature__icon">
                  <f.icon size={22} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="night" aria-labelledby="night-title">
          <div className="container">
            <div className="night__head" data-reveal>
              <div>
                <span className="eyebrow night__eyebrow">Safe by design</span>
                <h2 id="night-title">
                  Try anything.{" "}
                  <span className="serif">Get charged for nothing</span> you
                  didn’t choose.
                </h2>
              </div>
              <p>
                Single-use cards with a hard limit, reminders before every
                renewal, and a buddy that always asks first. Your bank stays
                read-only the whole time.
              </p>
            </div>
            <div className="night__stage" data-reveal>
              <div className="night__rings" aria-hidden="true" />
              <div className="night__chips night__chips--left" aria-hidden="true">
                <span className="action-chip">
                  <BellRing size={16} /> Remind me
                </span>
                <span className="action-chip action-chip--accent">
                  <Scissors size={16} /> Mark to cancel
                </span>
              </div>
              <CardStack />
              <div className="night__chips night__chips--right" aria-hidden="true">
                <span className="action-chip">
                  <Snowflake size={16} /> Closes after one use
                </span>
                <span className="action-chip">
                  <ShieldCheck size={16} /> $10 hard limit
                </span>
              </div>
            </div>
            <p className="night__note">Sandbox cards in this prototype. No real money.</p>
          </div>
        </section>

        <section className="section container" aria-labelledby="bento-title">
          <div className="section-head" data-reveal>
            <span className="eyebrow">At a glance</span>
            <h2 id="bento-title">Your money, brick by brick.</h2>
            <p>The dashboard turns scattered charges into a calm, clear picture.</p>
          </div>
          <div className="bento" data-reveal>
            <article className="bento__item bento__item--wide card">
              <div className="bento__text">
                <h3>Recurring spend, month by month</h3>
                <p>See what repeats and watch it shrink as you trim.</p>
              </div>
              <BarChart />
            </article>
            <article className="bento__item card card--accent">
              <div className="bento__text">
                <h3>Charges you avoided</h3>
                <p>Estimated from what you marked to cancel.</p>
              </div>
              <LineChart />
            </article>
            <article className="bento__item card card--green">
              <div className="bento__text">
                <h3>Subscriptions vs trials</h3>
                <p>
                  <span className="legend legend--a" /> Subscriptions{" "}
                  <span className="legend legend--b" /> Trials
                </p>
              </div>
              <Donut />
            </article>
            <article className="bento__item bento__item--photo card">
              <Image
                src="/images/card-and-phone.webp"
                alt="A student smiling at her phone in a sunny campus cafe"
                fill
                sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 400px"
                className="bento__img"
              />
              <div className="bento__caption">
                <Sparkles size={16} /> “Spotify renews Friday. Want a reminder?”
              </div>
            </article>
            <article className="bento__item card bento__upcoming">
              <h3>This week</h3>
              <ul>
                <li>
                  <span className="merchant-icon" data-tone="1">S</span>
                  Spotify <b>$11.99</b>
                </li>
                <li>
                  <span className="merchant-icon" data-tone="0">N</span>
                  Netflix <b>$15.49</b>
                </li>
                <li>
                  <span className="merchant-icon" data-tone="5">N</span>
                  Notion AI trial <b>$10.00</b>
                </li>
              </ul>
            </article>
          </div>
          <p className="sample-note">Charts and amounts above are sample data.</p>
        </section>

        <section id="demo" className="section demo" aria-labelledby="demo-title">
          <div className="container demo__grid">
            <div className="demo__copy" data-reveal>
              <span className="eyebrow">Live demo</span>
              <h2 id="demo-title">Meet your Brix. It reacts like a real buddy.</h2>
              <p>
                Brix listens while you type, thinks while it checks your
                charges, and cheers when you dodge one. React to its messages
                with a tapback and it reacts right back.
              </p>
              <ul className="ticks">
                <li>
                  <ShieldCheck size={18} /> Always asks before acting
                </li>
                <li>
                  <BellRing size={18} /> Gets concerned when a charge is close
                </li>
                <li>
                  <Sparkles size={18} /> Celebrates every charge you skip
                </li>
              </ul>
              <Link href="/dashboard" className="btn btn--primary btn--pill">
                Open the full demo <ArrowRight size={17} />
              </Link>
            </div>
            <div data-reveal>
              <BotDemo />
            </div>
          </div>
        </section>

        <section className="section container calc-section" aria-labelledby="calc-title">
          <div className="section-head" data-reveal>
            <span className="eyebrow">Do the math</span>
            <h2 id="calc-title">What do forgotten free trials really cost?</h2>
            <p>
              Slide to match your habits. Small charges add up faster than you
              think.
            </p>
          </div>
          <div data-reveal>
            <TrialCalculator />
          </div>
        </section>

        <section id="how" className="section container how" aria-labelledby="how-title">
          <div className="how__media" data-reveal>
            <Image
              src="/images/laptop-window.webp"
              alt="A tidy desk with a laptop, a planner, and a phone showing a reminder"
              width={1152}
              height={864}
              sizes="(max-width: 900px) 100vw, 520px"
              className="how__img"
            />
            <FloatingChip
              icon="bell"
              title="Heads-up: Adobe in 7 days"
              sub="Sent in the app"
              className="how__chip"
            />
          </div>
          <div data-reveal>
            <span className="eyebrow">How it works</span>
            <h2 id="how-title">
              A little more aware. <span className="serif">A lot more in control.</span>
            </h2>
            <ol className="steps">
              {steps.map((s, i) => (
                <li key={s.title}>
                  <span className="steps__num">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>
                      <s.icon size={18} /> {s.title}
                    </h3>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="channels" className="section container channels" aria-labelledby="channels-title">
          <div className="channels__photo" data-reveal>
            <Image
              src="/images/friends-cafe.webp"
              alt="Three friends laughing as they walk across an autumn campus"
              fill
              sizes="(max-width: 900px) 100vw, 1200px"
              className="channels__img"
            />
            <div className="channels__overlay">
              <span className="eyebrow night__eyebrow">Made for your life</span>
              <h2 id="channels-title">Same buddy. Wherever you are.</h2>
            </div>
          </div>
          <div className="channels__grid" data-reveal>
            <article className="card card--pad">
              <Globe size={22} />
              <h3>On the web</h3>
              <p>“What’s coming up this week?”</p>
            </article>
            <article className="card card--pad">
              <MessageCircle size={22} />
              <h3>On WhatsApp</h3>
              <p>“Remind me before my trial ends.”</p>
            </article>
            <article className="card card--pad">
              <PhoneCall size={22} />
              <h3>On a call</h3>
              <p>“Mark Netflix to cancel.”</p>
            </article>
          </div>
        </section>

        <section id="faq" className="section container faq" aria-labelledby="faq-title">
          <div className="section-head" data-reveal>
            <span className="eyebrow">FAQ</span>
            <h2 id="faq-title">Good questions, honest answers.</h2>
            <p>
              Still curious? <Link href="/dashboard" className="text-link">Try the demo</Link> and ask Brix yourself.
            </p>
          </div>
          <div className="faq__list" data-reveal>
            {faqs.map((f, i) => (
              <details key={f.q} name="faq" open={i === 0}>
                <summary>
                  {f.q}
                  <Plus size={18} className="faq__icon" aria-hidden />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="container" aria-labelledby="cta-title">
          <div className="final-cta" data-reveal>
            <div className="final-cta__buddy" aria-hidden="true">
              <BrixBuddy mood="happy" scale={0.55} decorative />
            </div>
            <div className="final-cta__buddy final-cta__buddy--left" aria-hidden="true">
              <BrixBuddy mood="listening" scale={0.42} decorative follow={false} />
            </div>
            <div className="final-cta__inner">
              <h2 id="cta-title">
                Ready to meet <span className="serif">your Brix?</span>
              </h2>
              <p>Explore the sandbox with sample charges. No sign-up, no real money.</p>
              <div className="hero__ctas">
                <Link href="/dashboard" className="btn btn--dark btn--lg btn--pill">
                  Try the live demo <ArrowRight size={18} />
                </Link>
                <a href="#features" className="btn btn--lg btn--pill">
                  Explore features
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="container lp-footer__grid">
          <div className="lp-footer__brand">
            <Link href="/" className="wordmark">
              <span className="brand-block" />
              brix<span className="brand-period">.</span>
            </Link>
            <p>Your money, brick by brick. A friendly assistant for college students.</p>
            <span className="badge badge--green">
              <ShieldCheck size={14} /> Read-only. Never moves money.
            </span>
          </div>
          <nav aria-label="Product">
            <h3>Product</h3>
            <Link href="/dashboard">Overview</Link>
            <Link href="/subscriptions">Your charges</Link>
            <Link href="/cards">One-time cards</Link>
            <Link href="/connect">Connections</Link>
          </nav>
          <nav aria-label="Learn">
            <h3>Learn</h3>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#demo">Live demo</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div>
            <h3>Project</h3>
            <p>Made at HackPSU Fall 2026 for the FNB Challenge.</p>
            <p>Built with {builtWith.join(", ")}.</p>
          </div>
        </div>
        <div className="container lp-footer__bottom">
          <span>© 2026 Brix. Not a bank. Brix never moves your money.</span>
          <span>Sample data on this page is for illustration only.</span>
        </div>
      </footer>
      <Reveal />
    </div>
  );
}
