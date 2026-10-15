// ABOUTME: End-to-end checks for Documents, Activity and editing in place: the sample lab report to its
// ABOUTME: document page, the library's URL state, inline edits with the Undo toast, and Activity undo.
import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("care_hub_onboarded_v1", "true"));
});

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page.getByText(/^Loading/)).toHaveCount(0);
}

const toast = (page: Page) => page.locator("[data-sonner-toast]");
const vitaminD = (page: Page) => page.locator('[data-medication="Vitamin D3"]');

test.describe("documents", () => {
  test("the sample lab report goes through review to a document page that lists its results", async ({
    page,
  }) => {
    await ready(page, "/documents");
    // Upload comes first, with the samples inside it and the details folded away.
    const zone = page.getByRole("region", { name: "Add a document" });
    await expect(zone.getByRole("button", { name: "Browse files" })).toBeVisible();
    await expect(zone.getByLabel("Document type")).toBeHidden();
    await zone.getByRole("button", { name: /Add details/ }).click();
    await expect(zone.getByLabel("Document type")).toBeVisible();

    await zone.getByRole("button", { name: "Lab report" }).click();
    const review = page.getByRole("dialog", { name: "Suggested updates found" });
    await expect(review).toBeVisible();
    await expect(review.locator('[data-status="watch"]').first()).toBeVisible();
    await review.getByRole("button", { name: /^Apply \d+ updates$/ }).click();

    await expect(page).toHaveURL(/\/documents\/[^/?]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "lab-report.txt" })).toBeVisible();
    const fromDoc = page.getByRole("region", { name: "What came from this document" });
    await expect(fromDoc.getByRole("link")).toHaveCount(11);
    await fromDoc.getByRole("link", { name: /Hemoglobin/ }).click();
    await expect(page).toHaveURL(/\/labs\/hemoglobin$/);

    await page.goBack();
    const text = page.locator("#document-text");
    await expect(text).toContainText("LABORATORY REPORT (fictional sample");
    await expect(page.getByRole("button", { name: "Show all" })).toBeVisible();
  });

  test("search, type filter and page live in the URL", async ({ page }) => {
    await ready(page, "/documents");
    const rows = page.locator("[data-document-row]");
    await expect(rows).toHaveCount(3);
    await page.getByRole("searchbox", { name: "Search documents" }).fill("radiation");
    await expect(page).toHaveURL(/\?q=radiation$/);
    await expect(rows).toHaveCount(1);
    await page.getByRole("searchbox", { name: "Search documents" }).fill("zzz");
    await expect(page.getByText("No documents match")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(rows).toHaveCount(3);

    await page.getByRole("combobox", { name: "Type" }).selectOption("pdf");
    await expect(page).toHaveURL(/\?type=pdf$/);
    await expect(rows).toHaveCount(3);

    // A page past the end is put back to the last page, replacing the history entry.
    await page.goto("/documents?page=9");
    await expect(rows).toHaveCount(3);
    await expect(page).toHaveURL(/\/documents$/);
  });

  test("a row opens the document, with its details and text", async ({ page }) => {
    await ready(page, "/documents");
    await page.locator('[data-document-row="Radiation treatment summary.pdf"]').click();
    await expect(page).toHaveURL(/\/documents\/[^/]+$/);
    const details = page.getByRole("region", { name: "Details" });
    await expect(details).toContainText("PDF");
    await expect(details.locator('[data-status="stable"]')).toHaveText("Ready");
    await expect(page.locator("#document-text")).toContainText("FICTIONAL SAMPLE DOCUMENT");
    await expect(
      page.getByText("Nothing in the record points back to this document"),
    ).toBeVisible();
  });

  test("an unknown document id shows not-found", async ({ page }) => {
    await page.goto("/documents/xyz");
    await expect(page.getByRole("heading", { level: 1, name: "Document not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Documents" })).toBeVisible();
  });
});

