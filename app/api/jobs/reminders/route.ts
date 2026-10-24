import { requireAdmin, errorResponse, HttpError } from "@/lib/auth";
import { listUserIds } from "@/lib/store";
import { runReminders } from "@/lib/tools/reminders";
import { timingSafeEqual } from "node:crypto";
export const runtime = "nodejs";
function isCron(request: Request) {
  const supplied =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ||
      request.headers.get("x-cron-secret") ||
      "",
    expected = process.env.CRON_SECRET;
  return (
    !!expected &&
    Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  );
}
async function sendReminders() {
  const results = [];
  for (const uid of await listUserIds()) results.push(await runReminders(uid));
  return Response.json({
    results,
    sent: results.reduce((s, r) => s + r.sent, 0),
    inApp: results.reduce((s, r) => s + r.inApp, 0),
    failed: results.reduce((s, r) => s + r.failed, 0),
  });
}
// Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  try {
    if (!isCron(request)) throw new HttpError(401, "Unauthorized.");
    return await sendReminders();
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    if (!isCron(request)) await requireAdmin(request);
    return await sendReminders();
  } catch (error) {
    return errorResponse(error);
  }
}
