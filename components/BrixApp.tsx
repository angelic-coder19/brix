"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  RecaptchaVerifier,
  PhoneAuthProvider,
  linkWithCredential,
  type User,
} from "firebase/auth";
import { usePlaidLink } from "react-plaid-link";
import { getClientAuth } from "@/lib/firebase/client";
import {
  ArrowRight,
  ArrowUpRight,
  LayoutDashboard,
  Layers3,
  CreditCard,
  Cable,
  Settings,
  Plus,
  Bell,
  MessageCircle,
  X,
  ShieldCheck,
  LogOut,
  Landmark,
  Phone,
  Check,
  RefreshCw,
  Scissors,
  ChevronRight,
  Activity,
} from "lucide-react";
import BrixBuddy from "./brix/BrixBuddy";
import MerchantLogo from "./ui/MerchantLogo";
import BrixChat from "./brix/BrixChat";
import {
  useBrixChat,
  type BrixChatApi,
  type ClientState,
  type RequestFn,
} from "./brix/useBrixChat";
import type { Charge } from "@/lib/types";
import { summarizeCharges } from "@/lib/summary";
import "./app.css";
import { BrixMark } from "@/components/brand/BrixMark";

export type View =
  | "dashboard"
  | "subscriptions"
  | "cards"
  | "connect"
  | "settings"
  | "admin";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const hasFirebase = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const DAY = 86400000;
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
const shortDate = (s: string) =>
  new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const nav = [
  { href: "dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "subscriptions", label: "Your charges", icon: Layers3 },
  { href: "cards", label: "One-time cards", icon: CreditCard },
  { href: "connect", label: "Connections", icon: Cable },
] as const;

const titles: Record<View, [string, string]> = {
  dashboard: [
    "Overview",
    "What bills in the next 14 days, and what you’ve already handled.",
  ],
  subscriptions: [
    "Your charges",
    "Every subscription and free trial Brix is watching.",
  ],
  cards: [
    "One-time cards",
    "Single-use sandbox cards with a hard spending limit.",
  ],
  connect: [
    "Connections",
    "Link a bank through Plaid and choose how Brix reaches you.",
  ],
  settings: ["Settings", "Reminder channels, your phone number and your data."],
  admin: ["Admin", "Demo controls and integration checks."],
};

function ChargeRow({
  charge: c,
  onAsk,
}: {
  charge: Charge;
  onAsk: (message: string) => void;
}) {
  const live = c.status === "active" || c.status === "trial";
  return (
    <article className="charge-row">
      <MerchantLogo merchant={c.merchant} size={42} />
      <div className="charge-name">
        <strong>
          {c.merchant}
          {c.kind === "trial" && <span className="badge badge--warn">Trial</span>}
          {c.status === "to_cancel" && (
            <span className="badge badge--accent">Marked to cancel</span>
          )}
        </strong>
        <span>
          {c.kind === "trial"
            ? "Free trial ends"
            : c.frequency === "annual"
              ? "Annual renewal"
              : "Next renewal"}{" "}
          · {shortDate(c.nextDate)}
        </span>
        {c.status === "to_cancel" &&
          (c.cancelUrl ? (
            <a
              href={c.cancelUrl}
              target="_blank"
              rel="noreferrer"
              className="cancel-link"
            >
              Finish on the merchant site <ArrowUpRight size={13} />
            </a>
          ) : (
            <span className="cancel-link">Cancel with the merchant</span>
          ))}
      </div>
      <div className="charge-price">
        <strong>{money(c.amount)}</strong>
        <span>{c.kind === "trial" ? "after trial" : c.frequency}</span>
      </div>
      {live && (
        <div className="charge-actions">
          <button
            className="btn btn--sm"
            title={`Remind me about ${c.merchant}`}
            aria-label={`Remind me about ${c.merchant}`}
            onClick={() =>
              onAsk(`Remind me about ${c.merchant} 2 days before the next charge`)
            }
          >
            <Bell size={15} />
            <span className="charge-action-label">Remind</span>
          </button>
          <button
            className="btn btn--sm"
            title={`Mark ${c.merchant} to cancel`}
            aria-label={`Mark ${c.merchant} to cancel`}
            onClick={() => onAsk(`Mark ${c.merchant} to cancel`)}
          >
            <Scissors size={15} />
            <span className="charge-action-label">Cancel</span>
          </button>
        </div>
      )}
    </article>
  );
}

function BuddyCard({
  chat,
  onOpen,
}: {
  chat: BrixChatApi;
  onOpen: () => void;
}) {
  const line: ReactNode =
    chat.mood === "concerned" && chat.headsUp
      ? `Heads up: ${chat.headsUp}.`
      : chat.mood === "celebrate"
        ? "Nice! That’s one less surprise."
        : chat.mood === "thinking"
          ? "Let me check that…"
          : chat.mood === "error"
            ? "Hmm, let’s try that again."
            : chat.mood === "happy"
              ? "Glad I could help!"
              : "Ask what bills next, or tell me what to cancel.";
  return (
    <button
      type="button"
      className={`card card--muted buddy-card buddy-card--${chat.mood}`}
      onClick={onOpen}
      aria-label={`Talk with Brix. ${typeof line === "string" ? line : ""}`}
    >
      <span className="buddy-card__bubble" aria-live="polite">
        {line}
      </span>
      <BrixBuddy mood={chat.mood} scale={0.56} decorative />
    </button>
  );
}

export default function BrixApp({ view }: { view: View }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(!hasFirebase),
    [state, setState] = useState<ClientState | null>(null),
    [needsSignIn, setNeedsSignIn] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [trialOpen, setTrialOpen] = useState(false),
    [chatOpen, setChatOpen] = useState(false),
    [filter, setFilter] = useState<"all" | "subscription" | "trial">("all"),
    [search, setSearch] = useState(""),
    [now, setNow] = useState(() => Date.now());
  const demo = !!state?.demo;

  useEffect(() => {
    const auth = getClientAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  const request: RequestFn = useCallback(
    async <T,>(path: string, method = "GET", body?: unknown) => {
      const token = await getClientAuth()?.currentUser?.getIdToken();
      let res: Response;
      try {
        res = await fetch(path, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        throw new ApiError("You seem to be offline. Try again in a moment.", 0);
      }
      const data = await res.json().catch(() => null);
      if (!res.ok)
        throw new ApiError(
          typeof data?.error === "string"
            ? data.error
            : "Something went wrong. Please try again.",
          res.status,
        );
      return data as T;
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      const next = await request<ClientState>("/api/state");
      setState(next);
      setNeedsSignIn(false);
      setNow(Date.now());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setState(null);
        setNeedsSignIn(true);
      } else setError((e as Error).message);
    }
  }, [request]);

  useEffect(() => {
    if (!authReady) return;
    let alive = true;
    const tick = async () => {
      if (alive && document.visibilityState !== "hidden") await refresh();
    };
    const first = setTimeout(() => void tick(), 0);
    const id = setInterval(() => void tick(), 5000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [authReady, user, refresh]);

  const chat = useBrixChat({ state, setState, request });
  // A reply only "finishes" when its bubble has typed out. If the chat is
  // closed mid-reply, finish it here so the launcher doesn't stay talking.
  const { streamingId, finishStreaming } = chat;
  useEffect(() => {
    if (!chatOpen && streamingId) finishStreaming();
  }, [chatOpen, streamingId, finishStreaming]);

  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      chat.flash("error", 3000);
    } finally {
      setBusy(false);
    }
  }
  const ask = useCallback(
    (message: string) => {
      setChatOpen(true);
      void chat.send(message);
    },
    [chat],
  );
  async function login() {
    await action(async () => {
      const auth = getClientAuth();
      if (!auth)
        throw new Error(
          "Google sign-in needs Firebase configuration. See the setup guide.",
        );
      await signInWithPopup(auth, new GoogleAuthProvider());
      await request("/api/auth/profile", "POST", {});
    });
  }

  const charges = useMemo(() => state?.charges ?? [], [state]);
  const active = charges.filter((c) => c.status !== "cancelled");
  const { monthly, subscriptionCount, trialCount } = summarizeCharges(charges);
  const saved = (state?.events ?? []).reduce(
    (sum, e) => sum + (e.amountSaved || 0),
    0,
  );
  const today = new Date(now).toISOString().slice(0, 10);
  const horizon = new Date(now + 14 * DAY).toISOString().slice(0, 10);
  const upcoming = active
    .filter((c) => c.nextDate >= today && c.nextDate <= horizon)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const visible = charges.filter(
    (c) =>
      (filter === "all" || c.kind === filter) &&
      c.merchant.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const name = state?.user.displayName || user?.displayName || "";

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Brix navigation">
        <Link href="/" className="wordmark">
          <BrixMark className="brand-mark" />
          brix<span className="brand-period">.</span>
        </Link>
        <div className="sidebar-caption">Subscriptions &amp; trials</div>
        <nav>
          {nav.map((n) => (
            <Link
              href={`/${n.href}`}
              key={n.href}
              className={view === n.href ? "nav-item is-active" : "nav-item"}
              aria-current={view === n.href ? "page" : undefined}
            >
              <n.icon size={19} />
              {n.label}
              {view === n.href && <span className="nav-marker" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-trust">
            <ShieldCheck size={20} />
            <strong>Read-only access</strong>
            <p>Brix can see charges through Plaid. It can’t pay, transfer or cancel without your yes.</p>
          </div>
          <Link
            href="/settings"
            className={`nav-item ${view === "settings" ? "is-active" : ""}`}
            aria-current={view === "settings" ? "page" : undefined}
          >
            <Settings size={19} />
            Settings
          </Link>
          <div className="profile">
            <span className="avatar" aria-hidden>
              {(name || "Y").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{name || "Your space"}</strong>
              <small>{demo ? "Demo workspace" : "Personal workspace"}</small>
            </div>
            {user && (
              <button
                className="icon-btn"
                aria-label="Sign out"
                onClick={() => {
                  const auth = getClientAuth();
                  if (auth) void signOut(auth);
                }}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <Link href="/" className="wordmark wordmark--sm topbar__brand">
            <BrixMark className="brand-mark" />
            brix<span className="brand-period">.</span>
          </Link>
          <span className="topbar__crumbs">
            Your space <ChevronRight size={14} />
            <strong>
              {nav.find((n) => n.href === view)?.label ||
                view.charAt(0).toUpperCase() + view.slice(1)}
            </strong>
          </span>
          <div className="topbar__actions">
            <span className="badge badge--green read-only">
              <ShieldCheck size={14} /> Read-only & secure
            </span>
            <button
              className="icon-btn icon-btn--outline"
              aria-label="Open Brix assistant"
              onClick={() => setChatOpen(true)}
            >
              <MessageCircle size={19} />
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner" role="note">
            Sandbox demo · Sample charges, simulated actions, no real money.
          </div>
        )}
        <main className="page" id="main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {name ? `${name.split(" ")[0]}’s money` : "Your money"}
              </span>
              <h1>{titles[view][0]}</h1>
              <p>{titles[view][1]}</p>
            </div>
            {(view === "dashboard" || view === "subscriptions") &&
              !needsSignIn && (
                <button
                  className="btn btn--primary"
                  onClick={() => setTrialOpen(true)}
                >
                  <Plus size={18} />
                  Add a free trial
                </button>
              )}
          </div>
          {error && (
            <div className="alert alert--error" role="alert">
              {error}
              <button
                className="icon-btn"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert alert--success" role="status">
              {notice}
            </div>
          )}
          {needsSignIn ? (
            <section className="card sign-in">
              <BrixBuddy scale={0.6} mood="happy" />
              <h2>Sign in to see your charges</h2>
              <p>
                Sign in to securely connect your bank and keep track of your
                charges.
              </p>
              <button
                className="btn btn--primary btn--lg"
                disabled={busy}
                onClick={() => void login()}
              >
                Continue with Google <ArrowRight size={18} />
              </button>
            </section>
          ) : !state ? (
            <div className="loading-skel" role="status" aria-label="Loading your charges">
              <div className="summary-grid">
                <div className="card skel-card"><span className="skeleton" style={{ width: "40%" }} /><span className="skeleton skeleton--xl" /><span className="skeleton" style={{ width: "70%" }} /></div>
                <div className="card skel-card"><span className="skeleton" style={{ width: "50%" }} /><span className="skeleton skeleton--xl" /><span className="skeleton" style={{ width: "60%" }} /></div>
                <div className="card skel-card"><span className="skeleton" style={{ width: "30%" }} /><span className="skeleton skeleton--xl" /><span className="skeleton" style={{ width: "80%" }} /></div>
              </div>
              <div className="card skel-list">
                {[0, 1, 2, 3].map((i) => (
                  <div className="skel-row" key={i}>
                    <span className="skeleton skeleton--tile" />
                    <span className="skel-row__text"><span className="skeleton" style={{ width: "34%" }} /><span className="skeleton" style={{ width: "22%" }} /></span>
                    <span className="skeleton" style={{ width: 64 }} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {state.pendingActions?.voice && (
                <form
                  className="card form-card"
                  style={{ marginBottom: 24 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action(async () => {
                      const result = await request<{ reply: string }>(
                        "/api/agent/action",
                        "POST",
                        {
                          name: "confirm_voice_action",
                          pin: f.get("voicePin") || undefined,
                        },
                      );
                      setNotice(result.reply);
                    });
                  }}
                >
                  <h2>Confirm your voice request</h2>
                  <p>{state.pendingActions.voice.summary}</p>
                  {state.pendingActions.voice.name ===
                    "create_one_time_card" && (
                    <label className="field">
                      Your voice PIN
                      <input
                        name="voicePin"
                        type="password"
                        inputMode="numeric"
                        required
                        pattern="[0-9]{4}"
                        maxLength={4}
                      />
                    </label>
                  )}
                  <button className="btn btn--primary" disabled={busy}>
                    Confirm request <Check size={17} />
                  </button>
                </form>
              )}
              {view === "dashboard" && (
                <>
                  <section className="summary-grid" aria-label="Summary">
                    <div className="card stat-card">
                      <div className="stat-card__label">
                        Monthly recurring <Layers3 size={18} />
                      </div>
                      <div className="stat-card__value">
                        {money(monthly)}
                        <small>/ mo</small>
                      </div>
                      <p>
                        Across{" "}
                        {subscriptionCount}{" "}
                        {subscriptionCount === 1 ? "subscription" : "subscriptions"}, not counting
                        anything marked to cancel.
                      </p>
                      <div className="stat-card__footer">
                        <span>
                          {trialCount} free {trialCount === 1 ? "trial" : "trials"} to keep an eye on
                        </span>
                        <Link
                          href="/subscriptions"
                          className="icon-btn"
                          aria-label="See all charges"
                        >
                          <ArrowUpRight size={19} />
                        </Link>
                      </div>
                    </div>
                    <div className="card card--green stat-card">
                      <div className="stat-card__label">
                        Charges you avoided <ShieldCheck size={18} />
                      </div>
                      <div className="stat-card__value">{money(saved)}</div>
                      <p>
                        Estimated from your actions. Marking to cancel still
                        needs a visit to the merchant.
                      </p>
                      <span className="badge badge--green">
                        {state.charges.filter((c) => c.status === "to_cancel").length}{" "}
                        marked to cancel
                      </span>
                    </div>
                    <BuddyCard chat={chat} onOpen={() => setChatOpen(true)} />
                  </section>
                  <div className="dash-columns">
                    <section className="card">
                      <div className="card-head">
                        <div>
                          <h2>Coming up next</h2>
                          <p>Sorted by date, next 14 days.</p>
                        </div>
                        <span className="badge">{upcoming.length} upcoming</span>
                      </div>
                      {upcoming.length ? (
                        upcoming.map((c) => (
                          <ChargeRow key={c.id} charge={c} onAsk={ask} />
                        ))
                      ) : (
                        <div className="empty-state">
                          <Bell size={28} />
                          <strong>Nothing bills in the next 14 days.</strong>
                          <p>
                            Add a free trial you just started, or connect a
                            bank so Brix can find recurring charges.
                          </p>
                          <Link href="/connect" className="text-link">
                            Connect a bank <ArrowRight size={16} />
                          </Link>
                        </div>
                      )}
                      <Link href="/subscriptions" className="card-foot-link">
                        See all your charges <ArrowRight size={16} />
                      </Link>
                    </section>
                    <aside className="right-column">
                      <div className="card card--accent ask-card">
                        <MessageCircle size={24} />
                        <h2>Ask Brix</h2>
                        <p>
                          “What’s my next charge?”
                          <br />
                          “Remind me before Spotify renews.”
                        </p>
                        <button
                          className="btn btn--block"
                          onClick={() => setChatOpen(true)}
                        >
                          Open chat <ArrowUpRight size={17} />
                        </button>
                      </div>
                      <section className="activity" aria-label="Recent activity">
                        <h3>
                          <Activity size={17} /> Recent activity
                        </h3>
                        {state.events.some((e) => e.type !== "agent_message") ? (
                          state.events
                            .filter((e) => e.type !== "agent_message")
                            .slice(0, 5)
                            .map((e) => (
                              <div className="activity-item" key={e.id}>
                                <span className="activity-dot" />
                                <div>
                                  <p>{e.text || e.type.replaceAll("_", " ")}</p>
                                  <small>Via {e.channel}</small>
                                </div>
                              </div>
                            ))
                        ) : (
                          <p className="muted">
                            Your reminders and actions will show up here,
                            whichever channel you use.
                          </p>
                        )}
                      </section>
                    </aside>
                  </div>
                </>
              )}
              {view === "subscriptions" && (
                <>
                  <div className="filter-bar">
                    <div
                      className="segmented"
                      role="group"
                      aria-label="Filter charges"
                    >
                      {(["all", "subscription", "trial"] as const).map((t) => (
                        <button
                          key={t}
                          aria-pressed={filter === t}
                          onClick={() => setFilter(t)}
                        >
                          {t === "all"
                            ? "All charges"
                            : t === "trial"
                              ? "Free trials"
                              : "Subscriptions"}
                        </button>
                      ))}
                    </div>
                    <input
                      className="input"
                      type="search"
                      aria-label="Search charges"
                      placeholder="Find a charge…"
                      value={search}
                      maxLength={100}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <section className="card" aria-label="Charges">
                    {visible.map((c) => (
                      <ChargeRow key={c.id} charge={c} onAsk={ask} />
                    ))}
                    {!visible.length && (
                      <div className="empty-state">
                        <Layers3 size={28} />
                        <h3>{search ? `Nothing matches “${search}”.` : "No charges in this view."}</h3>
                        <p>
                          {search
                            ? "Check the spelling, or switch to All charges."
                            : "Add a free trial or connect a bank and they’ll show up here."}
                        </p>
                      </div>
                    )}
                  </section>
                  <p className="footnote">
                    <ShieldCheck size={15} /> “Mark to cancel” flags a charge.
                    You finish cancellation on the merchant’s website.
                  </p>
                </>
              )}
              {view === "cards" && (
                <div className="cards-layout">
                  <section className="card form-card">
                    <CreditCard size={28} />
                    <h2>New one-time card</h2>
                    <p>
                      Create a single-use sandbox card. Brix will ask you to
                      confirm before creating it.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void action(async () => {
                          const result = await request<{ eventId?: string }>(
                            "/api/cards",
                            "POST",
                            {
                              purpose: f.get("purpose"),
                              spendLimit: Number(f.get("spendLimit")),
                            },
                          );
                          setChatOpen(true);
                          if (result.eventId) chat.stream(result.eventId);
                        });
                      }}
                    >
                      <label className="field">
                        What’s it for?
                        <input
                          name="purpose"
                          required
                          maxLength={80}
                          placeholder="e.g. Notion AI trial"
                        />
                      </label>
                      <label className="field">
                        Spending limit (USD)
                        <input
                          name="spendLimit"
                          required
                          type="number"
                          min="0.01"
                          max="500"
                          step="0.01"
                          placeholder="10.00"
                        />
                      </label>
                      <button className="btn btn--primary" disabled={busy}>
                        Review card <ArrowRight size={17} />
                      </button>
                    </form>
                    <small>Sandbox only. These cards cannot spend real money.</small>
                  </section>
                  <div className="card-list">
                    {state.cards.length ? (
                      state.cards.map((c) => (
                        <article className="virtual-card" key={c.id}>
                          <div className="virtual-card__top">
                            <strong>brix.</strong>
                            <span className="badge">{c.state}</span>
                          </div>
                          <span className="chip-icon" aria-hidden />
                          <p className="card-digits">
                            <span className="sr-only">Card ending </span>
                            <span aria-hidden>•••• •••• •••• </span>
                            {c.last4}
                          </p>
                          <div className="virtual-card__bottom">
                            <span>{c.purpose}</span>
                            <span>{money(c.spendLimit)} limit</span>
                          </div>
                          <small>
                            {c.source === "mock"
                              ? "Demo card · Simulated single use"
                              : "Sandbox single-use card"}
                          </small>
                        </article>
                      ))
                    ) : (
                      <div className="card empty-state">
                        <CreditCard size={30} />
                        <h3>No cards yet</h3>
                        <p>Cards you create show up here with their limit and the last four digits.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {view === "connect" && (
                <Connect
                  request={request}
                  action={action}
                  state={state}
                  busy={busy}
                  setNotice={setNotice}
                />
              )}
              {view === "settings" && (
                <form
                  className="card form-card settings"
                  key={`${state.user.whatsappOptIn}-${state.user.callOptIn}`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action(async () => {
                      await request("/api/settings", "PATCH", {
                        whatsappOptIn: f.get("whatsapp") === "on",
                        callOptIn: f.get("calls") === "on",
                        ...(f.get("pin") ? { pin: f.get("pin") } : {}),
                      });
                      setNotice("Your preferences are saved.");
                    });
                  }}
                >
                  <h2>Your channels</h2>
                  <label className="toggle-row">
                    <div>
                      <strong>WhatsApp reminders</strong>
                      <span>A heads-up before a charge arrives.</span>
                    </div>
                    <input
                      className="switch"
                      type="checkbox"
                      name="whatsapp"
                      defaultChecked={state.user.whatsappOptIn}
                    />
                  </label>
                  <label className="toggle-row">
                    <div>
                      <strong>Phone calls</strong>
                      <span>Allow Brix to reach out by voice.</span>
                    </div>
                    <input
                      className="switch"
                      type="checkbox"
                      name="calls"
                      defaultChecked={state.user.callOptIn}
                    />
                  </label>
                  <label className="field">
                    Set or reset your 4-digit voice PIN
                    <input
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      placeholder="Leave blank to keep current PIN"
                      autoComplete="new-password"
                    />
                  </label>
                  <p className="muted">
                    Reminder checks run at 7 days and 2 days before a charge.
                    Channel permissions stay in your control.
                  </p>
                  <button className="btn btn--primary" disabled={busy}>
                    Save preferences <Check size={17} />
                  </button>
                  <hr className="divider" />
                  <h2>Your data</h2>
                  <p>
                    Disconnecting removes linked bank access. Deleting your
                    account removes your Brix profile and stored data.
                  </p>
                  <div className="button-row">
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Disconnect all linked banks from Brix?",
                          )
                        )
                          void action(async () => {
                            await request("/api/plaid/disconnect", "POST", {});
                            setNotice("Your banks have been disconnected.");
                          });
                      }}
                    >
                      Disconnect bank
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Permanently delete your Brix data and disconnect your banks? This cannot be undone.",
                          )
                        )
                          void action(async () => {
                            await request("/api/account", "DELETE");
                            const auth = getClientAuth();
                            if (auth) await signOut(auth);
                            router.push("/");
                          });
                      }}
                    >
                      Delete my data
                    </button>
                  </div>
                </form>
              )}
              {view === "admin" && (
                <section className="card form-card">
                  <h2>Run the demo</h2>
                  <p>
                    These controls require an authorized admin account. Delivery
                    also requires configured services and a verified, opted-in
                    recipient.
                  </p>
                  <div className="button-row">
                    <button
                      className="btn btn--primary"
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          const r = await request<{
                            sent: number;
                            inApp: number;
                            failed: number;
                          }>("/api/jobs/reminders", "POST", {});
                          setNotice(
                            `Reminders ran: ${r.inApp} in-app, ${r.sent} sent, ${r.failed} failed.`,
                          );
                        })
                      }
                    >
                      <Bell size={18} />
                      Run reminders now
                    </button>
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Reset the demo workspace and its sample data?",
                          )
                        )
                          void action(async () => {
                            await request("/api/admin/reset-demo", "POST", {});
                            setNotice("Demo workspace reset.");
                          });
                      }}
                    >
                      <RefreshCw size={18} />
                      Reset demo
                    </button>
                  </div>
                  <Link href="/dashboard" className="text-link">
                    Return to the dashboard <ArrowRight size={17} />
                  </Link>
                </section>
              )}
            </>
          )}
          <footer className="app-footer">
            <span>Brix reads your charges. It never moves money.</span>
            <span>
              <ShieldCheck size={14} /> Read-only by design.
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Brix navigation">
        {[...nav, { href: "settings", label: "Settings", icon: Settings }].map(
          (n) => (
            <Link
              href={`/${n.href}`}
              key={n.href}
              className={view === n.href ? "is-active" : ""}
              aria-current={view === n.href ? "page" : undefined}
            >
              <n.icon size={20} />
              <span>{n.label.replace("One-time cards", "Cards").replace("Your charges", "Charges")}</span>
            </Link>
          ),
        )}
      </nav>
      {trialOpen && (
        <TrialModal
          busy={busy}
          error={error}
          onClose={() => setTrialOpen(false)}
          onSubmit={(body) =>
            action(async () => {
              await request("/api/trials", "POST", body);
              setTrialOpen(false);
              setNotice(
                `Added ${String(body.merchant ?? "your trial")}. You’ll get a reminder 2 days before it bills.`,
              );
              chat.celebrate();
            })
          }
        />
      )}
      {state && !chatOpen && (
        <button
          type="button"
          className="chat-launcher"
          onClick={() => setChatOpen(true)}
          aria-label="Ask Brix"
          data-mood={chat.mood}
        >
          <span className="chat-launcher__face">
            <BrixMark className="chat-launcher__mark" mood={chat.mood} decorative />
          </span>
          <span className="chat-launcher__label">Ask Brix</span>
          {chat.mood === "concerned" && <span className="chat-launcher__dot" />}
        </button>
      )}
      {chatOpen && <BrixChat chat={chat} onClose={() => setChatOpen(false)} />}
    </div>
  );
}

