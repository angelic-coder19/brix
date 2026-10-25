import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  PhoneCall,
  Plus,
  ShieldCheck,
} from "lucide-react";
import BrixBuddy from "@/components/brix/BrixBuddy";
import BotDemo from "@/components/landing/BotDemo";
import { Browser, Phone } from "@/components/landing/Devices";
import HeroBuddy from "@/components/landing/HeroBuddy";
import HelpLauncher from "@/components/landing/HelpLauncher";
import HeroNotice from "@/components/landing/HeroNotice";
import LandingHeader from "@/components/landing/LandingHeader";
import GoogleOneTap from "@/components/GoogleOneTap";
import Marquee from "@/components/landing/Marquee";
import CallDemo from "@/components/landing/CallDemo";
import LeavePreview from "@/components/landing/LeavePreview";
import PeekCta from "@/components/landing/PeekCta";
import Scrolly, { type ScrollyStep } from "@/components/landing/Scrolly";
import { VirtualCard } from "@/components/brand/VirtualCard";
import Reveal from "@/components/landing/Reveal";
import TrialCalculator from "@/components/landing/TrialCalculator";
import { CardStack } from "@/components/landing/Visuals";
import { BrandMark } from "@/components/ui/MerchantLogo";
import type { BrandSlug } from "@/lib/brands";
import "./landing.css";
import { Wordmark } from "@/components/brand/Wordmark";

const links = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#demo", label: "Try the bot" },
  { href: "#faq", label: "FAQ" },
  { href: "/developers", label: "Developers" },
];

const tracked: BrandSlug[] = [
  "spotify",
  "netflix",
  "youtube",
  "icloud",
  "duolingo",
  "notion",
  "applemusic",
  "max",
];

const facts = [
  { n: "7 & 2", unit: "days", text: "before a renewal or trial ends, you get a reminder." },
  { n: "14", unit: "days", text: "of upcoming charges on your overview, sorted by date." },
  { n: "$0", unit: "", text: "is what Brix can move. Bank access is read-only." },
  { n: "1", unit: "yes", text: "from you before anything changes. No yes, no action." },
];

const steps = [
  {
    title: "Link a bank, or don’t",
    text: "Connect through Plaid with read-only access, or skip it and add trials by hand.",
  },
  {
    title: "Brix lists what repeats",
    text: "Recurring charges show up with their next date and amount. Trials show their end date.",
  },
  {
    title: "You get a heads-up",
    text: "7 days and 2 days before each charge, in the app, on WhatsApp or by phone.",
  },
  {
    title: "Keep it or drop it",
    text: "Tell Brix to remind you again or mark it to cancel. It asks first, then links you to the merchant’s cancel page.",
  },
];

const faqs = [
  {
    q: "Can Brix move my money?",
    a: "No. Brix connects through Plaid with read-only access. It can see recurring charges, but it can’t pay, transfer, or cancel anything by itself.",
  },
  {
    q: "Does Brix cancel subscriptions for me?",
    a: "It marks the charge as “to cancel” and gives you the merchant’s cancellation page. You finish on the merchant’s site, so nothing is cancelled without you.",
  },
  {
    q: "Why does it keep asking me to confirm?",
    a: "Every action is saved as a proposal and waits for a separate yes. If you send yes twice, it still only runs once. Voice requests for cards also need your PIN.",
  },
  {
    q: "Are the one-time cards real?",
    a: "Not yet. They’re sandbox cards, so they can’t spend money. They show how a single-use card with a limit keeps a trial from rolling into a bill.",
  },
  {
    q: "How do WhatsApp and phone reminders work?",
    a: "Verify your number, join the WhatsApp sandbox, then switch on the channels you want in Settings. Turn them off whenever you like.",
  },
  {
    q: "Can I delete my data?",
    a: "Yes. Settings has a button to disconnect your bank and another to delete your Brix data entirely.",
  },
];

