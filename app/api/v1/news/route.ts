import { apiRoute } from "@/lib/api/v1";
import { executeTool } from "@/lib/tools";
export const runtime = "nodejs";
export const GET = apiRoute("news:read", async ({ uid }) => {
  const news = (await executeTool(uid, "api", "get_money_news")) as {
    headlines: Record<string, string>[];
    message: string;
  };
  return {
    object: "list",
    data: news.headlines.map((h) => ({
      object: "news_item",
      title: h.title,
      url: h.url,
      source: h.source,
      published_at: h.publishedAt,
      merchant: h.merchant,
      why_it_matters: h.whyItMatters,
    })),
    message: news.message,
  };
});
