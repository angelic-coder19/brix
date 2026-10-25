import { apiRoute, created } from "@/lib/api/v1";
import { charge } from "@/lib/api/resources";
import { HttpError } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { addTrial } from "@/lib/trials";
export const runtime = "nodejs";
export const POST = apiRoute("charges:write", async ({ uid, key, request }) => {
  const idempotency = request.headers.get("idempotency-key");
  if (idempotency !== null && !/^[\w-]{1,100}$/.test(idempotency))
    throw new HttpError(
      400,
      "`Idempotency-Key` must be 1–100 letters, digits, `-` or `_`.",
    );
  const body = await readJsonObject(request);
  const trial = await addTrial(
    uid,
    "api",
    { merchant: body.merchant, endDate: body.end_date, amount: body.amount },
    idempotency ? `api:${key.id}:${idempotency}` : undefined,
  );
  return created(charge(trial));
});
