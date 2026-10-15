// ABOUTME: End-to-end checks for the Today home: status chip, the four KPI tiles, the annotated
// ABOUTME: PSA chart, Up next, What-changed links and the expandable When-to-call tiers.
import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("care_hub_onboarded_v1", "true"));
});

async function openToday(page: Page) {
  await page.goto("/");
  await expect(page.locator("main h1")).toBeVisible();
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("shows the status chip, four KPI tiles, the chart and the first Up next item", async ({
    page,
  }) => {
    await openToday(page);
    const main = page.locator("main");
    await expect(main.locator("header [data-status]")).toHaveText("Keep watching");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PSA 0.11 and rising");
    await expect(main.locator("[data-kpi]")).toHaveCount(4);
    for (const label of ["Latest PSA", "Doubling time", "Next visit", "Open questions"]) {
      await expect(main.locator(`[data-kpi="${label}"]`)).toBeVisible();
    }
    await expect(main.locator('[data-kpi="Open questions"]')).toContainText("4");
    await expect(page.getByRole("img", { name: /^PSA chart from/ })).toBeVisible();
    await expect(page.locator(".recharts-area-curve")).toBeVisible();
    const first = main.locator("[data-up-next-item]").first();
    await expect(first).toContainText("Pre-scan check-in");
    await expect(main.locator("[data-up-next-item]")).toHaveCount(3);
  });

  test("the four tiles sit in one row", async ({ page }) => {
    await openToday(page);
    const tops = await page
      .locator("main [data-kpi]")
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });

  test("a What changed item opens where it lives", async ({ page }) => {
    await openToday(page);
    await page.locator('[data-change-kind="psa"]').click();
    await expect(page).toHaveURL(/\/labs\/psa$/);
    await expect(page.getByRole("heading", { level: 1, name: "PSA" })).toBeVisible();

    await page.goBack();
    await page.locator('[data-change-kind="document"]').click();
    await expect(page).toHaveURL(/\/documents\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(".pdf");

    await page.goBack();
    await page.getByRole("link", { name: "See all activity" }).click();
    await expect(page).toHaveURL(/\/activity$/);
  });

  test("Prepare opens the visit page", async ({ page }) => {
    await openToday(page);
    await page.getByRole("link", { name: /^Prepare for Pre-scan check-in/ }).click();
    await expect(page).toHaveURL(/\/plan\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pre-scan check-in");
  });

  test("When to call shows three tiers and See all expands the details in place", async ({
    page,
  }) => {
    await openToday(page);
    const section = page.getByRole("region", { name: "When to call" });
    await expect(section.locator("[data-tier]")).toHaveCount(3);
    const toggle = section.getByRole("button", { name: "See all" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(section.getByText(/Pressure on the spinal cord/)).toHaveCount(0);
    await toggle.click();
    await expect(section.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(section.getByText(/Pressure on the spinal cord/)).toBeVisible();
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("tiles sit two by two and nothing scrolls sideways", async ({ page }) => {
    await openToday(page);
    const boxes = await page.locator("main [data-kpi]").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), top: Math.round(r.top) };
      }),
    );
    expect(new Set(boxes.map((b) => b.left)).size).toBe(2);
    expect(new Set(boxes.map((b) => b.top)).size).toBe(2);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });
});
