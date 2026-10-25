"use client";
import { useState } from "react";
import { signInWithCustomToken } from "firebase/auth";
import { MessageSquare } from "lucide-react";
import { getClientAuth } from "@/lib/firebase/client";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw new Error(data?.error || "Something went wrong. Try again.");
  return data as T;
}

/** Sign in with a one-time code texted through Twilio Verify. */
export default function SmsSignIn() {
  const [open, setOpen] = useState(false),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => setOpen(true)}
      >
        <MessageSquare size={17} /> Sign in with a text message
      </button>
    );

  return (
    <form
      className="sms-sign-in"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          if (!sent) {
            await post("/api/auth/sms/start", { phone });
            setSent(true);
            return;
          }
          const auth = getClientAuth();
          if (!auth) throw new Error("Sign-in isn't configured.");
          const { token } = await post<{ token: string }>(
            "/api/auth/sms/verify",
            { phone, code },
          );
          const { user } = await signInWithCustomToken(auth, token);
          await fetch("/api/auth/profile", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${await user.getIdToken()}`,
            },
            body: "{}",
          });
        });
      }}
    >
      <label className="field">
        Mobile number
        <input
          type="tel"
          autoComplete="tel"
          required
          placeholder="+1 555 123 4567"
          value={phone}
          disabled={sent}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      {sent && (
        <label className="field">
          Code from the text
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="[0-9]{4,10}"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
      )}
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn--primary" disabled={busy}>
        {sent ? "Verify and sign in" : "Text me a code"}
      </button>
      {sent && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={busy}
          onClick={() => {
            setSent(false);
            setCode("");
          }}
        >
          Use a different number
        </button>
      )}
    </form>
  );
}
