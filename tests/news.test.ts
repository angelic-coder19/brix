import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRss, decodeEntities } from "../lib/news/rss";
import {
  getMoneyNews,
  isPricingStory,
  selectHeadlines,
} from "../lib/tools/getMoneyNews";
import { getTickerNews } from "../lib/news/tickers";
import { cached } from "../lib/news/cache";
import { demoState } from "../lib/store";

const google = readFileSync("tests/fixtures/google-news.xml", "utf8");
const yahoo = readFileSync("tests/fixtures/yahoo-ticker.xml", "utf8");
const rss = (items: string) => `<rss><channel>${items}</channel></rss>`;
const item = (
  title: string,
  link: string,
  date = new Date().toUTCString(),
  source = "Example",
) =>
  `<item><title><![CDATA[${title} - ${source}]]></title><link>${link}</link><pubDate>${date}</pubDate><source url="https://example.com">${source}</source></item>`;

test("parses real Google News and Yahoo Finance feeds", () => {
  const g = parseRss(google);
  assert.equal(g.length, 3);
  assert.ok(
    g.every((i) => i.title && i.link.startsWith("https://") && i.publishedAt),
  );
  assert.ok(
    !g[0].title.endsWith(` - ${g[0].source}`),
    "publisher suffix removed",
  );
  const y = parseRss(yahoo);
  assert.equal(y.length, 3);
  assert.match(y[0].title, /S&P 500/, "entities decoded");
  assert.equal(y[0].source, "fool.com");
  assert.equal(decodeEntities("&#x24;5 &amp; &#39;up&#39;"), "$5 & 'up'");
});

test("pricing stories match; TV renewals and publisher names don't", () => {
  assert.ok(
    isPricingStory("Netflix raises prices for its ad-free plan", "Netflix"),
  );
  assert.ok(
    isPricingStory(
      "Spotify Premium Student price hike lands in October",
      "Spotify",
    ),
  );
  assert.ok(
    !isPricingStory(
      "A Different World Season 2 Is Officially Renewed",
      "Netflix",
    ),
  );
  assert.ok(
    !isPricingStory("Netflix drops the trailer for its new season", "Netflix"),
  );
  assert.ok(
    !isPricingStory("Spotify Price Target Raised to $650/Share by Barclays", "Spotify"),
    "stock coverage is not subscription pricing",
  );
  assert.ok(
    !isPricingStory("Prices rise across streaming", "Netflix"),
    "merchant must be named",
  );
  assert.ok(
    !isPricingStory("Netflixing and chilling costs", "Netflix"),
    "whole word only",
  );
});

test("headline selection keeps safe, recent, unique items, newest first", () => {
  const now = Date.now();
  const at = (days: number) => new Date(now - days * 86400000).toISOString();
  const base = { source: "Example" };
  const picked = selectHeadlines(
    [
      {
        merchant: "Netflix",
        items: [
          {
            ...base,
            title: "Netflix price increase hits basic plan",
            link: "https://a.example/1",
            publishedAt: at(3),
          },
          {
            ...base,
            title: "Netflix price increase hits basic plan",
            link: "https://b.example/dup",
            publishedAt: at(2),
          },
          {
            ...base,
            title: "Netflix raises fees again",
            link: "http://insecure.example",
            publishedAt: at(1),
          },
          {
            ...base,
            title: "Netflix raises fees again",
            link: "javascript:alert(1)",
            publishedAt: at(1),
          },
          {
            ...base,
            title: "Netflix subscription cost in 2001",
            link: "https://old.example",
            publishedAt: at(400),
          },
          {
            ...base,
            title: "Netflix subscription cost from the future",
            link: "https://future.example",
            publishedAt: at(-3),
          },
          {
            ...base,
            title: "Netflix cuts student subscription price",
            link: "https://c.example/2",
            publishedAt: at(1),
          },
        ],
      },
    ],
    now,
  );
  assert.deepEqual(
    picked.map((h) => h.url),
    ["https://c.example/2", "https://a.example/1"],
  );
});

test("merchant news uses Google News, then NewsAPI only if Google fails", async () => {
  process.env.BRIX_DEMO_MODE = "false";
  const charges = demoState().charges;
  const calls: string[] = [];
  const google = await getMoneyNews(charges, async (input) => {
    calls.push(String(input));
    return new Response(
      rss(
        item(
          "Netflix raises its Standard plan price",
          "https://news.example/n",
        ),
      ),
    );
  });
  assert.ok(
    calls.every((u) => u.startsWith("https://news.google.com/rss/search?")),
  );
  assert.equal(calls.length, 3, "one query per top merchant");
  assert.equal(google.headlines.length, 1);
  assert.equal(google.headlines[0].merchant, "Netflix");

  process.env.NEWS_API_KEY = "test-only";
  const backup = await getMoneyNews(charges, async (input, init) => {
    if (String(input).includes("news.google.com"))
      return new Response("down", { status: 503 });
    assert.equal(
      (init?.headers as Record<string, string>)["X-Api-Key"],
      "test-only",
    );
    assert.ok(!String(input).includes("test-only"), "key never in the URL");
    return Response.json({
      status: "ok",
      articles: [
        {
          title: "Spotify price hike for students",
          url: "https://n.example/s",
          publishedAt: new Date().toISOString(),
          source: { name: "N" },
        },
      ],
    });
  });
  assert.equal(backup.headlines[0]?.merchant, "Spotify");
  delete process.env.NEWS_API_KEY;
  await assert.rejects(
    getMoneyNews(charges, async () => new Response("down", { status: 503 })),
    /temporarily unavailable/,
  );
});

test("demo news is labelled sample data and never fetches", async () => {
  process.env.BRIX_DEMO_MODE = "true";
  const fail = async () => assert.fail("demo must not fetch");
  const news = await getMoneyNews(demoState().charges, fail);
  assert.ok(news.headlines.length > 0);
  assert.ok(news.headlines.every((h) => h.source === "Sample news (demo)"));
  const tickers = await getTickerNews(["voo"], fail);
  assert.equal(tickers.headlines[0].symbol, "VOO");
});

test("ticker news reads Yahoo; one failing symbol doesn't fail the rest", async () => {
  process.env.BRIX_DEMO_MODE = "false";
  const fresh = new Date().toUTCString();
  const result = await getTickerNews(["VOO", "AAPL"], async (input) =>
    String(input).includes("s=VOO")
      ? new Response(
          rss(item("VOO hits a record", "https://y.example/1", fresh)),
        )
      : new Response("nope", { status: 500 }),
  );
  assert.deepEqual(
    result.headlines.map((h) => h.symbol),
    ["VOO"],
  );
  await assert.rejects(
    getTickerNews(["AAPL"], async () => new Response("nope", { status: 500 })),
    /temporarily unavailable/,
  );
});

test("cache serves fresh values, then stale ones when a refresh fails", async () => {
  process.env.BRIX_DEMO_MODE = "true"; // memory layer only
  const key = `test:${Math.random()}`;
  let loads = 0;
  const first = await cached(key, 1, async () => ++loads);
  assert.deepEqual(first, { value: 1, stale: false });
  await new Promise((r) => setTimeout(r, 5));
  const fallback = await cached(key, 1, async () => {
    throw new Error("down");
  });
  assert.deepEqual(fallback, { value: 1, stale: true });
  await assert.rejects(
    cached(`test:${Math.random()}`, 1, async () => {
      throw new Error("down");
    }),
  );
});
