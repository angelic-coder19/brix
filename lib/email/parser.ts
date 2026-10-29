import { createHash } from "node:crypto";
import type { EmailCandidate } from "./types";
export interface GmailMessage {
  id?: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    filename?: string;
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: GmailMessage["payload"][];
  };
}
const MERCHANTS: Record<string, string> = {
  "spotify.com": "Spotify",
  "netflix.com": "Netflix",
  "adobe.com": "Adobe",
  "adobe.io": "Adobe",
  "apple.com": "Apple",
  "google.com": "Google",
  "youtube.com": "YouTube",
  "microsoft.com": "Microsoft",
  "notion.so": "Notion",
  "notion.com": "Notion",
  "canva.com": "Canva",
  "dropbox.com": "Dropbox",
  "github.com": "GitHub",
  "openai.com": "OpenAI",
  "disneyplus.com": "Disney+",
  "hulu.com": "Hulu",
  "amazon.com": "Amazon",
};
function plainText(part: GmailMessage["payload"], depth = 0): string {
  if (!part || depth > 8 || part.filename) return "";
  if (part.mimeType === "text/plain" && part.body?.data)
    return Buffer.from(part.body.data.slice(0, 100000), "base64url")
      .toString("utf8")
      .slice(0, 50000);
  if (part.parts?.length) {
    const text = part.parts
      .slice(0, 15)
      .map((p) => plainText(p, depth + 1))
      .filter(Boolean);
    if (text.length) return text.join("\n").slice(0, 50000);
  }
  if (part.mimeType === "text/html" && part.body?.data)
    return Buffer.from(part.body.data.slice(0, 100000), "base64url")
      .toString("utf8")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .slice(0, 50000);
  return "";
}
export function parseSubscriptionEmail(
  message: GmailMessage,
): EmailCandidate | null {
  if (!message.id) return null;
  const headers = message.payload?.headers ?? [];
  const header = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  const sender = header("from");
  const addresses = [
    ...sender.matchAll(
      /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@([a-z0-9.-]+\.[a-z]{2,})/gi,
    ),
  ];
  if (addresses.length !== 1) return null;
  const domain = addresses[0][1].toLowerCase();
  const known = Object.keys(MERCHANTS).find(
    (d) => domain === d || domain.endsWith(`.${d}`),
  );
  if (!known) return null;
  const subject = header("subject")
    .replace(/[\r\n\x00-\x1f]/g, " ")
    .slice(0, 160);
  const text = `${subject}\n${plainText(message.payload)}`;
  if (
    !/\b(subscription|membership|renew(?:al|s|ing)?|free trial|trial (?:ends|expires))\b/i.test(
      text,
    )
  )
    return null;
  // Broad email consent is needed for message bodies, but extraction stays local:
  // no model calls, remote image loading, links, attachments, or raw email storage.
  const amounts = [
    ...text.matchAll(
      /(?:\bUSD\s*|\$\s*)(\d{1,5}(?:,\d{3})*(?:\.\d{2})?)(?![\d.])/gi,
    ),
  ].map((m) => Number(m[1].replaceAll(",", "")));
  const distinct = [...new Set(amounts)];
  const amount =
    !/\b(CAD|AUD|NZD|SGD|HKD|MXN|EUR|GBP)\b|[€£]/i.test(text) &&
    distinct.length === 1 &&
    distinct[0] > 0 &&
    distinct[0] <= 100000
      ? distinct[0]
      : null;
  const frequency =
    /\b(annually|annual subscription|per year|yearly)\b|\/year\b/i.test(text)
      ? "annual"
      : /\b(monthly|per month)\b|\/mo(?:nth)?\b/i.test(text)
        ? "monthly"
        : /\b(weekly|per week)\b/i.test(text)
          ? "weekly"
          : "unknown";
  const dateMatch = text.match(
    /(?:renew(?:s|al)?|next (?:billing|payment|charge)|trial (?:ends|expires)|will be charged)[^\n.!?]{0,45}?\b(\d{4}-\d{2}-\d{2})\b/i,
  );
  let nextDate: string | null = null;
  if (
    dateMatch &&
    Number.isFinite(Date.parse(dateMatch[1])) &&
    new Date(dateMatch[1]).toISOString().slice(0, 10) === dateMatch[1]
  )
    nextDate = dateMatch[1];
  const received = Number(message.internalDate);
  if (
    !Number.isFinite(received) ||
    received <= 0 ||
    received > 8640000000000000
  )
    return null;
  return {
    id: createHash("sha256").update(message.id).digest("hex").slice(0, 32),
    merchant: MERCHANTS[known],
    amount,
    nextDate,
    frequency,
    kind: /\b(?:free trial|trial (?:ends|expires))\b/i.test(text)
      ? "trial"
      : "subscription",
    subject,
    senderDomain: domain,
    receivedAt: new Date(received).toISOString(),
  };
}
