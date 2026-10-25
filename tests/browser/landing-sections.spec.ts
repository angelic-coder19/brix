import { test, expect } from "@playwright/test";

test("numbers row alternates ink and accent columns", async ({ page }) => {
  await page.goto("/");
  const cols = page.locator(".facts__col");
  await expect(cols).toHaveCount(4);
  const bgs = await cols.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
  expect(new Set(bgs).size).toBe(2);
  expect(bgs[0]).not.toBe(bgs[1]);
});

test("wordmark i is the accent colour and status bars carry no text", async ({ page }) => {
  await page.goto("/");
  const i = page.locator("header .brand-i");
  await expect(i).toHaveText("i");
  const [iColor, period] = await Promise.all([
    i.evaluate((el) => getComputedStyle(el).color),
    page.locator("header .brand-period").evaluate((el) => getComputedStyle(el).color),
  ]);
  expect(iColor).toBe(period);
  const text = await page.locator("body").innerText();
  expect(text).not.toContain("9:41");
});

test("help launcher adapts to the dark section behind it", async ({ page }) => {
  await page.goto("/");
  const launcher = page.locator(".help-launcher");
  await expect(launcher).toHaveAttribute("data-surface", "light");
  await page.evaluate(() => {
    const night = document.querySelector<HTMLElement>(".night")!;
    const r = night.getBoundingClientRect();
    window.scrollTo(0, r.bottom + window.scrollY - window.innerHeight + 10);
  });
  await expect(launcher).toHaveAttribute("data-surface", "dark");
});

test("call demo plays while on screen", async ({ page }) => {
  await page.goto("/");
  const call = page.locator(".call");
  await call.scrollIntoViewIfNeeded();
  await expect(call).toHaveAttribute("data-playing", "true");
  await expect(call).toHaveAttribute("data-phase", "ringing");
  await expect(call).toHaveAttribute("data-phase", "asking", { timeout: 5000 });
  await expect(call.locator("svg.brix-mark")).toHaveAttribute("data-mood", "listening");
  await expect(call).toHaveAttribute("data-phase", "answering", { timeout: 6000 });
  await expect(call.locator("svg.brix-mark")).toHaveAttribute("data-mood", "talking");
});

test("call demo is a still frame with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const call = page.locator(".call");
  await call.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await expect(call).toHaveAttribute("data-playing", "false");
  await expect(call).toHaveAttribute("data-phase", "answering");
});

test("leave preview asks once, then confirms", async ({ page }) => {
  await page.goto("/");
  const preview = page.getByRole("group", { name: "Settings preview with sample data" });
  await preview.scrollIntoViewIfNeeded();
  await preview.getByRole("button", { name: "Disconnect" }).click();
  await expect(preview.getByText("Disconnect all linked banks?")).toBeVisible();
  await preview.getByRole("button", { name: "Disconnect" }).click();
  await expect(preview.getByText(/Bank disconnected/)).toBeVisible();
});

test("Brix peeks out when the hero CTA is hovered", async ({ page, isMobile }) => {
  test.skip(isMobile, "hover only");
  await page.goto("/");
  const peek = page.locator(".hero .peek__brix");
  await expect(peek).toHaveCSS("opacity", "0");
  await page.locator(".hero .peek .btn").hover();
  await expect(peek).toHaveCSS("opacity", "1");
});

test("screen-by-screen steps advance as you scroll", async ({ page, isMobile }) => {
  test.skip(isMobile, "sticky stage is desktop only");
  await page.goto("/");
  const scrolly = page.locator(".scrolly");
  await page.locator('[data-step="0"]').scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-step="2"]')!;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3);
  });
  await expect(scrolly).toHaveAttribute("data-active", "2");
  await expect(page.locator(".scrolly__frame.is-on .wa-note")).toBeVisible();
});

test("developers page is linked from the header and documents the stack", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }
  await page.locator("a:visible", { hasText: /^Developers$/ }).first().click();
  await expect(page).toHaveURL(/\/developers$/);
  await expect(page.getByRole("heading", { name: "Run it yourself" })).toBeVisible();
  await expect(page.getByText("NEXT_PUBLIC_BRIX_DEMO_MODE").first()).toBeVisible();
  await expect(page.locator("header .brand-i")).toHaveText("i");
});
