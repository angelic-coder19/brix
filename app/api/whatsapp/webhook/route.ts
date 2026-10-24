import { validateTwilio, twiml } from "@/lib/twilio";
import { findUserByPhone, getState, updateState } from "@/lib/store";
import { runAgent } from "@/lib/agent/runAgent";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const params = Object.fromEntries(new URLSearchParams(await request.text()));
  if (!validateTwilio(request, params))
    return new Response("Unauthorized", { status: 401 });
  const uid = await findUserByPhone(
    (params.From || "").replace(/^whatsapp:/, ""),
  );
  if (!uid)
    return twiml(
      `Link and verify your phone in Brix: ${process.env.APP_URL}/connect`,
    );
  const requestId = params.MessageSid;
  if (!requestId) return new Response("Missing message ID", { status: 400 });
  let claimed = false;
  await updateState(uid, (s) => {
    claimed = false;
    if (s.events.some((e) => e.requestId === requestId)) return;
    claimed = true;
    s.events.unshift({
      id: requestId,
      requestId,
      type: "webhook_received",
      channel: "whatsapp",
      text: "WhatsApp message received",
      createdAt: new Date().toISOString(),
    });
  });
  if (!claimed)
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  try {
    if (!(await getState(uid)).user.whatsappOptIn)
      return twiml("Enable WhatsApp in Brix Settings first.");
    return twiml(await runAgent(uid, params.Body || "", "whatsapp"));
  } catch {
    return twiml(
      "I couldn't complete that request. Please open Brix or try again.",
    );
  }
}
