import type { Metadata } from "next";
import Link from "next/link";
import { operations, type Operation } from "@/lib/api/openapi";
import {
  MAX_KEYS_PER_USER,
  RATE_LIMIT_PER_MINUTE,
  SCOPES,
} from "@/lib/api/keys";
import { API_VERSION } from "@/lib/api/v1";
import { ArrowUpRight } from "lucide-react";
import LandingHeader from "@/components/landing/LandingHeader";
import "../landing.css";
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

const REPO = "https://github.com/Timeless-Dave/brix";

const siteLinks = [
  { href: "/#product", label: "Product" },
  { href: "/#how", label: "How it works" },
  { href: "/#demo", label: "Try the bot" },
  { href: "/#faq", label: "FAQ" },
  { href: "/developers", label: "Developers" },
];

const STACK: [string, string][] = [
  ["Next.js 16", "App Router, route handlers for the API, React 19, TypeScript"],
  ["Firebase", "Auth for sign-in, Firestore for charges, reminders and keys"],
  ["Plaid", "sandbox, read-only recurring transactions"],
  ["Anthropic", "the Brix agent behind web chat, WhatsApp and voice"],
  ["Twilio", "WhatsApp reminders and phone verification"],
  ["Vapi", "phone calls with Brix"],
  ["Lithic", "sandbox single-use cards"],
  ["Vercel", "hosting and the reminder cron"],
];

const ENV: [string, string[]][] = [
  ["Demo", ["BRIX_DEMO_MODE", "NEXT_PUBLIC_BRIX_DEMO_MODE", "APP_URL"]],
  [
    "Firebase",
    [
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "NEXT_PUBLIC_FIREBASE_APP_ID",
      "FIREBASE_ADMIN_PROJECT_ID",
      "FIREBASE_ADMIN_CLIENT_EMAIL",
      "FIREBASE_ADMIN_PRIVATE_KEY",
    ],
  ],
  ["Plaid", ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV"]],
  ["Anthropic", ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"]],
  [
    "Twilio",
    [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
      "TWILIO_WHATSAPP_FROM",
      "TWILIO_PHONE_NUMBER",
      "NEXT_PUBLIC_TWILIO_PHONE_NUMBER",
      "TWILIO_VERIFY_SERVICE_SID",
      "NEXT_PUBLIC_WHATSAPP_NUMBER",
      "NEXT_PUBLIC_WHATSAPP_JOIN_CODE",
    ],
  ],
  [
    "Vapi",
    ["VAPI_API_KEY", "VAPI_ASSISTANT_ID", "VAPI_PHONE_NUMBER_ID", "VAPI_SERVER_SECRET", "NEXT_PUBLIC_VAPI_PHONE_NUMBER"],
  ],
  ["Lithic", ["LITHIC_API_KEY", "LITHIC_ENV"]],
  ["Other", ["NEWS_API_KEY", "CRON_SECRET", "ADMIN_EMAILS"]],
];

export default function DevelopersPage() {
  return (
    <div className="dev">
      <LandingHeader links={siteLinks} current="/developers" />

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
          <nav className="dev-subnav" aria-label="On this page">
            <a href="#quickstart">Quickstart</a>
            <a href="#reference">API reference</a>
            <a href="#run">Run it yourself</a>
            <a href="/api/v1/openapi.json">OpenAPI</a>
            <a href={REPO} rel="noreferrer" target="_blank">
              GitHub <ArrowUpRight size={14} />
            </a>
            <Link href="/settings" className="btn btn--sm btn--dark">
              Get a key
            </Link>
          </nav>
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

        <section id="run" className="dev-section">
          <h2>Run it yourself</h2>
          <p>
            Brix is open source. The code, setup guide and tests are on{" "}
            <a href={REPO} rel="noreferrer" target="_blank">
              GitHub
            </a>
            . A local copy runs as a demo with sample data and no accounts.
          </p>
          <div className="dev-grid">
            <div>
              <h3>Stack</h3>
              <ul className="dev-list">
                {STACK.map(([name, use]) => (
                  <li key={name}>
                    <strong>{name}</strong> {use}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Local demo (Node 22+)</h3>
              <pre className="dev-code" tabIndex={0}>
                <code>{`git clone https://github.com/Timeless-Dave/brix
cd brix
npm install
cp .env.example .env.local
npm run dev`}</code>
              </pre>
              <p>
                The example file turns on <code>BRIX_DEMO_MODE</code> and{" "}
                <code>NEXT_PUBLIC_BRIX_DEMO_MODE</code>, which skip sign-in and
                share one sample account. Both must be <code>false</code> in
                production. Checks: <code>npm run lint</code>,{" "}
                <code>npm run typecheck</code>, <code>npm test</code> and{" "}
                <code>npx playwright test</code>.
              </p>
            </div>
          </div>
          <h3>Environment variables</h3>
          <p>
            Names from <code>.env.example</code>. Leave a provider’s values empty
            to keep that integration off.
          </p>
          <div className="dev-table-wrap">
            <table className="dev-table">
              <thead>
                <tr>
                  <th scope="col">Area</th>
                  <th scope="col">Variables</th>
                </tr>
              </thead>
              <tbody>
                {ENV.map(([area, names]) => (
                  <tr key={area}>
                    <td>{area}</td>
                    <td>
                      {names.map((n) => (
                        <code key={n} className="dev-env">
                          {n}
                        </code>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
