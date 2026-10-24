import { requireUser, errorResponse } from "@/lib/auth";
import { plaidRequest } from "@/lib/plaid";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(
      await plaidRequest("/link/token/create", {
        user: { client_user_id: uid },
        client_name: "Brix",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
