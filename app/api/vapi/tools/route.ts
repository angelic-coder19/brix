import { verifyVapi } from "@/lib/vapi";
import { findUserByPhone } from "@/lib/store";
import { executeTool } from "@/lib/tools";
import { errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { handleVapiTools } from "@/lib/vapi-tools";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyVapi(request))
    return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json(
      await handleVapiTools(
        await readJsonObject(request),
        findUserByPhone,
        (uid, name, args) => executeTool(uid, "voice", name, args),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
