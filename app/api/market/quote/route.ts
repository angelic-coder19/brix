import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { getQuotes } from "@/lib/market/quotes";
import { findSecurity } from "@/lib/market/universe";
export const runtime = "nodejs";
/** `?symbols=VOO,AAPL` from the practice list, up to 10. */
export async function GET(request: Request) {
  try {
    await requireUser(request);
    const raw = new URL(request.url).searchParams.get("symbols") ?? "";
    const symbols = raw
      .split(",")
      .map((s) => findSecurity(s)?.symbol)
      .filter((s): s is string => !!s)
      .slice(0, 10);
    if (!symbols.length)
      throw new HttpError(400, "Pass `symbols` from the practice list.");
    return Response.json({ quotes: await getQuotes(symbols) });
  } catch (error) {
    return errorResponse(error);
  }
}
