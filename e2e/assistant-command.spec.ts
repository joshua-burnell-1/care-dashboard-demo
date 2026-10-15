// ABOUTME: End-to-end checks for the assistant slide-over and the Cmd or Ctrl K command palette:
// ABOUTME: opening from anywhere, focus handling, state kept across close, palette search and actions.
import { test, expect, type Page } from "@playwright/test";

// Skip the first-visit tour so it does not cover the shell.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("care_hub_onboarded_v1", "true"));
});

async function ready(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page.getByText(/^Loading/)).toHaveCount(0);
}

const palette = (page: Page) => page.getByRole("dialog", { name: "Command palette" });
const assistant = (page: Page) => page.getByRole("dialog", { name: "Assistant" });
const chatInput = (page: Page) => assistant(page).getByPlaceholder("Ask a question…");

async function openPalette(page: Page) {
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette(page)).toBeVisible();
  await expect(palette(page).getByRole("combobox")).toBeFocused();
}

/** Type a query and press Enter once the named option is the highlighted one. */
async function pickFromPalette(page: Page, query: string, option: string | RegExp) {
  await page.keyboard.type(query);
  await expect(palette(page).getByRole("option", { name: option })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Enter");
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("palette: type a lab name and Enter opens that result", async ({ page }) => {
    await ready(page);
    await openPalette(page);
    await expect(palette(page).getByRole("combobox")).toBeFocused();
    await pickFromPalette(page, "hemo", /^Hemoglobin$/);
    await expect(page).toHaveURL(/\/labs\/hemoglobin$/);
    await expect(palette(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Hemoglobin" })).toBeVisible();
  });

  test("palette: pages, plan items and documents are searchable, and Escape closes it", async ({
    page,
  }) => {
    await ready(page);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(palette(page)).toBeVisible();
    for (const group of ["Pages", "Lab results", "Plan", "Documents", "Actions"]) {
      await expect(
        palette(page).locator("[cmdk-group-heading]").filter({ hasText: group }),
      ).toBeVisible();
    }
    await pickFromPalette(page, "care circle", /^Care circle$/);
    await expect(page).toHaveURL(/\/circle$/);

    await openPalette(page);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette(page)).toHaveCount(0);
  });

  test("palette: plan items and documents open their pages", async ({ page }) => {
    await ready(page);
    await openPalette(page);
    const plan = palette(page).getByRole("group", { name: "Plan" }).getByRole("option").first();
    await plan.click();
    await expect(page).toHaveURL(/\/plan\/[^/]+$/);

    await openPalette(page);
    const doc = palette(page).getByRole("group", { name: "Documents" }).getByRole("option").first();
    await doc.click();
    await expect(page).toHaveURL(/\/documents\/[^/]+$/);
  });

  test("shortcuts: Cmd or Ctrl K and J work while typing, bare letters do nothing", async ({
    page,
  }) => {
    await ready(page);
    await page.keyboard.press("ControlOrMeta+j");
    await expect(assistant(page)).toBeVisible();
    await chatInput(page).fill("");
    await page.keyboard.type("kj");
    await expect(chatInput(page)).toHaveValue("kj");
    await expect(palette(page)).toHaveCount(0);

    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette(page)).toHaveCount(0);
    await expect(assistant(page)).toBeVisible();
    await expect(chatInput(page)).toBeFocused();
    await expect(chatInput(page)).toHaveValue("kj");
  });

  test("assistant: Cmd or Ctrl J opens it, Escape closes it, focus returns to the trigger", async ({
    page,
  }) => {
    await ready(page);
    const trigger = page.getByRole("button", { name: "Assistant" });
    await expect(page.locator("[data-assistant-panel]")).toHaveAttribute("inert", "");

    await page.keyboard.press("ControlOrMeta+j");
    await expect(assistant(page)).toBeVisible();
    await expect(chatInput(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(assistant(page)).toBeHidden();
    await expect(trigger).toBeFocused();

    // From the button: the button gets focus back too.
    await trigger.click();
    await expect(assistant(page)).toBeVisible();
    await page.getByRole("button", { name: "Close assistant" }).click();
    await expect(assistant(page)).toBeHidden();
    await expect(trigger).toBeFocused();

    // A second press of the shortcut closes it as well.
    await page.keyboard.press("ControlOrMeta+j");
    await expect(assistant(page)).toBeVisible();
    await page.keyboard.press("ControlOrMeta+j");
    await expect(assistant(page)).toBeHidden();
  });

  test("assistant: focus is trapped while open, and clicking the backdrop closes it", async ({
    page,
  }) => {
    await ready(page);
    await page.keyboard.press("ControlOrMeta+j");
    await expect(chatInput(page)).toBeFocused();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() => !!document.activeElement?.closest("[data-assistant-panel]")),
      ).toBe(true);
    }
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(
        await page.evaluate(() => !!document.activeElement?.closest("[data-assistant-panel]")),
      ).toBe(true);
    }
    await page.mouse.click(100, 400);
    await expect(assistant(page)).toBeHidden();
  });

  test("assistant: with no key it asks for one, and a draft and the prompt survive closing", async ({
    page,
  }) => {
    await ready(page);
    await page.keyboard.press("ControlOrMeta+j");
    await chatInput(page).fill("What was the last PSA?");
    await page.keyboard.press("Enter");
    await expect(assistant(page).getByText("Your key stays in this browser tab")).toBeVisible();

    await chatInput(page).fill("a half-typed follow-up");
    await page.keyboard.press("Escape");
    await expect(assistant(page)).toBeHidden();
    await page.keyboard.press("ControlOrMeta+j");
    await expect(assistant(page)).toBeVisible();
    await expect(chatInput(page)).toHaveValue("a half-typed follow-up");
    await expect(assistant(page).getByText("Your key stays in this browser tab")).toBeVisible();
    await expect(assistant(page).getByText("What was the last PSA?")).toBeVisible();
  });

  test("assistant: stays open and keeps its panel across route changes", async ({ page }) => {
    await ready(page, "/labs");
    await page.keyboard.press("ControlOrMeta+j");
    await chatInput(page).fill("keep me");
    await page.keyboard.press("Escape");
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Plan" })
      .click();
    await expect(page).toHaveURL(/\/plan$/);
    await page.getByRole("button", { name: "Assistant" }).click();
    await expect(chatInput(page)).toHaveValue("keep me");
  });

  test("actions: Ask the assistant, Take the tour, Add PSA reading, Toggle theme", async ({
    page,
  }) => {
    await ready(page);

    await openPalette(page);
    await pickFromPalette(page, "ask the", "Ask the assistant");
    await expect(assistant(page)).toBeVisible();
    await expect(chatInput(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Assistant" })).toBeFocused();

    await openPalette(page);
    await pickFromPalette(page, "tour", "Take the tour");
    await expect(page.getByRole("button", { name: "Skip tour" })).toBeVisible();
    await page.getByRole("button", { name: "Skip tour" }).click();

    await openPalette(page);
    await pickFromPalette(page, "add psa", "Add PSA reading");
    await expect(page.getByRole("heading", { name: "Add PSA reading" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Add PSA reading" })).toHaveCount(0);

    const html = page.locator("html");
    const wasDark = await html.evaluate((el) => el.classList.contains("dark"));
    await openPalette(page);
    await pickFromPalette(page, "toggle theme", "Toggle theme");
    await expect(html).toHaveClass(wasDark ? /^(?!.*\bdark\b)/ : /\bdark\b/);
    await expect(palette(page)).toHaveCount(0);
  });

  test("actions: Add PSA reading from the palette saves a reading and the PSA page count goes up", async ({
    page,
  }) => {
    await ready(page, "/labs/psa");
    const before = Number(
      (await page.getByText(/^\d+ readings?$/).textContent())?.match(/\d+/)?.[0],
    );
    await openPalette(page);
    await pickFromPalette(page, "add psa", "Add PSA reading");
    const dialog = page.getByRole("heading", { name: "Add PSA reading" });
    await expect(dialog).toBeVisible();
    await page.locator('input[type="date"]').fill("2026-10-10");
    await page.locator('input[type="number"]').fill("0.137");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(`${before + 1} readings`)).toBeVisible();
  });

  test("actions: Upload a document goes to Documents and focuses the upload area", async ({
    page,
  }) => {
    await ready(page, "/labs");
    await openPalette(page);
    await pickFromPalette(page, "upload", "Upload a document");
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.getByRole("group", { name: "Upload documents" })).toBeFocused();
  });

  test("actions: Reset demo data runs the same reset as the Demo menu (reloads)", async ({
    page,
  }) => {
    await ready(page);
    await openPalette(page);
    await page.keyboard.type("reset demo");
    await expect(palette(page).getByRole("option", { name: "Reset demo data" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await Promise.all([page.waitForEvent("load"), page.keyboard.press("Enter")]);
    await expect(page.locator("main h1").first()).toBeVisible();
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the floating button opens a full-width assistant and Escape returns focus to it", async ({
    page,
  }) => {
    await ready(page);
    const fab = page.getByRole("button", { name: "Open assistant" });
    await expect(page.getByRole("button", { name: "Assistant", exact: true })).toHaveCount(0);
    await fab.click();
    await expect(assistant(page)).toBeVisible();
    const box = await assistant(page).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(388);
    expect(box?.height).toBeGreaterThanOrEqual(843);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(assistant(page)).toBeHidden();
    await expect(fab).toBeFocused();
  });

  test("the search button opens the palette", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(palette(page)).toBeVisible();
    await pickFromPalette(page, "labs", /^Labs$/);
    await expect(page).toHaveURL(/\/labs$/);
  });
});
