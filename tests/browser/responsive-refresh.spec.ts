import { test, expect } from "@playwright/test";

test("workspace fits narrow phones, tablets, and wide screens", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/dashboard",
      "/cards",
      "/refunds",
      "/practice",
      "/subscriptions",
      "/settings",
      "/connect",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(".market-ticker")).toBeVisible();
      await expect
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollWidth - innerWidth,
            ),
          { message: `${path} at ${width}px` },
        )
        .toBeLessThanOrEqual(0);
    }
  }
});

test("overview has one chat launcher; card colors work in the wallet", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("button", { name: "Ask Brix", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Open Brix assistant", exact: true }),
  ).toHaveCount(0);
  await page.goto("/cards");
  const colors = page.getByRole("group", { name: "Card color" });
  await colors.getByRole("button", { name: "Cobalt card" }).click();
  await expect(
    colors.getByRole("button", { name: "Cobalt card" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("What’s it for?")).toBeVisible();
});
