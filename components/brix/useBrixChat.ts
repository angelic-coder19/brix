"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isChargeImminent,
  nextLiveCharge,
  daysUntil,
  suggestionsFor,
  type AgentMeta,
  type BuddyMood,
  type Tapback,
} from "@/lib/agent/persona";
import type { AppState } from "@/lib/types";

export type ClientState = AppState & { demo?: boolean };
export type RequestFn = <T = unknown>(
  path: string,
  method?: string,
  body?: unknown,
) => Promise<T>;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  reaction?: string;
  /** Where the reply's facts came from. */
  sources?: string[];
  /** Persisted on the server, so it can receive a tapback. */
  persisted: boolean;
  pending?: boolean;
  error?: boolean;
}

interface ChatResponse {
  reply: string;
  meta: AgentMeta;
  userEventId: string;
  assistantEventId: string;
  state: ClientState;
}

const HISTORY = 40;
const TAPBACK_MOOD: Record<Tapback, BuddyMood> = {
  "❤️": "happy",
  "👍": "happy",
  "😂": "happy",
  "🙏": "happy",
  "😮": "listening",
  "👎": "concerned",
};

export function useBrixChat({
  state,
  setState,
  request,
}: {
  state: ClientState | null;
  setState: (s: ClientState) => void;
  request: RequestFn;
}) {
  const [local, setLocal] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [transient, setTransient] = useState<BuddyMood | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<AgentMeta | null>(null);
  const [celebration, setCelebration] = useState(0);
  const [reactionOverrides, setReactionOverrides] = useState<
    Record<string, string | null>
  >({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const counter = useRef(0);

  const flash = useCallback((mood: BuddyMood | null, ms = 3500) => {
    clearTimeout(timer.current);
    setTransient(mood);
    if (mood && ms > 0)
      timer.current = setTimeout(() => setTransient(null), ms);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const serverMessages = useMemo<ChatMessage[]>(() => {
    if (!state) return [];
    return state.events
      .filter(
        (e) =>
          e.type === "agent_message" &&
          e.channel === "web" &&
          (e.role === "user" || e.role === "assistant"),
      )
      .slice(0, HISTORY)
      .reverse()
      .map((e) => {
        const override = reactionOverrides[e.id];
        const reaction = override === undefined ? e.reaction : override;
        return {
          id: e.id,
          role: e.role as "user" | "assistant",
          text: e.text,
          persisted: true,
          ...(reaction ? { reaction } : {}),
          ...(e.sources?.length ? { sources: e.sources } : {}),
        };
      });
  }, [state, reactionOverrides]);

  const messages = useMemo(
    () => [...serverMessages, ...local],
    [serverMessages, local],
  );

  const charges = useMemo(() => state?.charges ?? [], [state]);
  const hasPending = !!state?.pendingActions?.web;
  const baseMood: BuddyMood = isChargeImminent(charges) ? "concerned" : "idle";
  const mood: BuddyMood =
    transient ?? (busy ? "thinking" : streamingId ? "talking" : baseMood);

  const suggestions = useMemo(
    () =>
      lastMeta && (lastMeta.suggestions[0] === "Yes") === hasPending
        ? lastMeta.suggestions
        : suggestionsFor(charges, hasPending),
    [lastMeta, charges, hasPending],
  );

  const next = nextLiveCharge(charges);
  const headsUp = next
    ? `${next.merchant} ${next.status === "trial" ? "trial ends" : "renews"} ${
        daysUntil(next.nextDate) === 0
          ? "today"
          : daysUntil(next.nextDate) === 1
            ? "tomorrow"
            : `in ${daysUntil(next.nextDate)} days`
      }`
    : null;

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, 2000);
      if (!text || busy) return false;
      const localId = `local-${++counter.current}`;
      setLocal((m) => [
        ...m.filter((x) => !x.error),
        { id: localId, role: "user", text, persisted: false, pending: true },
      ]);
      setBusy(true);
      setStreamingId(null);
      flash(null);
      try {
        const result = await request<ChatResponse>("/api/agent", "POST", {
          message: text,
        });
        setState(result.state);
        setLocal((m) => m.filter((x) => x.id !== localId));
        setLastMeta(result.meta);
        setStreamingId(result.assistantEventId);
        return true;
      } catch (error) {
        setLocal((m) => [
          ...m.map((x) => (x.id === localId ? { ...x, pending: false } : x)),
          {
            id: `local-${++counter.current}`,
            role: "assistant",
            text:
              (error as Error).message ||
              "Something went wrong. Please try again.",
            persisted: false,
            error: true,
          },
        ]);
        flash("error", 4000);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, flash, request, setState],
  );

  /** Called by the streaming bubble once the reply is fully on screen. */
  const finishStreaming = useCallback(() => {
    setStreamingId(null);
    if (lastMeta) {
      flash(lastMeta.mood, lastMeta.mood === "celebrate" ? 3200 : 4000);
      if (lastMeta.celebrate) setCelebration((n) => n + 1);
    }
  }, [flash, lastMeta]);

  const react = useCallback(
    async (eventId: string, emoji: Tapback | null) => {
      setReactionOverrides((r) => ({ ...r, [eventId]: emoji }));
      if (emoji) flash(TAPBACK_MOOD[emoji], 2500);
      try {
        await request("/api/agent/react", "POST", { eventId, emoji });
      } catch {
        setReactionOverrides((r) => {
          const copy = { ...r };
          delete copy[eventId];
          return copy;
        });
      }
    },
    [flash, request],
  );

  /** Stream a reply that was created outside the chat box (e.g. a card proposal). */
  const stream = useCallback((eventId: string) => {
    setLastMeta(null);
    setStreamingId(eventId);
  }, []);

  /** Something good happened outside chat (e.g. a trial was flagged). */
  const celebrate = useCallback(() => {
    flash("celebrate", 3200);
    setCelebration((n) => n + 1);
  }, [flash]);

  const typing = useCallback(
    (value: string) => {
      if (busy || streamingId) return;
      flash(value.trim() ? "listening" : null, value.trim() ? 2500 : 0);
    },
    [busy, flash, streamingId],
  );

  return {
    messages,
    busy,
    mood,
    streamingId,
    finishStreaming,
    suggestions,
    send,
    react,
    typing,
    celebrate,
    stream,
    celebration,
    headsUp,
    flash,
  };
}
export type BrixChatApi = ReturnType<typeof useBrixChat>;
