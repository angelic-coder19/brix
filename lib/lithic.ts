import { randomUUID } from "node:crypto";
export async function issueSandboxCard(
  purpose: string,
  spendLimit: number,
  idempotencyKey: string,
) {
  if (process.env.BRIX_DEMO_MODE === "true")
    return {
      lithicToken: `demo_${randomUUID()}`,
      last4: "4242",
      source: "mock" as const,
    };
  if (!process.env.LITHIC_API_KEY)
    throw new Error("Lithic sandbox is not configured.");
  if (process.env.LITHIC_ENV && process.env.LITHIC_ENV !== "sandbox")
    throw new Error("Only sandbox card issuing is supported.");
  const response = await fetch("https://sandbox.lithic.com/v1/cards", {
    method: "POST",
    headers: {
      Authorization: `api-key ${process.env.LITHIC_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      type: "SINGLE_USE",
      memo: purpose,
      spend_limit: Math.round(spendLimit * 100),
      spend_limit_duration: "FOREVER",
      state: "OPEN",
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(
      `Lithic sandbox request failed (${response.status}); no demo fallback was used.`,
    );
  const card = await response.json();
  if (!card.token || !/^\d{4}$/.test(card.last_four))
    throw new Error("Lithic returned an invalid card response.");
  return {
    lithicToken: String(card.token),
    last4: String(card.last_four),
    source: "lithic" as const,
  };
}
/** Closes a sandbox card permanently. Demo cards never reach Lithic. */
export async function closeSandboxCard(lithicToken: string) {
  if (process.env.BRIX_DEMO_MODE === "true" || lithicToken.startsWith("demo_"))
    return;
  if (!process.env.LITHIC_API_KEY)
    throw new Error("Lithic sandbox is not configured.");
  const response = await fetch(
    `https://sandbox.lithic.com/v1/cards/${encodeURIComponent(lithicToken)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `api-key ${process.env.LITHIC_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state: "CLOSED" }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new Error(`Lithic sandbox close failed (${response.status}).`);
}
