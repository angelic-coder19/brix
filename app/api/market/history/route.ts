import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import {
  getHistory,
  HISTORY_RANGES,
  type HistoryRange,
} from "@/lib/market/history";
import { findSecurity } from "@/lib/market/universe";
export const runtime = "nodejs";
/** `?symbol=VOO&range=1mo` (1mo, 6mo or 1y) from the practice list. */
export async function GET(request: Request) {
  try {
    await requireUser(request);
    const params = new URL(request.url).searchParams;
    const symbol = findSecurity(params.get("symbol") ?? "")?.symbol;
    if (!symbol)
      throw new HttpError(400, "Pass a `symbol` from the practice list.");
    const range = (params.get("range") ?? "1mo") as HistoryRange;
    if (!HISTORY_RANGES.includes(range))
      throw new HttpError(400, "`range` must be 1mo, 6mo or 1y.");
    const history = await getHistory(symbol, range);
    if (!history)
      throw new HttpError(503, "Price history isn't available right now.");
    return Response.json(history);
  } catch (error) {
    return errorResponse(error);
  }
}
