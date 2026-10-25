import { test, expect } from "@playwright/test";

test("header compresses into a pill and tracks scroll progress", async ({ page }) => {
  await page.goto("/");
  const header = page.locator("header.lp-nav");
  await expect(header).toHaveAttribute("data-compact", "false");
  await page.evaluate(() => window.scrollTo(0, 1600));
  await expect(header).toHaveAttribute("data-compact", "true");
  const progress = await header.evaluate((el) =>
    Number(getComputedStyle(el).getPropertyValue("--progress")),
  );
  expect(progress).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header).toHaveAttribute("data-compact", "false");
});

test("help launcher opens, minimizes with Escape and closes", async ({ page }) => {
  await page.goto("/");
  const launcher = page.getByRole("button", { name: "Open Brix help" });
  await launcher.click();
  const panel = page.getByRole("dialog", { name: "Brix help" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Close help" })).toBeVisible();

  // Focus stays inside the panel.
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(launcher).toBeFocused();

  await launcher.click();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Minimize help" }).click();
  await expect(panel).toBeHidden();

  await launcher.click();
  await panel.getByRole("button", { name: "Close help" }).click();
  await expect(panel).toBeHidden();
  await expect(launcher).toBeVisible();
});

test("quick-reply chips are not clipped on hover", async ({ page }) => {
  await page.goto("/");
  const scroller = page.locator(".bot-demo--inline .chat__chips");
  await scroller.scrollIntoViewIfNeeded();
  const chip = scroller.locator(".chip").first();
  await expect(chip).toBeVisible();
  await chip.hover();
  await page.waitForTimeout(300);
  const [c, s] = await Promise.all([chip.boundingBox(), scroller.boundingBox()]);
  expect(c && s).toBeTruthy();
  expect(c!.y).toBeGreaterThanOrEqual(s!.y);
  expect(c!.y + c!.height).toBeLessThanOrEqual(s!.y + s!.height);
});

test("landing page has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
