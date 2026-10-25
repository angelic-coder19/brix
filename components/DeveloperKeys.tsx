"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { ConfirmAction } from "./ui/ConfirmAction";
import type { RequestFn } from "./brix/useBrixChat";

interface ApiKey {
  id: string;
  name: string;
  preview: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
}

const DEFAULT_SCOPES = ["charges:read", "reminders:read"];
const when = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Never";

/** Developers panel for personal API keys. Secrets are shown once, right after creation. */
export default function DeveloperKeys({ request }: { request: RequestFn }) {
  const [keys, setKeys] = useState<ApiKey[] | null>(null),
    [scopes, setScopes] = useState<Record<string, string>>({}),
    [secret, setSecret] = useState(""),
    [copied, setCopied] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await request<{
        keys: ApiKey[];
        scopes: Record<string, string>;
      }>("/api/developer/keys");
      setKeys(data.keys);
      setScopes(data.scopes);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request]);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    return () => clearTimeout(first);
  }, [load]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card form-card settings" aria-labelledby="api-keys">
      <KeyRound size={26} />
      <h2 id="api-keys">Developer API keys</h2>
      <p>
        Let your own scripts and apps read your charges and set reminders. Keys
        act as you, so keep them on a server and never in a web page.{" "}
        <Link href="/developers" className="text-link">
          Read the API docs
        </Link>
        .
      </p>
      {secret && (
        <div className="key-secret" role="status">
          <strong>Copy your key now. You won’t see it again.</strong>
          <div className="key-secret__row">
            <code>{secret}</code>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                void navigator.clipboard?.writeText(secret).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setSecret("")}
          >
            I’ve saved it
          </button>
        </div>
      )}
      <form
        className="key-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form);
          void run(async () => {
            const result = await request<{ secret: string }>(
              "/api/developer/keys",
              "POST",
              { name: f.get("name"), scopes: f.getAll("scope") },
            );
            setSecret(result.secret);
            form.reset();
          });
        }}
      >
        <label className="field">
          Key name
          <input
            name="name"
            required
            maxLength={60}
            placeholder="e.g. Budget spreadsheet"
          />
        </label>
        <fieldset className="scope-list">
          <legend>Permissions</legend>
          {Object.entries(scopes).map(([scope, description]) => (
            <label key={scope} className="scope-option">
              <input
                type="checkbox"
                name="scope"
                value={scope}
                defaultChecked={DEFAULT_SCOPES.includes(scope)}
              />
              <span>
                <code>{scope}</code>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <button className="btn btn--primary" disabled={busy}>
          Create key
        </button>
      </form>
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
      {keys === null ? (
        <p className="muted">Loading keys…</p>
      ) : keys.length ? (
        <ul className="key-list">
          {keys.map((k) => (
            <li key={k.id}>
              <div>
                <strong>{k.name}</strong>
                <code>{k.preview}</code>
                <small>
                  {k.scopes.join(", ")} · Created {when(k.createdAt)} · Last
                  used {when(k.lastUsedAt)}
                </small>
              </div>
              <ConfirmAction
                className="btn btn--danger btn--sm"
                ariaLabel={`Revoke ${k.name}`}
                icon={<Trash2 size={15} />}
                label="Revoke"
                question={`Revoke “${k.name}”? Apps using it stop working right away.`}
                confirmLabel="Revoke key"
                tone="danger"
                disabled={busy}
                onConfirm={() =>
                  void run(async () => {
                    await request(`/api/developer/keys/${k.id}`, "DELETE");
                  })
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No keys yet.</p>
      )}
    </section>
  );
}
