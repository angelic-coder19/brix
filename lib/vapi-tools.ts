import { HttpError } from "./auth";

type ToolCall = {
  id: string;
  function: { name: string; arguments?: string | Record<string, unknown> };
};
type ResolvePhone = (phone: string) => Promise<string | null>;
type Execute = (
  uid: string,
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

export async function handleVapiTools(
  body: Record<string, unknown>,
  resolvePhone: ResolvePhone,
  execute: Execute,
) {
  const message = body.message as
    | { call?: { customer?: { number?: unknown } }; toolCallList?: unknown }
    | undefined;
  const calls = message?.toolCallList;
  if (
    !Array.isArray(calls) ||
    !calls.length ||
    calls.length > 8 ||
    calls.some(
      (c) =>
        !c ||
        typeof c.id !== "string" ||
        !c.id ||
        typeof c.function?.name !== "string" ||
        !c.function.name,
    )
  )
    throw new HttpError(400, "Invalid tool calls.");
  if (new Set(calls.map((c) => c.id)).size !== calls.length)
    throw new HttpError(400, "Duplicate tool call IDs.");
  const number = message?.call?.customer?.number;
  const uid =
    typeof number === "string" && /^\+[1-9]\d{7,14}$/.test(number)
      ? await resolvePhone(number)
      : null;
  if (!uid)
    return {
      results: calls.map((c) => ({
        toolCallId: c.id,
        result:
          "I can't find a verified Brix account for this caller. Sign in to Brix, verify this phone number on Connections, and call again.",
      })),
    };
  let proposed = false;
  const results = [];
  for (const call of calls as ToolCall[]) {
    try {
      const args =
        typeof call.function.arguments === "string"
          ? JSON.parse(call.function.arguments)
          : (call.function.arguments ?? {});
      if (!args || typeof args !== "object" || Array.isArray(args))
        throw new HttpError(400, "Tool arguments must be an object.");
      const mutation = [
        "mark_to_cancel",
        "set_reminder",
        "create_one_time_card",
      ].includes(call.function.name);
      if (mutation && proposed)
        throw new HttpError(
          409,
          "Confirm the first voice proposal in the Brix app before preparing another action.",
        );
      const result = await execute(uid, call.function.name, args);
      if (
        result &&
        typeof result === "object" &&
        "confirmationRequired" in result
      )
        proposed = true;
      results.push({
        toolCallId: call.id,
        result: typeof result === "string" ? result : JSON.stringify(result),
      });
    } catch (error) {
      results.push({
        toolCallId: call.id,
        result:
          error instanceof HttpError
            ? error.message
            : error instanceof SyntaxError
              ? "The action arguments were invalid. Please ask again."
              : "I couldn't complete this action. Please check the Brix app.",
      });
    }
  }
  return { results };
}
