import { verifyVapi } from "@/lib/vapi";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!verifyVapi(request))
    return new Response("Unauthorized", { status: 401 });
  return Response.json({ received: true });
}
