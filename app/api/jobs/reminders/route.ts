import { requireAdmin, errorResponse } from "@/lib/auth";
import { listUserIds } from "@/lib/store";
import { runReminders } from "@/lib/tools/reminders";
import { timingSafeEqual } from "node:crypto";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const supplied =
        request.headers.get("authorization")?.replace(/^Bearer /, "") ||
        request.headers.get("x-cron-secret") ||
        "",
      expected = process.env.CRON_SECRET;
    const cron =
      !!expected &&
      Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
      timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
    if (!cron) await requireAdmin(request);
    const results = [];
    for (const uid of await listUserIds())
      results.push(await runReminders(uid));
    return Response.json({
      results,
      sent: results.reduce((s, r) => s + r.sent, 0),
      inApp: results.reduce((s, r) => s + r.inApp, 0),
      failed: results.reduce((s, r) => s + r.failed, 0),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
