import { test, expect } from "@playwright/test";

test("header stays full-width while the progress train rides its bottom edge", async ({
  page,
}) => {
  await page.goto("/");
  const header = page.locator("header.lp-nav");
  const bar = header.locator(".lp-nav__bar");
  const train = header.locator(".lp-progress__train");
  await expect(header).toHaveAttribute("data-riding", "false");
  await expect(train).toHaveCSS("opacity", "0");

  await page.evaluate(() => window.scrollTo(0, 1600));
  await expect(header).toHaveAttribute("data-riding", "true");
  await expect(train).toHaveCSS("opacity", "1");
  const progress = await header.evaluate((el) =>
    Number(getComputedStyle(el).getPropertyValue("--progress")),
  );
  expect(progress).toBeGreaterThan(0);

  // No floating pill: square corners and the full viewport width.
  await expect(bar).toHaveCSS("border-top-left-radius", "0px");
  const viewport = page.viewportSize()!;
  const barBox = (await bar.boundingBox())!;
  expect(barBox.x).toBe(0);
  expect(Math.round(barBox.width)).toBe(viewport.width);

  // The train stays inside the header and below every nav link.
  const t = (await train.boundingBox())!;
  expect(t.y + t.height).toBeLessThanOrEqual(barBox.y + barBox.height + 1);
  for (const link of await header.locator(".lp-nav__links a").all()) {
    if (!(await link.isVisible())) continue;
    const l = (await link.boundingBox())!;
    expect(t.y).toBeGreaterThanOrEqual(l.y + l.height - 1);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header).toHaveAttribute("data-riding", "false");
});

test("help launcher opens, minimizes with Escape and closes", async ({
  page,
}) => {
  await page.goto("/");
  const launcher = page.getByRole("button", { name: "Open Brix help" });
  await launcher.click();
  const panel = page.getByRole("dialog", { name: "Brix help" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Close help" })).toBeVisible();

  // Focus stays inside the panel.
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  expect(
    await panel.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);

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
  await page.getByRole("button", { name: "Open Brix help" }).click();
  const scroller = page
    .getByRole("dialog", { name: "Brix help" })
    .locator(".chat__chips");
  await scroller.scrollIntoViewIfNeeded();
  const chip = scroller.locator(".chip").first();
  await expect(chip).toBeVisible();
  await chip.hover();
  await page.waitForTimeout(300);
  const [c, s] = await Promise.all([
    chip.boundingBox(),
    scroller.boundingBox(),
  ]);
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

test("help launcher face follows the chat's mood", async ({ page }) => {
  await page.goto("/");
  const launcher = page.getByRole("button", { name: "Open Brix help" });
  const face = launcher.locator("svg.brix-mark");
  await expect(face).toHaveAttribute("data-mood", "idle");

  await launcher.click();
  const panel = page.getByRole("dialog", { name: "Brix help" });
  await panel.getByRole("button", { name: "Remind me about Spotify" }).click();
  await panel.getByRole("button", { name: "Yes", exact: true }).click();
  await panel.getByRole("button", { name: "Minimize help" }).click();

  // Still working when minimized, then happy about the reminder.
  await expect(launcher).toHaveAttribute("data-mood", /thinking|talking|happy/);
  await expect(launcher).toHaveAttribute("data-mood", "happy", {
    timeout: 8000,
  });
  await expect(face).toHaveAttribute("data-mood", "happy");
});

test("app launcher face follows the chat's mood", async ({ page, request }) => {
  expect((await request.post("/api/admin/reset-demo")).ok()).toBeTruthy();
  await page.goto("/dashboard");
  const launcher = page.getByRole("button", { name: "Ask Brix" });
  await expect(launcher).toHaveAttribute("data-mood", /idle|concerned/);
  const resting = await launcher.getAttribute("data-mood");

  await launcher.click();
  const chat = page.getByRole("dialog", { name: "Talk with Brix" });
  await chat
    .getByRole("group", { name: "Suggested replies" })
    .getByRole("button", { name: "What's coming up?" })
    .click();
  await page.keyboard.press("Escape");
  await expect(chat).toBeHidden();
  await expect(launcher).toHaveAttribute(
    "data-mood",
    /thinking|talking|happy|listening/,
  );
  await expect(launcher.locator("svg.brix-mark")).toHaveAttribute(
    "data-mood",
    /thinking|talking|happy|listening/,
  );
  await expect(launcher).toHaveAttribute("data-mood", resting!, {
    timeout: 10000,
  });
});
