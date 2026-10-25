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
  /** Card colour picked on the Cards page; graphite when absent. */
  design?: CardDesign;
}
export const CARD_DESIGNS = ["graphite", "clay", "cobalt"] as const;
export type CardDesign = (typeof CARD_DESIGNS)[number];
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
  /** Where an assistant reply's facts came from, shown under the message. */
  sources?: string[];
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
  /** Optional so accounts created before refunds existed still load. */
  refunds?: Refund[];
  giftCards?: GiftCard[];
}
/** A store gift card the student owns; unspent balances are easy to forget. */
export interface GiftCard {
  id: string;
  merchant: string;
  balance: number;
  /** Optional: many cards never expire, but promo cards often do. */
  expiresOn?: string;
  addedOn: string;
  status: "active" | "used";
}
export type RefundFunding =
  "loan" | "grant" | "scholarship" | "mixed" | "unknown";
export type LoanType =
  "subsidized" | "unsubsidized" | "private" | "parent_plus";
/** Money a school sent back after tuition: often partly borrowed. */
export interface Refund {
  id: string;
  amount: number;
  receivedOn: string;
  source: "plaid" | "manual";
  descriptor?: string;
  funding: RefundFunding;
  loanAmount?: number;
  /** Annual interest rate as a percentage, entered by the student. */
  loanRate?: number;
  loanType?: LoanType;
  status: "new" | "planned" | "dismissed";
  plan?: RefundPlan;
}
export interface RefundPlanInputs {
  monthsUntilNext: number;
  monthlyLiving: number;
  currentSavings: number;
  yearsUntilRepayment: number;
}
export interface RefundPlanStep {
  key: "essentials" | "emergency" | "return_loan" | "prepay_loan" | "save";
  label: string;
  amount: number;
  reason: string;
  link?: { label: string; href: string };
}
export interface RefundPlan {
  createdAt: string;
  inputs: RefundPlanInputs;
  steps: RefundPlanStep[];
  /** Last day to return Direct Loan money without interest or fees. */
  returnBy?: string;
  /** Interest the returned or prepaid loan money would have built, if a rate was given. */
  interestAvoided?: number;
  notes: string[];
  /** Virtual dollars for the practice portfolio; never real money. */
  practiceAmount: number;
}
export interface UserSecret {
  pinHash?: string;
  plaidAccessTokens?: Record<string, string>;
  plaidCursors?: Record<string, string>;
  [key: string]: unknown;
}
