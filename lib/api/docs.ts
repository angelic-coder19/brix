// Shared content for the developer docs: the HTML page and its Markdown copy
// (for LLMs and coding agents) are built from the same data, so they agree.
import { operations, type Operation } from "./openapi";
import { MAX_KEYS_PER_USER, RATE_LIMIT_PER_MINUTE, SCOPES } from "./keys";
import { API_VERSION } from "./v1";

export const origin = process.env.APP_URL?.startsWith("https://")
  ? process.env.APP_URL.replace(/\/$/, "")
  : "https://www.usebrix.app";
export const base = `${origin}/api/v1`;

export const anchor = (op: Operation) =>
  `${op.method}-${op.path.replace(/[{}]/g, "").replace(/\//g, "-").replace(/^-/, "")}`;
const samplePath = (op: Operation) =>
  op.path.replace(
    "{id}",
    op.path.startsWith("/reminders") ? "manual:…" : "ch_123",
  ) + (op.example?.query ?? "");

export function curl(op: Operation) {
  const lines = [
    `curl${op.method === "get" ? "" : ` -X ${op.method.toUpperCase()}`} "${base}${samplePath(op)}"`,
    `  -H "Authorization: Bearer $BRIX_API_KEY"`,
  ];
  if (op.path === "/trials")
    lines.push(`  -H "Idempotency-Key: trial-notion-nov"`);
  if (op.example?.body)
    lines.push(
      `  -H "Content-Type: application/json"`,
      `  -d '${JSON.stringify(op.example.body)}'`,
    );
  return lines.join(" \\\n");
}

export const ERRORS: [number, string, string][] = [
  [400, "invalid_request", "A parameter or body field is missing or invalid."],
  [
    401,
    "authentication_failed",
    "The key is missing, malformed, unknown, or revoked.",
  ],
  [
    403,
    "insufficient_scope",
    "The key doesn't have the scope this endpoint needs.",
  ],
  [
    404,
    "not_found",
    "No charge or reminder with that ID belongs to this user.",
  ],
  [
    409,
    "conflict",
    "The change conflicts with the current state, e.g. a sent reminder.",
  ],
  [413, "request_too_large", "The body is larger than 64 KB."],
  [
    429,
    "rate_limited",
    `More than ${RATE_LIMIT_PER_MINUTE} requests in a minute. Wait for \`Retry-After\`.`,
  ],
  [
    502,
    "upstream_unavailable",
    "A provider such as the news service didn't respond.",
  ],
  [
    500,
    "api_error",
    "Something failed on our side. Retry; share the request ID if it continues.",
  ],
];

export const REPO = "https://github.com/Timeless-Dave/brix";

export const SNIPPETS = {
  first: `curl ${base}/me \\\n  -H "Authorization: Bearer $BRIX_API_KEY"`,
  js: `const res = await fetch("${base}/charges/upcoming?days=7", {
  headers: { Authorization: \`Bearer \${process.env.BRIX_API_KEY}\` },
});
if (!res.ok) throw new Error((await res.json()).error.message);
const { data } = await res.json();
for (const c of data)
  console.log(\`\${c.merchant}: $\${c.amount} on \${c.next_date}\`);`,
  python: `import os, requests

r = requests.post(
    "${base}/reminders",
    headers={"Authorization": f"Bearer {os.environ['BRIX_API_KEY']}"},
    json={"merchant": "Spotify", "when": "2 days before"},
    timeout=10,
)
r.raise_for_status()
print(r.json()["remind_at"])`,
  error: `{
  "error": {
    "type": "insufficient_scope",
    "message": "This key is missing the \`charges:write\` scope.",
    "request_id": "req_4f1c9a0b2e7d4c3a8b19"
  }
}`,
  local: `git clone ${"https://github.com/Timeless-Dave/brix"}
cd brix
npm install
cp .env.example .env.local
npm run dev`,
};

const fence = (lang: string, code: string) =>
  "```" + lang + "\n" + code + "\n```";

/** The developer docs as one Markdown document, for LLMs and agents. */
export function developerMarkdown() {
  const lines: string[] = [
    "# Brix API v1",
    "",
    "Brix is an AI money assistant for college students. The API lets a Brix user read their subscriptions, free trials, reminders, single-use cards (masked), school refunds and practice portfolio, mark charges to cancel, and schedule reminders, with a personal key they create and can revoke.",
    "",
    `- Base URL: \`${base}\``,
    `- OpenAPI 3.1 spec: ${origin}/api/v1/openapi.json`,
    `- Human docs: ${origin}/developers`,
    `- Source: ${REPO}`,
    "",
    "## Quickstart",
    "",
    "1. Sign in to Brix and open Developers → API keys. Name the key, choose only the scopes you need, and copy it (it's shown once).",
    "2. Store it server-side as `BRIX_API_KEY`. Never ship it in a web page, app bundle or public repo.",
    "3. Make your first call:",
    "",
    fence("bash", SNIPPETS.first),
    "",
    "JavaScript:",
    "",
    fence("js", SNIPPETS.js),
    "",
    "Python:",
    "",
    fence("python", SNIPPETS.python),
    "",
    "## Authentication and scopes",
    "",
    `Send \`Authorization: Bearer brix_sk_…\`. Brix stores only a SHA-256 hash of the key. Up to ${MAX_KEYS_PER_USER} active keys per user. A missing scope returns \`403 insufficient_scope\`.`,
    "",
    "| Scope | Allows |",
    "|---|---|",
    ...Object.entries(SCOPES).map(([s, d]) => `| \`${s}\` | ${d} |`),
    "",
    "## Conventions",
    "",
    "- JSON in and out, `snake_case` fields, amounts in USD as decimal numbers, dates as `YYYY-MM-DD`.",
    '- Lists: `{ "object": "list", "data": [...] }`.',
    `- Rate limit: ${RATE_LIMIT_PER_MINUTE} requests per minute per key, with \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` and \`Retry-After\` on 429.`,
    "- `POST /trials` accepts an `Idempotency-Key` header.",
    `- Responses carry \`Brix-Version: ${API_VERSION}\`. Fields are only ever added within \`/v1\`.`,
    "- Every response has an `X-Request-Id`, also inside error bodies.",
    "",
    "## Errors",
    "",
    fence("json", SNIPPETS.error),
    "",
    "| Status | Type | Meaning |",
    "|---|---|---|",
    ...ERRORS.map(
      ([status, type, meaning]) => `| ${status} | \`${type}\` | ${meaning} |`,
    ),
    "",
    "## Endpoints",
    "",
  ];
  for (const op of operations as Operation[])
    lines.push(
      `### ${op.method.toUpperCase()} /v1${op.path}`,
      "",
      `**${op.summary}.** ${op.description}`,
      "",
      `Scope: ${op.scope ? `\`${op.scope}\`` : "any valid key"}`,
      "",
      fence("bash", curl(op)),
      "",
    );
  lines.push(
    "## What the API doesn't do",
    "",
    "- Create cards (needs the user's confirmation in the app), link banks (Plaid's secure screen in the app), chat with the assistant, cancel at the merchant, or act for other people (keys are personal; no OAuth yet).",
    "",
    "## Data and safety",
    "",
    "Bank charges are Plaid sandbox data and cards are Lithic sandbox cards that can't spend real money. Treat a key like a password; revoke a leaked key on the Developers page in the app.",
    "",
  );
  return lines.join("\n");
}
