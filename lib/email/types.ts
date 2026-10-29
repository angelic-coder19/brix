import type { Charge } from "../types";
export interface EmailCandidate {
  id: string;
  merchant: string;
  amount: number | null;
  nextDate: string | null;
  frequency: Charge["frequency"];
  kind: Charge["kind"];
  subject: string;
  senderDomain: string;
  receivedAt: string;
}
export interface GmailConnection {
  email: string;
  encryptedRefreshToken: string;
  connectedAt: string;
  lastScannedAt?: string;
  candidates: EmailCandidate[];
}
export interface EmailStatus {
  configured: boolean;
  connected: boolean;
  demo: boolean;
  email?: string;
  lastScannedAt?: string;
  candidates: EmailCandidate[];
  setupRequired?: string;
}
