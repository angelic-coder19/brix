import { test, expect, type APIRequestContext } from "@playwright/test";

// Demo-mode API robustness and a small concurrency stress test.
// Timings are printed so they can be compared between runs.

test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/admin/reset-demo")).ok()).toBeTruthy();
});

const JSON_ROUTES = [
  "/api/agent",
  "/api/agent/chat",
  "/api/agent/action",
  "/api/agent/react",
  "/api/trials",
  "/api/cards",
  "/api/plaid/exchange",
];

const raw = (request: APIRequestContext, url: string, body: string) =>
  request.post(url, {
    data: body,
    headers: { "content-type": "application/json" },
  });

test("Vercel cron GET requires its secret and sends reminders only once", async ({
  request,
}) => {
  expect((await request.get("/api/jobs/reminders")).status()).toBe(401);
  expect(
    (
      await request.get("/api/jobs/reminders", {
        headers: { authorization: "Bearer wrong" },
      })
    ).status(),
  ).toBe(401);
  const headers = {
    authorization: "Bearer brix-browser-test-cron-secret-not-for-deployment",
  };
  const first = await request.get("/api/jobs/reminders", { headers });
  expect(first.status()).toBe(200);
  expect((await first.json()).inApp).toBeGreaterThan(0);
  const repeated = await request.get("/api/jobs/reminders", { headers });
  expect((await repeated.json()).inApp).toBe(0);
});

for (const url of JSON_ROUTES) {
  test(`${url} rejects bad bodies with 4xx, never 5xx`, async ({ request }) => {
    for (const body of [
      "",
      "{oops",
      "null",
      "[]",
      "[1,2,3]",
      '"hi"',
      "42",
      "{}",
    ]) {
      const res = await raw(request, url, body);
      expect(
        res.status(),
        `${url} body=${JSON.stringify(body)}`,
      ).toBeGreaterThanOrEqual(400);
      expect(res.status(), `${url} body=${JSON.stringify(body)}`).toBeLessThan(
        500,
      );
    }
    const huge = await raw(
      request,
      url,
      JSON.stringify({ message: "x".repeat(70_000) }),
    );
    expect(huge.status()).toBe(413);
  });
}

test("settings accepts an empty body but rejects wrong types", async ({
  request,
}) => {
  const patch = (body: string) =>
    request.patch("/api/settings", {
      data: body,
      headers: { "content-type": "application/json" },
    });
  expect((await request.patch("/api/settings")).status()).toBe(200);
  expect((await patch("null")).status()).toBe(400);
  expect((await patch('{"whatsappOptIn":"yes"}')).status()).toBe(400);
  expect((await patch('{"displayName":42}')).status()).toBe(400);
  expect((await patch('{"pin":"12"}')).status()).toBe(400);
});

test("agent validates message length and type", async ({ request }) => {
  const send = (message: unknown) =>
    request.post("/api/agent", { data: { message } });
  expect((await send("")).status()).toBe(400);
  expect((await send("   ")).status()).toBe(400);
  expect((await send(123)).status()).toBe(400);
  expect((await send({ text: "hi" })).status()).toBe(400);
  expect((await send("x".repeat(2001))).status()).toBe(400);
  const ok = await send("x".repeat(2000));
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(body.reply).toEqual(expect.any(String));
  expect(body.meta.suggestions.length).toBeGreaterThan(0);
});

test("react endpoint only accepts known tapbacks on assistant messages", async ({
  request,
}) => {
  const turn = await (
    await request.post("/api/agent", { data: { message: "hi" } })
  ).json();
  const react = (data: unknown) =>
    request.post("/api/agent/react", { data: data as object });
  expect(
    (await react({ eventId: turn.assistantEventId, emoji: "💩" })).status(),
  ).toBe(400);
  // Only Brix's own messages can receive a tapback; user messages are "not found".
  expect(
    (await react({ eventId: turn.userEventId, emoji: "❤️" })).status(),
  ).toBe(404);
  expect((await react({ eventId: "missing", emoji: "❤️" })).status()).toBe(404);
  expect(
    (await react({ eventId: turn.assistantEventId, emoji: "❤️" })).status(),
  ).toBe(200);
  expect(
    (await react({ eventId: turn.assistantEventId, emoji: null })).status(),
  ).toBe(200);
});

