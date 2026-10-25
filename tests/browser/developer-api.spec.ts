import { test, expect } from "@playwright/test";

// Public API end to end: a key made through the signed-in app works against
// /api/v1, scopes are enforced, and revocation is immediate.

test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/admin/reset-demo")).ok()).toBeTruthy();
});

test("key lifecycle against the public API", async ({ request }) => {
  const made = await request.post("/api/developer/keys", {
    data: { name: "e2e", scopes: ["charges:read", "reminders:write"] },
  });
  expect(made.status()).toBe(201);
  const { secret, key } = await made.json();
  const auth = { authorization: `Bearer ${secret}` };

  const me = await request.get("/api/v1/me", { headers: auth });
  expect(me.status()).toBe(200);
  expect(me.headers()["x-ratelimit-limit"]).toBe("120");
  expect(me.headers()["x-request-id"]).toMatch(/^req_/);

  const charges = await (
    await request.get("/api/v1/charges", { headers: auth })
  ).json();
  expect(charges.data.length).toBeGreaterThan(0);

  const reminder = await request.post("/api/v1/reminders", {
    headers: auth,
    data: { charge_id: charges.data.at(-1).id, when: "1 day before" },
  });
  expect(reminder.status()).toBe(201);

  const denied = await request.post("/api/v1/trials", {
    headers: auth,
    data: { merchant: "X", end_date: "2099-01-01", amount: 1 },
  });
  expect(denied.status()).toBe(403);

  const listed = await (await request.get("/api/developer/keys")).json();
  expect(JSON.stringify(listed)).not.toContain(secret);
  expect(
    (await request.delete(`/api/developer/keys/${key.id}`)).ok(),
  ).toBeTruthy();
  expect((await request.get("/api/v1/me", { headers: auth })).status()).toBe(
    401,
  );
});

test("concurrent API calls on one key stay consistent", async ({ request }) => {
  const { secret } = await (
    await request.post("/api/developer/keys", {
      data: { name: "load", scopes: ["charges:read"] },
    })
  ).json();
  const results = await Promise.all(
    Array.from({ length: 40 }, () =>
      request.get("/api/v1/summary", {
        headers: { authorization: `Bearer ${secret}` },
      }),
    ),
  );
  expect(results.every((r) => r.status() === 200)).toBe(true);
  const remaining = results.map((r) =>
    Number(r.headers()["x-ratelimit-remaining"]),
  );
  expect(new Set(remaining).size).toBe(40);
});

test("OpenAPI spec and docs page are public", async ({ request, page }) => {
  const spec = await request.get("/api/v1/openapi.json");
  expect(spec.ok()).toBeTruthy();
  const doc = await spec.json();
  expect(doc.openapi).toBe("3.1.0");
  expect(Object.keys(doc.paths)).toContain("/charges/{id}");

  await page.goto("/developers");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Build on Brix.",
  );
  await expect(page.locator("#get-charges")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("developers page creates, shows once, and revokes a key", async ({
  page,
}) => {
  await page.goto("/developer");
  await page.getByLabel("Key name").fill("Spreadsheet");
  await page.getByRole("button", { name: "Create key" }).click();
  await expect(page.getByText("Copy your key now")).toBeVisible();
  await expect(page.locator(".key-secret code")).toHaveText(/^brix_sk_/);
  await page.getByRole("button", { name: "I’ve saved it" }).click();
  await expect(page.locator(".key-secret")).toHaveCount(0);
  await page.getByRole("button", { name: "Revoke Spreadsheet" }).click();
  await page
    .getByRole("group", { name: /Revoke “Spreadsheet”/ })
    .getByRole("button", { name: "Revoke key" })
    .click();
  await expect(page.getByText("No keys yet.")).toBeVisible();
});

test("a demo card can be closed", async ({ request }) => {
  await request.post("/api/cards", { data: { purpose: "e2e", spendLimit: 5 } });
  await request.post("/api/agent/chat", { data: { message: "yes" } });
  const { cards } = await (await request.get("/api/cards")).json();
  expect(cards[0].state).toBe("OPEN");
  const closed = await request.patch("/api/cards", {
    data: { id: cards[0].id, state: "CLOSED" },
  });
  expect(closed.ok()).toBeTruthy();
  expect((await closed.json()).cards[0].state).toBe("CLOSED");
});
