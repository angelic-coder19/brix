import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { plaidRequest } from "@/lib/plaid";
import { getSecret, setSecret } from "@/lib/store";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const { public_token } = await request.json();
    if (typeof public_token !== "string" || public_token.length > 1000)
      throw new HttpError(400, "A valid Plaid public token is required.");
    const item = await plaidRequest<{ access_token: string; item_id: string }>(
      "/item/public_token/exchange",
      { public_token },
    );
    const secret = await getSecret(uid);
    await setSecret(uid, {
      plaidAccessTokens: {
        ...secret.plaidAccessTokens,
        [item.item_id]: item.access_token,
      },
    });
    return Response.json({ linked: true });
  } catch (e) {
    return errorResponse(e);
  }
}
