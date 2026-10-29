import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { updateState } from "@/lib/store";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
/**
 * `{ notSubscription: true }` hides a row the bank wrongly called a
 * subscription; `false` puts it back. Nothing is cancelled at the merchant.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { uid } = await requireUser(request);
    const { id } = await params;
    const body = await readJsonObject(request);
    if (typeof body.notSubscription !== "boolean")
      throw new HttpError(400, "Send notSubscription as true or false.");
    let merchant = "";
    await updateState(uid, (s) => {
      const charge = s.charges.find((c) => c.id === id);
      if (!charge) throw new HttpError(404, "That charge is gone.");
      merchant = charge.merchant;
      if (body.notSubscription) {
        charge.notSubscription = true;
        charge.status = "cancelled";
        s.reminders = s.reminders.filter((r) => r.chargeId !== id || r.sent);
      } else {
        delete charge.notSubscription;
        charge.status = charge.kind === "trial" ? "trial" : "active";
      }
    });
    return Response.json({ id, merchant, notSubscription: body.notSubscription });
  } catch (error) {
    return errorResponse(error);
  }
}
