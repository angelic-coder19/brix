import { test, expect } from "@playwright/test";

test("header CTA matches the demo entry point and peeks on hover", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Header CTA is hidden on phones; the menu has its own");
  await page.goto("/");
  const cta = page
    .locator(".lp-nav__cta")
    .getByRole("link", { name: "Try the demo" });
  await expect(cta).toHaveText("Try the demo");
  const brix = page.locator(".lp-nav__cta .peek__brix");
  await expect(brix).toHaveCSS("opacity", "0");
  await cta.hover();
  await expect(brix).toHaveCSS("opacity", "1");
});

test("every landing CTA has the peek effect", async ({ page }) => {
  await page.goto("/");
  const ctas = page.locator(
    "main a.btn--primary, main .hero__how, .lp-nav__actions a.btn",
  );
  const n = await ctas.count();
  expect(n).toBeGreaterThan(3);
  for (let i = 0; i < n; i++) {
    const inPeek = await ctas.nth(i).evaluate((el) => !!el.closest(".peek"));
    expect(inPeek).toBe(true);
  }
  await expect(page.getByRole("link", { name: /Open the demo/ })).toHaveCount(
    0,
  );
});

test("calculator shows the formula and updates live", async ({ page }) => {
  await page.goto("/");
  const calc = page.locator(".calc");
  await calc.scrollIntoViewIfNeeded();
  await expect(calc.locator(".calc__total")).toContainText("$216");
  await expect(calc.locator(".calc__formula")).toHaveText(
    "3 trials × $12/mo × 3 months = $108 per semester × 2 semesters = $216 per school year",
  );
  await expect(calc).toContainText("12 reminders");
  await expect(calc).toContainText("Illustration, not a savings promise");
  const chart = calc.getByRole("img", { name: /3 trials at \$12 per month/ });
  await expect(chart).toBeVisible();
  await expect(calc.locator(".calc-chart__line")).toHaveCount(2);
  const initialLine = await calc
    .locator(".calc-chart__line")
    .last()
    .getAttribute("d");
  const trials = page.getByLabel("Free trials you start per semester");
  await expect(trials).toHaveAttribute("aria-valuetext", "3 trials");
  await trials.focus();
  await page.keyboard.press("ArrowRight");
  await expect(trials).toHaveAttribute("aria-valuetext", "4 trials");
  await expect(calc.locator(".calc__total")).toContainText("$288");
  await expect(calc.locator(".calc__formula")).toContainText(
    "= $144 per semester",
  );
  await expect(calc).toContainText("16 reminders");
  await expect(
    calc.getByRole("img", { name: /4 trials at \$12 per month/ }),
  ).toBeVisible();
  await expect(calc.locator(".calc-chart__line").last()).not.toHaveAttribute(
    "d",
    initialLine!,
  );
});

test("how it works is a 2x2 grid with diagonal colors and single numbering", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const items = page.locator("#how ol.steps > li");
  await expect(items).toHaveCount(4);
  await expect(page.locator("#how .steps__num")).toHaveCount(0);
  const info = await items.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        color: getComputedStyle(el.querySelector("h3")!).color,
        num: getComputedStyle(el, "::before").content,
      };
    }),
  );
  // Numbers come from one CSS counter, not from extra text in the markup.
  for (const i of info) expect(i.num).not.toBe("none");
  const texts = await items.allInnerTexts();
  for (const t of texts) expect(t.trim()).not.toMatch(/^\d/);
  if (!isMobile) {
    expect(info[0].y).toBe(info[1].y);
    expect(info[2].y).toBe(info[3].y);
    expect(info[0].x).toBe(info[2].x);
    expect(info[0].color).toBe(info[3].color);
    expect(info[1].color).toBe(info[2].color);
    expect(info[0].color).not.toBe(info[1].color);
  } else {
    expect(new Set(info.map((i) => i.x)).size).toBe(1);
    expect(info[0].color).toBe(info[2].color);
    expect(info[1].color).toBe(info[3].color);
    expect(info[0].color).not.toBe(info[1].color);
  }
});

test("the Brix card has an even border and no edge stripe", async ({
  page,
}) => {
  await page.goto("/");
  const face = page.locator(".vcard__face").first();
  await face.scrollIntoViewIfNeeded();
  const r = await face.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      widths: [
        cs.borderTopWidth,
        cs.borderRightWidth,
        cs.borderBottomWidth,
        cs.borderLeftWidth,
      ],
      after: getComputedStyle(el, "::after").content,
    };
  });
  expect(new Set(r.widths).size).toBe(1);
  expect(r.widths[0]).toBe("1px");
  expect(["none", "normal"]).toContain(r.after);
});
