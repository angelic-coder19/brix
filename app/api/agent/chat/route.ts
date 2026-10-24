import { requireUser, errorResponse } from "@/lib/auth";
import { runAgent } from "@/lib/agent/runAgent";
import { getState } from "@/lib/store";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await request.json();
    const reply = await runAgent(uid, body.message);
    return Response.json({ reply, state: await getState(uid) });
  } catch (error) {
    return errorResponse(error);
  }
}
