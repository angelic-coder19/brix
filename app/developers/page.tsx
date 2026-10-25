import type { Metadata } from "next";
import Link from "next/link";
import { operations, type Operation } from "@/lib/api/openapi";
import {
  MAX_KEYS_PER_USER,
  RATE_LIMIT_PER_MINUTE,
  SCOPES,
} from "@/lib/api/keys";
import { API_VERSION } from "@/lib/api/v1";
import "./developers.css";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "The Brix API: read subscriptions and trials, mark charges to cancel, and schedule reminders from your own apps.",
};

const origin = process.env.APP_URL?.startsWith("https://")
  ? process.env.APP_URL.replace(/\/$/, "")
  : "https://www.usebrix.app";
const base = `${origin}/api/v1`;

const anchor = (op: Operation) =>
  `${op.method}-${op.path.replace(/[{}]/g, "").replace(/\//g, "-").replace(/^-/, "")}`;
const samplePath = (op: Operation) =>
  op.path.replace(
    "{id}",
    op.path.startsWith("/reminders") ? "manual:…" : "ch_123",
  ) + (op.example?.query ?? "");

function curl(op: Operation) {
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

const ERRORS: [number, string, string][] = [
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

export default function DevelopersPage() {
  return (
    <div className="dev">
      <header className="dev-header">
        <Link href="/" className="wordmark wordmark--sm" aria-label="Brix home">
          <span className="brand-block" />
          brix<span className="brand-period">.</span>
        </Link>
        <nav aria-label="Developer docs">
          <a href="#quickstart">Quickstart</a>
          <a href="#reference">Reference</a>
          <a href="/api/v1/openapi.json">OpenAPI</a>
          <Link href="/settings" className="btn btn--sm btn--dark">
            Get a key
          </Link>
        </nav>
      </header>

      <main className="dev-main">
        <section className="dev-hero">
          <span className="badge badge--accent">API · v1</span>
          <h1>Build on Brix.</h1>
          <p>
            Bring your subscriptions, free trials, and reminders into your own
            apps: a budget spreadsheet, a Discord bot, a home dashboard, or a
            shortcut on your phone. Every request acts for one Brix user with a
            key they create and can revoke.
          </p>
        </section>

        <section id="quickstart" className="dev-section">
          <h2>Quickstart</h2>
          <ol className="dev-steps">
            <li>
              Sign in to Brix and open{" "}
              <Link href="/settings">Settings → Developer API keys</Link>. Name
              the key, pick only the permissions you need, and copy it. It’s
              shown once.
            </li>
            <li>
              Store it as an environment variable on your server, e.g.{" "}
              <code>BRIX_API_KEY</code>. Never put it in a web page, a mobile
              app bundle, or a public repo.
            </li>
            <li>Make your first call:</li>
          </ol>
          <pre className="dev-code" tabIndex={0}>
            <code>{`curl ${base}/me \\\n  -H "Authorization: Bearer $BRIX_API_KEY"`}</code>
          </pre>
          <div className="dev-grid">
            <div>
              <h3>JavaScript</h3>
              <pre className="dev-code" tabIndex={0}>
                <code>{`const res = await fetch("${base}/charges/upcoming?days=7", {
  headers: { Authorization: \`Bearer \${process.env.BRIX_API_KEY}\` },
});
if (!res.ok) throw new Error((await res.json()).error.message);
const { data } = await res.json();
for (const c of data)
  console.log(\`\${c.merchant}: $\${c.amount} on \${c.next_date}\`);`}</code>
              </pre>
            </div>
            <div>
              <h3>Python</h3>
              <pre className="dev-code" tabIndex={0}>
                <code>{`import os, requests

r = requests.post(
    "${base}/reminders",
    headers={"Authorization": f"Bearer {os.environ['BRIX_API_KEY']}"},
    json={"merchant": "Spotify", "when": "2 days before"},
    timeout=10,
)
r.raise_for_status()
print(r.json()["remind_at"])`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="dev-section">
          <h2>Authentication & permissions</h2>
          <p>
            Send the key as a bearer token:{" "}
            <code>Authorization: Bearer brix_sk_…</code>. Brix stores only a
            SHA-256 hash of it. Each user can have up to {MAX_KEYS_PER_USER}{" "}
            active keys; revoking one stops it immediately. Each key carries
            scopes, and an endpoint without its scope returns{" "}
            <code>403 insufficient_scope</code>.
          </p>
          <div className="dev-table-wrap" tabIndex={0} role="region" aria-label="Table">
            <table className="dev-table">
              <thead>
                <tr>
                  <th scope="col">Scope</th>
                  <th scope="col">Allows</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(SCOPES).map(([scope, description]) => (
                  <tr key={scope}>
                    <td>
                      <code>{scope}</code>
                    </td>
                    <td>{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dev-section">
          <h2>Conventions</h2>
          <dl className="dev-facts">
            <div>
              <dt>Base URL</dt>
              <dd>
                <code>{base}</code>
              </dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>
                JSON in and out, <code>snake_case</code> fields, amounts in USD
                as decimal numbers, dates as <code>YYYY-MM-DD</code>. Lists come
                back as <code>{`{ "object": "list", "data": [...] }`}</code>.
              </dd>
            </div>
            <div>
              <dt>Rate limit</dt>
              <dd>
                {RATE_LIMIT_PER_MINUTE} requests per minute per key. Every
                response includes <code>X-RateLimit-Limit</code> and{" "}
                <code>X-RateLimit-Remaining</code>; a <code>429</code> includes{" "}
                <code>Retry-After</code>.
              </dd>
            </div>
            <div>
              <dt>Retries</dt>
              <dd>
                <code>POST /trials</code> accepts an{" "}
                <code>Idempotency-Key</code> header; repeating it returns the
                first result. Creating the same reminder twice is already safe.
              </dd>
            </div>
            <div>
              <dt>Versioning</dt>
              <dd>
                Responses carry <code>Brix-Version: {API_VERSION}</code>. We add
                fields without notice; we never remove or rename fields within{" "}
                <code>/v1</code>.
              </dd>
            </div>
            <div>
              <dt>Request IDs</dt>
              <dd>
                Every response has an <code>X-Request-Id</code>, also inside
                error bodies. Include it when you report a problem.
              </dd>
            </div>
          </dl>
        </section>

        <section className="dev-section">
          <h2>Errors</h2>
          <pre className="dev-code" tabIndex={0}>
            <code>{`{
  "error": {
    "type": "insufficient_scope",
    "message": "This key is missing the \`charges:write\` scope.",
    "request_id": "req_4f1c9a0b2e7d4c3a8b19"
  }
}`}</code>
          </pre>
          <div className="dev-table-wrap" tabIndex={0} role="region" aria-label="Table">
            <table className="dev-table">
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Type</th>
                  <th scope="col">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {ERRORS.map(([status, type, meaning]) => (
                  <tr key={status}>
                    <td>{status}</td>
                    <td>
                      <code>{type}</code>
                    </td>
                    <td>{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="reference" className="dev-section">
          <h2>Endpoint reference</h2>
          <p>
            The full machine-readable spec is at{" "}
            <a href="/api/v1/openapi.json">
              <code>/api/v1/openapi.json</code>
            </a>{" "}
            (OpenAPI 3.1). Import it into Postman, Insomnia, or a client
            generator.
          </p>
          <ul className="dev-index">
            {operations.map((op) => (
              <li key={anchor(op)}>
                <a href={`#${anchor(op)}`}>
                  <span className={`dev-method dev-method--${op.method}`}>
                    {op.method.toUpperCase()}
                  </span>
                  <code>{op.path}</code>
                  <span>{op.summary}</span>
                </a>
              </li>
            ))}
          </ul>
          {operations.map((op) => (
            <article key={anchor(op)} id={anchor(op)} className="dev-endpoint">
              <h3>
                <span className={`dev-method dev-method--${op.method}`}>
                  {op.method.toUpperCase()}
                </span>
                <code>/v1{op.path}</code>
              </h3>
              <p className="dev-endpoint__summary">
                <strong>{op.summary}.</strong> {op.description}
              </p>
              <p className="dev-endpoint__scope">
                Scope: {op.scope ? <code>{op.scope}</code> : "any valid key"}
              </p>
              <pre className="dev-code" tabIndex={0}>
                <code>{curl(op)}</code>
              </pre>
            </article>
          ))}
        </section>

        <section className="dev-section">
          <h2>What the API doesn’t do, and why</h2>
          <ul className="dev-list">
            <li>
              <strong>Create cards.</strong> A card is a payment instrument, so
              it needs the user’s confirmation in the app (and their PIN for
              voice). The API can list cards, masked to the last four digits.
            </li>
            <li>
              <strong>Link banks.</strong> Bank linking runs through Plaid’s
              secure screen in the app. Linked charges show up in{" "}
              <code>/charges</code> with <code>source: &quot;plaid&quot;</code>.
            </li>
            <li>
              <strong>Chat with the assistant.</strong> Each conversation runs a
              language model, which costs money per message, so it stays in the
              app, WhatsApp, and voice.
            </li>
            <li>
              <strong>Cancel at the merchant.</strong> Brix never cancels or
              moves money. Marking a charge <code>to_cancel</code> records the
              decision and returns the merchant’s cancel link.
            </li>
            <li>
              <strong>Act for other people.</strong> Keys are personal. There’s
              no OAuth for third-party apps yet; build for yourself, or have
              each user paste their own key.
            </li>
          </ul>
        </section>

        <section className="dev-section dev-section--note">
          <h2>Data & safety</h2>
          <p>
            Charges from linked banks are Plaid sandbox data; cards are Lithic
            sandbox cards and can’t spend real money. Treat a key like a
            password: anyone holding it can read that user’s subscriptions. If
            one leaks, revoke it in Settings and create a new one.
          </p>
        </section>
      </main>
    </div>
  );
}