test("trials and cards validate inputs", async ({ request }) => {
  const trial = (data: object) => request.post("/api/trials", { data });
  expect((await trial({ merchant: "", endDate: "2026-12-01" })).status()).toBe(
    400,
  );
  expect((await trial({ merchant: "X", endDate: "not-a-date" })).status()).toBe(
    400,
  );
  expect(
    (
      await trial({ merchant: "X".repeat(101), endDate: "2026-12-01" })
    ).status(),
  ).toBe(400);
  expect((await trial({ merchant: "X", endDate: 20261201 })).status()).toBe(
    400,
  );
  const card = (data: object) => request.post("/api/cards", { data });
  expect((await card({ purpose: "", spendLimit: 5 })).status()).toBe(400);
  expect((await card({ purpose: "x", spendLimit: -1 })).status()).toBe(400);
  expect((await card({ purpose: "x", spendLimit: "lots" })).status()).toBe(400);
});

test("rapid repeated confirmations apply exactly once", async ({ request }) => {
  await request.post("/api/agent", {
    data: { message: "Remind me about Spotify 2 days before" },
  });
  const state0 = await (await request.get("/api/state")).json();
  if (!state0.pendingActions?.web) {
    // Without an LLM key the keyword agent proposes through the action route.
    await request.post("/api/agent/action", {
      data: {
        name: "set_reminder",
        args: { merchant: "Spotify", when: "2 days before" },
      },
    });
  }
  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      request.post("/api/agent", { data: { message: "yes" } }),
    ),
  );
  expect(results.every((r) => r.status() < 500)).toBeTruthy();
  const state = await (await request.get("/api/state")).json();
  expect(
    state.events.filter((e: { type: string }) => e.type === "reminder_created"),
  ).toHaveLength(1);
});

async function burst(
  name: string,
  n: number,
  fire: () => Promise<{ status(): number }>,
) {
  const times: number[] = [];
  const started = performance.now();
  const statuses = await Promise.all(
    Array.from({ length: n }, async () => {
      const t = performance.now();
      const res = await fire();
      times.push(performance.now() - t);
      return res.status();
    }),
  );
  const wall = performance.now() - started;
  times.sort((a, b) => a - b);
  const p = (q: number) =>
    times[Math.min(times.length - 1, Math.floor(q * times.length))];
  const stats = {
    name,
    n,
    ok: statuses.filter((s) => s < 400).length,
    "4xx": statuses.filter((s) => s >= 400 && s < 500).length,
    "5xx": statuses.filter((s) => s >= 500).length,
    wallMs: Math.round(wall),
    p50: Math.round(p(0.5)),
    p95: Math.round(p(0.95)),
    max: Math.round(times[times.length - 1]),
  };
  console.log(`STRESS ${JSON.stringify(stats)}`);
  return stats;
}

test("50 parallel requests per route stay healthy", async ({ request }) => {
  test.setTimeout(120_000);
  const s1 = await burst("GET /api/state", 50, () => request.get("/api/state"));
  const s2 = await burst("POST /api/agent", 50, () =>
    request.post("/api/agent", { data: { message: "What's coming up?" } }),
  );
  let i = 0;
  const s3 = await burst("POST /api/trials", 50, () =>
    request.post("/api/trials", {
      data: { merchant: `Load trial ${++i}`, endDate: "2026-12-01", amount: 5 },
    }),
  );
  let j = 0;
  const s4 = await burst("POST /api/cards", 50, () =>
    request.post("/api/cards", {
      data: { purpose: `Load card ${++j}`, spendLimit: 5 },
    }),
  );
  const s5 = await burst("GET /", 50, () => request.get("/"));
  for (const s of [s1, s2, s5]) expect(s.ok, s.name).toBe(50);
  for (const s of [s3, s4]) expect(s["5xx"], s.name).toBe(0);
  const state = await (await request.get("/api/state")).json();
  const trials = state.charges.filter((c: { merchant: string }) =>
    c.merchant.startsWith("Load trial"),
  );
  console.log(`STRESS trials persisted ${trials.length}/${s3.ok}`);
  expect(trials.length).toBe(s3.ok);
});
