// ABOUTME: End-to-end checks for Team and Learn: five care team cards with Call and Email links,
// ABOUTME: the medications list and add dialog, and Learn's anchor nav, scroll-spy and hash on load.
import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("care_hub_onboarded_v1", "true"));
});

async function openTeam(page: Page) {
  await page.goto("/team");
  await expect(page.getByRole("heading", { level: 1, name: "Team" })).toBeVisible();
  await expect(page.locator("[data-member]").first()).toBeVisible();
}

async function openLearn(page: Page, hash = "") {
  await page.goto(`/learn${hash}`);
  await expect(page.getByRole("heading", { level: 1, name: "Learn" })).toBeVisible();
  await expect(page.locator("#glossary dt").first()).toBeVisible();
}

test.describe("team, desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("shows five members with fictional call and email links", async ({ page }) => {
    await openTeam(page);
    const cards = page.locator("[data-member]");
    await expect(cards).toHaveCount(5);
    const tels = await cards
      .locator('a[href^="tel:"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(tels).toHaveLength(5);
    expect(tels.every((h) => /^tel:55501001\d\d$/.test(h!))).toBe(true);
    const mails = await cards
      .locator('a[href^="mailto:"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(mails).toHaveLength(5);
    expect(mails.every((h) => h!.endsWith("@example.com"))).toBe(true);
  });

  test("lays the cards out three across and marks the nurse navigator as main contact", async ({
    page,
  }) => {
    await openTeam(page);
    const tops = await page
      .locator("[data-member]")
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(tops.filter((t) => t === tops[0])).toHaveLength(3);
    const chip = page.locator("[data-main-contact]");
    await expect(chip).toHaveCount(1);
    await expect(page.locator("[data-member]", { has: chip })).toContainText("Nurse navigator");
  });

  test("Ask about their role opens the assistant about that person", async ({ page }) => {
    await openTeam(page);
    await page
      .locator('[data-member="Dr. Priya Raman"]')
      .getByRole("button", { name: "Ask about their role" })
      .click();
    const panel = page.locator("[data-assistant-panel]");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Dr. Priya Raman");
    await expect(panel.locator("input, textarea").first()).toHaveValue(/Dr\. Priya Raman/);
  });

  test("lists the medications and adds one from the section header", async ({ page }) => {
    await openTeam(page);
    const rows = page.locator("[data-medication]");
    const before = await rows.count();
    expect(before).toBeGreaterThan(2);
    await expect(page.getByRole("button", { name: /^Enter edit mode/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Add medication" }).click();
    const dialog = page.getByRole("dialog", { name: "Add medication" });
    await dialog.getByPlaceholder("e.g. Vitamin D3").fill("Magnesium");
    await dialog.getByPlaceholder("e.g. 2,000 IU/day").fill("200 mg nightly");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(rows).toHaveCount(before + 1);
    await expect(page.locator('[data-medication="Magnesium"]')).toContainText("200 mg nightly");
  });

  test("editing a member keeps the contact details", async ({ page }) => {
    await openTeam(page);
    const card = page.locator('[data-member="Dr. Helen Brooks"]');
    await card.hover();
    await card.getByRole("button", { name: "Edit Dr. Helen Brooks" }).click();
    await expect(card.getByLabel("Email")).toHaveValue(/@example\.com$/);
    await card.getByLabel("Location").fill("Northgate Primary Care");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card).toContainText("Northgate Primary Care");
    await expect(card.locator('a[href^="mailto:"]')).toHaveCount(1);
  });
});

test.describe("team, phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("stacks the cards one per row without sideways scroll", async ({ page }) => {
    await openTeam(page);
    const lefts = await page
      .locator("[data-member]")
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator("[data-medication]").first()).toBeVisible();
  });
});