function TrialModal({
  busy,
  error,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (body: {
    merchant: FormDataEntryValue | null;
    nextDate: FormDataEntryValue | null;
    amount: number;
  }) => Promise<void>;
}) {
  const [min] = useState(() => new Date().toISOString().slice(0, 10));
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trial-title"
      >
        <button
          className="icon-btn modal-close"
          aria-label="Close trial form"
          onClick={onClose}
        >
          <X />
        </button>
        <span className="badge badge--accent">A head start on your next charge</span>
        <h2 id="trial-title">Try it. Don’t forget it.</h2>
        <p>We’ll keep the end date on your radar.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void onSubmit({
              merchant: f.get("merchant"),
              nextDate: f.get("nextDate"),
              amount: Number(f.get("amount")),
            });
          }}
        >
          <label className="field">
            Trial name
            <input
              autoFocus
              required
              name="merchant"
              maxLength={100}
              placeholder="e.g. Notion AI"
            />
          </label>
          <label className="field">
            Trial ends
            <input required name="nextDate" type="date" min={min} />
          </label>
          <label className="field">
            Price after trial (USD)
            <input
              required
              name="amount"
              type="number"
              min="0"
              max="10000"
              step="0.01"
              placeholder="10.00"
            />
          </label>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <button className="btn btn--primary btn--lg" disabled={busy}>
            {busy ? "Adding…" : "Add to my charges"}
            <Plus size={18} />
          </button>
        </form>
      </section>
    </div>
  );
}

