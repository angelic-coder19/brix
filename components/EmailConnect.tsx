"use client";
import { useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw, ArrowUpRight } from "lucide-react";
import type { RequestFn } from "./brix/useBrixChat";

type Candidate = {
  id: string;
  merchant: string;
  amount: number | null;
  nextDate: string | null;
  frequency: string;
  kind: string;
  subject: string;
  senderDomain: string;
  receivedAt: string;
};
type EmailStatus = {
  configured: boolean;
  connected: boolean;
  email?: string;
  lastScannedAt?: string;
  candidates: Candidate[];
  demo: boolean;
  setupRequired?: string;
};
export function EmailConnect({ request }: { request: RequestFn }) {
  const [status, setStatus] = useState<EmailStatus | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const load = useCallback(async () => {
    const next = await request<EmailStatus>("/api/email");
    setStatus(next);
    setSelected([]);
  }, [request]);
  useEffect(() => {
    let alive = true;
    void request<EmailStatus>("/api/email")
      .then((v) => {
        if (alive) setStatus(v);
      })
      .catch(() => {
        if (alive) setError("Email connections are unavailable right now.");
      });
    return () => {
      alive = false;
    };
  }, [request]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="card email-connect"
      aria-labelledby="email-connect-title"
    >
      <div className="email-connect__head">
        <Mail size={24} />
        <div>
          <h2 id="email-connect-title">Let your receipts do the work</h2>
          <p>
            Find subscription clues in Gmail. Review them before anything lands
            in your wallet.
          </p>
        </div>
      </div>
      <p className="muted">
        Read-only, with separate Google consent. Brix can’t send, change, or
        delete your emails. You choose what to import.
      </p>
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!status && !error && <p role="status">Checking your connection…</p>}
      {status && !status.connected && (
        <>
          <button
            className="btn btn--primary"
            disabled={busy || !status.configured || status.demo}
            onClick={() =>
              void run(async () => {
                const { url } = await request<{ url: string }>(
                  "/api/email/connect",
                  "POST",
                  {},
                );
                window.location.assign(url);
              })
            }
          >
            Connect Gmail <ArrowUpRight size={16} />
          </button>
          {status.demo ? (
            <p className="footnote">Demo mode doesn’t connect to your inbox.</p>
          ) : (
            !status.configured && (
              <p className="footnote">
                Gmail import isn’t enabled on this deployment yet. Bank sync and
                manual tracking are still available.
              </p>
            )
          )}
        </>
      )}
      {status?.connected && (
        <>
          <div className="button-row">
            <span className="badge">
              Connected{status.email ? ` · ${status.email}` : ""}
            </span>
            <button
              className="btn"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await request("/api/email/scan", "POST", {});
                  await load();
                  setNotice(
                    "Scan done. Check the details below; a receipt isn’t proof of an active subscription.",
                  );
                })
              }
            >
              <RefreshCw size={15} /> {busy ? "Working…" : "Scan receipts"}
            </button>
            <button
              className="btn btn--sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await request("/api/email", "DELETE");
                  await load();
                  setNotice("Gmail disconnected.");
                })
              }
            >
              Disconnect Gmail
            </button>
          </div>
          {!!status.candidates.length && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const candidates = status.candidates.filter((c) =>
                    selected.includes(c.id),
                  );
                  const result = await request<{
                    imported: number;
                    skipped: number;
                  }>("/api/email/import", "POST", { candidates });
                  await load();
                  setNotice(
                    `${result.imported} imported, ${result.skipped} already tracked. Your wallet is up to date.`,
                  );
                });
              }}
            >
              <h3>Looks recurring? You make the call.</h3>
              <p className="muted">
                Check the amount and next billing date. Nothing is added
                automatically.
              </p>
              <div className="email-candidates">
                {status.candidates.map((c) => (
                  <fieldset key={c.id}>
                    <legend>
                      <label>
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          onChange={(e) =>
                            setSelected((ids) =>
                              e.target.checked
                                ? [...ids, c.id]
                                : ids.filter((id) => id !== c.id),
                            )
                          }
                        />{" "}
                        {c.merchant}
                      </label>
                    </legend>
                    <p className="email-source">
                      {c.subject} · {c.senderDomain}
                    </p>
                    <div className="studio-fields">
                      <label className="field">
                        Merchant
                        <input
                          aria-label={`Merchant for ${c.merchant}`}
                          value={c.merchant}
                          required={selected.includes(c.id)}
                          onChange={(e) =>
                            setStatus({
                              ...status,
                              candidates: status.candidates.map((v) =>
                                v.id === c.id
                                  ? { ...v, merchant: e.target.value }
                                  : v,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        Amount (USD)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={c.amount ?? ""}
                          required={selected.includes(c.id)}
                          onChange={(e) =>
                            setStatus({
                              ...status,
                              candidates: status.candidates.map((v) =>
                                v.id === c.id
                                  ? {
                                      ...v,
                                      amount:
                                        e.target.value === ""
                                          ? null
                                          : Number(e.target.value),
                                    }
                                  : v,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        Next billing date
                        <input
                          type="date"
                          value={c.nextDate ?? ""}
                          required={selected.includes(c.id)}
                          onChange={(e) =>
                            setStatus({
                              ...status,
                              candidates: status.candidates.map((v) =>
                                v.id === c.id
                                  ? { ...v, nextDate: e.target.value }
                                  : v,
                              ),
                            })
                          }
                        />
                      </label>
                    </div>
                  </fieldset>
                ))}
              </div>
              <button
                className="btn btn--primary"
                disabled={busy || !selected.length}
              >
                Import {selected.length || "selected"} reviewed{" "}
                {selected.length === 1 ? "subscription" : "subscriptions"}
              </button>
            </form>
          )}
          {status.lastScannedAt && !status.candidates.length && (
            <p>
              No new subscription candidates. Try again after your next receipt.
            </p>
          )}
        </>
      )}
    </section>
  );
}
