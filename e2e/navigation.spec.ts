// ABOUTME: End-to-end checks for the routed app shell: deep links, back button, reload with
// ABOUTME: search params, not-found states, the mobile tab bar and More sheet, and no sideways scroll.
import { test, expect, type Page } from "@playwright/test";

const TOP_LEVEL = [
  "/",
  "/labs",
  "/plan",
  "/documents",
  "/team",
  "/learn",
  "/activity",
  "/circle",
  "/reminders",
];

// Skip the first-visit tour so it does not cover the shell.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("care_hub_onboarded_v1", "true"));
});

async function waitForPage(page: Page) {
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page.getByText(/^Loading/)).toHaveCount(0);
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("deep link, sidebar navigation and the back button", async ({ page }) => {
    await page.goto("/labs");
    await expect(page.getByRole("heading", { level: 1, name: "Labs" })).toBeVisible();

    const primary = page.getByRole("navigation", { name: "Primary" });
    await primary.getByRole("link", { name: "Plan" }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/labs$/);
    await expect(page.getByRole("heading", { level: 1, name: "Labs" })).toBeVisible();
  });

  test("a reload keeps the labs search params in the URL", async ({ page }) => {
    await page.goto("/labs?abnormal=1");
    await expect(page.getByRole("heading", { level: 1, name: "Labs" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Labs" })).toBeVisible();
    expect(new URL(page.url()).searchParams.get("abnormal")).toMatch(/^(1|true)$/);
  });

  test("an unknown lab metric shows a not-found state with a way back", async ({ page }) => {
    await page.goto("/labs/not-a-metric");
    await expect(page.getByRole("heading", { name: "Lab result not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Labs" }).click();
    await expect(page).toHaveURL(/\/labs$/);
    await expect(page.getByRole("heading", { level: 1, name: "Labs" })).toBeVisible();
  });

  test("unknown plan items, documents and pages show not-found inside the shell", async ({
    page,
  }) => {
    await page.goto("/plan/not-a-visit");
    await expect(page.getByRole("heading", { name: "Visit not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Plan" })).toBeVisible();

    await page.goto("/documents/not-a-doc");
    await expect(page.getByRole("heading", { name: "Document not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Documents" })).toBeVisible();

    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });

  test("the shell has a skip link and one primary nav", async ({ page }) => {
    await page.goto("/");
    await waitForPage(page);
    await expect(page.getByRole("navigation")).toHaveCount(1);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(page.locator("main#main")).toHaveCount(1);
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("one nav landmark and the More sheet reaches Activity", async ({ page }) => {
    await page.goto("/");
    await waitForPage(page);
    await expect(page.getByRole("navigation")).toHaveCount(1);

    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Activity" }).click();
    await expect(page).toHaveURL(/\/activity$/);
    await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  for (const path of TOP_LEVEL) {
    test(`no horizontal scroll on ${path}`, async ({ page }) => {
      await page.goto(path);
      await waitForPage(page);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(390);
    });
  }
});
