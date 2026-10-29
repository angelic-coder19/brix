import { requireUser, errorResponse } from "@/lib/auth";
import { findSecurity } from "@/lib/market/universe";
import { getTickerNews } from "@/lib/news/tickers";
import { getPortfolio } from "@/lib/store";
export const runtime = "nodejs";
/** Headlines for `?symbols=` or, by default, the user's largest holdings. */
export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const raw = new URL(request.url).searchParams.get("symbols");
    let symbols = (raw ?? "")
      .split(",")
      .map((s) => findSecurity(s)?.symbol)
      .filter((s): s is string => !!s);
    if (!symbols.length) {
      const p = await getPortfolio(uid);
      symbols = p
        ? Object.entries(p.positions)
            .sort(
              (a, b) => b[1].shares * b[1].avgCost - a[1].shares * a[1].avgCost,
            )
            .map(([s]) => s)
        : [];
      // No holdings yet: a starter watchlist, so the strip is never empty.
      symbols = [...symbols, "VOO", "QQQ", "AAPL", "NVDA", "TSLA"];
    }
    return Response.json(
      await getTickerNews(symbols, fetch, { images: true }),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
