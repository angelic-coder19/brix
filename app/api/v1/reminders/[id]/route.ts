import { apiRoute, noContent } from "@/lib/api/v1";
import { HttpError } from "@/lib/auth";
import { updateState } from "@/lib/store";
export const runtime = "nodejs";
export const DELETE = apiRoute("reminders:write", async ({ uid, params }) => {
  await updateState(uid, (s) => {
    const found = s.reminders.find((r) => r.id === params.id);
    if (!found) throw new HttpError(404, "No reminder with that ID.");
    if (found.sent || found.status === "sending")
      throw new HttpError(409, "That reminder was already sent.");
    s.reminders = s.reminders.filter((r) => r.id !== params.id);
  });
  return noContent();
});
