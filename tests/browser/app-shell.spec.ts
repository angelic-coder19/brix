import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/admin/reset-demo")).ok()).toBeTruthy();
});

test.describe("desktop shell", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop sidebar");

  test("sidebar collapses to a rail, persists, and responds to shortcuts", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/Across 6 subscriptions/)).toBeVisible();
    const sidebar = page.locator("#app-sidebar");
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
    const groups = sidebar.getByRole("group");
    await expect(
      groups.filter({ has: page.getByRole("link", { name: "Overview" }) }),
    ).toHaveAttribute("aria-label", "Money");
    // Badges only show real counts: the demo has no free trials yet, and one
    // school refund waiting for a plan.
    await expect(
      sidebar.getByRole("link", { name: "Your charges", exact: true }),
    ).toBeVisible();
    await expect(sidebar.locator(".nav-badge")).toHaveCount(1);
    await expect(
      sidebar.getByRole("link", { name: /Refunds/ }).locator(".nav-badge"),
    ).toContainText("1 refund to plan");

    const shell = page.locator(".app-shell");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(shell).toHaveAttribute("data-sidebar", "collapsed");
    await page.mouse.move(900, 500);
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    // Measure only after the width transition settles.
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width)
      .toBe(80);
    // The toggle sits on the logo row, not below it.
    const brand = await sidebar.locator(".sidebar-brand").boundingBox();
    const toggle = await page
      .getByRole("button", { name: "Expand sidebar" })
      .boundingBox();
    expect(
      Math.abs(brand!.y + brand!.height / 2 - (toggle!.y + toggle!.height / 2)),
    ).toBeLessThan(6);
    expect(toggle!.x).toBeGreaterThan(brand!.x);
    // Labels stay as accessible names in the rail.
    await expect(sidebar.getByRole("link", { name: "Overview" })).toBeVisible();

    // Hover and focus never resize the rail or shift the page.
    const mainLeft = async () =>
      (await page.locator(".app-main").boundingBox())!.x;
    await expect.poll(mainLeft).toBe(80);
    await sidebar.getByRole("link", { name: "Overview" }).hover();
    await page.waitForTimeout(300);
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    expect((await sidebar.boundingBox())!.width).toBe(80);
    expect(await mainLeft()).toBe(80);
    await sidebar.getByRole("link", { name: "Settings" }).focus();
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    expect((await sidebar.boundingBox())!.width).toBe(80);
    // The collapse control straddles the divider in either state.
    const rail = (await sidebar.boundingBox())!;
    expect(
      Math.abs(toggle!.x + toggle!.width / 2 - (rail.x + rail.width)),
    ).toBeLessThanOrEqual(2);

    // Only an explicit toggle expands the rail, and that choice persists.
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(shell).toHaveAttribute("data-sidebar", "expanded");
    await page.mouse.move(900, 500);
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await page.mouse.move(900, 500);

    await page.reload();
    await expect(shell).toHaveAttribute("data-sidebar", "collapsed");
    await page.keyboard.press("[");
    await expect(shell).toHaveAttribute("data-sidebar", "expanded");
    await page.keyboard.press("ControlOrMeta+b");
    await expect(shell).toHaveAttribute("data-sidebar", "collapsed");
    await page.keyboard.press("ControlOrMeta+b");
    await expect(shell).toHaveAttribute("data-sidebar", "expanded");

    // `[` typed into a field doesn't toggle.
    await page
      .getByRole("button", { name: "Add a free trial", exact: true })
      .click();
    await page.getByLabel("Trial name").pressSequentially("a[b");
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
    await page
      .getByLabel("Trial ends")
      .fill(new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10));
    await page.getByLabel("Price after trial (USD)").fill("9");
    await page.getByRole("button", { name: "Add to my charges" }).click();
    await expect(
      sidebar.getByRole("link", { name: /Your charges\s*,\s*1 free trial/ }),
    ).toBeVisible();
  });

  test("account menu opens, navigates and works collapsed", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/Across 6 subscriptions/)).toBeVisible();
    const trigger = page.getByRole("button", { name: /^Account: / });
    await expect(trigger).toHaveText(/Demo account/);
    await trigger.click();
    const menu = page.getByRole("menu", { name: "Account" });
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: "Settings" }),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
      menu.getByRole("menuitem", { name: "Setup guide" }),
    ).toBeFocused();
    await expect(menu.getByText(/Demo account\. No sign-in/)).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .include("#app-sidebar")
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await page.mouse.move(900, 500);
    await expect(page.locator("#app-sidebar")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    await trigger.click();
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(
      page.locator("#app-sidebar").getByRole("link", { name: "Settings" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("cards page uses the Brix card and closes with an inline confirm", async ({
    page,
  }) => {
    await page.goto("/cards");
    await page.getByLabel("What’s it for?").fill("Figma trial");
    await page.getByLabel("Spending limit (USD)").fill("12");
    await page.getByRole("button", { name: "Review card" }).click();
    const chat = page.getByRole("dialog", { name: "Talk with Brix" });
    await expect(chat).toBeVisible();
    await page.getByLabel("Message Brix", { exact: true }).fill("yes");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.keyboard.press("Escape");
    const card = page.getByRole("img", {
      name: /Brix single-use card for Figma trial/,
    });
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".card-item .vcard")).not.toHaveCount(0);
    await expect(page.locator(".virtual-card")).toHaveCount(0);

    const item = page.locator(".card-item").filter({ has: card });
    await item.getByRole("button", { name: "Close card" }).click();
    const confirm = item.getByRole("group", {
      name: /Close the Figma trial card/,
    });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toHaveCount(0);
    await item.getByRole("button", { name: "Close card" }).click();
    await item
      .getByRole("group")
      .getByRole("button", { name: "Close card" })
      .click();
    await expect(page.getByText("Card closed.")).toBeVisible();
    await expect(
      page.getByRole("img", { name: /Figma trial.*closed/ }),
    ).toBeVisible();
  });
});

test.describe("mobile shell", () => {
  test.skip(({ isMobile }) => !isMobile, "Mobile drawer");

  test("menu opens an off-canvas drawer with the account menu", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/Across 6 subscriptions/)).toBeVisible();
    const sidebar = page.locator("#app-sidebar");
    await expect(sidebar).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Overview" })).toBeVisible();
    await sidebar.getByRole("button", { name: /^Account: / }).click();
    await expect(page.getByRole("menu", { name: "Account" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(sidebar).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    await sidebar.getByRole("link", { name: /^Cards/ }).click();
    await expect(page).toHaveURL(/\/cards$/);
    await expect(sidebar).toBeHidden();
  });
});
