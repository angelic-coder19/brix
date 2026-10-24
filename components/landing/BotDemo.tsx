"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import BrixBuddy from "@/components/brix/BrixBuddy";
import StreamingText from "@/components/brix/StreamingText";
import Tapbacks from "@/components/brix/Tapbacks";
import {
  reactionFor,
  type AgentOutcome,
  type BuddyMood,
  type Tapback,
} from "@/lib/agent/persona";
import "@/components/brix/chat.css";

/*
 * A self-contained preview of the Brix chat on the landing page.
 * It runs in the browser on sample data (no account, no API calls) but uses
 * the same personality rules as the real assistant: moods, emoji reactions,
 * confirmation before every action, and quick replies.
 */
type Msg = {
  id: number;
  role: "user" | "assistant";
  text: string;
  reaction?: string;
};
type Pending = { kind: "cancel" | "remind"; merchant: string } | null;

const SAMPLE = [
  { merchant: "Spotify", amount: 11.99, days: 2 },
  { merchant: "Netflix", amount: 15.49, days: 5 },
  { merchant: "Adobe", amount: 9.99, days: 9 },
  { merchant: "Notion AI", amount: 10, days: 12, trial: true },
];
const inDays = (d: number) =>
  d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;

function respond(
  input: string,
  pending: Pending,
  saved: number,
): {
  reply: string;
  outcome: AgentOutcome;
  action?: string;
  mood: BuddyMood;
  pending: Pending;
  saved: number;
} {
  const lower = input.toLowerCase();
  const match = SAMPLE.find((c) => lower.includes(c.merchant.toLowerCase()));
  if (/^(yes|yep|yes please|confirm|go ahead)[.!]?$/i.test(input.trim())) {
    if (!pending)
      return {
        reply: "No pending action. Ask me what you'd like to do first.",
        outcome: "answered",
        mood: "idle",
        pending,
        saved,
      };
    const charge = SAMPLE.find((c) => c.merchant === pending.merchant)!;
    if (pending.kind === "cancel")
      return {
        reply: `${charge.merchant} is marked to cancel. 🎉 Finish on their site and you'll skip ${"$" + charge.amount.toFixed(2)} this month.`,
        outcome: "confirmed",
        action: "mark_to_cancel",
        mood: "celebrate",
        pending: null,
        saved: saved + charge.amount,
      };
    return {
      reply: `Reminder set for ${charge.merchant}. I'll ping you 2 days before it renews.`,
      outcome: "confirmed",
      action: "set_reminder",
      mood: "happy",
      pending: null,
      saved,
    };
  }
  if (/^(no|nope|never mind|nevermind|stop)[.!]?$/i.test(input.trim()))
    return {
      reply: "Okay, I cleared that. Nothing changed.",
      outcome: "cleared",
      mood: "idle",
      pending: null,
      saved,
    };
  if (/cancel/.test(lower)) {
    if (!match)
      return {
        reply: "Which one? Try Spotify, Netflix, Adobe, or Notion AI.",
        outcome: "answered",
        mood: "listening",
        pending,
        saved,
      };
    return {
      reply: `Mark ${match.merchant} ($${match.amount.toFixed(2)}) to cancel? You'll still finish on the merchant's site. Reply yes to confirm.`,
      outcome: "proposed",
      mood: "listening",
      pending: { kind: "cancel", merchant: match.merchant },
      saved,
    };
  }
  if (/remind/.test(lower)) {
    const target = match ?? SAMPLE[0];
    return {
      reply: `Remind you about ${target.merchant} 2 days before it renews? Reply yes to confirm.`,
      outcome: "proposed",
      mood: "listening",
      pending: { kind: "remind", merchant: target.merchant },
      saved,
    };
  }
  if (/sav|avoid/.test(lower))
    return {
      reply: saved
        ? `You've marked $${saved.toFixed(2)} to avoid in this preview (estimated). Brick by brick!`
        : "Nothing marked yet. Try “Mark Netflix to cancel”.",
      outcome: "answered",
      mood: saved ? "happy" : "idle",
      pending,
      saved,
    };
  if (/trial/.test(lower)) {
    const trial = SAMPLE.find((c) => c.trial)!;
    return {
      reply: `${trial.merchant} is a free trial that turns into $${trial.amount.toFixed(2)}/mo ${inDays(trial.days)}. Want a reminder before it does?`,
      outcome: "answered",
      mood: "concerned",
      pending,
      saved,
    };
  }
  if (match)
    return {
      reply: `${match.merchant} is $${match.amount.toFixed(2)} and ${match.trial ? "the trial ends" : "renews"} ${inDays(match.days)}. Want me to remind you or mark it to cancel?`,
      outcome: "answered",
      mood: match.days <= 3 ? "concerned" : "happy",
      pending,
      saved,
    };
  const soon = SAMPLE[0];
  return {
    reply: `Coming up: ${SAMPLE.slice(0, 3)
      .map((c) => `${c.merchant} $${c.amount.toFixed(2)} ${inDays(c.days)}`)
      .join(", ")}. Heads up, ${soon.merchant} is close.`,
    outcome: "answered",
    mood: "concerned",
    pending,
    saved,
  };
}

