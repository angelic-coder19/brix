import { requireUser, errorResponse } from "@/lib/auth";
import { getState } from "@/lib/store";
import { proposeAction } from "@/lib/tools";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json({ cards: (await getState(uid)).cards });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(
      await proposeAction(
        uid,
        "web",
        "create_one_time_card",
        await request.json(),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
