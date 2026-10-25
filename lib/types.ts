export type Channel = "web" | "whatsapp" | "voice" | "system" | "api";
export interface Charge {
  id: string;
  kind: "subscription" | "trial";
  merchant: string;
  amount: number;
  frequency: "weekly" | "monthly" | "annual" | "unknown";
  lastDate: string | null;
  nextDate: string;
  status: "active" | "to_cancel" | "cancelled" | "trial";
  source: "plaid" | "manual" | "agent";
  cancelUrl?: string;
  usageNote?: string;
  plaidStreamId?: string;
}
export interface Reminder {
  id: string;
  chargeId: string;
  remindAt: string;
  channel: "whatsapp" | "call" | "push";
  sent: boolean;
  status?: "pending" | "sending" | "sent" | "failed";
  providerId?: string;
  error?: string;
  createdBy: Channel;
}
export interface VirtualCard {
  id: string;
  last4: string;
  purpose: string;
  spendLimit: number;
  state: "OPEN" | "CLOSED" | "PAUSED";
  source: "mock" | "lithic";
  createdAt?: string;
}
export interface ActivityEvent {
  id: string;
  type: string;
  channel: Channel;
  text: string;
  createdAt: string;
  amountSaved?: number;
  role?: "user" | "assistant";
  /** Emoji reaction left on this chat message by the other party. */
  reaction?: string;
  requestId?: string;
  /** Charge this event refers to, when there is one. */
  chargeId?: string;
}
export interface PendingAction {
  status?: "processing" | "failed";
  id: string;
  name: string;
  args: Record<string, unknown>;
  summary: string;
  expiresAt: string;
}
export interface AppState {
  pendingActions?: Partial<Record<Channel, PendingAction>>;
  user: {
    uid: string;
    displayName: string;
    email: string;
    phoneE164?: string;
    whatsappOptIn: boolean;
    callOptIn: boolean;
  };
  charges: Charge[];
  reminders: Reminder[];
  cards: VirtualCard[];
  events: ActivityEvent[];
}
export interface UserSecret {
  pinHash?: string;
  plaidAccessTokens?: Record<string, string>;
  plaidCursors?: Record<string, string>;
  [key: string]: unknown;
}