test.describe("editing in place", () => {
  test("a medication dose edit shows at once, and the toast's Undo puts it back", async ({
    page,
  }) => {
    await ready(page, "/team");
    await expect(vitaminD(page)).toContainText("2,000 IU once daily");
    const pencil = page.getByRole("button", { name: "Edit Vitamin D3" });
    await vitaminD(page).hover();
    await pencil.click();
    const dose = vitaminD(page).getByLabel("Dose");
    await expect(page.getByLabel("Medication or supplement")).toBeFocused();
    await dose.fill("3,000 IU once daily");
    await dose.press("Enter");

    await expect(vitaminD(page)).toContainText("3,000 IU once daily");
    await expect(pencil).toBeFocused();
    await expect(toast(page)).toHaveCount(1);
    await expect(toast(page)).toContainText("Saved");
    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect(vitaminD(page)).toContainText("2,000 IU once daily");
    await expect(toast(page)).toContainText("Undone");
    await expect(toast(page)).toHaveCount(1);
  });

  test("Escape cancels an edit and returns focus to the pencil", async ({ page }) => {
    await ready(page, "/team");
    const pencil = page.getByRole("button", { name: "Edit Vitamin D3" });
    await pencil.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.type("nonsense");
    await page.keyboard.press("Escape");
    await expect(vitaminD(page)).toContainText("2,000 IU once daily");
    await expect(pencil).toBeFocused();
  });

  test("a care team note is edited on the card and keeps the contact details", async ({ page }) => {
    await ready(page, "/team");
    const card = page.locator('[data-member="Dr. Helen Brooks"]');
    await card.hover();
    await card.getByRole("button", { name: "Edit Dr. Helen Brooks" }).click();
    await expect(card.getByLabel("Email")).toHaveValue(/@example\.com$/);
    await card.getByLabel("Location").fill("Northgate Primary Care");
    await card.getByLabel("Notes").fill("Sees him every spring");
    await card.getByLabel("Notes").press("ControlOrMeta+Enter");
    await expect(card).toContainText("Northgate Primary Care");
    await expect(card).toContainText("Sees him every spring");
    await expect(card.locator('a[href^="mailto:"]')).toHaveCount(1);
  });

  test("a plan item is renamed on the timeline", async ({ page }) => {
    await ready(page, "/plan");
    const row = page.locator("[data-plan-row]").first();
    const title = (await row.getByRole("link").first().textContent())!.trim();
    await row.hover();
    await row.getByRole("button", { name: `Edit ${title}` }).click();
    await row.getByLabel("Title").fill(`${title} (moved)`);
    await row.getByLabel("Title").press("Enter");
    await expect(page.getByRole("link", { name: `${title} (moved)`, exact: true })).toBeVisible();
  });

  test("a PSA reading's note is edited in the readings list", async ({ page }) => {
    await ready(page, "/labs/psa");
    const row = page.locator("[data-psa-reading]").first();
    await row.hover();
    await row.getByRole("button", { name: /^Edit PSA reading from / }).click();
    await row.getByLabel("Note").fill("Same lab as last time");
    await row.getByLabel("Note").press("Enter");
    await expect(row).toContainText("Same lab as last time");
  });

  test("no page has a global Edit mode any more", async ({ page }) => {
    for (const path of ["/", "/team", "/plan", "/labs/psa", "/documents"]) {
      await ready(page, path);
      await expect(
        page.getByRole("button", { name: /edit mode|^Edit$|Done editing/i }),
      ).toHaveCount(0);
    }
  });
});

test.describe("activity", () => {
  test("shows edits as sentences grouped by day, and Undo reverts one", async ({ page }) => {
    await ready(page, "/activity");
    const row = page.locator("[data-activity-row]", { hasText: "Changed Vitamin D3 dose" });
    await expect(row).toContainText("1,000 IU once daily to 2,000 IU once daily");
    await expect(page.locator("main")).not.toContainText(/medication_items|UPDATE|INSERT/);

    await row.getByRole("button", { name: "Undo: Changed Vitamin D3 dose" }).click();
    await expect(row.locator('[data-status="neutral"]')).toHaveText("Undone");
    // The undo is itself a change, logged today.
    await expect(page.getByRole("heading", { level: 2, name: "Today" })).toBeVisible();
    await expect(page.getByText("Undo of an earlier change")).toBeVisible();

    await ready(page, "/team");
    await expect(vitaminD(page)).toContainText("1,000 IU once daily");
  });

  test("the area filter uses human names and lives in the URL", async ({ page }) => {
    await ready(page, "/activity");
    const area = page.getByRole("combobox", { name: "Area" });
    await expect(area.locator("option")).toContainText(["All areas", "Plan", "Labs", "Team"]);
    await area.selectOption({ label: "Medications" });
    await expect(page).toHaveURL(/\?table=medications$/);
    await expect(page.locator("[data-activity-row]")).toHaveCount(1);
  });

  test("an inline edit appears in Activity and on Today in the same words", async ({ page }) => {
    await ready(page, "/team");
    await vitaminD(page).hover();
    await page.getByRole("button", { name: "Edit Vitamin D3" }).click();
    await vitaminD(page).getByLabel("Purpose").fill("Bones");
    await vitaminD(page).getByLabel("Purpose").press("Enter");
    await expect(vitaminD(page)).toContainText("Bones");

    await ready(page, "/activity");
    await expect(page.locator("[data-activity-row]").first()).toContainText(
      "Changed Vitamin D3 purpose",
    );
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Documents and Activity fit the screen", async ({ page }) => {
    for (const path of ["/documents", "/activity"]) {
      await ready(page, path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });

  test("the medication pencil is always visible on touch screens", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const phone = await context.newPage();
    await phone.addInitScript(() => localStorage.setItem("care_hub_onboarded_v1", "true"));
    await ready(phone, "/team");
    const pencil = phone.getByRole("button", { name: "Edit Vitamin D3" });
    await pencil.scrollIntoViewIfNeeded();
    expect(await pencil.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await context.close();
  });
});
