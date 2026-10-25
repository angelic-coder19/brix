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

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width)
      .toBeLessThan(80);
    // Labels stay as accessible names in the rail, and show as tooltips.
    const overview = sidebar.getByRole("link", { name: "Overview" });
    await overview.hover();
    const tip = await overview.evaluate(
      (el) => getComputedStyle(el, "::after").content,
    );
    expect(tip).toContain("Overview");

    await page.reload();
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    await page.keyboard.press("[");
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
    await page.keyboard.press("ControlOrMeta+b");
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    await page.keyboard.press("ControlOrMeta+b");
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");

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
    await trigger.click();
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box && box.x).toBeGreaterThan(72);
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
    await sidebar.getByRole("link", { name: /One-time cards/ }).click();
    await expect(page).toHaveURL(/\/cards$/);
    await expect(sidebar).toBeHidden();
  });
});