test.describe("learn, desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the nav jumps to the glossary, updates the hash and marks it current", async ({ page }) => {
    await openLearn(page);
    const nav = page.getByRole("navigation", { name: "On this page" });
    await expect(nav.getByRole("link", { name: "Pathology" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await nav.getByRole("link", { name: "Glossary" }).click();
    await expect(page).toHaveURL(/\/learn#glossary$/);
    await expect(nav.getByRole("link", { name: "Glossary" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(nav.locator('[aria-current="true"]')).toHaveCount(1);
    // The heading sits clear of the sticky top bar.
    await expect
      .poll(async () => (await page.locator("#glossary-heading").boundingBox())!.y)
      .toBeGreaterThan(56);
    await expect
      .poll(async () => (await page.locator("#glossary-heading").boundingBox())!.y)
      .toBeLessThan(300);
  });

  test("scroll-spy follows the page", async ({ page }) => {
    await openLearn(page);
    const nav = page.getByRole("navigation", { name: "On this page" });
    await page.locator("#nutrition-heading").scrollIntoViewIfNeeded();
    await page.evaluate(() => document.getElementById("nutrition")!.scrollIntoView());
    await expect(nav.getByRole("link", { name: "Nutrition" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(nav.getByRole("link", { name: "Glossary" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  test("a short last section still wins at the bottom, and gives way when scrolling up", async ({
    page,
  }) => {
    await openLearn(page);
    const nav = page.getByRole("navigation", { name: "On this page" });
    // No matches leaves the glossary a single line, far too short to reach the reading band.
    await page.getByLabel("Filter glossary terms").fill("zzzz");
    await expect(page.getByText("No terms match")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(nav.getByRole("link", { name: "Glossary" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    // Give a late observer callback time to misfire, then check Glossary held.
    await page.waitForTimeout(400);
    await expect(nav.getByRole("link", { name: "Glossary" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await page.evaluate(() => document.getElementById("doubling-time")!.scrollIntoView());
    await expect(nav.getByRole("link", { name: "Doubling time" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(nav.locator('[aria-current="true"]')).toHaveCount(1);
  });

  test("the hash follows the section being read without moving the page", async ({ page }) => {
    await openLearn(page);
    await page.evaluate(() => document.getElementById("nutrition")!.scrollIntoView());
    await expect(page).toHaveURL(/\/learn#nutrition$/);
    const y = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
    // Back at the top the hash is dropped, so a reload does not jump to a section left behind.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page).toHaveURL(/\/learn$/);
  });

  test("scrolling gradually back up to the top leaves no hash", async ({ page }) => {
    await openLearn(page);
    await page.evaluate(() => document.getElementById("doubling-time")!.scrollIntoView());
    await expect(page).toHaveURL(/\/learn#doubling-time$/);
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(30);
      if ((await page.evaluate(() => window.scrollY)) === 0) break;
    }
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page).toHaveURL(/\/learn$/);
  });

  test("changing the hash after load scrolls to that section", async ({ page }) => {
    await openLearn(page);
    await page.evaluate(() => {
      window.location.hash = "glossary";
    });
    await expect
      .poll(async () => (await page.locator("#glossary-heading").boundingBox())!.y)
      .toBeLessThan(300);
    await expect(
      page
        .getByRole("navigation", { name: "On this page" })
        .getByRole("link", { name: "Glossary" }),
    ).toHaveAttribute("aria-current", "true");
  });

  test("a hash on load scrolls to its section", async ({ page }) => {
    await openLearn(page, "#doubling-time");
    await expect
      .poll(async () => (await page.locator("#doubling-heading").boundingBox())!.y)
      .toBeLessThan(250);
    await expect(
      page
        .getByRole("navigation", { name: "On this page" })
        .getByRole("link", { name: "Doubling time" }),
    ).toHaveAttribute("aria-current", "true");
  });

  test("the doubling bands match the status scale", async ({ page }) => {
    await openLearn(page);
    const bands = page.locator("[data-band]");
    await expect(bands).toHaveCount(3);
    await expect(bands.nth(0)).toContainText("Fast");
    await expect(bands.nth(0)).toContainText("Under 2 months");
    await expect(bands.nth(1)).toContainText("Moderate");
    await expect(bands.nth(1)).toContainText("2 to 6 months");
    await expect(bands.nth(2)).toContainText("Slow");
    await expect(bands.nth(2)).toContainText("Over 6 months");
    // The seeded doubling time is about 2.5 months.
    await expect(page.locator('[data-band][data-current="true"]')).toContainText("Moderate");
  });

  test("the glossary is an alphabetical definition list with a filter", async ({ page }) => {
    await openLearn(page);
    const terms = await page.locator("#glossary dt").allTextContents();
    expect(terms.length).toBeGreaterThan(5);
    expect(terms).toEqual(
      [...terms].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
    );
    await page.getByLabel("Filter glossary terms").fill("psma");
    await expect(page.locator("#glossary dt")).toHaveCount(1);
    await page.getByLabel("Filter glossary terms").fill("zzzz");
    await expect(page.getByText("No terms match")).toBeVisible();
  });
});

test.describe("learn, phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the chip nav sticks under the top bar and the page never scrolls sideways", async ({
    page,
  }) => {
    await openLearn(page);
    const nav = page.getByRole("navigation", { name: "On this page" });
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect
      .poll(async () => Math.round((await nav.boundingBox())!.y))
      .toBeGreaterThanOrEqual(50);
    await expect.poll(async () => Math.round((await nav.boundingBox())!.y)).toBeLessThan(70);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await nav.getByRole("link", { name: "Glossary" }).click();
    await expect(page).toHaveURL(/#glossary$/);
    await expect
      .poll(async () => (await page.locator("#glossary-heading").boundingBox())!.y)
      .toBeGreaterThan(100);
  });
});
