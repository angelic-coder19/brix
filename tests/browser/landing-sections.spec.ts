import { test, expect } from "@playwright/test";

test("numbers alternate text colors on the page background with dividers", async ({
  page,
}) => {
  await page.goto("/");
  const cols = page.locator(".facts__col");
  await expect(cols).toHaveCount(4);
  const styles = await cols.evaluateAll((els) =>
    els.map((el) => {
      const style = getComputedStyle(el);
      return {
        background: style.backgroundColor,
        color: style.color,
        divider: style.borderLeftWidth,
      };
    }),
  );
  for (const style of styles) expect(style.background).toBe("rgba(0, 0, 0, 0)");
  expect(styles[0].color).toBe(styles[2].color);
  expect(styles[1].color).toBe(styles[3].color);
  expect(styles[0].color).not.toBe(styles[1].color);
  expect(styles[1].divider).toBe("1px");
});

test("hero has one phone and a Brix card, with reduced-motion typing fallback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".hero .device-phone")).toHaveCount(1);
  await expect(page.locator(".hero .vcard")).toHaveCount(1);
  await expect(page.locator(".hero__notice")).toHaveCount(0);
  await expect(page.locator(".hero-type__text")).toBeHidden();
  await expect(page.locator(".hero-type__still")).toBeVisible();
  await expect(page.locator("main .bot-demo--inline")).toHaveCount(0);
  await expect(page.locator('a[href="#demo"]')).toHaveCount(0);
});

test("wordmark i is the accent colour and status bars carry no text", async ({
  page,
}) => {
  await page.goto("/");
  const i = page.locator("header .brand-i");
  await expect(i).toHaveText("i");
  const [iColor, period] = await Promise.all([
    i.evaluate((el) => getComputedStyle(el).color),
    page
      .locator("header .brand-period")
      .evaluate((el) => getComputedStyle(el).color),
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
  await expect(call.locator("svg.brix-mark")).toHaveAttribute(
    "data-mood",
    "listening",
  );
  await expect(call).toHaveAttribute("data-phase", "answering", {
    timeout: 6000,
  });
  await expect(call.locator("svg.brix-mark")).toHaveAttribute(
    "data-mood",
    "talking",
  );
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
  const preview = page.getByRole("group", {
    name: "Settings preview with sample data",
  });
  await preview.scrollIntoViewIfNeeded();
  await preview.getByRole("button", { name: "Disconnect" }).click();
  await expect(preview.getByText("Disconnect all linked banks?")).toBeVisible();
  await preview.getByRole("button", { name: "Disconnect" }).click();
  await expect(preview.getByText(/Bank disconnected/)).toBeVisible();
});

test("Brix peeks out when the hero CTA is hovered", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "hover only");
  await page.goto("/");
  const peek = page.locator(".hero .peek:has(.btn--primary) .peek__brix");
  await expect(peek).toHaveCSS("opacity", "0");
  await page.locator(".hero .peek .btn--primary").hover();
  await expect(peek).toHaveCSS("opacity", "1");
});

test("screen-by-screen steps advance as you scroll", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "sticky stage is desktop only");
  await page.goto("/");
  const scrolly = page.locator(".scrolly");
  await page.locator('[data-step="0"]').scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-step="2"]')!;
    window.scrollTo(
      0,
      el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3,
    );
  });
  await expect(scrolly).toHaveAttribute("data-active", "2");
  await expect(page.locator(".scrolly__frame.is-on .wa-note")).toBeVisible();
});

test("developers page is linked from the header and documents the stack", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }
  await page
    .locator("a:visible", { hasText: /^Developers$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/developers$/);
  await expect(
    page.getByRole("heading", { name: "Run it yourself" }),
  ).toBeVisible();
  await expect(
    page.getByText("NEXT_PUBLIC_BRIX_DEMO_MODE").first(),
  ).toBeVisible();
  await expect(page.locator("header .brand-i")).toHaveText("i");
});

test("hero types a changing ending without shifting its heading", async ({
  page,
}) => {
  await page.goto("/");
  const fragment = page.locator(".hero-type__text");
  const heading = page.locator(".hero h1");
  const initial = await heading.boundingBox();
  await expect(fragment).toHaveText("before the trial ends.", {
    timeout: 7000,
  });
  const changed = await heading.boundingBox();
  expect(changed?.height).toBe(initial?.height);
});
