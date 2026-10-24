import twilio from "twilio";
export function validateTwilio(
  request: Request,
  params: Record<string, string>,
) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const base = process.env.APP_URL;
  if (!token || !base) return false;
  const url = new URL(request.url);
  return twilio.validateRequest(
    token,
    request.headers.get("x-twilio-signature") || "",
    `${base.replace(/\/$/, "")}${url.pathname}${url.search}`,
    params,
  );
}
export function twiml(message: string) {
  const response = new twilio.twiml.MessagingResponse();
  response.message(message);
  return new Response(response.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
export async function sendWhatsApp(to: string, body: string) {
  if (process.env.BRIX_DEMO_MODE === "true")
    throw new Error("External messaging is disabled in demo mode.");
  const {
    TWILIO_ACCOUNT_SID: sid,
    TWILIO_AUTH_TOKEN: token,
    TWILIO_WHATSAPP_FROM: from,
  } = process.env;
  if (!sid || !token || !from)
    throw new Error("WhatsApp is not configured; no message was sent.");
  const message = await twilio(sid, token).messages.create({
    from,
    to: `whatsapp:${to}`,
    body,
  });
  return message.sid;
}
