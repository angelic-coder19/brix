import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = [
  "/",
  "/dashboard",
  "/subscriptions",
  "/cards",
  "/refunds",
  "/practice",
  "/connect",
  "/settings",
  "/admin",
];

test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/admin/reset-demo")).ok()).toBeTruthy();
});

function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    const text = m.text();
    if (m.type() === "error" || /hydrat/i.test(text))
      problems.push(`${m.type()}: ${text}`);
  });
  return problems;
}

for (const path of PAGES) {
  test(`${path} renders cleanly`, async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    if (path !== "/")
      await expect(page.getByText(/Sandbox demo/)).toBeVisible();
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(0);
    expect(problems).toEqual([]);
  });
}

for (const path of [
  "/",
  "/dashboard",
  "/subscriptions",
  "/cards",
  "/refunds",
  "/practice",
  "/settings",
  "/developers",
]) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => n.target.join(" "))
            .slice(0, 4)
            .join(" | ")}`,
      );
    expect(serious).toEqual([]);
  });
}

test("landing interactions: FAQ, calculator, mobile menu", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const items = page.locator("#faq details");
  await expect(items.first()).toHaveAttribute("open", "");
  await items.nth(1).locator("summary").click();
  await expect(items.nth(1)).toHaveAttribute("open", "");
  // name="faq" makes it an exclusive accordion
  await expect(items.first()).not.toHaveAttribute("open", "");

  const output = page.locator(".calc__total");
  const before = await output.textContent();
  const slider = page.getByRole("slider").first();
  await slider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await expect(output).not.toHaveText(before ?? "");

  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    const nav = page.getByRole("navigation", { name: "Mobile" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: /FAQ/i }).click();
    await expect(nav).toBeHidden();
  }
});

test("reduced motion shows all content without reveal animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator("#faq").scrollIntoViewIfNeeded();
  const hidden = await page.$$eval(
    "[data-reveal]",
    (els) => els.filter((el) => getComputedStyle(el).opacity === "0").length,
  );
  expect(hidden).toBe(0);
});
