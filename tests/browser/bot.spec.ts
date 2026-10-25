import { test, expect } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  expect((await request.post("/api/admin/reset-demo")).ok()).toBeTruthy();
});

test("chat shows typing, streams a reply and offers quick replies", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Ask Brix" }).click();
  const chat = page.getByRole("dialog", { name: "Talk with Brix" });
  await expect(chat).toBeVisible();
  const chips = chat.getByRole("group", { name: "Suggested replies" });
  await chips.getByRole("button", { name: "What's coming up?" }).click();
  await expect(chat.getByText(/Coming up: Spotify/).first()).toBeVisible();
  await expect(chips).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(chat).toBeHidden();
});

test("bot reacts to the user, and the user's tapback persists", async ({ page, request }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Ask Brix" }).click();
  const chat = page.getByRole("dialog", { name: "Talk with Brix" });
  await chat.getByLabel("Message Brix", { exact: true }).fill("thanks Brix!");
  await chat.getByRole("button", { name: "Send message" }).click();
  await expect(chat.getByRole("img", { name: "Brix reacted 🙏" })).toBeVisible();

  const reply = chat.getByTestId("chat-assistant").last();
  await reply.getByRole("button", { name: "React to this message" }).click();
  await reply.getByRole("button", { name: "React with 😂" }).click();
  await expect(reply.getByRole("img", { name: "You reacted 😂" })).toBeVisible();

  await expect
    .poll(async () => {
      const state = await (await request.get("/api/state")).json();
      return state.events.find(
        (e: { type: string; reaction?: string }) =>
          e.type === "agent_message" && e.reaction === "😂",
      )?.reaction;
    })
    .toBe("😂");

  await page.reload();
  await page.getByRole("button", { name: "Ask Brix" }).click();
  await expect(
    page.getByRole("dialog", { name: "Talk with Brix" }).getByRole("img", { name: "You reacted 😂" }),
  ).toBeVisible();
});

test("confirming a cancel celebrates and the chips switch to yes/no while pending", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Mark Spotify to cancel" }).click();
  const chat = page.getByRole("dialog", { name: "Talk with Brix" });
  await expect(chat.getByText(/Reply yes to confirm/)).toBeVisible();
  const chips = chat.getByRole("group", { name: "Suggested replies" });
  await expect(chips.getByRole("button", { name: "Yes" })).toBeVisible();
  await chips.getByRole("button", { name: "Yes" }).click();
  await expect(chat.getByText(/Spotify is marked to cancel/)).toBeVisible();
  await expect(chat.locator(".chat__confetti")).toBeAttached();
  await expect(chat.getByRole("img", { name: "Brix reacted 🎉" })).toBeVisible();
});

test("saying yes with nothing pending gets a friendly reply, not an error", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Ask Brix" }).click();
  const chat = page.getByRole("dialog", { name: "Talk with Brix" });
  await chat.getByLabel("Message Brix", { exact: true }).fill("yes");
  await chat.getByRole("button", { name: "Send message" }).click();
  await expect(chat.getByText(/nothing waiting|No pending|nothing to confirm/i).first()).toBeVisible();
  await expect(chat.locator(".msg--error")).toHaveCount(0);
});

test("landing preview bot runs the full propose → confirm loop", async ({ page }) => {
  await page.goto("/#demo");
  const preview = page.getByRole("region", { name: "Brix chat preview with sample data" });
  await preview.getByLabel("Message the Brix preview").fill("cancel netflix");
  await preview.getByRole("button", { name: "Send preview message" }).click();
  const bubbles = preview.locator(".msg--assistant .msg__bubble");
  await expect(bubbles.filter({ hasText: /Mark Netflix \(\$15\.49\) to cancel\?/ })).toBeVisible();
  // Wait for the reply to finish streaming before answering.
  await expect(preview.locator(".stream-caret")).toHaveCount(0);
  await preview.getByLabel("Message the Brix preview").fill("yes");
  await preview.getByRole("button", { name: "Send preview message" }).click();
  await expect(bubbles.filter({ hasText: /Netflix is marked to cancel/ })).toBeVisible();
  await expect(preview.getByRole("img", { name: "Brix reacted 🎉" })).toBeVisible();
});
