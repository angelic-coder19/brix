import { API_VERSION } from "./v1";
import { RATE_LIMIT_PER_MINUTE, SCOPES, type Scope } from "./keys";

// Single source of truth for the public API reference: served as JSON at
// /api/v1/openapi.json and rendered on /developers.

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object, description = "OK") => ({
  description,
  content: { "application/json": { schema } },
});
const errors = (...codes: number[]) =>
  Object.fromEntries(
    [401, 429, ...codes].map((c) => [
      c,
      { $ref: `#/components/responses/E${c}` },
    ]),
  );
const listOf = (name: string) => ({
  type: "object",
  required: ["object", "data"],
  properties: {
    object: { const: "list" },
    data: { type: "array", items: ref(name) },
  },
});
const idParam = (what: string) => ({
  name: "id",
  in: "path",
  required: true,
  description: `The ${what} ID.`,
  schema: { type: "string" },
});

export interface Operation {
  method: "get" | "post" | "patch" | "delete";
  path: string;
  scope: Scope | null;
  summary: string;
  description: string;
  example?: { body?: unknown; query?: string };
  spec: Record<string, unknown>;
}

export const operations: Operation[] = [
  {
    method: "get",
    path: "/me",
    scope: null,
    summary: "Check your key",
    description:
      "Returns the key you authenticated with and its scopes. Works with any scope; use it to verify setup.",
    spec: { responses: { 200: json(ref("Identity")), ...errors() } },
  },
  {
    method: "get",
    path: "/charges",
    scope: "charges:read",
    summary: "List charges",
    description:
      "Every subscription and trial Brix knows about, sorted by next expected date.",
    example: { query: "?status=active" },
    spec: {
      parameters: [
        {
          name: "status",
          in: "query",
          schema: { enum: ["active", "trial", "to_cancel", "cancelled"] },
        },
        {
          name: "kind",
          in: "query",
          schema: { enum: ["subscription", "trial"] },
        },
      ],
      responses: { 200: json(listOf("Charge")), ...errors(400, 403) },
    },
  },
  {
    method: "get",
    path: "/charges/upcoming",
    scope: "charges:read",
    summary: "Upcoming charges",
    description:
      "Active subscriptions and trials expected within the next `days` days (default 14, max 90).",
    example: { query: "?days=7" },
    spec: {
      parameters: [
        {
          name: "days",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 90, default: 14 },
        },
      ],
      responses: {
        200: json({
          allOf: [
            listOf("Charge"),
            { properties: { days: { type: "integer" } } },
          ],
        }),
        ...errors(400, 403),
      },
    },
  },
  {
    method: "get",
    path: "/charges/{id}",
    scope: "charges:read",
    summary: "Get a charge",
    description: "One charge by ID.",
    spec: {
      parameters: [idParam("charge")],
      responses: { 200: json(ref("Charge")), ...errors(403, 404) },
    },
  },
  {
    method: "patch",
    path: "/charges/{id}",
    scope: "charges:write",
    summary: "Manage link / reactivate",
    description:
      "Brix no longer flags subscriptions to cancel. Sending `to_cancel` leaves the charge unchanged and returns a `message` with the merchant's manage link, so you can send the user straight there. `active` restores a charge flagged by older clients.",
    example: { body: { status: "to_cancel" } },
    spec: {
      parameters: [idParam("charge")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["status"],
              additionalProperties: false,
              properties: { status: { enum: ["to_cancel", "active"] } },
            },
          },
        },
      },
      responses: {
        200: json({
          allOf: [
            ref("Charge"),
            { properties: { message: { type: "string" } } },
          ],
        }),
        ...errors(400, 403, 404, 409),
      },
    },
  },
  {
    method: "post",
    path: "/trials",
    scope: "charges:write",
    summary: "Add a free trial",
    description:
      "Track a free trial so Brix reminds you before it bills. Send an `Idempotency-Key` header to make retries safe.",
    example: {
      body: { merchant: "Notion AI", end_date: "2026-11-15", amount: 10 },
    },
    spec: {
      parameters: [
        {
          name: "Idempotency-Key",
          in: "header",
          schema: { type: "string", maxLength: 100, pattern: "^[\\w-]+$" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["merchant", "end_date", "amount"],
              properties: {
                merchant: { type: "string", maxLength: 100 },
                end_date: {
                  type: "string",
                  format: "date",
                  description: "Today or later.",
                },
                amount: {
                  type: "number",
                  minimum: 0,
                  maximum: 100000,
                  description: "Price after the trial, in USD.",
                },
              },
            },
          },
        },
      },
      responses: { 201: json(ref("Charge"), "Created"), ...errors(400, 403) },
    },
  },
  {
    method: "get",
    path: "/summary",
    scope: "charges:read",
    summary: "Spending summary",
    description:
      "Monthly subscription total, counts, the next 14 days, and the estimated amount avoided this month.",
    spec: { responses: { 200: json(ref("Summary")), ...errors(403) } },
  },
  {
    method: "get",
    path: "/reminders",
    scope: "reminders:read",
    summary: "List reminders",
    description: "Scheduled and sent reminders, earliest first.",
    spec: { responses: { 200: json(listOf("Reminder")), ...errors(403) } },
  },
  {
    method: "post",
    path: "/reminders",
    scope: "reminders:write",
    summary: "Create a reminder",
    description:
      "Remind the user about a charge. Identify it by `charge_id` or `merchant`. `when` accepts a future `YYYY-MM-DD`, an ISO timestamp, or `N days before`. Delivery is WhatsApp when the user enabled it, otherwise in the app.",
    example: { body: { merchant: "Spotify", when: "2 days before" } },
    spec: {
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["when"],
              properties: {
                charge_id: { type: "string" },
                merchant: { type: "string" },
                when: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        201: json(ref("Reminder"), "Created"),
        ...errors(400, 403, 404),
      },
    },
  },
  {
    method: "delete",
    path: "/reminders/{id}",
    scope: "reminders:write",
    summary: "Delete a reminder",
    description: "Removes a reminder that hasn't been sent yet.",
    spec: {
      parameters: [idParam("reminder")],
      responses: { 204: { description: "Deleted" }, ...errors(403, 404, 409) },
    },
  },
  {
    method: "get",
    path: "/cards",
    scope: "cards:read",
    summary: "List cards",
    description:
      "Single-use cards created in Brix. Only the last four digits are returned. Creating cards is not available through the API; it requires confirmation in the app.",
    spec: { responses: { 200: json(listOf("Card")), ...errors(403) } },
  },
  {
    method: "get",
    path: "/news",
    scope: "news:read",
    summary: "Merchant news",
    description:
      "Recent articles about pricing or renewal changes at the user's top merchants. Articles don't confirm a change to the user's own plan.",
    spec: {
      responses: {
        200: json({
          type: "object",
          properties: {
            object: { const: "list" },
            data: { type: "array", items: ref("NewsItem") },
            message: { type: "string" },
          },
        }),
        ...errors(403, 502),
      },
    },
  },
  {
    method: "get",
    path: "/refunds",
    scope: "refunds:read",
    summary: "List refunds",
    description:
      "School refunds (aid left after tuition) Brix detected or the user added, with any saved plan. `loan_amount` is the borrowed part; federal Direct Loan money can be returned within 120 days without interest.",
    spec: { responses: { 200: json(listOf("Refund")), ...errors(403) } },
  },
  {
    method: "get",
    path: "/practice",
    scope: "practice:read",
    summary: "Practice portfolio",
    description:
      "The user's paper-trading portfolio: virtual cash, positions at live prices, gain compared with the S&P 500 (VOO), auto-invest rules, and recent orders. No real money is involved. `null` when the user hasn't started one.",
    spec: { responses: { 200: json(ref("Practice")), ...errors(403) } },
  },
];

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ref("Error") } },
});

