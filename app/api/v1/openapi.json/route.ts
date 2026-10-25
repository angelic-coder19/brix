import { openApiDocument } from "@/lib/api/openapi";
export const runtime = "nodejs";
export function GET() {
  const origin = process.env.APP_URL?.startsWith("http")
    ? process.env.APP_URL.replace(/\/$/, "")
    : "https://www.usebrix.app";
  return Response.json(openApiDocument(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
