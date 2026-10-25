import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/admin/reset-demo")).ok()).toBeTruthy();
});

test("onboarding happy path in demo mode", async ({ page, request }) => {
  await page.goto("/dashboard");
  const strip = page.getByRole("region", { name: "Finish setting up" });
  await expect(strip).toBeVisible();
  await strip.getByRole("link", { name: /Continue setup/ }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  const progress = page.getByRole("progressbar", { name: "Setup progress" });
  await expect(page.getByText("Step 1 of 6")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "You’re in." })).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  await page.getByRole("button", { name: "Continue" }).click();

  // Name
  await expect(page.getByText("Step 2 of 6")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "What should Brix call you?" }),
  ).toBeFocused();
  await page.getByLabel("Your name").fill("Maya Chen");
  await page.getByRole("button", { name: "Continue" }).click();

  // Bank: back works, then use the sample bank
  await expect(page.getByRole("heading", { name: "Link a bank, or skip it" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("Maya Chen");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Use the sample bank" }).click();

  // First trial
  await expect(page.getByText("Step 4 of 6")).toBeVisible();
  await page.getByLabel("Trial name").fill("Notion AI");
  await page
    .getByLabel("Trial ends")
    .fill(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10));
  await page.getByLabel("Price after trial (USD)").fill("10");
  await page.getByRole("button", { name: "Add trial" }).click();

  // Reminders: skip
  await expect(page.getByRole("heading", { name: "Where should reminders reach you?" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();

  // Done
  await expect(page.getByRole("heading", { level: 1, name: "You’re set up, Maya." })).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuenow", "100");
  const summary = page.locator(".ob__summary");
  await expect(summary).toContainText("Notion AI");
  await expect(summary).toContainText("Skipped");

  const state = await (await request.get("/api/state")).json();
  expect(state.user.displayName).toBe("Maya Chen");
  expect(
    state.charges.some((c: { merchant: string }) => c.merchant === "Notion AI"),
  ).toBe(true);

  await page.getByRole("button", { name: "Go to your overview" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "Mark Notion AI to cancel" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Finish setting up" })).toHaveCount(0);
});

test("onboarding shows an error and keeps the step when saving fails", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.route("**/api/settings", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Could not save right now."}' }),
  );
  await page.getByLabel("Your name").fill("Maya");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".ob__error")).toHaveText("Could not save right now.");
  await expect(page.getByText("Step 2 of 6")).toBeVisible();
});

test("setup strip can be dismissed", async ({ page }) => {
  await page.goto("/dashboard");
  const strip = page.getByRole("region", { name: "Finish setting up" });
  await strip.getByRole("button", { name: "Dismiss" }).click();
  await expect(strip).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Across 6 subscriptions/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Finish setting up" })).toHaveCount(0);
});
