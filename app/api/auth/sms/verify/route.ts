import { errorResponse, HttpError, requireUser } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase/admin";
import { readJsonObject } from "@/lib/http";
import { checkCode, normalizePhone } from "@/lib/sms-verify";
import { registerPhone, updateState } from "@/lib/store";
export const runtime = "nodejs";

/**
 * Checks a Twilio Verify code. Signed in: links the phone to the current
 * account. Signed out: returns a Firebase custom token for the account that
 * owns this phone, creating one if needed.
 */
export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const phone = normalizePhone(body.phone);
    if (!(await checkCode(phone, body.code)))
      throw new HttpError(
        400,
        "That code didn't work. Check it or request a new one.",
      );
    if (request.headers.get("authorization")) {
      const { uid } = await requireUser(request);
      const owner = await adminAuth()
        .getUserByPhoneNumber(phone)
        .catch(() => null);
      if (owner && owner.uid !== uid)
        throw new HttpError(
          409,
          "That number is already linked to another Brix account.",
        );
      await adminAuth().updateUser(uid, { phoneNumber: phone });
      await registerPhone(uid, phone);
      await updateState(uid, (s) => {
        s.user.phoneE164 = phone;
      });
      return Response.json({ linked: true });
    }
    const user =
      (await adminAuth()
        .getUserByPhoneNumber(phone)
        .catch(() => null)) ??
      (await adminAuth().createUser({ phoneNumber: phone }));
    if (user.disabled) throw new HttpError(403, "This account is disabled.");
    return Response.json({
      token: await adminAuth().createCustomToken(user.uid),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
