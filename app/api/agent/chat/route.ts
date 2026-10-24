import { requireUser, errorResponse } from "@/lib/auth";
import { runAgentTurn } from "@/lib/agent/runAgent";
import { readJsonObject } from "@/lib/http";
import { getState } from "@/lib/store";
import { isDemo } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await readJsonObject(request);
    const turn = await runAgentTurn(uid, body.message);
    return Response.json(
      { ...turn, state: { ...(await getState(uid)), demo: isDemo() } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
