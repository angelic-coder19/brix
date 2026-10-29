import { requireUser, errorResponse } from "@/lib/auth";
import { beginEmailConnect } from "@/lib/email/service";
import { oauthCookie } from "@/lib/email/security";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const result = await beginEmailConnect(uid);
    return Response.json(
      { url: result.url },
      {
        headers: {
          "Set-Cookie": oauthCookie(result.cookie),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
