import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/admin/reset-demo")).ok()).toBeTruthy();
});

test.describe("desktop search", () => {
  test.skip(({ isMobile }) => isMobile, "Top bar search field");

  test("finds charges with grouped, highlighted results and keyboard nav", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/Across 6 subscriptions/)).toBeVisible();
    await page.keyboard.press("/");
    const box = page.getByRole("combobox", { name: /Search charges/ });
    await expect(box).toBeFocused();
    await box.fill("net");
    const list = page.getByRole("listbox", { name: "Search results" });
    await expect(list.getByRole("group", { name: "Charges and trials" })).toBeVisible();
    const first = list.getByRole("option").first();
    await expect(first).toContainText("Netflix");
    await expect(first.locator("mark")).toHaveText("Net");
    await expect(first).toHaveAttribute("aria-selected", "true");
    const axe = await new AxeBuilder({ page }).include(".topbar").analyze();
    expect(axe.violations).toEqual([]);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/subscriptions\?q=Netflix/);
    await expect(page.getByLabel("Search charges", { exact: true })).toHaveValue("Netflix");
    await expect(page.getByRole("region", { name: "Charges" }).getByText("Spotify")).toHaveCount(0);
  });

  test("pages, arrows, empty state, clear and escape", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/Across 6 subscriptions/)).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    const box = page.getByRole("combobox", { name: /Search charges/ });
    await expect(box).toBeFocused();
    await box.fill("set");
    const list = page.getByRole("listbox", { name: "Search results" });
    await expect(list.getByRole("group", { name: "Go to" })).toBeVisible();
    const options = list.getByRole("option");
    await expect(options.first()).toContainText("Settings");
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");

    await box.fill("zzzz");
    await expect(page.getByText(/Nothing matches “zzzz”/)).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(box).toHaveValue("");
    await expect(box).toBeFocused();

    await box.fill("Settings");
    await expect(options.first()).toContainText("Settings");
    await page.keyboard.press("Escape");
    await expect(box).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();

    await box.fill("Settings");
    await options.first().click();
    await expect(page).toHaveURL(/\/settings$/);
  });
});

test.describe("mobile search", () => {
  test.skip(({ isMobile }) => !isMobile, "Search sheet");

  test("search button opens a full-width sheet", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/Across 6 subscriptions/)).toBeVisible();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Search Brix" });
    await expect(sheet).toBeVisible();
    const vw = page.viewportSize()!.width;
    expect((await sheet.boundingBox())!.width).toBeGreaterThanOrEqual(vw - 1);
    const box = sheet.getByRole("combobox");
    await expect(box).toBeFocused();
    await box.fill("spot");
    await sheet.getByRole("option", { name: /Spotify/ }).click();
    await expect(page).toHaveURL(/\/subscriptions\?q=Spotify/);
    await expect(sheet).toHaveCount(0);
  });
});

test("compact overview and setup strip with real progress", async ({ page }) => {
  await page.goto("/dashboard");
  const summary = page.getByRole("region", { name: "Summary" });
  await expect(summary).toContainText("Monthly recurring");
  await expect(summary).toContainText("Next 14 days");
  await expect(summary).toContainText("Charges avoided");
  const h = (await summary.boundingBox())!.height;
  expect(h).toBeLessThan(page.viewportSize()!.width > 800 ? 140 : 320);

  const strip = page.getByRole("region", { name: "Finish setting up" });
  await expect(strip).toContainText(/\d of 5 done/);
  await expect(strip.getByRole("list", { name: "Setup steps" }).getByRole("listitem")).toHaveCount(5);
  // Even 1px border, no one-sided accent bar.
  const borders = await strip.evaluate((el) => {
    const cs = getComputedStyle(el);
    return [cs.borderLeftWidth, cs.borderRightWidth, cs.borderTopWidth, cs.borderBottomWidth];
  });
  expect(new Set(borders).size).toBe(1);
  expect(borders[0]).toBe("1px");
});
