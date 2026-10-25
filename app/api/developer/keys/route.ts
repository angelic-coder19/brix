import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { createApiKey, listApiKeys, SCOPES } from "@/lib/api/keys";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    return Response.json(
      { keys: await listApiKeys(uid), scopes: SCOPES },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
/** Returns the secret once; only its hash is stored. */
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await readJsonObject(request);
    return Response.json(await createApiKey(uid, body.name, body.scopes), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
