import { errorResponse } from "@/lib/auth";
import { finishEmailConnect } from "@/lib/email/service";
import { emailConfig, oauthCookie } from "@/lib/email/security";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { origin } = emailConfig();
    let result: "connected" | "denied" | "error" = "error";
    try {
      result = await finishEmailConnect(request);
    } catch {
      /* Do not echo codes, tokens or mailbox contents into redirects or logs. */
    }
    return new Response(null, {
      status: 303,
      headers: {
        Location: `${origin}/connect?email=${result}`,
        "Set-Cookie": oauthCookie("", 0),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
