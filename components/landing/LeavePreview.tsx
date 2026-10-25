"use client";
import { useState } from "react";
import { Check, Landmark, Trash2 } from "lucide-react";

type Row = "bank" | "data";
type Status = "idle" | "confirm" | "done";

/**
 * A working copy of the "Your data" block from Settings, on sample data. Each
 * action asks once, then shows what happened. Nothing here touches an account.
 */
export default function LeavePreview() {
  const [status, setStatus] = useState<Record<Row, Status>>({ bank: "idle", data: "idle" });
  const set = (row: Row, s: Status) => setStatus((v) => ({ ...v, [row]: s }));
  const rows: {
    id: Row;
    icon: typeof Landmark;
    title: string;
    detail: string;
    action: string;
    ask: string;
    done: string;
  }[] = [
    {
      id: "bank",
      icon: Landmark,
      title: "Linked bank",
      detail: "Plaid · read-only · Checking ••4821",
      action: "Disconnect",
      ask: "Disconnect all linked banks?",
      done: "Bank disconnected. Brix can’t see new charges.",
    },
    {
      id: "data",
      icon: Trash2,
      title: "Your Brix data",
      detail: "Charges, trials, reminders, chat history",
      action: "Delete",
      ask: "Delete everything Brix stored?",
      done: "Deleted. You’re signed out.",
    },
  ];
  return (
    <div className="leave" aria-label="Settings preview with sample data" role="group">
      <div className="leave__head">
        <span>Settings</span>
        <span>Your data</span>
      </div>
      {rows.map((r) => {
        const s = status[r.id];
        return (
          <div key={r.id} className={`leave__row leave__row--${s}`}>
            <span className={`leave__icon leave__icon--${r.id}`}>
              {s === "done" ? <Check size={16} /> : <r.icon size={16} />}
            </span>
            <div className="leave__text">
              <strong>{s === "confirm" ? r.ask : r.title}</strong>
              <small aria-live="polite">{s === "done" ? r.done : r.detail}</small>
            </div>
            {s === "idle" && (
              <button
                type="button"
                className={`btn btn--sm${r.id === "data" ? " btn--danger" : ""}`}
                onClick={() => set(r.id, "confirm")}
              >
                {r.action}
              </button>
            )}
            {s === "confirm" && (
              <span className="leave__confirm">
                <button type="button" className="btn btn--sm btn--ghost" onClick={() => set(r.id, "idle")}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn btn--sm ${r.id === "data" ? "btn--danger-fill" : "btn--dark"}`}
                  onClick={() => set(r.id, "done")}
                >
                  {r.action}
                </button>
              </span>
            )}
            {s === "done" && (
              <button type="button" className="leave__undo" onClick={() => set(r.id, "idle")}>
                Reset preview
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