const screens: ScrollyStep[] = [
  {
    id: "list",
    copy: (
      <>
        <span className="row__num">01</span>
        <h3>Every charge that repeats, in one list</h3>
        <p>
          Link a bank and Brix pulls recurring charges from Plaid. Started a trial? Add the name,
          end date and price in three fields. Each line shows when it bills next and what it costs.
        </p>
        <ul className="row__list">
          <li>Monthly total across subscriptions</li>
          <li>Trials tagged with their end date</li>
          <li>Real merchant names, not bank codes</li>
        </ul>
      </>
    ),
    media: (
      <Browser
        src="/screens/dashboard-desktop-1680.webp"
        alt="The Brix overview in a browser, listing a Notion trial ending Oct 28 above Spotify and Netflix renewals"
        url="usebrix.app/dashboard"
        className="row__media"
      />
    ),
  },
  {
    id: "cancel",
    copy: (
      <>
        <span className="row__num">02</span>
        <h3>Cancel by chat, after you say yes</h3>
        <p>
          Tap Cancel on a charge or type “cancel Spotify”. Brix saves it as a proposal and waits.
          Reply yes and it marks the charge, logs it, and hands you the merchant’s cancel link.
          Reply no and nothing changes.
        </p>
        <ul className="row__list">
          <li>Proposals run once, even if you send yes twice</li>
          <li>Brix reacts to your messages, and you can react back</li>
        </ul>
      </>
    ),
    media: (
      <div className="row__media row__phones">
        <Phone
          src="/screens/chat-confirm-mobile-393.webp"
          alt="Brix asks: Mark Spotify ($11.99) to cancel? Reply yes to confirm"
          sizes="(max-width: 640px) 46vw, 260px"
        />
        <Phone
          src="/screens/chat-cancelled-mobile-393.webp"
          alt="After replying yes, Brix confirms Spotify is marked to cancel and links the cancellation page"
          sizes="(max-width: 640px) 46vw, 260px"
        />
      </div>
    ),
  },
  {
    id: "remind",
    copy: (
      <>
        <span className="row__num">03</span>
        <h3>Reminders that reach you</h3>
        <p>
          A week out, then two days out. Brix posts the reminder in the app, and if you opt in,
          texts it on WhatsApp or calls you. Answer with “remind me again” or “cancel”.
        </p>
      </>
    ),
    media: (
      <div className="row__media row__photo">
        <Image
          src="/images/paying-at-home.webp"
          alt="A young woman at home checking her phone with a bank card in her hand"
          width={1600}
          height={900}
          sizes="(max-width: 900px) 100vw, 640px"
        />
        <div className="wa-note" data-buddy-mood="concerned">
          <span className="wa-note__app">
            <BrandMark slug="whatsapp" size={15} />
          </span>
          <div className="wa-note__body">
            <span className="wa-note__meta">
              WhatsApp <span aria-hidden="true">·</span> <span>now</span>
            </span>
            <strong>Brix</strong>
            <p>
              Heads-up: your Notion trial ends in 2 days. After that it’s $10.00/mo. Keep it or
              cancel?
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

export default function Home() {
  return (
    <div className="landing">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <LandingHeader links={links} />
      <GoogleOneTap redirectTo="/dashboard" />

      <main id="main">
        <section className="hero container">
          <div className="hero__copy">
            <h1>
              Catch the charge <span className="accent-text hero__accent">before it catches you.</span>
            </h1>
            <p className="hero__lead">
              Brix tracks your subscriptions and free trials, and reminds you before they bill.
            </p>
            <div className="hero__ctas">
              <PeekCta>
                <Link href="/dashboard" className="btn btn--primary btn--lg" data-buddy-mood="celebrate">
                  Open the demo <ArrowRight size={18} />
                </Link>
              </PeekCta>
              <a href="#how" className="btn btn--lg btn--ghost hero__how">
                How it works
              </a>
            </div>
            <p className="hero__note">
              <ShieldCheck size={16} /> Read-only bank access. Brix never moves money.
            </p>
          </div>
          <div className="hero__visual">
            <Phone
              src="/screens/dashboard-mobile-393.webp"
              alt="The Brix overview on a phone: $62.94 a month in recurring charges, with Spotify, Netflix and Adobe coming up"
              preload
              sizes="(max-width: 640px) 62vw, 300px"
              className="hero__phone hero__phone--main"
            />
            <Phone
              src="/screens/chat-confirm-mobile-393.webp"
              alt="Brix chat asking you to reply yes before it marks Spotify to cancel"
              sizes="(max-width: 640px) 48vw, 250px"
              className="hero__phone hero__phone--side"
            />
            <HeroNotice />
            <div className="hero__buddy">
              <HeroBuddy />
            </div>
          </div>
        </section>

        <section className="tracked container" aria-labelledby="tracked-title">
          <p id="tracked-title">Recognizes the subscriptions you already pay for</p>
          <Marquee
            label="Subscriptions Brix recognizes"
            items={tracked.map((slug) => ({ key: slug, node: <BrandMark slug={slug} size={26} /> }))}
          />
        </section>

        <section className="facts container" aria-label="How Brix works, in numbers">
          <ul className="facts__row" data-reveal data-reveal-stagger>
            {facts.map((f, i) => (
              <li
                key={f.text}
                className={`facts__col facts__col--${i % 2 ? "accent" : "dark"}`}
                data-surface={i % 2 ? "accent" : "dark"}
              >
                <strong>
                  {f.n}
                  {f.unit && <small>{f.unit}</small>}
                </strong>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="product" className="section container" aria-labelledby="product-title">
          <div className="section-head section-head--split" data-reveal>
            <h2 id="product-title">What Brix does, screen by screen.</h2>
            <p>
              These are captures of the demo you can open right now. Same sample account, same
              buttons.
            </p>
          </div>

          <Scrolly steps={screens} />

          <ul className="extras">
            <li className="card extra extra--card" data-reveal>
              <div className="extra__visual extra__visual--card">
                <VirtualCard purpose="Notion AI trial" last4="4242" limit={15} expiry="11/26" />
              </div>
              <div className="extra__copy">
                <h3>One-time cards</h3>
                <p>
                  Make a single-use card with a hard limit for a trial you want to try. If the
                  trial tries to bill more, the card says no. Sandbox only in this build.
                </p>
              </div>
            </li>
            <li className="card extra extra--call" data-reveal>
              <div className="extra__visual extra__visual--call">
                <CallDemo />
              </div>
              <div className="extra__copy">
                <h3>Call it</h3>
                <p>
                  Ring Brix and ask what’s due. Card requests by voice also need your 4-digit PIN
                  in the app.
                </p>
              </div>
            </li>
            <li className="card extra extra--leave" data-reveal>
              <div className="extra__visual extra__visual--leave">
                <LeavePreview />
              </div>
              <div className="extra__copy">
                <h3>Leave whenever you want</h3>
                <p>
                  Settings has two buttons: disconnect your bank, which ends Brix’s read access, or
                  delete your account and everything Brix stored. Each asks once, then it’s done.
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className="night" data-surface="dark" aria-labelledby="night-title">
          <div className="container night__grid">
            <div className="night__copy" data-reveal>
              <h2 id="night-title">Nothing happens without your yes.</h2>
              <p>
                Brix can read and remind. It can’t pay, transfer or cancel on its own. Here’s what
                happens when you ask it to drop a charge:
              </p>
              <ol className="night__flow" data-reveal data-reveal-stagger>
                <li>
                  <span>
                    <b>Brix proposes.</b> “Mark Spotify ($11.99) to cancel?”
                  </span>
                </li>
                <li>
                  <span>
                    <b>You reply yes.</b> Anything else, and nothing changes.
                  </span>
                </li>
                <li>
                  <span>
                    <b>It’s logged.</b> You finish on Spotify’s own cancel page.
                  </span>
                </li>
              </ol>
            </div>
            <div className="night__media" data-reveal>
              <Image
                src="/images/card-and-phone.webp"
                alt="A student holding a bank card and a phone"
                width={1600}
                height={900}
                sizes="(max-width: 900px) 100vw, 560px"
                className="night__photo"
              />
              <CardStack />
            </div>
          </div>
        </section>

        <section id="demo" className="section demo" aria-labelledby="demo-title">
          <div className="container demo__grid">
            <div className="demo__copy" data-reveal>
              <span className="eyebrow">Try the bot</span>
              <h2 id="demo-title">Talk to Brix right here.</h2>
              <p>
                This preview runs on sample data. Ask what’s coming up, or tell it to cancel
                something. Watch its face: it listens while you type, thinks while it checks, and
                cheers when you skip a charge.
              </p>
              <PeekCta>
                <Link href="/dashboard" className="btn btn--primary">
                  Open the full demo <ArrowRight size={17} />
                </Link>
              </PeekCta>
            </div>
            <div data-reveal>
              <BotDemo />
            </div>
          </div>
        </section>

        <section className="section container calc-section" aria-labelledby="calc-title">
          <div className="section-head section-head--split" data-reveal>
            <h2 id="calc-title">What do forgotten trials cost you?</h2>
            <p>Move the sliders to match your semester.</p>
          </div>
          <div data-reveal>
            <TrialCalculator />
          </div>
        </section>

        <section id="how" className="section container how" aria-labelledby="how-title">
          <div className="how__media" data-reveal>
            <Image
              src="/images/laptop-window.webp"
              alt="Someone typing on a laptop at a wooden desk by a window"
              width={1600}
              height={1067}
              sizes="(max-width: 900px) 100vw, 520px"
              className="how__img"
            />
          </div>
          <div data-reveal>
            <span className="eyebrow">How it works</span>
            <h2 id="how-title">Four steps, about two minutes.</h2>
            <ol className="steps" data-reveal data-reveal-stagger>
              {steps.map((s, i) => (
                <li key={s.title}>
                  <span className="steps__num">{i + 1}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="channels" className="section container channels channels--flip" aria-labelledby="channels-title">
          <div className="channels__photo" data-reveal>
            <Image
              src="/images/friends-cafe.webp"
              alt="Four friends at a cafe table laughing at something on a phone"
              fill
              sizes="(max-width: 1240px) 100vw, 1200px"
              className="channels__img"
            />
          </div>
          <div className="channels__body" data-reveal>
            <h2 id="channels-title">Same Brix in every channel.</h2>
            <dl className="channels__list">
              <div>
                <dt>
                  <MessageCircle size={18} /> Web
                </dt>
                <dd>“What’s coming up this week?”</dd>
              </div>
              <div>
                <dt>
                  <BrandMark slug="whatsapp" size={17} /> WhatsApp
                </dt>
                <dd>“Remind me before my trial ends.”</dd>
              </div>
              <div>
                <dt>
                  <PhoneCall size={18} /> Phone
                </dt>
                <dd>“Mark Netflix to cancel.”</dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="faq" className="section container faq" aria-labelledby="faq-title">
          <div className="section-head" data-reveal>
            <h2 id="faq-title">Questions</h2>
            <p>
              Anything else? <Link href="/dashboard" className="text-link">Open the demo</Link> and
              ask Brix.
            </p>
          </div>
          <div className="faq__list" data-reveal data-reveal-stagger>
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
            <div className="final-cta__inner">
              <h2 id="cta-title">
                Find out what you’re paying for <span className="accent-text">in two minutes.</span>
              </h2>
              <p>The demo opens with a sample account. No sign-up, no card, no real money.</p>
              <div className="hero__ctas">
                <PeekCta>
                  <Link href="/dashboard" className="btn btn--primary btn--lg">
                    Open the demo <ArrowRight size={18} />
                  </Link>
                </PeekCta>
                <a href="#product" className="final-cta__link">
                  See the product <ArrowUpRight size={16} />
                </a>
              </div>
            </div>
            <div className="final-cta__buddy" aria-hidden="true">
              <BrixBuddy mood="happy" scale={0.62} decorative />
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="container lp-footer__grid">
          <div className="lp-footer__brand">
            <Link href="/" className="wordmark">
          <Wordmark />
            </Link>
            <p>Tracks subscriptions and free trials for college students. Never moves money.</p>
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
            <a href="#product">Product</a>
            <a href="#how">How it works</a>
            <a href="#demo">Try the bot</a>
            <a href="#faq">FAQ</a>
            <Link href="/developers">Developer API</Link>
          </nav>
          <div>
            <h3>Project</h3>
            <p>Built at HackPSU Fall 2026 for the FNB Challenge.</p>
            <p>Plaid, Twilio, Vapi, Firebase and Anthropic under the hood.</p>
          </div>
        </div>
        <div className="container lp-footer__bottom">
          <span>© 2026 Brix. Not a bank.</span>
          <span>
            Photos from{" "}
            <a href="https://unsplash.com" rel="noreferrer" target="_blank">
              Unsplash
            </a>{" "}
            (Vitaly Gariev, Christin Hume). Logos belong to their owners.
          </span>
        </div>
      </footer>
      <Reveal />
      <HelpLauncher />
    </div>
  );
}