function Connect({
  request,
  action,
  state,
  busy,
  setNotice,
}: {
  request: RequestFn;
  action: (work: () => Promise<void>) => Promise<void>;
  state: ClientState | null;
  busy: boolean;
  setNotice: (s: string) => void;
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null),
    [verificationId, setVerificationId] = useState(""),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState("");
  const captcha = useRef<RecaptchaVerifier | null>(null);
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token) => {
      void action(async () => {
        await request("/api/plaid/exchange", "POST", { public_token });
        await request("/api/plaid/sync", "POST", {});
        setNotice(
          "Bank connected. Your available recurring charges have been synced.",
        );
        setLinkToken(null);
      });
    },
    onExit: () => setLinkToken(null),
  });
  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);
  useEffect(() => () => captcha.current?.clear(), []);
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    joinCode = process.env.NEXT_PUBLIC_WHATSAPP_JOIN_CODE,
    voice = process.env.NEXT_PUBLIC_VAPI_PHONE_NUMBER;
  return (
    <div className="connect-grid">
      <section className="card form-card">
        <span className="step-number">01</span>
        <Phone size={26} />
        <h2>Phone number</h2>
        <p>
          Link a phone number so Brix recognizes you across WhatsApp and voice.
        </p>
        {state?.user.phoneE164 ? (
          <div className="connected">
            <Check size={18} />
            {state.user.phoneE164} verified
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                const auth = getClientAuth();
                if (!auth?.currentUser)
                  throw new Error(
                    "Sign in with Google to verify a phone number.",
                  );
                if (!verificationId) {
                  captcha.current ??= new RecaptchaVerifier(
                    auth,
                    "phone-captcha",
                    { size: "invisible" },
                  );
                  setVerificationId(
                    await new PhoneAuthProvider(auth).verifyPhoneNumber(
                      phone,
                      captcha.current,
                    ),
                  );
                  setNotice("Verification code sent to your phone.");
                } else {
                  await linkWithCredential(
                    auth.currentUser,
                    PhoneAuthProvider.credential(verificationId, code),
                  );
                  await auth.currentUser.getIdToken(true);
                  await request("/api/auth/profile", "POST", {});
                  setNotice("Your phone number is verified.");
                }
              });
            }}
          >
            <label className="field">
              Phone number
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+18145551234"
                pattern="\+[1-9][0-9]{7,14}"
                disabled={!!verificationId}
                autoComplete="tel"
              />
            </label>
            {verificationId && (
              <label className="field">
                Verification code
                <input
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </label>
            )}
            <div id="phone-captcha" />
            <button className="btn" disabled={busy}>
              {verificationId ? "Verify code" : "Send verification code"}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
      </section>
      <section className="card form-card">
        <span className="step-number">02</span>
        <MessageCircle size={26} />
        <h2>WhatsApp</h2>
        <p>
          Join the Twilio sandbox, then turn on WhatsApp reminders in Settings.
        </p>
        {whatsapp && joinCode ? (
          <>
            <div className="join-code">{joinCode}</div>
            <a
              className="btn"
              href={`https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(joinCode)}`}
              target="_blank"
              rel="noreferrer"
            >
              Open WhatsApp <ArrowUpRight size={17} />
            </a>
          </>
        ) : (
          <div className="setup-note">
            Your team needs to configure the WhatsApp sandbox number and join
            code.
          </div>
        )}
        {voice && (
          <a className="text-link" href={`tel:${voice}`}>
            Call Brix at {voice}
            <Phone size={16} />
          </a>
        )}
        <Link href="/settings" className="text-link">
          Manage permissions & voice PIN <ArrowRight size={16} />
        </Link>
      </section>
      <section className="card form-card">
        <span className="step-number">03</span>
        <Landmark size={26} />
        <h2>Bank account</h2>
        <p>
          Link a sandbox bank through Plaid. Brix can read your charges, never
          move your money.
        </p>
        <button
          className="btn btn--primary"
          disabled={busy || !!linkToken}
          onClick={() =>
            void action(async () => {
              const result = await request<{ link_token: string }>(
                "/api/plaid/link-token",
                "POST",
                {},
              );
              setLinkToken(result.link_token);
            })
          }
        >
          Connect a bank <ArrowUpRight size={17} />
        </button>
        <button
          className="btn btn--ghost"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await request("/api/plaid/sync", "POST", {});
              setNotice("Bank transactions synced.");
            })
          }
        >
          <RefreshCw size={16} />
          Sync linked bank
        </button>
        <div className="setup-note">
          <ShieldCheck size={18} /> Sandbox connection. No real bank credentials
          needed.
        </div>
      </section>
    </div>
  );
}
