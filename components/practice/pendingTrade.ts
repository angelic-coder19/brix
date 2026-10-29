"use client";
import { useSyncExternalStore } from "react";

// The practice trade waiting on Confirm, so Ask Brix can explain the exact
// trade the student is looking at. Lives only in this tab's memory.

export interface PendingTrade {
  symbol: string;
  side: "buy" | "sell";
  amount: number;
}

let current: PendingTrade | null = null;
const listeners = new Set<() => void>();

export function setPendingTrade(trade: PendingTrade | null) {
  current = trade;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePendingTrade() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/** "buy $20.00 of MSFT with practice money" */
export function describeTrade(t: PendingTrade) {
  const amount = t.amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return `${t.side} ${amount} of ${t.symbol} with practice money`;
}
