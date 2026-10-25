"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, X } from "lucide-react";
import BrixBuddy from "./BrixBuddy";
import "./chat.css";
import StreamingText from "./StreamingText";
import Tapbacks from "./Tapbacks";
import type { BuddyMood } from "@/lib/agent/persona";
import type { BrixChatApi } from "./useBrixChat";

const STATUS: Record<BuddyMood, string> = {
  idle: "Online",
  listening: "Listening…",
  thinking: "Checking your charges…",
  talking: "Typing…",
  happy: "Glad to help",
  celebrate: "One less charge",
  concerned: "Keeping an eye on something",
  error: "Hmm, that didn't work",
};

export default function BrixChat({
  chat,
  onClose,
}: {
  chat: BrixChatApi;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    field.current?.focus();
  }, []);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".tapback__menu"))
        onClose();
      // Keep Tab inside the chat while it's open.
      const node = root.current;
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    const node = list.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy, streamingId]);
  // Keep the view pinned while a reply streams in.
  useEffect(() => {
    if (!streamingId) return;
    const node = list.current;
    const id = setInterval(() => {
      if (node) node.scrollTop = node.scrollHeight;
    }, 120);
    return () => clearInterval(id);
  }, [streamingId]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await send(text);
    field.current?.focus();
  }

  return (
    <section
      ref={root}
      className={`chat chat--${mood}`}
      role="dialog"
      aria-modal="true"
      aria-label="Talk with Brix"
    >
      <header className="chat__header">
        <span className="chat__avatar">
          <BrixBuddy mood={mood} scale={0.19} />
        </span>
        <div className="chat__title">
          <strong>Brix</strong>
          <small aria-live="polite">
            {mood === "concerned" && headsUp ? `Heads up: ${headsUp}` : STATUS[mood]}
          </small>
        </div>
        <button
          className="icon-btn"
          aria-label="Close chat"
          onClick={onClose}
          type="button"
        >
          <X size={20} />
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
