import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { addGiftCard, giftCardSummary } from "@/lib/giftcards";
import { getState } from "@/lib/store";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const state = await getState(uid);
    return Response.json(
      { ...giftCardSummary(state), all: state.giftCards ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const card = await addGiftCard(uid, await readJsonObject(request));
    return Response.json({ card }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
