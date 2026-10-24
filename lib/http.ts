import { HttpError } from "./auth";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Reads a JSON request body and guarantees a plain object.
 * Rejects empty, oversized, malformed, or non-object bodies with a 4xx
 * instead of letting property access on `null` surface as a 500.
 */
export async function readJsonObject(
  request: Request,
  { optional = false }: { optional?: boolean } = {},
): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES)
    throw new HttpError(413, "That request is too large.");
  if (!text.trim()) {
    if (optional) return {};
    throw new HttpError(400, "A JSON body is required.");
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, "The request body must be valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new HttpError(400, "The request body must be a JSON object.");
  return body as Record<string, unknown>;
}
