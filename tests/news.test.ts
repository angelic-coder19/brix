import test from "node:test";
import assert from "node:assert/strict";
import { getMoneyNews } from "../lib/tools/getMoneyNews";
import { demoState } from "../lib/store";

test("news returns only recent merchant-matched subscription headlines and safe links", async () => {
  process.env.BRIX_DEMO_MODE = "false";
  process.env.NEWS_API_KEY = "test-only";
  const base = {
    title: "Netflix subscription pricing changes",
    description: "Plan renewal update",
    url: "https://example.com/news",
    publishedAt: new Date(Date.now() - 1000).toISOString(),
    source: { name: "Example" },
  };
  const result = await getMoneyNews(
    demoState().charges,
    async (input, init) => {
      assert.ok(String(input).startsWith("https://newsapi.org/v2/everything?"));
      assert.ok(!String(input).includes("test-only"));
      assert.equal(
        (init?.headers as Record<string, string>)["X-Api-Key"],
        "test-only",
      );
      return Response.json({
        status: "ok",
        articles: [
          base,
          base,
          { ...base, url: "javascript:bad" },
          {
            ...base,
            url: "https://example.com/old",
            publishedAt: "2000-01-01",
          },
          {
            ...base,
            title: "Sports scores",
            description: "Unrelated",
            url: "https://example.com/sports",
          },
        ],
      });
    },
  );
  assert.equal(result.headlines.length, 1);
  assert.equal(result.headlines[0].merchant, "Netflix");
});
test("demo news never contacts providers and provider failures are not invented headlines", async () => {
  process.env.BRIX_DEMO_MODE = "true";
  const result = await getMoneyNews(demoState().charges, async () => {
    assert.fail("demo must not fetch");
  });
  assert.equal(result.headlines.length, 0);
  process.env.BRIX_DEMO_MODE = "false";
  process.env.NEWS_API_KEY = "test-only";
  await assert.rejects(
    getMoneyNews(
      demoState().charges,
      async () => new Response("no", { status: 403 }),
    ),
    /Check the news provider/,
  );
});
