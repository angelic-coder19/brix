import { hashPin } from "@/lib/identity";
import { requireUser, errorResponse, HttpError, isDemo } from "@/lib/auth";
import { getState, updateState, setSecret, registerPhone } from "@/lib/store";
export async function PATCH(request: Request) {
  try {
    const identity = await requireUser(request);
    const body = await request.json();
    for (const key of ["whatsappOptIn", "callOptIn"])
      if (body[key] !== undefined && typeof body[key] !== "boolean")
        throw new HttpError(400, "Channel preferences must be true or false.");
    if (
      body.pin !== undefined &&
      (typeof body.pin !== "string" || !/^\d{4}$/.test(body.pin))
    )
      throw new HttpError(400, "PIN must have exactly four digits.");
    const current = await getState(identity.uid);
    const phone = identity.phone_number;
    if (body.phoneE164 && body.phoneE164 !== phone)
      throw new HttpError(
        400,
        "Verify your phone through Firebase before linking it.",
      );
    if (
      (body.whatsappOptIn || body.callOptIn) &&
      !phone &&
      !current.user.phoneE164
    )
      throw new HttpError(
        400,
        "Verify a phone number before enabling phone channels.",
      );
    if (phone) await registerPhone(identity.uid, phone);
    if (body.pin) {
      await setSecret(identity.uid, {
        pinHash: hashPin(body.pin),
        pinAttempts: 0,
        pinBlockedUntil: 0,
      });
    }
    const state = await updateState(identity.uid, (state) => {
      if (identity.email) state.user.email = identity.email;
      if (phone) state.user.phoneE164 = phone;
      if (typeof body.displayName === "string")
        state.user.displayName =
          body.displayName.trim().slice(0, 100) || state.user.displayName;
      for (const key of ["whatsappOptIn", "callOptIn"] as const)
        if (body[key] !== undefined) state.user[key] = body[key];
    });
    return Response.json({ user: state.user, demo: isDemo() });
  } catch (e) {
    return errorResponse(e);
  }
}
export const POST = PATCH;
