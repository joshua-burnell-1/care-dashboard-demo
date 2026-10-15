// ABOUTME: End-to-end checks for Plan: the timeline with three upcoming visits, the Decisions
// ABOUTME: comparison (desktop rows and phone cards), the visit page with its brief, and not-found.
import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("care_hub_onboarded_v1", "true"));
});

async function openPlan(page: Page) {
  await page.goto("/plan");
  await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
  await expect(page.locator("[data-plan-row]").first()).toBeVisible();
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the timeline shows three upcoming visits and the past one", async ({ page }) => {
    await openPlan(page);
    const upcoming = page.locator('[data-timeline-group="Upcoming"] [data-plan-row]');
    await expect(upcoming).toHaveCount(3);
    await expect(upcoming.first()).toContainText("Pre-scan check-in");
    await expect(upcoming.first().getByRole("link", { name: /^Prepare for/ })).toBeVisible();
    await expect(page.locator('[data-timeline-group="Past"] [data-plan-row]')).toHaveCount(1);
  });

  test("Prepare opens the visit page with the key form where the brief goes", async ({ page }) => {
    await openPlan(page);
    await page
      .locator('[data-timeline-group="Upcoming"] [data-plan-row]')
      .first()
      .getByRole("link", { name: /^Prepare for/ })
      .click();
    await expect(page).toHaveURL(/\/plan\/[^/]+$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Pre-scan check-in with Dr. Raman" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Plan");
    const brief = page.locator("[data-visit-prep]");
    await expect(brief).toBeVisible();
    await expect(brief.getByLabel("Anthropic API key")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
  });

  test("clicking a timeline row opens its visit page", async ({ page }) => {
    await openPlan(page);
    await page
      .locator('[data-timeline-group="Past"] [data-plan-row]')
      .click({ position: { x: 300, y: 20 } });
    await expect(page).toHaveURL(/\/plan\/[^/]+$/);
    // A completed visit has nothing to prepare for.
    await expect(page.locator("[data-visit-prep]")).toHaveCount(0);
  });

  test("Ask the assistant opens the panel with the visit as context", async ({ page }) => {
    await openPlan(page);
    await page.locator("[data-plan-row]").first().getByRole("link").first().click();
    await page.getByRole("button", { name: "Ask the assistant" }).click();
    const panel = page.locator("[data-assistant-panel]");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Pre-scan check-in");
  });

  test("Decisions lines both clinicians up in the same rows", async ({ page }) => {
    await openPlan(page);
    const comparison = page.locator("[data-comparison]");
    await expect(comparison.locator("[data-clinician]")).toHaveCount(2);
    await expect(comparison.locator('[data-clinician="Dr. Priya Raman"]')).toContainText(
      "Image first, hold treatment",
    );
    await expect(comparison.locator('[data-clinician="Dr. James Whitfield"]')).toContainText(
      "Start early, through a trial",
    );
    const topic = comparison.locator('[data-topic="Preferred next step"]');
    await expect(topic).toBeVisible();
    const left = await topic.locator('[data-view="Dr. Priya Raman"]').boundingBox();
    const right = await topic.locator('[data-view="Dr. James Whitfield"]').boundingBox();
    expect(Math.abs(left!.y - right!.y)).toBeLessThan(2);
    expect(right!.x).toBeGreaterThan(left!.x + left!.width - 1);
    await expect(page.getByRole("region", { name: "Where they agree" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Where they differ" })).toBeVisible();
  });

  test("Add plan item is visible without any edit mode and adds an item", async ({ page }) => {
    await openPlan(page);
    await page.getByRole("button", { name: "Add plan item" }).click();
    await page.getByPlaceholder("e.g. PSMA PET/CT scan").fill("Bone density scan");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("link", { name: "Bone density scan" })).toBeVisible();
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Decisions stacks each topic as a card with one view under the other", async ({ page }) => {
    await openPlan(page);
    const topic = page.locator('[data-comparison] [data-topic="Preferred next step"]');
    await topic.scrollIntoViewIfNeeded();
    const a = await topic.locator('[data-view="Dr. Priya Raman"]').boundingBox();
    const b = await topic.locator('[data-view="Dr. James Whitfield"]').boundingBox();
    expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
    await expect(topic.locator('[data-view="Dr. Priya Raman"]')).toContainText("Dr. Priya Raman");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("an unknown visit id shows not-found inside the shell", async ({ page }) => {
  await page.goto("/plan/does-not-exist");
  await expect(page.getByRole("heading", { level: 1, name: "Visit not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Plan" })).toBeVisible();
  await expect(page.getByRole("navigation").first()).toBeVisible();
});