const START_CHIPS = ["What's coming up?", "Mark Netflix to cancel", "Remind me about Spotify"];
const TAPBACK_MOOD: Record<Tapback, BuddyMood> = {
  "❤️": "happy",
  "👍": "happy",
  "😂": "happy",
  "🙏": "happy",
  "😮": "listening",
  "👎": "concerned",
};

export default function BotDemo() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 0,
      role: "assistant",
      text: "Hi, I'm Brix! Tap a suggestion or ask me anything. I'll always check with you before I act.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState<number | null>(null);
  const [mood, setMood] = useState<BuddyMood>("idle");
  const [pending, setPending] = useState<Pending>(null);
  const [saved, setSaved] = useState(0);
  const [burst, setBurst] = useState(0);
  const after = useRef<{ mood: BuddyMood; celebrate: boolean } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const list = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const el = list.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    if (streaming === null) return;
    const id = setInterval(() => {
      el.scrollTop = el.scrollHeight;
    }, 120);
    return () => clearInterval(id);
  }, [messages.length, busy, streaming]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const send = (raw: string) => {
    const text = raw.trim().slice(0, 500);
    if (!text || busy || streaming !== null) return;
    const result = respond(text, pending, saved);
    const userId = nextId.current++;
    const botId = nextId.current++;
    setMessages((m) => [...m, { id: userId, role: "user", text }]);
    setInput("");
    setBusy(true);
    setMood("thinking");
    const reaction = reactionFor(text, result.outcome, result.action);
    later(() => {
      if (reaction)
        setMessages((m) =>
          m.map((x) => (x.id === userId ? { ...x, reaction } : x)),
        );
    }, 350);
    later(() => {
      setBusy(false);
      setPending(result.pending);
      setSaved(result.saved);
      setMood("talking");
      after.current = {
        mood: result.mood,
        celebrate: result.outcome === "confirmed",
      };
      setMessages((m) => [...m, { id: botId, role: "assistant", text: result.reply }]);
      setStreaming(botId);
    }, 750 + Math.min(600, text.length * 8));
  };

  const finish = useCallback(() => {
    setStreaming(null);
    const next = after.current;
    if (!next) return;
    setMood(next.mood);
    if (next.celebrate) setBurst((n) => n + 1);
    timers.current.push(setTimeout(() => setMood("idle"), 3500));
  }, []);

  const react = (id: number, emoji: Tapback | null) => {
    setMessages((m) =>
      m.map((x) => (x.id === id ? { ...x, reaction: emoji ?? undefined } : x)),
    );
    if (emoji) {
      setMood(TAPBACK_MOOD[emoji]);
      later(() => setMood("idle"), 2500);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const chips = pending
    ? ["Yes", "No"]
    : saved
      ? ["How much have I saved?", "What's coming up?", "Remind me about Adobe"]
      : START_CHIPS;

  return (
    <div className="bot-demo">
      <div className="bot-demo__stage" aria-hidden="true">
        <BrixBuddy mood={mood} scale={0.62} decorative />
      </div>
      <section
        className={`chat chat--inline chat--${mood}`}
        aria-label="Brix chat preview with sample data"
      >
        <header className="chat__header">
          <span className="chat__avatar">
            <BrixBuddy mood={mood} scale={0.19} decorative follow={false} />
          </span>
          <div className="chat__title">
            <strong>Brix</strong>
            <small>Preview · sample data, runs in your browser</small>
          </div>
          <span className="badge badge--green">Live</span>
        </header>
        <div className="chat__messages" ref={list} role="log" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`msg msg--${m.role}`}>
              <div
                className="msg__bubble"
                onDoubleClick={
                  m.role === "assistant"
                    ? () => react(m.id, m.reaction === "❤️" ? null : "❤️")
                    : undefined
                }
              >
                {m.id === streaming ? (
                  <StreamingText text={m.text} onDone={finish} />
                ) : (
                  m.text
                )}
              </div>
              {m.reaction && (
                <span
                  className="msg__reaction"
                  role="img"
                  aria-label={`${m.role === "user" ? "Brix reacted" : "You reacted"} ${m.reaction}`}
                >
                  {m.reaction}
                </span>
              )}
              {m.role === "assistant" && m.id !== streaming && (
                <Tapbacks message={m} onReact={(e) => react(m.id, e)} />
              )}
            </div>
          ))}
          {busy && (
            <div className="msg msg--assistant">
              <div className="msg__bubble typing" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <span className="sr-only">Brix is typing</span>
            </div>
          )}
        </div>
        {!busy && streaming === null && (
          <div className="chat__chips" role="group" aria-label="Suggested replies">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                className="chip"
                onClick={() => send(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <form className="chat__composer" onSubmit={submit}>
          <input
            className="input"
            aria-label="Message the Brix preview"
            placeholder="Try “Mark Netflix to cancel”"
            value={input}
            maxLength={500}
            onChange={(e) => {
              setInput(e.target.value);
              if (!busy && streaming === null)
                setMood(e.target.value.trim() ? "listening" : "idle");
            }}
          />
          <button
            className="btn btn--primary chat__send"
            aria-label="Send preview message"
            disabled={busy || !input.trim()}
          >
            <Send size={18} />
          </button>
        </form>
        {burst > 0 && (
          <div className="chat__confetti" key={burst} aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
