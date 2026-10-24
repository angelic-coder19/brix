"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
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
  Send,
  X,
  ShieldCheck,
  LogOut,
  Landmark,
  Phone,
  Check,
  RefreshCw,
  Scissors,
  Sparkles,
  ChevronRight,
  Activity,
  LoaderCircle,
} from "lucide-react";
import BrixBuddy from "./brix/BrixBuddy";
type Charge = {
  id: string;
  merchant: string;
  amount: number;
  nextDate: string;
  frequency: string;
  status: string;
  kind: string;
  cancelUrl?: string;
  usageNote?: string;
};
type State = {
  demo?: boolean;
  pendingActions?: { voice?: { summary: string; name: string } };
  user: {
    displayName?: string;
    phoneE164?: string;
    whatsappOptIn?: boolean;
    callOptIn?: boolean;
  };
  charges: Charge[];
  cards: {
    id: string;
    purpose: string;
    last4: string;
    spendLimit: number;
    state: string;
    source?: string;
  }[];
  events: {
    id: string;
    text?: string;
    type: string;
    channel: string;
    amountSaved?: number;
  }[];
  reminders: unknown[];
};
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
const date = (s: string) =>
  new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
const nav = [
  { href: "dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "subscriptions", label: "Your charges", icon: Layers3 },
  { href: "cards", label: "One-time cards", icon: CreditCard },
  { href: "connect", label: "Connections", icon: Cable },
];
export default function BrixApp({ view }: { view: string }) {
  const [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(false),
    [state, setState] = useState<State | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [trialOpen, setTrialOpen] = useState(false),
    [chatOpen, setChatOpen] = useState(false),
    [messages, setMessages] = useState<{ role: string; text: string }[]>([]),
    [input, setInput] = useState(""),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const demo = process.env.NEXT_PUBLIC_BRIX_DEMO_MODE === "true";
  useEffect(() => {
    const auth = getClientAuth();
    if (!auth) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);
  const request = useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      const token = await getClientAuth()?.currentUser?.getIdToken();
      const res = await fetch(path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : data.error?.message || "Something went wrong. Please try again.",
        );
      return data;
    },
    [],
  );
  const refresh = useCallback(async () => {
    try {
      setState(await request("/api/state"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request]);
  useEffect(() => {
    if (!authReady || (!demo && !user)) return;
    void refresh();
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [authReady, demo, user, refresh]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function chat(message: string) {
    setChatOpen(true);
    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    await action(async () => {
      const result = await request("/api/agent", "POST", { message });
      setMessages((m) => [...m, { role: "assistant", text: result.reply }]);
    });
  }
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
  const charges = state?.charges || [],
    active = charges.filter((c) => c.status !== "cancelled"),
    monthly = active
      .filter(
        (c) =>
          c.kind !== "trial" &&
          c.status !== "to_cancel" &&
          c.frequency !== "unknown",
      )
      .reduce(
        (sum, c) =>
          sum +
          c.amount *
            (c.frequency === "annual"
              ? 1 / 12
              : c.frequency === "weekly"
                ? 52 / 12
                : 1),
        0,
      ),
    saved = (state?.events || []).reduce(
      (sum, e) => sum + (e.amountSaved || 0),
      0,
    ),
    upcoming = active
      .filter(
        (c) =>
          c.nextDate >= new Date().toISOString().slice(0, 10) &&
          new Date(c.nextDate).getTime() < Date.now() + 14 * 86400000,
      )
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const titles: Record<string, [string, string]> = {
    dashboard: [
      "A little clarity goes a long way.",
      "Here’s what’s happening with your money.",
    ],
    subscriptions: [
      "Small charges. Full picture.",
      "Your subscriptions and free trials, all in one place.",
    ],
    cards: [
      "Try it. On your terms.",
      "Single-use sandbox cards for a little extra control.",
    ],
    connect: [
      "Let’s get connected.",
      "One buddy. Your bank, your phone, your choice.",
    ],
    settings: ["Make Brix yours.", "You decide how we stay in touch."],
    admin: ["Behind the bricks.", "Demo controls and integration checks."],
  };
  function ChargeRow({ charge: c }: { charge: Charge }) {
    return (
      <article className="charge-row">
        <div
          className={`merchant-icon merchant-${c.merchant.toLowerCase().slice(0, 1)}`}
        >
          {c.merchant.slice(0, 1)}
        </div>
        <div className="charge-name">
          <strong>{c.merchant}</strong>
          <span>
            {c.kind === "trial"
              ? "Free trial ends"
              : c.frequency === "annual"
                ? "Annual renewal"
                : "Next renewal"}{" "}
            · {date(c.nextDate)}
          </span>
          {c.status === "to_cancel" && (
            <a
              href={c.cancelUrl || undefined}
              target="_blank"
              rel="noreferrer"
              className="cancel-link"
            >
              Marked to cancel{" "}
              {c.cancelUrl
                ? "· Finish on merchant site ↗"
                : "· Cancel with the merchant"}
            </a>
          )}
        </div>
        <div className="charge-price">
          <strong>{money(c.amount)}</strong>
          <span>{c.kind === "trial" ? "after trial" : c.frequency}</span>
        </div>
        <div className="charge-actions">
          <button
            title={`Remind me about ${c.merchant}`}
            aria-label={`Remind me about ${c.merchant}`}
            onClick={() =>
              void chat(
                `Remind me about ${c.merchant} 2 days before the next charge`,
              )
            }
          >
            <Bell size={17} />
          </button>
          <button
            title={`Mark ${c.merchant} to cancel`}
            aria-label={`Mark ${c.merchant} to cancel`}
            onClick={() => void chat(`Mark ${c.merchant} to cancel`)}
          >
            <Scissors size={17} />
          </button>
        </div>
      </article>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="wordmark">
          <span className="brand-block" />
          brix<span className="brand-period">.</span>
        </Link>
        <div className="sidebar-caption">YOUR MONEY, BRICK BY BRICK</div>
        <nav>
          {nav.map((n) => (
            <Link
              href={`/${n.href}`}
              key={n.href}
              className={view === n.href ? "nav-item active" : "nav-item"}
            >
              <n.icon size={20} />
              {n.label}
              {view === n.href && <span className="nav-marker" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-trust">
            <ShieldCheck size={22} />
            <strong>
              Here to help.
              <br />
              Never to move your money.
            </strong>
            <p>Your bank connection is read-only. You’re always in control.</p>
          </div>
          <Link
            href="/settings"
            className={`nav-item ${view === "settings" ? "active" : ""}`}
          >
            <Settings size={19} />
            Settings
          </Link>
          <div className="profile">
            <span className="avatar">
              {(state?.user.displayName || user?.displayName || "Y").slice(
                0,
                1,
              )}
            </span>
            <div>
              <strong>
                {state?.user.displayName || user?.displayName || "Your space"}
              </strong>
              <small>{demo ? "Demo workspace" : "Personal workspace"}</small>
            </div>
            {user && (
              <button
                aria-label="Sign out"
                onClick={() => void signOut(getClientAuth()!)}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <span>
            Your space <ChevronRight size={14} />{" "}
            {nav.find((n) => n.href === view)?.label || view}
          </span>
          <div>
            <span className="read-only">
              <ShieldCheck size={15} /> Read-only & secure
            </span>
            <button
              className="icon-button"
              aria-label="Open Brix assistant"
              onClick={() => setChatOpen(true)}
            >
              <MessageCircle size={20} />
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            Sandbox demo · Sample charges, simulated actions, no real money.
          </div>
        )}
        <div className="page-content">
          <div className="page-heading">
            <div>
              <span className="greeting">
                {view === "dashboard"
                  ? `HEY ${(state?.user.displayName || "THERE").split(" ")[0].toUpperCase()}, MEET YOUR MONEY`
                  : "YOUR BRIX WORKSPACE"}
              </span>
              <h1>{titles[view][0]}</h1>
              <p>{titles[view][1]}</p>
            </div>
            {["dashboard", "subscriptions"].includes(view) && (
              <button
                className="button primary"
                onClick={() => setTrialOpen(true)}
              >
                <Plus size={18} />
                Add a free trial
              </button>
            )}
          </div>
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
            </div>
          )}
          {!authReady ? (
            <div className="empty">
              <LoaderCircle className="spin" />
              Getting your space ready…
            </div>
          ) : !demo && !user ? (
            <section className="sign-in panel">
              <BrixBuddy small />
              <h2>Your money story starts here.</h2>
              <p>
                Sign in to securely connect your bank and keep track of your
                charges.
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void login()}
              >
                Continue with Google <ArrowRight size={18} />
              </button>
            </section>
          ) : (
            <>
              {state?.pendingActions?.voice && (
                <form
                  className="panel form-panel"
                  style={{ marginBottom: 24 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action(async () => {
                      const result = await request(
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
                    <label>
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
                  <button className="button primary" disabled={busy}>
                    Confirm request <Check size={17} />
                  </button>
                </form>
              )}
              {view === "dashboard" && (
                <>
                  <section className="dashboard-summary">
                    <div className="monthly-panel panel">
                      <div className="panel-label">
                        MONTHLY RECURRING <Layers3 size={18} />
                      </div>
                      <div className="large-money">
                        {state ? money(monthly) : "…"}
                        <span>/ mo</span>
                      </div>
                      <p>
                        Across {active.filter((c) => c.kind !== "trial").length}{" "}
                        subscriptions. A little awareness adds up.
                      </p>
                      <div className="summary-footer">
                        <span>
                          {charges.filter((c) => c.kind === "trial").length}{" "}
                          free trials to keep an eye on
                        </span>
                        <Link href="/subscriptions">
                          <ArrowUpRight size={19} />
                        </Link>
                      </div>
                    </div>
                    <div className="saved-panel panel">
                      <div className="panel-label">
                        CHARGES YOU AVOIDED <ShieldCheck size={18} />
                      </div>
                      <div className="large-money">
                        {state ? money(saved) : "…"}
                      </div>
                      <p>
                        Estimated from your actions. Marking to cancel still
                        needs a visit to the merchant.
                      </p>
                      <span className="soft-badge">
                        A good start, brick by brick.
                      </span>
                    </div>
                    <div className="buddy-panel">
                      <BrixBuddy small />
                      <p>
                        You bring the big dreams.
                        <br />
                        <strong>I’ll watch the little charges.</strong>
                      </p>
                    </div>
                  </section>
                  <div className="dashboard-columns">
                    <section className="panel timeline-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Coming up next</h2>
                          <p>Your next 14 days, without the surprises.</p>
                        </div>
                        <span className="soft-badge">
                          {upcoming.length} upcoming
                        </span>
                      </div>
                      {!state ? (
                        <div className="empty">Loading your charges…</div>
                      ) : upcoming.length ? (
                        upcoming.map((c) => <ChargeRow key={c.id} charge={c} />)
                      ) : (
                        <div className="empty">
                          <Bell size={28} />
                          <strong>A little breathing room.</strong>
                          <p>
                            No charges due in the next 14 days. Add a trial or
                            connect your bank.
                          </p>
                          <Link href="/connect" className="text-link">
                            Connect a bank <ArrowRight size={16} />
                          </Link>
                        </div>
                      )}
                      <Link href="/subscriptions" className="panel-bottom-link">
                        See all your charges <ArrowRight size={16} />
                      </Link>
                    </section>
                    <aside className="right-column">
                      <div className="ask-panel">
                        <MessageCircle size={25} />
                        <h2>Just ask Brix.</h2>
                        <p>
                          “What’s my next charge?”
                          <br />
                          “Remind me before Spotify renews.”
                        </p>
                        <button
                          className="button"
                          onClick={() => setChatOpen(true)}
                        >
                          Let’s talk <ArrowUpRight size={17} />
                        </button>
                      </div>
                      <section className="activity-panel">
                        <h3>
                          <Activity size={17} /> The latest
                        </h3>
                        {state?.events.length ? (
                          state.events.slice(0, 5).map((e) => (
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
                    <div className="tabs">
                      {["all", "subscription", "trial"].map((t) => (
                        <button
                          key={t}
                          className={filter === t ? "selected" : ""}
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
                      type="search"
                      aria-label="Search charges"
                      placeholder="Find a charge…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <section className="panel">
                    {charges
                      .filter(
                        (c) =>
                          (filter === "all" || c.kind === filter) &&
                          c.merchant
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((c) => (
                        <ChargeRow key={c.id} charge={c} />
                      ))}
                    {!charges.filter(
                      (c) =>
                        (filter === "all" || c.kind === filter) &&
                        c.merchant.toLowerCase().includes(search.toLowerCase()),
                    ).length && (
                      <div className="empty">
                        <Layers3 size={28} />
                        <h3>No charges here yet.</h3>
                        <p>
                          Add a free trial or connect a bank to start your
                          picture.
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
                <>
                  <div className="cards-layout">
                    <form
                      className="panel form-panel"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void action(async () => {
                          const result = await request("/api/cards", "POST", {
                            purpose: f.get("purpose"),
                            spendLimit: Number(f.get("spendLimit")),
                          });
                          setMessages((m) => [
                            ...m,
                            { role: "assistant", text: result.reply },
                          ]);
                          setChatOpen(true);
                        });
                      }}
                    >
                      <CreditCard size={28} />
                      <h2>A card with a clear limit.</h2>
                      <p>
                        Create a single-use sandbox card. Brix will ask you to
                        confirm before creating it.
                      </p>
                      <label>
                        What’s it for?
                        <input
                          name="purpose"
                          required
                          maxLength={80}
                          placeholder="e.g. Notion AI trial"
                        />
                      </label>
                      <label>
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
                      <button className="button primary" disabled={busy}>
                        Review card <ArrowRight size={17} />
                      </button>
                      <small>
                        Sandbox only. These cards cannot spend real money.
                      </small>
                    </form>
                    <div className="card-list">
                      {state?.cards.length ? (
                        state.cards.map((c) => (
                          <article className="virtual-card" key={c.id}>
                            <div>
                              <strong>brix.</strong>
                              <span>{c.state}</span>
                            </div>
                            <span className="chip-icon" />
                            <p className="card-digits">
                              •••• &nbsp; •••• &nbsp; •••• &nbsp; {c.last4}
                            </p>
                            <div>
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
                        <div className="empty panel">
                          <CreditCard size={30} />
                          <h3>A fresh start.</h3>
                          <p>Your one-time cards will appear here.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
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
                  className="panel form-panel settings-panel"
                  key={`${state?.user.whatsappOptIn}-${state?.user.callOptIn}`}
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
                  <label className="toggle-label">
                    <div>
                      <strong>WhatsApp reminders</strong>
                      <span>A heads-up before a charge arrives.</span>
                    </div>
                    <input
                      type="checkbox"
                      name="whatsapp"
                      defaultChecked={state?.user.whatsappOptIn}
                    />
                  </label>
                  <label className="toggle-label">
                    <div>
                      <strong>Phone calls</strong>
                      <span>Allow Brix to reach out by voice.</span>
                    </div>
                    <input
                      type="checkbox"
                      name="calls"
                      defaultChecked={state?.user.callOptIn}
                    />
                  </label>
                  <label>
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
                  <button className="button primary" disabled={busy}>
                    Save preferences <Check size={17} />
                  </button>
                  <hr />
                  <h2>Your data, your choice.</h2>
                  <p>
                    Disconnecting removes linked bank access. Deleting your
                    account removes your Brix profile and stored data.
                  </p>
                  <div className="button-row">
                    <button
                      type="button"
                      className="button"
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
                      className="button danger"
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
                            window.location.href = "/";
                          });
                      }}
                    >
                      Delete my data
                    </button>
                  </div>
                </form>
              )}
              {view === "admin" && (
                <section className="panel form-panel">
                  <h2>Run the demo</h2>
                  <p>
                    These controls require an authorized admin account. Delivery
                    also requires configured services and a verified, opted-in
                    recipient.
                  </p>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const result = await request(
                          "/api/jobs/reminders",
                          "POST",
                          {},
                        );
                        setNotice(JSON.stringify(result));
                      })
                    }
                  >
                    <Bell size={18} />
                    Run reminders now
                  </button>
                  <button
                    className="button"
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
                  <Link href="/dashboard" className="text-link">
                    Return to the dashboard <ArrowRight size={17} />
                  </Link>
                </section>
              )}
            </>
          )}
          <footer className="app-footer">
            <span>brix. A little more peace of mind.</span>
            <span>
              <ShieldCheck size={14} /> Your money stays yours.
            </span>
          </footer>
        </div>
      </main>
      <nav className="mobile-nav">
        {nav.map((n) => (
          <Link
            href={`/${n.href}`}
            key={n.href}
            className={view === n.href ? "active" : ""}
          >
            <n.icon size={20} />
            <span>{n.label}</span>
          </Link>
        ))}
        <Link href="/settings">
          <Settings size={20} />
          <span>Settings</span>
        </Link>
      </nav>
      {trialOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trial-title"
          >
            <button
              className="modal-close"
              aria-label="Close trial form"
              onClick={() => setTrialOpen(false)}
            >
              <X />
            </button>
            <span className="soft-badge">A HEAD START ON YOUR NEXT CHARGE</span>
            <h2 id="trial-title">Try it. Don’t forget it.</h2>
            <p>We’ll keep the end date on your radar.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void action(async () => {
                  await request("/api/trials", "POST", {
                    merchant: f.get("merchant"),
                    nextDate: f.get("nextDate"),
                    amount: Number(f.get("amount")),
                  });
                  setTrialOpen(false);
                  setNotice("Your trial is on the radar.");
                });
              }}
            >
              <label>
                Trial name
                <input
                  autoFocus
                  required
                  name="merchant"
                  maxLength={100}
                  placeholder="e.g. Notion AI"
                />
              </label>
              <label>
                Trial ends
                <input
                  required
                  name="nextDate"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                />
              </label>
              <label>
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
              <button className="button primary" disabled={busy}>
                {busy ? "Adding…" : "Add to my charges"}
                <Plus size={18} />
              </button>
            </form>
          </section>
        </div>
      )}
      {chatOpen && (
        <section
          className="chat-panel"
          role="dialog"
          aria-label="Talk with Brix"
        >
          <header>
            <span className="brand-block" />
            <div>
              <strong>Your Brix buddy</strong>
              <small>Here for the little things.</small>
            </div>
            <button aria-label="Close chat" onClick={() => setChatOpen(false)}>
              <X size={20} />
            </button>
          </header>
          <div className="chat-messages" aria-live="polite">
            <div className="chat-bubble assistant">
              Hey! Ask me what’s coming up, set a reminder, or mark a charge to
              cancel. I’ll check with you before I act.
            </div>
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role}`}>
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="chat-bubble assistant">
                Checking that for you…
              </div>
            )}
            {error && <p className="error-text">{error}</p>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) void chat(input.trim());
            }}
          >
            <input
              aria-label="Message Brix"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about your charges…"
              maxLength={1000}
            />
            <button disabled={busy || !input.trim()} aria-label="Send message">
              <Send size={19} />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
type Request = (path: string, method?: string, body?: unknown) => Promise<any>;
function Connect({
  request,
  action,
  state,
  busy,
  setNotice,
}: {
  request: Request;
  action: (work: () => Promise<void>) => Promise<void>;
  state: State | null;
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
        const result = await request("/api/plaid/sync", "POST", {});
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
      <section className="panel form-panel">
        <span className="step-number">01</span>
        <Phone size={27} />
        <h2>Your phone, verified.</h2>
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
            <label>
              Phone number
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="+18145551234"
                pattern="\+[1-9][0-9]{7,14}"
                disabled={!!verificationId}
              />
            </label>
            {verificationId && (
              <label>
                Verification code
                <input
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  pattern="[0-9]{6}"
                  maxLength={6}
                />
              </label>
            )}
            <div id="phone-captcha" />
            <button className="button" disabled={busy}>
              {verificationId ? "Verify code" : "Send verification code"}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
      </section>
      <section className="panel form-panel">
        <span className="step-number">02</span>
        <MessageCircle size={27} />
        <h2>Say hi on WhatsApp.</h2>
        <p>
          Join the Twilio sandbox, then turn on WhatsApp reminders in Settings.
        </p>
        {whatsapp && joinCode ? (
          <>
            <div className="join-code">{joinCode}</div>
            <a
              className="button"
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
      <section className="panel form-panel">
        <span className="step-number">03</span>
        <Landmark size={27} />
        <h2>Connect the dots.</h2>
        <p>
          Link a sandbox bank through Plaid. Brix can read your charges, never
          move your money.
        </p>
        <button
          className="button primary"
          disabled={busy || !!linkToken}
          onClick={() =>
            void action(async () => {
              const result = await request("/api/plaid/link-token", "POST", {});
              setLinkToken(result.link_token);
            })
          }
        >
          Connect a bank <ArrowUpRight size={17} />
        </button>
        <button
          className="text-link"
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
