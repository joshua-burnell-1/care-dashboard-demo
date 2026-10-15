// ABOUTME: End-to-end checks for the Labs pages: the grouped, filterable, paginated index with its
// ABOUTME: URL state surviving a reload, the metric page, the not-found state and the PSA deep dive.
import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("care_hub_onboarded_v1", "true"));
});

async function openLabs(page: Page, path = "/labs") {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: "Labs" })).toBeVisible();
  await expect(page.locator("[data-lab-row]").first()).toBeVisible();
}

const rows = (page: Page) => page.locator("[data-lab-row]");
const searchParams = (page: Page) => new URL(page.url()).searchParams;

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("groups metrics by panel, eight to a page", async ({ page }) => {
    await openLabs(page);
    await expect(page.getByText(/^\d+ results across \d+ panels$/)).toBeVisible();
    await expect(rows(page)).toHaveCount(8);
    await expect(page.locator("[data-lab-group]").first()).toHaveAttribute(
      "data-lab-group",
      "Complete Blood Count (CBC)",
    );
    const hemoglobin = page.locator('[data-lab-row="hemoglobin"]');
    await expect(hemoglobin).toContainText("13.1");
    await expect(hemoglobin).toContainText("g/dL");
    await expect(hemoglobin).toContainText("Ref 13.5–17.5");
    await expect(hemoglobin.locator("[data-status]")).toHaveText("Low");
  });

  test("abnormal only shows just the flagged metrics", async ({ page }) => {
    await openLabs(page, "/labs?abnormal=1");
    await expect(rows(page)).toHaveCount(2);
    for (const row of await rows(page).all()) {
      await expect(row.locator("[data-status]")).toBeVisible();
    }
    await expect(page.getByRole("switch", { name: "Abnormal only" })).toBeChecked();
    await expect(page.getByRole("navigation", { name: "Pagination" })).toHaveCount(0);
  });

  test("page 2 through the pager updates the URL, and a reload restores the page and the control", async ({
    page,
  }) => {
    await openLabs(page);
    const pager = page.getByRole("navigation", { name: "Pagination" });
    await expect(pager.getByRole("button", { name: "Page 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(pager.getByRole("button", { name: "Previous" })).toBeDisabled();
    await pager.getByRole("button", { name: "Page 2" }).click();
    await expect(page).toHaveURL(/[?&]page=2\b/);
    await expect(rows(page)).toHaveCount(7);
    await expect(pager.getByRole("button", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(pager.getByRole("button", { name: "Next" })).toBeDisabled();

    await page.reload();
    await expect(rows(page).first()).toBeVisible();
    await expect(rows(page)).toHaveCount(7);
    await expect(pager.getByRole("button", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(pager.getByRole("button", { name: "Page 1" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );

    await pager.getByRole("button", { name: "Previous" }).click();
    await expect(page).not.toHaveURL(/page=/);
    await expect(rows(page)).toHaveCount(8);
  });

  test("changing a filter goes back to page 1", async ({ page }) => {
    await openLabs(page, "/labs?page=2");
    await expect(rows(page)).toHaveCount(7);
    await page.getByRole("switch", { name: "Abnormal only" }).click();
    await expect(page).toHaveURL(/abnormal=true/);
    expect(searchParams(page).has("page")).toBe(false);
    await expect(rows(page)).toHaveCount(2);
  });

  test("changing the search, the panel or the sort each goes back to page 1", async ({ page }) => {
    await openLabs(page, "/labs?page=2");
    await expect(rows(page)).toHaveCount(7);
    await page.getByRole("searchbox", { name: "Search lab results" }).fill("c");
    await expect(page).toHaveURL(/[?&]q=c/);
    expect(searchParams(page).has("page")).toBe(false);

    await openLabs(page, "/labs?page=2");
    await page
      .getByRole("combobox", { name: "Panel" })
      .selectOption("Comprehensive Metabolic Panel");
    await expect(page).toHaveURL(/panel=Comprehensive/);
    expect(searchParams(page).has("page")).toBe(false);

    await openLabs(page, "/labs?page=2");
    await page.getByRole("combobox", { name: "Sort" }).selectOption("name");
    await expect(page).toHaveURL(/sort=name/);
    expect(searchParams(page).has("page")).toBe(false);
    await expect(rows(page)).toHaveCount(8);
  });

  test("a real reload restores the search box text", async ({ page }) => {
    await openLabs(page);
    await page.getByRole("searchbox", { name: "Search lab results" }).fill("hemo");
    await expect(page).toHaveURL(/[?&]q=hemo/);
    await page.reload();
    await expect(rows(page).first()).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search lab results" })).toHaveValue("hemo");
    await expect(rows(page)).toHaveCount(1);
  });

  test("a page number past the end is clamped and the URL is corrected", async ({ page }) => {
    await openLabs(page, "/labs?page=99");
    await expect(page).toHaveURL(/[?&]page=2\b/);
    await expect(rows(page)).toHaveCount(7);
    await expect(
      page.getByRole("navigation", { name: "Pagination" }).getByRole("button", { name: "Page 2" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("a panel split across pages shows its full count on both", async ({ page }) => {
    const count = (p: Page) =>
      p.locator('[data-lab-group="Comprehensive Metabolic Panel"] header').getByText(/results?$/);
    await openLabs(page);
    await expect(count(page)).toHaveText("8 results");
    await openLabs(page, "/labs?page=2");
    await expect(count(page)).toHaveText("8 results");
  });

  test("two readings show the change instead of a sparkline; more show a sparkline", async ({
    page,
  }) => {
    await openLabs(page);
    const hemoglobin = page.locator('[data-lab-row="hemoglobin"]');
    await expect(hemoglobin).toContainText("Down 0.7");
    await expect(hemoglobin).toContainText("since Jun 13, 2026");
    await expect(hemoglobin.locator("svg polyline")).toHaveCount(0);
    await openLabs(page, "/labs?page=2");
    await expect(page.locator('[data-lab-row="psa-total"] svg polyline')).toHaveCount(1);
  });

  test("the row action is a quiet icon whose label appears on hover", async ({ page }) => {
    await openLabs(page);
    const row = page.locator('[data-lab-row="hemoglobin"]');
    const label = row.getByText("Ask about this", { exact: true });
    await expect(label).toHaveCSS("opacity", "0");
    await row.hover();
    await expect(label).toHaveCSS("opacity", "1");
    await expect(row.getByRole("button", { name: "Ask about this Hemoglobin" })).toBeVisible();
  });

  test("search, panel and sort live in the URL and come back after a reload", async ({ page }) => {
    await openLabs(page);
    await page.getByRole("searchbox", { name: "Search lab results" }).fill("gluc");
    await expect(page).toHaveURL(/[?&]q=gluc/);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Glucose");

    await page.getByRole("searchbox", { name: "Search lab results" }).fill("");
    await expect(rows(page)).toHaveCount(8);
    await page
      .getByRole("combobox", { name: "Panel" })
      .selectOption("Comprehensive Metabolic Panel");
    await expect(page).toHaveURL(/panel=Comprehensive/);
    await expect(rows(page)).toHaveCount(8);
    await page.getByRole("combobox", { name: "Sort" }).selectOption("name");
    await expect(page).toHaveURL(/sort=name/);
    await expect(rows(page).first()).toContainText("ALT");

    await page.reload();
    await expect(rows(page).first()).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Panel" })).toHaveValue(
      "Comprehensive Metabolic Panel",
    );
    await expect(page.getByRole("combobox", { name: "Sort" })).toHaveValue("name");
    await expect(rows(page)).toHaveCount(8);
    await expect(rows(page).first()).toContainText("ALT");

    await page.goto("/labs?q=hemo&abnormal=1");
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByRole("searchbox", { name: "Search lab results" })).toHaveValue("hemo");
    await expect(page.getByRole("switch", { name: "Abnormal only" })).toBeChecked();
  });

  test("a search that matches nothing shows the empty state, and Clear filters resets everything", async ({
    page,
  }) => {
    await openLabs(page);
    await page.getByRole("searchbox", { name: "Search lab results" }).fill("zzzz");
    await expect(page.getByText("No results match these filters")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(rows(page)).toHaveCount(8);
    await expect(page.getByRole("searchbox", { name: "Search lab results" })).toHaveValue("");
    expect(new URL(page.url()).search).toBe("");
  });

  test("panel headings stay under the top bar while their rows scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 420 });
    await openLabs(page);
    const header = page.locator("[data-lab-group]").first().locator("header");
    const before = await header.evaluate((el) => getComputedStyle(el).position);
    expect(before).toBe("sticky");
    await page.evaluate(() => window.scrollTo(0, 220));
    const top = await header.evaluate((el) => Math.round(el.getBoundingClientRect().top));
    expect(top).toBe(56);
  });

  test("a row opens its metric page with the value, chip, chart and readings", async ({ page }) => {
    await openLabs(page);
    await page.locator('[data-lab-row="hemoglobin"]').getByRole("link").click();
    await expect(page).toHaveURL(/\/labs\/hemoglobin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Hemoglobin" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Labs");
    const latest = page.getByRole("region", { name: "Latest result" });
    await expect(latest).toContainText("13.1");
    await expect(latest.locator("[data-status]")).toHaveText("Low");
    await expect(page.getByRole("img", { name: /^Hemoglobin chart from/ })).toBeVisible();
    await expect(page.locator(".recharts-area-curve")).toBeVisible();
    const readings = page.getByRole("region", { name: "Readings" });
    await expect(readings.locator("tbody tr")).toHaveCount(2);
    await page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: "Labs" })
      .click();
    await expect(page).toHaveURL(/\/labs$/);
  });

  test("an unknown metric shows the not-found state", async ({ page }) => {
    await page.goto("/labs/not-a-real-metric");
    await expect(
      page.getByRole("heading", { level: 1, name: "Lab result not found" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Back to Labs" }).click();
    await expect(page).toHaveURL(/\/labs$/);
  });

  test("Ask about this opens the assistant about that result", async ({ page }) => {
    await openLabs(page);
    await page
      .locator('[data-lab-row="hemoglobin"]')
      .getByRole("button", { name: /Ask about this/ })
      .click();
    const assistant = page.getByRole("dialog", { name: "Assistant" });
    await expect(assistant).toBeVisible();
    await expect(assistant.getByText("Hemoglobin result")).toBeVisible();
    await expect(assistant.getByPlaceholder("Ask a question…")).toHaveValue(
      "What does my latest Hemoglobin result of 13.1 g/dL mean?",
    );
  });

  test("the PSA row and the PSA lab slug lead to the PSA deep dive", async ({ page }) => {
    await openLabs(page, "/labs?page=2");
    await page.locator('[data-lab-row="psa-total"]').getByRole("link").click();
    await expect(page).toHaveURL(/\/labs\/psa$/);
    await page.goto("/labs/psa-total");
    await expect(page).toHaveURL(/\/labs\/psa$/);
    await expect(page.getByRole("heading", { level: 1, name: "PSA" })).toBeVisible();
  });

  test("the PSA page shows the timeline, a range selector that survives a reload, and the doubling explainer", async ({
    page,
  }) => {
    await page.goto("/labs/psa");
    await expect(page.getByRole("heading", { level: 1, name: "PSA" })).toBeVisible();
    await expect(page.getByRole("img", { name: /^PSA chart from/ })).toBeVisible();
    const range = page.getByRole("group", { name: "Range" });
    await expect(range.getByRole("button", { name: "Since surgery" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const chart = page.getByRole("img", { name: /^PSA chart from/ });
    await expect(chart).toHaveAttribute("aria-label", /: 7 readings,/);

    await range.getByRole("button", { name: "All" }).click();
    await expect(page).toHaveURL(/range=all/);
    await expect(range.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(chart).toHaveAttribute("aria-label", /: 11 readings,/);

    await range.getByRole("button", { name: "Since radiation" }).click();
    await expect(page).toHaveURL(/range=post-rad/);
    await expect(chart).toHaveAttribute("aria-label", /: 5 readings,/);

    await page.reload();
    await expect(range.getByRole("button", { name: "Since radiation" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(chart).toHaveAttribute("aria-label", /: 5 readings,/);

    await expect(page.getByRole("heading", { name: "How doubling time works" })).toBeVisible();
    await expect(page.getByText(/Under 2 months is fast, 2 to 6 months is moderate/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Readings" }).locator("tbody tr")).toHaveCount(
      11,
    );
  });

  test("Add reading on the PSA page opens the reading dialog", async ({ page }) => {
    await page.goto("/labs/psa");
    await page.getByRole("button", { name: "Add reading" }).click();
    await expect(page.getByRole("heading", { name: "Add PSA reading" })).toBeVisible();
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the labs list fits the screen with every row action reachable", async ({ page }) => {
    await openLabs(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    const row = page.locator('[data-lab-row="hemoglobin"]');
    await expect(row.getByRole("button", { name: /Ask about this/ })).toBeVisible();
    await expect(row).toContainText("Hemoglobin");
    await expect(row).toContainText("13.1");
  });

  test("the metric and PSA pages fit the screen", async ({ page }) => {
    for (const path of ["/labs/hemoglobin", "/labs/psa"]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.getByText(/^Loading/)).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
    }
  });
});
