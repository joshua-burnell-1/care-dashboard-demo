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
  await expect(page.getByText("Demo mode · All patient data is fictional")).toBeVisible();
  await expect(page.getByText("Raymond Ellis · Care Dashboard")).toBeVisible();
  await expect(page.getByPlaceholder("Password")).toHaveCount(0);
  await expect(page.locator(".recharts-area-curve")).toBeVisible();
  // A horizontal line has no height, so check that it is drawn rather than "visible".
  await expect(page.locator(".recharts-reference-line-line")).toHaveCount(1);
  // Re-take the README screenshot only on request: UPDATE_SCREENSHOT=1 bunx playwright test
  if (process.env.UPDATE_SCREENSHOT === "1") {
    await page.screenshot({ path: "docs/screenshot.png" });
  }
});

test("chat asks for an API key", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[placeholder="Ask a question…"]:visible').fill("What was the last PSA?");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Your key stays in this browser tab")).toBeVisible();
});

test("sample document opens suggested updates without a key", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Records" }).click();
  await page.getByRole("button", { name: /Lab report/ }).click();
  await expect(page.getByText("Suggested updates found")).toBeVisible();
  const rows = page.getByRole("button", {
    name: /^(PSA reading|Medication|Care team|Plan item|Lab result)/,
  });
  expect(await rows.count()).toBeGreaterThanOrEqual(4);
});

test("an edit survives reload and reset restores it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter edit mode" }).click();
  // The doubling-time sub-label is the one KPI field not recomputed from live data.
  await page.getByRole("button", { name: "Edit Doubling time" }).click();
  const dialog = page.getByRole("dialog");
  const value = dialog.getByPlaceholder("e.g. Mar 3 · ng/mL");
  const original = await value.inputValue();
  await value.fill("EDITED-42");
  await dialog.getByRole("button", { name: /save/i }).click();
  await expect(page.getByText("EDITED-42")).toBeVisible();

  await page.reload();
  await expect(page.getByText("EDITED-42")).toBeVisible();

  await page.getByRole("button", { name: "Reset demo data" }).click();
  await expect(page.getByText("Raymond Ellis · Care Dashboard")).toBeVisible();
  await expect(page.getByText("EDITED-42")).toHaveCount(0);
  await expect(page.getByText(original, { exact: true }).first()).toBeVisible();
});
