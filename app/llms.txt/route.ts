import { origin, REPO } from "@/lib/api/docs";

/** An llms.txt index (https://llmstxt.org) pointing agents at the docs. */
export function GET() {
  const body = `# Brix

> An AI money assistant for college students: it catches free trials before they bill, spots borrowed money in school refunds, tracks gift cards, and offers practice investing. Brix never moves money.

## Docs

- [API docs (Markdown)](${origin}/developers.md): authentication, scopes, conventions, errors and every endpoint with a curl example
- [OpenAPI 3.1 spec](${origin}/api/v1/openapi.json): machine-readable API definition
- [Developer page](${origin}/developers): the same docs as HTML

## Optional

- [Source code](${REPO}): Next.js app, tests and setup guide
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
