import { randomUUID } from "node:crypto";
import { getState, updateState } from "../store";
import { isDemo } from "../auth";
import { sendWhatsApp } from "../twilio";
import { placeReminderCall } from "../vapi-calls";
import type { AppState, Reminder } from "../types";

/** Calls for the 2-day heads-up when allowed, otherwise WhatsApp, otherwise in-app. */
export function pickChannel(
  s: AppState,
  threshold: number,
): Reminder["channel"] {
  if (isDemo()) return "push";
  if (threshold === 2 && s.user.callOptIn && s.user.phoneE164) return "call";
  return s.user.whatsappOptIn ? "whatsapp" : "push";
}
/** A phone channel can be used only while the user still allows it. */
export function channelAllowed(s: AppState, channel: Reminder["channel"]) {
  if (channel === "whatsapp") return s.user.whatsappOptIn && !!s.user.phoneE164;
  if (channel === "call") return s.user.callOptIn && !!s.user.phoneE164;
  return true;
}
export async function runReminders(uid: string) {
  const now = new Date(),
    today = now.toISOString().slice(0, 10);
  await updateState(uid, (s) => {
    for (const charge of s.charges.filter(
      (c) => c.status === "active" || c.status === "trial",
    )) {
      const days = Math.ceil(
        (Date.parse(`${charge.nextDate}T00:00:00Z`) -
          Date.parse(`${today}T00:00:00Z`)) /
          86400000,
      );
      if (days < 0 || days > 7) continue;
      const threshold = days <= 2 ? 2 : 7,
        id = `auto:${charge.id}:${charge.nextDate}:${threshold}`;
      if (!s.reminders.some((r) => r.id === id))
        s.reminders.push({
          id,
          chargeId: charge.id,
          remindAt: now.toISOString(),
          channel: pickChannel(s, threshold),
          sent: false,
          createdBy: "system",
        });
    }
  });
  const due = (await getState(uid)).reminders.filter(
    (r) =>
      !r.sent &&
      !["sending", "failed"].includes(r.status || "") &&
      r.remindAt <= now.toISOString(),
  );
  let sent = 0,
    inApp = 0,
    skipped = 0,
    failed = 0;
  for (const reminder of due) {
    const state = await getState(uid),
      charge = state.charges.find((c) => c.id === reminder.chargeId);
    if (
      !charge ||
      charge.status === "to_cancel" ||
      charge.status === "cancelled"
    ) {
      skipped++;
      continue;
    }
    if (
      (isDemo() && reminder.channel !== "push") ||
      !channelAllowed(state, reminder.channel)
    ) {
      skipped++;
      continue;
    }
    let claimed = false;
    await updateState(uid, (s) => {
      claimed = false;
      const item = s.reminders.find((r) => r.id === reminder.id);
      const currentCharge = s.charges.find((c) => c.id === reminder.chargeId);
      if (
        !item ||
        item.sent ||
        item.status === "sending" ||
        item.status === "failed" ||
        !currentCharge ||
        currentCharge.status === "to_cancel" ||
        currentCharge.status === "cancelled" ||
        (item.channel !== "push" &&
          (!channelAllowed(s, item.channel) ||
            s.user.phoneE164 !== state.user.phoneE164))
      )
        return;
      item.status = "sending";
      claimed = true;
    });
    if (!claimed) continue;
    const text = `${charge.merchant}: $${charge.amount.toFixed(2)} expected ${charge.nextDate}${charge.kind === "trial" ? " when your trial ends" : ""}. Open Brix to set a reminder or mark it to cancel.`;
    try {
      const providerId =
        reminder.channel === "whatsapp"
          ? await sendWhatsApp(state.user.phoneE164!, text)
          : reminder.channel === "call"
            ? await placeReminderCall(state.user.phoneE164!, spoken(charge))
            : undefined;
      await updateState(uid, (s) => {
        const item = s.reminders.find((r) => r.id === reminder.id)!;
        item.sent = true;
        item.status = "sent";
        if (providerId) item.providerId = providerId;
        s.events.unshift({
          id: randomUUID(),
          type:
            reminder.channel === "push" ? "reminder_in_app" : "reminder_sent",
          channel: "system",
          text: `${reminder.channel === "push" ? "In-app reminder" : reminder.channel === "call" ? "Reminder call placed" : "WhatsApp accepted for delivery"}: ${text}`,
          createdAt: new Date().toISOString(),
        });
      });
      if (providerId) sent++;
      else inApp++;
    } catch {
      // A provider timeout is ambiguous: never automatically resend and risk duplicates.
      await updateState(uid, (s) => {
        const item = s.reminders.find((r) => r.id === reminder.id)!;
        item.status = "failed";
        item.error =
          "Delivery failed or is uncertain. Check provider logs before retrying.";
      });
      failed++;
    }
  }
  return { sent, inApp, skipped, failed };
}

/** What the assistant says first on a reminder call. */
function spoken(charge: {
  merchant: string;
  amount: number;
  nextDate: string;
  kind: string;
}) {
  const day = new Date(`${charge.nextDate}T12:00:00Z`).toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    },
  );
  return `Hi, it's Brix with a quick heads-up. ${charge.merchant} is expected to charge $${charge.amount.toFixed(2)} on ${day}${charge.kind === "trial" ? ", when your free trial ends" : ""}. Want to keep it, or should I mark it to cancel?`;
}
