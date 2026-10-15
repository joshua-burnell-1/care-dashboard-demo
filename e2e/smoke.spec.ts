// ABOUTME: End-to-end smoke tests for the demo build: boot, keyless chat prompt,
// ABOUTME: sample document extraction, and edit persistence with reset.
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

// Skip the first-visit tour so it does not cover the dashboard.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("care_hub_onboarded_v1", "true"));
});

test("demo boots with fictional data and no password", async ({ page }) => {
  // Reduced motion makes the PSA chart draw at once, so a capture shows the line and fill.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Demo · fictional data" })).toBeVisible();
  await expect(page.getByText("Raymond Ellis · Prostate cancer")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toHaveCount(0);
  await expect(page.locator(".recharts-area-curve")).toBeVisible();
  // The readiness line plus the surgery, radiation and upcoming scan markers. A horizontal line
  // has no height, so check that they are drawn rather than "visible".
  await expect(page.locator(".recharts-reference-line-line")).toHaveCount(4);
  // Re-take the README screenshot only on request: UPDATE_SCREENSHOT=1 bunx playwright test
  if (process.env.UPDATE_SCREENSHOT === "1") {
    await page.screenshot({ path: "docs/screenshot.png" });
  }
});

test("chat asks for an API key", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Assistant" }).click();
  await page.locator('input[placeholder="Ask a question…"]:visible').fill("What was the last PSA?");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Your key stays in this browser tab")).toBeVisible();
});

test("sample document opens suggested updates without a key", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Documents" })
    .click();
  await page.getByRole("button", { name: /Lab report/ }).click();
  await expect(page.getByText("Suggested updates found")).toBeVisible();
  const rows = page.getByRole("button", {
    name: /^(PSA reading|Medication|Care team|Plan item|Lab result)/,
  });
  expect(await rows.count()).toBeGreaterThanOrEqual(4);
});

test("an edit survives reload and reset restores it", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("PSA 0.11");
  // A reading dated today becomes the latest PSA, which the status line and tile quote.
  const now = new Date();
  const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((n) => String(n).padStart(2, "0"))
    .join("-");
  await page.getByRole("button", { name: "Enter edit mode" }).click();
  await page.getByRole("button", { name: "Add reading" }).click();
  await page.locator('input[type="date"]').fill(today);
  await page.locator('input[type="number"]').fill("0.142");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(heading).toContainText("PSA 0.142");

  await page.reload();
  await expect(heading).toContainText("PSA 0.142");

  await page.getByRole("button", { name: "Demo · fictional data" }).click();
  await page.getByRole("menuitem", { name: "Reset demo data" }).click();
  await expect(page.getByText("Raymond Ellis · Prostate cancer")).toBeVisible();
  await expect(heading).toContainText("PSA 0.11");
  await expect(page.getByText("0.142")).toHaveCount(0);
});
