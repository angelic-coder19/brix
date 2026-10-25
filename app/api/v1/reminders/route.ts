import { apiRoute, created } from "@/lib/api/v1";
import { list, reminder } from "@/lib/api/resources";
import { HttpError } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { getState, updateState } from "@/lib/store";
import { addReminder, matchCharge, reminderDate } from "@/lib/tools";
import type { Reminder } from "@/lib/types";
export const runtime = "nodejs";
export const GET = apiRoute("reminders:read", async ({ uid }) => {
  const reminders = [...(await getState(uid)).reminders].sort((a, b) =>
    a.remindAt.localeCompare(b.remindAt),
  );
  return list(reminders.map(reminder));
});
/** Body: `charge_id` (or `merchant`) and `when` (YYYY-MM-DD, ISO time, or "N days before"). */
export const POST = apiRoute("reminders:write", async ({ uid, request }) => {
  const body = await readJsonObject(request);
  if (typeof body.when !== "string" || !body.when.trim())
    throw new HttpError(400, "`when` is required.");
  let made: Reminder | undefined;
  await updateState(uid, (s) => {
    const target =
      typeof body.charge_id === "string"
        ? s.charges.find(
            (c) => c.id === body.charge_id && c.status !== "cancelled",
          )
        : typeof body.merchant === "string"
          ? matchCharge(s.charges, body.merchant)
          : undefined;
    if (!target)
      throw new HttpError(
        body.charge_id || body.merchant ? 404 : 400,
        body.charge_id || body.merchant
          ? "No matching charge."
          : "Send `charge_id` or `merchant`.",
      );
    made = {
      ...addReminder(s, "api", target, reminderDate(String(body.when), target))
        .reminder,
    };
  });
  return created(reminder(made!));
});
