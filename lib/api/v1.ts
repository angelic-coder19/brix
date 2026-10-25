import { randomUUID } from "node:crypto";
import { HttpError } from "../auth";
import {
  authenticateKey,
  RATE_LIMIT_PER_MINUTE,
  type ApiKey,
  type Scope,
} from "./keys";

export const API_VERSION = "2026-10-24";

const ERROR_TYPES: Record<number, string> = {
  400: "invalid_request",
  401: "authentication_failed",
  403: "insufficient_scope",
  404: "not_found",
  405: "method_not_allowed",
  409: "conflict",
  413: "request_too_large",
  429: "rate_limited",
  502: "upstream_unavailable",
  503: "service_unavailable",
};

export interface ApiContext {
  uid: string;
  key: ApiKey;
  request: Request;
  url: URL;
  params: Record<string, string>;
}
type Handler = (ctx: ApiContext) => Promise<unknown>;
type RouteContext = { params: Promise<Record<string, string>> };

/** A JSON body with a status other than 200, e.g. `created(charge)`. */
export class ApiResult {
  constructor(
    public status: number,
    public body: unknown,
  ) {}
}
export const created = (body: unknown) => new ApiResult(201, body);
export const noContent = () => new ApiResult(204, null);

function errorBody(status: number, message: string, requestId: string) {
  return {
    error: {
      type: ERROR_TYPES[status] ?? "api_error",
      message,
      request_id: requestId,
    },
  };
}

/**
 * Wraps a public API handler: authenticates the bearer API key, enforces the
 * scope and rate limit, and returns JSON with consistent errors and headers.
 */
export function apiRoute(scope: Scope | null, handler: Handler) {
  return async (request: Request, route?: RouteContext) => {
    const requestId = `req_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    const headers: Record<string, string> = {
      "Cache-Control": "no-store",
      "Brix-Version": API_VERSION,
      "X-Request-Id": requestId,
    };
    try {
      const secret = request.headers
        .get("authorization")
        ?.match(/^Bearer\s+(\S+)$/)?.[1];
      if (!secret)
        throw new HttpError(
          401,
          "Send your API key as `Authorization: Bearer brix_sk_...`.",
        );
      const key = await authenticateKey(secret);
      headers["X-RateLimit-Limit"] = String(RATE_LIMIT_PER_MINUTE);
      headers["X-RateLimit-Remaining"] = String(key.remaining);
      if (scope && !key.scopes.includes(scope))
        throw new HttpError(403, `This key is missing the \`${scope}\` scope.`);
      const result = await handler({
        uid: key.uid,
        key,
        request,
        url: new URL(request.url),
        params: (await route?.params) ?? {},
      });
      if (result instanceof ApiResult)
        return result.status === 204
          ? new Response(null, { status: 204, headers })
          : Response.json(result.body, { status: result.status, headers });
      return Response.json(result, { headers });
    } catch (error) {
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof SyntaxError
            ? 400
            : 500;
      if (status === 429) headers["Retry-After"] = "60";
      if (status === 500)
        console.error(
          `Brix API ${requestId} failed:`,
          error instanceof Error ? error.message : "unknown error",
        );
      return Response.json(
        errorBody(
          status,
          status === 500
            ? "Something went wrong on our side. Retry, and contact us with the request ID if it persists."
            : (error as Error).message,
          requestId,
        ),
        { status, headers },
      );
    }
  };
}

/** Parses an optional integer query parameter within bounds. */
export function intParam(
  url: URL,
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max)
    throw new HttpError(
      400,
      `\`${name}\` must be a whole number from ${min} to ${max}.`,
    );
  return value;
}
