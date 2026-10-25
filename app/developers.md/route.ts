import { developerMarkdown } from "@/lib/api/docs";

/** The developer docs as plain Markdown, for LLMs and coding agents. */
export function GET() {
  return new Response(developerMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