export function openApiDocument(origin: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of operations)
    (paths[op.path] ??= {})[op.method] = {
      operationId: `${op.method}${op.path.replace(/\{id\}/g, "ById").replace(/\/(\w)/g, (_, c) => c.toUpperCase())}`,
      summary: op.summary,
      description: op.description,
      ...(op.scope ? { "x-brix-scope": op.scope } : {}),
      security: [{ apiKey: op.scope ? [op.scope] : [] }],
      ...op.spec,
    };
  return {
    openapi: "3.1.0",
    info: {
      title: "Brix API",
      version: API_VERSION,
      description: `Read and manage a Brix user's subscriptions, trials, and reminders. Authenticate with a personal API key. Limit: ${RATE_LIMIT_PER_MINUTE} requests per minute per key.`,
    },
    servers: [{ url: `${origin}/api/v1` }],
    security: [{ apiKey: [] }],
    paths,
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "brix_sk_…",
          description: `Scopes: ${Object.entries(SCOPES)
            .map(([s, d]) => `\`${s}\` ${d}`)
            .join(" ")}`,
        },
      },
      responses: {
        E400: errorResponse("Invalid request"),
        E401: errorResponse("Missing, invalid, or revoked API key"),
        E403: errorResponse("The key lacks the required scope"),
        E404: errorResponse("Not found"),
        E409: errorResponse("Conflicts with the current state"),
        E429: errorResponse(
          "Rate limited; retry after the `Retry-After` seconds",
        ),
        E502: errorResponse("An upstream provider is unavailable"),
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["type", "message", "request_id"],
              properties: {
                type: {
                  enum: [
                    "invalid_request",
                    "authentication_failed",
                    "insufficient_scope",
                    "not_found",
                    "conflict",
                    "request_too_large",
                    "rate_limited",
                    "upstream_unavailable",
                    "service_unavailable",
                    "api_error",
                  ],
                },
                message: { type: "string" },
                request_id: { type: "string" },
              },
            },
          },
        },
        Charge: {
          type: "object",
          properties: {
            object: { const: "charge" },
            id: { type: "string" },
            kind: { enum: ["subscription", "trial"] },
            merchant: { type: "string" },
            amount: { type: "number" },
            currency: { const: "usd" },
            frequency: { enum: ["weekly", "monthly", "annual", "unknown"] },
            status: { enum: ["active", "trial", "to_cancel", "cancelled"] },
            source: { enum: ["plaid", "manual", "agent"] },
            last_date: { type: ["string", "null"], format: "date" },
            next_date: { type: "string", format: "date" },
            cancel_url: { type: ["string", "null"], format: "uri" },
          },
        },
        Reminder: {
          type: "object",
          properties: {
            object: { const: "reminder" },
            id: { type: "string" },
            charge_id: { type: "string" },
            remind_at: { type: "string", format: "date-time" },
            channel: { enum: ["whatsapp", "call", "push"] },
            status: { enum: ["pending", "sending", "sent", "failed"] },
            created_by: { type: "string" },
          },
        },
        Card: {
          type: "object",
          properties: {
            object: { const: "card" },
            id: { type: "string" },
            last4: { type: "string" },
            purpose: { type: "string" },
            spend_limit: { type: "number" },
            currency: { const: "usd" },
            state: { enum: ["OPEN", "CLOSED", "PAUSED"] },
            source: { enum: ["mock", "lithic"] },
            created_at: { type: ["string", "null"], format: "date-time" },
          },
        },
        Summary: {
          type: "object",
          properties: {
            object: { const: "summary" },
            currency: { const: "usd" },
            monthly_subscription_total: { type: "number" },
            active_subscriptions: { type: "integer" },
            active_trials: { type: "integer" },
            upcoming_14_days: {
              type: "object",
              properties: {
                count: { type: "integer" },
                amount: { type: "number" },
              },
            },
            avoided_this_month: {
              type: "object",
              properties: {
                amount: { type: "number" },
                estimated: { const: true },
              },
            },
          },
        },
        NewsItem: {
          type: "object",
          properties: {
            object: { const: "news_item" },
            title: { type: "string" },
            url: { type: "string", format: "uri" },
            source: { type: "string" },
            published_at: { type: "string", format: "date-time" },
            merchant: { type: "string" },
            why_it_matters: { type: "string" },
          },
        },
        Refund: {
          type: "object",
          properties: {
            object: { const: "refund" },
            id: { type: "string" },
            amount: { type: "number" },
            received_on: { type: "string", format: "date" },
            source: { enum: ["plaid", "manual"] },
            funding: {
              enum: ["loan", "grant", "scholarship", "mixed", "unknown"],
            },
            loan_amount: { type: ["number", "null"] },
            status: { enum: ["new", "planned", "dismissed"] },
            return_by: { type: ["string", "null"], format: "date" },
            plan: {
              type: ["array", "null"],
              items: {
                type: "object",
                properties: {
                  step: { type: "string" },
                  label: { type: "string" },
                  amount: { type: "number" },
                },
              },
            },
          },
        },
        Practice: {
          type: "object",
          properties: {
            object: { const: "practice_portfolio" },
            virtual_money: { const: true },
            portfolio: {
              type: ["object", "null"],
              properties: {
                cash: { type: "number" },
                total: { type: "number" },
                gain: { type: "number" },
                gain_pct: { type: "number" },
                benchmark_pct: { type: ["number", "null"] },
                positions: { type: "array", items: { type: "object" } },
                rules: { type: "array", items: { type: "object" } },
                orders: { type: "array", items: { type: "object" } },
              },
            },
          },
        },
        Identity: {
          type: "object",
          properties: {
            object: { const: "identity" },
            user: {
              type: "object",
              properties: { display_name: { type: "string" } },
            },
            key: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                preview: { type: "string" },
                scopes: {
                  type: "array",
                  items: { enum: Object.keys(SCOPES) },
                },
                createdAt: { type: "string", format: "date-time" },
                lastUsedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
    },
  };
}
