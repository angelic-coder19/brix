"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  Landmark,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { usePlaidLink } from "react-plaid-link";
import { getClientAuth } from "@/lib/firebase/client";
import type { ClientState } from "@/components/brix/useBrixChat";
import { BrixMark } from "@/components/brand/BrixMark";
import { Wordmark } from "@/components/brand/Wordmark";
import "./onboarding.css";

export const ONBOARDED_KEY = "brix.onboarded";
const hasFirebase = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

const STEPS = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "name", label: "Your name", icon: Sparkles },
  { id: "bank", label: "Bank", icon: Landmark },
  { id: "trial", label: "First trial", icon: BellRing },
  { id: "reminders", label: "Reminders", icon: MessageCircle },
  { id: "done", label: "Done", icon: Check },
] as const;
type StepId = (typeof STEPS)[number]["id"];

class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
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
    throw new RequestError("You seem to be offline. Try again in a moment.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new RequestError(
      typeof data?.error === "string"
        ? data.error
        : "Something went wrong. Please try again.",
      res.status,
    );
  return data as T;
}

/**
 * First-run setup: one decision per screen, with a stepper, back and skip.
 * Works in demo mode (sample account, no sign-in) and with Firebase sign-in.
 */
export default function Onboarding() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(!hasFirebase);
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<ClientState | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Partial<Record<StepId, string>>>({});
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const auth = getClientAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const next = await call<ClientState>("/api/state");
      setState(next);
      setNeedsSignIn(false);
      return next;
    } catch (e) {
      if (e instanceof RequestError && e.status === 401) {
        setState(null);
        setNeedsSignIn(true);
      } else setLoadError((e as Error).message);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [authReady, user, load]);

  // Move focus to the new step's heading so keyboard and screen reader users
  // land on it.
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [step]);

  const current = STEPS[step];
  const go = (n: number) => {
    setError("");
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
  };
  const next = (note?: string) => {
    if (note) setDone((d) => ({ ...d, [current.id]: note }));
    go(step + 1);
  };
  const skip = () => {
    setDone((d) => ({ ...d, [current.id]: "Skipped" }));
    go(step + 1);
  };
  async function run(work: () => Promise<string | void>) {
    setBusy(true);
    setError("");
    try {
      const note = await work();
      await load();
      next(note || undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const finish = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {}
    router.push("/dashboard");
  };

  const signedIn = !!state;
  const demo = !!state?.demo;
  const progress = Math.round((step / (STEPS.length - 1)) * 100);
  const canSkip = ["bank", "trial", "reminders"].includes(current.id);

  return (
    <div className="ob">
      <header className="ob__top">
        <Link href="/" className="wordmark" aria-label="Brix home">
          <Wordmark />
        </Link>
        {demo && (
          <span className="badge">
            Demo<span className="ob__wide"> account · sample data</span>
          </span>
        )}
        <Link href="/dashboard" className="ob__exit">
          Finish later
        </Link>
      </header>

      <div className="ob__body">
        <nav className="ob__steps" aria-label="Setup progress">
          <div
            className="ob__bar"
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <ol>
            {STEPS.map((s, i) => (
              <li
                key={s.id}
                className={
                  i === step ? "is-current" : i < step ? "is-done" : undefined
                }
                aria-current={i === step ? "step" : undefined}
              >
                <span className="ob__dot">
                  {i < step ? <Check size={13} /> : i + 1}
                </span>
                <span className="ob__label">{s.label}</span>
                {i < step && done[s.id] === "Skipped" && <small>Skipped</small>}
              </li>
            ))}
          </ol>
          <p className="ob__count" aria-live="polite">
            Step {step + 1} of {STEPS.length}
          </p>
        </nav>

        <main className="ob__panel" id="main">
          {!authReady || (!state && !needsSignIn && !loadError) ? (
            <div className="ob__loading" role="status">
              <Loader2 className="spin" size={20} /> Getting your account…
            </div>
          ) : loadError ? (
            <div className="ob__state" role="alert">
              <BrixMark mood="error" decorative className="ob__face" />
              <h1 ref={heading} tabIndex={-1}>
                We couldn’t load your account
              </h1>
              <p>{loadError}</p>
              <button className="btn btn--primary" onClick={() => void load()}>
                Try again
              </button>
            </div>
          ) : (
            <section
              className={`ob__step ob__step--${current.id}`}
              aria-labelledby="ob-title"
            >
              {current.id !== "done" && (
                <span className="ob__icon">
                  <current.icon size={20} />
                </span>
              )}

              {current.id === "account" && (
                <>
                  <h1 id="ob-title" ref={heading} tabIndex={-1}>
                    {signedIn ? "You’re in." : "Make your Brix account"}
                  </h1>
                  {signedIn ? (
                    <p>
                      {demo
                        ? "This is the shared demo account, filled with sample charges. Nothing you do here touches real money."
                        : `Signed in as ${state?.user.email || user?.email || "you"}.`}
                    </p>
                  ) : (
                    <p>
                      Sign in with Google. Brix only uses it to keep your
                      charges and reminders private to you.
                    </p>
                  )}
                  <ul className="ob__facts">
                    <li>
                      <ShieldCheck size={16} /> Bank access is read-only. Brix
                      never moves money.
                    </li>
                    <li>
                      <Check size={16} /> Nothing changes without your yes.
                    </li>
                  </ul>
                  <div className="ob__actions">
                    {signedIn ? (
                      <button
                        className="btn btn--primary btn--lg"
                        onClick={() => next("Signed in")}
                      >
                        Continue <ArrowRight size={18} />
                      </button>
                    ) : (
                      <button
                        className="btn btn--primary btn--lg"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const auth = getClientAuth();
                            if (!auth)
                              throw new Error(
                                "Sign-in isn’t configured on this copy of Brix. See the setup guide.",
                              );
                            await signInWithPopup(
                              auth,
                              new GoogleAuthProvider(),
                            );
                            await call("/api/auth/profile", "POST", {});
                            return "Signed in";
                          })
                        }
                      >
                        Continue with Google <ArrowRight size={18} />
                      </button>
                    )}
                  </div>
                </>
              )}

              {current.id === "name" && (
                <NameStep
                  heading={heading}
                  initial={state?.user.displayName || user?.displayName || ""}
                  busy={busy}
                  onSubmit={(displayName) =>
                    run(async () => {
                      await call("/api/settings", "PATCH", { displayName });
                      return displayName;
                    })
                  }
                />
              )}

              {current.id === "bank" && (
                <BankStep
                  heading={heading}
                  demo={demo}
                  busy={busy}
                  setBusy={setBusy}
                  setError={setError}
                  onLinked={(note) => {
                    void load();
                    next(note);
                  }}
                />
              )}

              {current.id === "trial" && (
                <TrialStep
                  heading={heading}
                  busy={busy}
                  onSubmit={(body) =>
                    run(async () => {
                      await call("/api/trials", "POST", body);
                      return String(body.merchant);
                    })
                  }
                />
              )}

              {current.id === "reminders" && (
                <RemindersStep
                  heading={heading}
                  state={state}
                  busy={busy}
                  onSubmit={(prefs) =>
                    run(async () => {
                      await call("/api/settings", "PATCH", prefs);
                      return prefs.whatsappOptIn || prefs.callOptIn
                        ? "Channels on"
                        : "In-app only";
                    })
                  }
                />
              )}

              {current.id === "done" && (
                <>
                  <BrixMark mood="celebrate" decorative className="ob__face" />
                  <h1 id="ob-title" ref={heading} tabIndex={-1}>
                    You’re set up
                    {state?.user.displayName
                      ? `, ${state.user.displayName.split(" ")[0]}`
                      : ""}
                    .
                  </h1>
                  <p>
                    Here’s what Brix has. You can change any of it later in
                    Settings.
                  </p>
                  <dl className="ob__summary">
                    {STEPS.slice(0, -1).map((s) => (
                      <div key={s.id}>
                        <dt>{s.label}</dt>
                        <dd>{done[s.id] ?? "Done"}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="ob__actions">
                    <button
                      className="btn btn--primary btn--lg"
                      onClick={finish}
                    >
                      Go to your overview <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              )}

              {error && (
                <p className="ob__error" role="alert">
                  {error}
                </p>
              )}

              {current.id !== "done" && (
                <div className="ob__nav">
                  {step > 0 ? (
                    <button
                      className="btn btn--ghost"
                      onClick={() => go(step - 1)}
                      disabled={busy}
                    >
                      <ArrowLeft size={16} /> Back
                    </button>
                  ) : (
                    <span />
                  )}
                  {canSkip && (
                    <button
                      className="btn btn--ghost ob__skip"
                      onClick={skip}
                      disabled={busy}
                    >
                      Skip for now
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

type HeadingRef = React.RefObject<HTMLHeadingElement | null>;

function NameStep({
  heading,
  initial,
  busy,
  onSubmit,
}: {
  heading: HeadingRef;
  initial: string;
  busy: boolean;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  return (
    <>
      <h1 id="ob-title" ref={heading} tabIndex={-1}>
        What should Brix call you?
      </h1>
      <p>Brix uses your first name in reminders and chat.</p>
      <form
        className="ob__form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (name.trim()) void onSubmit(name.trim());
        }}
      >
        <label className="field">
          Your name
          <input
            name="displayName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
            placeholder="e.g. Maya Chen"
          />
        </label>
        <div className="ob__actions">
          <button
            className="btn btn--primary btn--lg"
            disabled={busy || !name.trim()}
          >
            {busy ? "Saving…" : "Continue"} <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </>
  );
}

function BankStep({
  heading,
  demo,
  busy,
  setBusy,
  setError,
  onLinked,
}: {
  heading: HeadingRef;
  demo: boolean;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (s: string) => void;
  onLinked: (note: string) => void;
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token) => {
      setBusy(true);
      void (async () => {
        try {
          await call("/api/plaid/exchange", "POST", { public_token });
          await call("/api/plaid/sync", "POST", {});
          onLinked("Bank linked");
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
          setLinkToken(null);
        }
      })();
    },
    onExit: () => setLinkToken(null),
  });
  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <>
      <h1 id="ob-title" ref={heading} tabIndex={-1}>
        Link a bank, or skip it
      </h1>
      <p>
        Brix reads recurring charges through Plaid with read-only access. It
        can’t pay, transfer or cancel anything. You can also skip this and add
        trials by hand.
      </p>
      {demo ? (
        <div className="ob__note ob__note--ok">
          <Check size={16} /> The demo account already has a sample bank with
          six recurring charges.
        </div>
      ) : (
        <div className="ob__note">
          <ShieldCheck size={16} /> Plaid sandbox: use the test login Plaid
          shows. No real bank credentials.
        </div>
      )}
      <div className="ob__actions">
        {demo ? (
          <button
            className="btn btn--primary btn--lg"
            onClick={() => onLinked("Sample bank")}
          >
            Use the sample bank <ArrowRight size={18} />
          </button>
        ) : (
          <button
            className="btn btn--primary btn--lg"
            disabled={busy || !!linkToken}
            onClick={() => {
              setBusy(true);
              setError("");
              void call<{ link_token: string }>(
                "/api/plaid/link-token",
                "POST",
                {},
              )
                .then((r) => setLinkToken(r.link_token))
                .catch((e: Error) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Opening Plaid…" : "Link with Plaid"} <Landmark size={18} />
          </button>
        )}
      </div>
    </>
  );
}

function TrialStep({
  heading,
  busy,
  onSubmit,
}: {
  heading: HeadingRef;
  busy: boolean;
  onSubmit: (body: {
    merchant: string;
    nextDate: string;
    amount: number;
  }) => Promise<void>;
}) {
  const [min] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <>
      <h1 id="ob-title" ref={heading} tabIndex={-1}>
        Add a free trial you’re on
      </h1>
      <p>Brix reminds you 7 days and 2 days before it turns into a bill.</p>
      <form
        className="ob__form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void onSubmit({
            merchant: String(f.get("merchant") ?? "").trim(),
            nextDate: String(f.get("nextDate") ?? ""),
            amount: Number(f.get("amount")),
          });
        }}
      >
        <label className="field">
          Trial name
          <input
            name="merchant"
            required
            maxLength={100}
            placeholder="e.g. Notion AI"
          />
        </label>
        <div className="ob__row">
          <label className="field">
            Trial ends
            <input name="nextDate" type="date" required min={min} />
          </label>
          <label className="field">
            Price after trial (USD)
            <input
              name="amount"
              type="number"
              required
              min="0"
              max="10000"
              step="0.01"
              inputMode="decimal"
              placeholder="10.00"
            />
          </label>
        </div>
        <div className="ob__actions">
          <button className="btn btn--primary btn--lg" disabled={busy}>
            {busy ? "Adding…" : "Add trial"} <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </>
  );
}

function RemindersStep({
  heading,
  state,
  busy,
  onSubmit,
}: {
  heading: HeadingRef;
  state: ClientState | null;
  busy: boolean;
  onSubmit: (prefs: {
    whatsappOptIn: boolean;
    callOptIn: boolean;
  }) => Promise<void>;
}) {
  const verified = !!state?.user.phoneE164;
  return (
    <>
      <h1 id="ob-title" ref={heading} tabIndex={-1}>
        Where should reminders reach you?
      </h1>
      <p>
        Reminders always show up in the app. WhatsApp and phone calls are
        optional.
      </p>
      <form
        className="ob__form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void onSubmit({
            whatsappOptIn: f.get("whatsapp") === "on",
            callOptIn: f.get("calls") === "on",
          });
        }}
      >
        <label className="ob__toggle is-locked">
          <div>
            <strong>In the app</strong>
            <span>Always on.</span>
          </div>
          <input
            className="switch"
            type="checkbox"
            checked
            readOnly
            disabled
            aria-label="In-app reminders, always on"
          />
        </label>
        <label className={`ob__toggle${verified ? "" : " is-locked"}`}>
          <div>
            <strong>WhatsApp</strong>
            <span>A message 7 and 2 days before a charge.</span>
          </div>
          <input
            className="switch"
            type="checkbox"
            name="whatsapp"
            disabled={!verified}
            defaultChecked={state?.user.whatsappOptIn}
          />
        </label>
        <label className={`ob__toggle${verified ? "" : " is-locked"}`}>
          <div>
            <strong>Phone call</strong>
            <span>Brix calls you about the charge.</span>
          </div>
          <input
            className="switch"
            type="checkbox"
            name="calls"
            disabled={!verified}
            defaultChecked={state?.user.callOptIn}
          />
        </label>
        {!verified && (
          <div className="ob__note">
            <Phone size={16} />
            <span>
              WhatsApp and calls need a verified phone. You can add one later in{" "}
              <Link href="/connect">Connections</Link>.
            </span>
          </div>
        )}
        <div className="ob__actions">
          <button className="btn btn--primary btn--lg" disabled={busy}>
            {busy ? "Saving…" : "Save and continue"} <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </>
  );
}
