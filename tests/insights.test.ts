import test from "node:test";
import assert from "node:assert/strict";
import { parseHistory, sampleHistory } from "../lib/market/history";
import { samplePrice } from "../lib/market/quotes";
import { coinsFor, publicName } from "../lib/practice/leaderboard";

test("price history keeps real closes in order and skips empty sessions", () => {
  const body = {
    chart: {
      result: [
        {
          timestamp: [1760000000, 1760086400, 1760172800],
          indicators: { quote: [{ close: [600.123, null, 612.4] }] },
        },
      ],
    },
  };
  const h = parseHistory("VOO", "1mo", body);
  assert.ok(h);
  assert.deepEqual(
    h.points.map((p) => p.close),
    [600.12, 612.4],
  );
  assert.equal(parseHistory("VOO", "1mo", { chart: { result: [] } }), null);
});

test("sample history is repeatable and ends on the sample price", () => {
  const a = sampleHistory("VOO", "1mo", 0)!;
  const b = sampleHistory("VOO", "1mo", 0)!;
  assert.deepEqual(a, b);
  assert.equal(a.sample, true);
  assert.equal(a.points.at(-1)!.close, samplePrice("VOO"));
  assert.equal(sampleHistory("NOPE", "1mo"), null);
});

test("coins reward habits, and losses never take coins away", () => {
  assert.equal(coinsFor(0, 0, 0), 100);
  assert.equal(coinsFor(2.5, 3, 1), 100 + 30 + 50 + 50);
  assert.equal(coinsFor(-10, 0, 0), 100);
  assert.equal(coinsFor(0, 99, 9), 100 + 300 + 150);
});

test("leaderboard names show only a first name and initial", () => {
  assert.equal(publicName("Maya Chen"), "Maya C.");
  assert.equal(publicName("  Maya  "), "Maya");
  assert.equal(publicName("Ana Maria de la Cruz"), "Ana C.");
  assert.equal(publicName(""), "A Brix student");
});

test("merchant logos: only Plaid's CDN is trusted, domains are cleaned", async () => {
  const { merchantDomain, safeLogoUrl } =
    await import("../lib/merchant-domains");
  assert.equal(
    safeLogoUrl("https://plaid-merchant-logos.plaid.com/spotify_947.png"),
    "https://plaid-merchant-logos.plaid.com/spotify_947.png",
  );
  assert.equal(
    safeLogoUrl("http://plaid-merchant-logos.plaid.com/x.png"),
    undefined,
  );
  assert.equal(safeLogoUrl("https://evil.example/plaid.com.png"), undefined);
  assert.equal(safeLogoUrl("javascript:alert(1)"), undefined);
  assert.equal(
    merchantDomain("Spotify", "https://www.spotify.com/us"),
    "spotify.com",
  );
  assert.equal(merchantDomain("LinkedIn Premium"), "linkedin.com");
  assert.equal(merchantDomain("Local Gym"), undefined);
  assert.equal(merchantDomain("x", "not a domain"), undefined);
});
