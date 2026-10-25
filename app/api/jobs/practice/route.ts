import { requireAdmin, errorResponse, HttpError } from "@/lib/auth";
import { isCron } from "@/lib/cron";
import { runPracticeJob } from "@/lib/practice";
export const runtime = "nodejs";
// Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  try {
    if (!isCron(request)) throw new HttpError(401, "Unauthorized.");
    return Response.json(await runPracticeJob());
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    if (!isCron(request)) await requireAdmin(request);
    return Response.json(await runPracticeJob());
  } catch (error) {
    return errorResponse(error);
  }
}
