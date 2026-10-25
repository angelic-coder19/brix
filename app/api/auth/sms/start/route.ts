import { errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { clientIp, normalizePhone, sendCode } from "@/lib/sms-verify";
export const runtime = "nodejs";
/** Texts a one-time code through Twilio Verify. Public: used for sign-in. */
export async function POST(request: Request) {
  try {
    const { phone } = await readJsonObject(request);
    await sendCode(normalizePhone(phone), clientIp(request));
    return Response.json({ sent: true });
  } catch (error) {
    return errorResponse(error);
  }
}
