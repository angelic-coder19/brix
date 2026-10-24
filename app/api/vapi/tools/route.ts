import { verifyVapi } from "@/lib/vapi";
import { findUserByPhone } from "@/lib/store";
import { executeTool } from "@/lib/tools";
export const runtime = "nodejs";
type ToolCall = {
  id?: string;
  function?: { name?: string; arguments?: string | Record<string, unknown> };
};
type VapiBody = {
  message?: {
    call?: { customer?: { number?: unknown } };
    toolCallList?: unknown;
  };
};
export async function POST(request: Request) {
  if (!verifyVapi(request))
    return new Response("Unauthorized", { status: 401 });
  let body: VapiBody | null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = body?.message;
  const uid = await findUserByPhone(
    String(message?.call?.customer?.number || ""),
  );
  if (!uid)
    return Response.json(
      { error: "Verify your phone in the Brix app first." },
      { status: 403 },
    );
  const calls = message?.toolCallList;
  if (!Array.isArray(calls) || calls.length > 8)
    return Response.json({ error: "Invalid tool calls" }, { status: 400 });
  const results = [];
  for (const call of calls as ToolCall[]) {
    try {
      const args =
        typeof call.function?.arguments === "string"
          ? JSON.parse(call.function.arguments)
          : call.function?.arguments || {};
      const result = await executeTool(
        uid,
        "voice",
        String(call.function?.name || ""),
        args,
      );
      results.push({
        toolCallId: call.id,
        result:
          JSON.stringify(result) +
          (result &&
          typeof result === "object" &&
          "confirmationRequired" in result
            ? " Confirm this proposal in the Brix app. Voice tools cannot authorize mutations."
            : ""),
      });
    } catch {
      results.push({
        toolCallId: call.id,
        result: "I couldn't complete this action. Please check the Brix app.",
      });
    }
  }
  return Response.json({ results });
}
