import { test, expect } from "@playwright/test";

// Refunds → plan → practice portfolio, end to end in the demo.

test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/admin/reset-demo")).ok()).toBeTruthy();
});

test("dashboard flags the new refund and the plan returns borrowed money first", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /Plan my refund/ }).click();
  await expect(page).toHaveURL(/\/refunds$/);
  await expect(
    page.getByRole("heading", { name: "$1,850.00 refund" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "days left" }),
  ).toBeVisible();
  await expect(page.getByText("Three quick questions")).toBeVisible();
  await page.getByText("More details for a sharper plan").click();
  await page.getByLabel("Loan interest rate (%)").fill("6.5");
  await page.getByLabel("Rent, food and bills per month").fill("100");
  await page.getByLabel("Months until next aid").fill("2");
  await page.getByRole("button", { name: /Make my plan/ }).click();
  const plan = page.locator(".refund-plan");
  await expect(plan.getByText("Return unused loan money")).toBeVisible();
  await expect(plan.getByText("Starter emergency fund")).toBeVisible();
  await expect(plan.getByText(/taxable income/)).toBeVisible();
  await expect(page.locator(".refund-list .badge")).toHaveText("Planned");
});

test("practice: start from the refund, buy, set a stop, auto-invest, sell, reset", async ({
  page,
  request,
}) => {
  await page.goto("/refunds");
  await page.getByRole("button", { name: /Make my plan/ }).click();
  await page.getByRole("button", { name: "Start practicing" }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.locator(".practice-disclaimer").first()).toContainText(
    "virtual money",
  );
  await expect(
    page
      .getByRole("region", { name: "Portfolio summary" })
      .locator(".glance-tile__value")
      .first(),
  ).toHaveText(
    "$1,850.00",
  );

  const ticker = page.getByRole("combobox", { name: "Symbol", exact: true });
  await ticker.focus();
  await ticker.press("Home");
  await ticker.press("v");
  await ticker.press("o");
  await ticker.press("o");
  await ticker.press("Enter");
  await expect(ticker).toContainText("VOO");
  await page.getByLabel("Amount (USD)").fill("100");
  await page.getByRole("button", { name: "Review order" }).click();
  await expect(page.getByRole("group", { name: "Review order" })).toContainText(
    "VOO",
  );
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Order filled.")).toBeVisible();
  await expect(page.getByRole("rowheader", { name: /VOO/ })).toBeVisible();

  await page.getByLabel("Stop-loss price for VOO").fill("999");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".alert--error")).toContainText("must be below");
  await page.getByLabel("Stop-loss price for VOO").fill("500");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Guardrails saved for VOO.")).toBeVisible();

  await page
    .locator(".rule-form")
    .getByRole("button", { name: "Turn on auto-invest" })
    .click();
  // Auto-invest reads as a fixed schedule: "$25.00 of <fund> every <day>".
  await expect(
    page.locator(".rule-list").getByText(/\$25\.00 of Vanguard S&P 500 ETF (every|on the)/),
  ).toBeVisible();
  const job = await request.post("/api/jobs/practice");
  expect((await job.json()).filled).toBe(1);
  expect((await (await request.post("/api/jobs/practice")).json()).filled).toBe(
    0,
  );
  await page.reload();
  await expect(page.locator(".order-list")).toContainText("Auto-invest");

  const sold = await request.post("/api/practice/orders", {
    data: { symbol: "VOO", side: "sell", shares: "all" },
  });
  expect((await sold.json()).order.status).toBe("filled");
  await page.reload();
  await expect(page.getByText(/Lots of people start/)).toBeVisible();

  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Learn investing/ }),
  ).toBeVisible();
});

test("refund and practice APIs validate input and stay idempotent", async ({
  request,
}) => {
  const bad = await request.post("/api/refunds", {
    data: { amount: -5, receivedOn: "2026-01-01" },
  });
  expect(bad.status()).toBe(400);
  const made = await request.post("/api/refunds", {
    data: {
      amount: 900,
      receivedOn: new Date().toISOString().slice(0, 10),
      funding: "grant",
    },
  });
  expect(made.status()).toBe(201);
  const { refunds } = await (await request.get("/api/refunds")).json();
  expect(refunds).toHaveLength(2);
  await request.post("/api/practice", { data: { startingCash: 500 } });
  expect(
    (
      await request.post("/api/practice", { data: { startingCash: 500 } })
    ).status(),
  ).toBe(409);
  const order = {
    symbol: "AAPL",
    side: "buy",
    amount: 50,
    clientKey: "same-click",
  };
  const a = await (
    await request.post("/api/practice/orders", { data: order })
  ).json();
  const b = await (
    await request.post("/api/practice/orders", { data: order })
  ).json();
  expect(a.order.id).toBe(b.order.id);
  expect(
    (
      await request.post("/api/practice/orders", {
        data: { symbol: "GME", side: "buy", amount: 5 },
      })
    ).status(),
  ).toBe(400);

  const key = await (
    await request.post("/api/developer/keys", {
      data: { name: "grow", scopes: ["refunds:read", "practice:read"] },
    })
  ).json();
  const auth = { authorization: `Bearer ${key.secret}` };
  const v1r = await (
    await request.get("/api/v1/refunds", { headers: auth })
  ).json();
  expect(v1r.data.length).toBe(2);
  const v1p = await (
    await request.get("/api/v1/practice", { headers: auth })
  ).json();
  expect(v1p.virtual_money).toBe(true);
  expect(v1p.portfolio.positions[0].symbol).toBe("AAPL");
});

test("dashboard leads with one decision: the borrowed part of the refund", async ({
  page,
}) => {
  await page.goto("/dashboard");
  const card = page.getByRole("region", { name: "Your next decision" });
  await expect(card).toContainText("$1,200.00 of your refund is borrowed");
  await expect(
    card.getByRole("link", { name: /Plan my refund/ }),
  ).toBeVisible();
});

test("gift cards: see unspent total, add one, log spending, use it up", async ({
  page,
}) => {
  await page.goto("/cards");
  const section = page.getByRole("region", { name: "Gift cards" });
  await expect(section).toContainText("$52.35 unspent across 2 cards");
  await expect(section).toContainText("Expires in 20 days");
  const studio = page.getByRole("region", { name: "Add a gift card" });
  await studio.getByLabel("Store", { exact: true }).fill("Chipotle");
  await studio.getByLabel("Balance (USD)").fill("25");
  await studio.getByRole("button", { name: "Save card" }).click();
  await expect(section).toContainText("$77.35 unspent across 3 cards");
  await section.getByLabel("Amount spent from Chipotle card").fill("25");
  await section.getByRole("button", { name: "Log spend" }).first().click();
  await expect(section).toContainText("$52.35 unspent across 2 cards");
});

test("chat replies say where their facts came from", async ({ page }) => {
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: /Ask Brix|Open chat/ })
    .first()
    .click();
  const box = page.getByPlaceholder(/Ask about your charges/);
  await box.fill("What's coming up?");
  await box.press("Enter");
  await expect(
    page.getByRole("list", { name: "Where this came from" }).last(),
  ).toContainText("Your charges (sample)", { timeout: 15000 });
});
