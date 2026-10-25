/**
 * Places an outbound reminder call through Vapi using the saved assistant and
 * phone number. The assistant opens with `firstMessage`; its tool calls reach
 * /api/vapi/tools and identify the user by the number it dialed.
 */
export async function placeReminderCall(phone: string, firstMessage: string) {
  if (process.env.BRIX_DEMO_MODE === "true")
    throw new Error("Outbound calls are disabled in demo mode.");
  const {
    VAPI_API_KEY: key,
    VAPI_ASSISTANT_ID: assistantId,
    VAPI_PHONE_NUMBER_ID: phoneNumberId,
  } = process.env;
  if (!key || !assistantId || !phoneNumberId)
    throw new Error("Outbound calls are not configured; no call was placed.");
  const response = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: { number: phone },
      assistantOverrides: { firstMessage },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(`Vapi call request failed (${response.status}).`);
  const call = await response.json();
  if (typeof call.id !== "string") throw new Error("Vapi returned no call ID.");
  return call.id as string;
}
