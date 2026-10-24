"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, X } from "lucide-react";
import BrixBuddy from "./BrixBuddy";
import StreamingText from "./StreamingText";
import Tapbacks from "./Tapbacks";
import type { BuddyMood } from "@/lib/agent/persona";
import type { BrixChatApi } from "./useBrixChat";

const STATUS: Record<BuddyMood, string> = {
  idle: "Here when you need me",
  listening: "Listening…",
  thinking: "Typing…",
  talking: "Typing…",
  happy: "Glad to help",
  celebrate: "Brick by brick!",
  concerned: "Heads up",
  error: "Hmm, that didn’t work",
};

export default function BrixChat({
  chat,
  onClose,
}: {
  chat: BrixChatApi;
  onClose: () => void;
}) {
  const {
    messages,
    busy,
    mood,
    streamingId,
    finishStreaming,
    suggestions,
    send,
    react,
    typing,
    celebration,
    headsUp,
  } = chat;
  const [input, setInput] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Keep the newest message in view, including while a reply streams in.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    if (!streamingId) return;
    const id = setInterval(() => {
      el.scrollTop = el.scrollHeight;
    }, 120);
    return () => clearInterval(id);
  }, [messages.length, busy, streamingId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = input;
    if (!text.trim()) return;
    setInput("");
    const ok = await send(text);
    if (!ok) setInput(text);
  }

  const status =
    mood === "concerned" && headsUp ? `Heads up: ${headsUp}` : STATUS[mood];

  return (
    <section
      className={`chat chat--${mood}`}
      role="dialog"
      aria-label="Talk with Brix"
    >
      <header className="chat__header">
        <span className="chat__avatar">
          <BrixBuddy mood={mood} scale={0.19} decorative follow={false} />
        </span>
        <div className="chat__title">
          <strong>Brix</strong>
          <small aria-live="polite">{status}</small>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          aria-label="Close chat"
        >
          <X size={18} />
        </button>
      </header>
      <div className="chat__messages" ref={list} role="log" aria-live="polite">
        <div className="msg msg--assistant">
          <div className="msg__bubble">
            Hey! Ask me what’s coming up, set a reminder, or mark a charge to
            cancel. I’ll always check with you before I act.
          </div>
        </div>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`msg msg--${m.role}${m.error ? " msg--error" : ""}${m.pending ? " msg--pending" : ""}`}
            data-testid={`chat-${m.role}`}
          >
            <div
              className="msg__bubble"
              onDoubleClick={
                m.role === "assistant" && m.persisted
                  ? () => void react(m.id, m.reaction === "❤️" ? null : "❤️")
                  : undefined
              }
            >
              {m.id === streamingId ? (
                <StreamingText text={m.text} onDone={finishStreaming} />
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
            {m.role === "assistant" && m.persisted && m.id !== streamingId && (
              <Tapbacks message={m} onReact={(emoji) => void react(m.id, emoji)} />
            )}
          </div>
        ))}
        {busy && (
          <div className="msg msg--assistant" role="status">
            <div className="msg__bubble typing" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <span className="sr-only">Brix is typing</span>
          </div>
        )}
      </div>
      {!busy && !streamingId && suggestions.length > 0 && (
        <div className="chat__chips" role="group" aria-label="Suggested replies">
          {suggestions.map((s) => (
            <button
              type="button"
              key={s}
              className="chip"
              onClick={() => void send(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <form className="chat__composer" onSubmit={(e) => void submit(e)}>
        <input
          ref={field}
          className="input"
          aria-label="Message Brix"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            typing(e.target.value);
          }}
          placeholder="Ask me anything about your charges…"
          maxLength={2000}
          autoComplete="off"
        />
        <button
          className="btn btn--primary chat__send"
          disabled={busy || !input.trim()}
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </form>
      {celebration > 0 && (
        <div className="chat__confetti" key={celebration} aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      )}
    </section>
  );
}
