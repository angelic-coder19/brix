import { test, expect } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  const response = await request.post("/api/admin/reset-demo");
  expect(response.ok()).toBeTruthy();
});

test("trials and reminders work through the wallet with explicit confirmation", async ({
  page,
  request,
}) => {
  await page.goto("/subscriptions");
  await expect(page.getByText("Spotify", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Add a free trial", exact: true })
    .click();
  await page.getByLabel("Trial name").fill("Notion AI");
  await page
    .getByLabel("Trial ends")
    .fill(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  await page.getByLabel("Price after trial (USD)").fill("10");
  await page.getByRole("button", { name: "Add to my charges" }).click();
  await expect(
    page.getByRole("button", { name: "Remind me about Notion AI" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remind me about Spotify" }).click();
  const chat = page.getByRole("dialog", { name: "Talk with Brix" });
  await expect(chat.getByText(/Reply yes to confirm/)).toBeVisible();
  let state = await (await request.get("/api/state")).json();
  expect(state.reminders).toHaveLength(0);
  await page.getByLabel("Message Brix", { exact: true }).fill("yes");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(chat.getByText(/Reminder set for Spotify/)).toBeVisible();
  state = await (await request.get("/api/state")).json();
  expect(state.reminders).toHaveLength(1);
  // Brix never flags a cancel; Manage goes straight to the merchant.
  expect(
    state.charges.find((c: { merchant: string }) => c.merchant === "Spotify")
      .status,
  ).toBe("active");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("link", { name: "Manage Spotify on merchant site" }),
  ).toBeVisible();
});

test("mobile landing and dashboard fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/",
    "/dashboard",
    "/subscriptions",
    "/cards",
    "/connect",
    "/settings",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
});

test("card creation shows a proposal before persisting a masked demo card", async ({
  page,
  request,
}) => {
  await page.goto("/cards");
  await page.getByLabel("What’s it for?").fill("Notion AI trial");
  await page.getByLabel("Spending limit (USD)").fill("1.10");
  await page.getByRole("button", { name: "Review card" }).click();
  const chat = page.getByRole("dialog", { name: "Talk with Brix" });
  await expect(chat.getByText(/Reply yes to confirm/)).toBeVisible();
  expect((await (await request.get("/api/state")).json()).cards).toHaveLength(
    0,
  );
  await page.getByLabel("Message Brix", { exact: true }).fill("yes");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(chat.getByText(/card ending 4242 created/)).toBeVisible();
  const card = (await (await request.get("/api/state")).json()).cards[0];
  expect(card).toMatchObject({
    purpose: "Notion AI trial",
    spendLimit: 1.1,
    last4: "4242",
    source: "mock",
  });
  expect(card).not.toHaveProperty("lithicToken");
});

test("webhooks reject unsigned requests and reminders do not duplicate", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/whatsapp/webhook", {
        form: { From: "whatsapp:+15555550123", Body: "yes" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (await request.post("/api/vapi/tools", { data: { message: {} } })).status(),
  ).toBe(401);
  const first = await request.post("/api/jobs/reminders");
  expect(first.ok()).toBeTruthy();
  expect((await first.json()).inApp).toBeGreaterThan(0);
  const second = await request.post("/api/jobs/reminders");
  expect((await second.json()).inApp).toBe(0);
});
