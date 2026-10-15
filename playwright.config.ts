// ABOUTME: Playwright config for the smoke tests; serves the production build via vite preview.
// ABOUTME: Set PW_CHROMIUM to use a specific Chromium binary (e.g. a sandbox install).
import { defineConfig } from "@playwright/test";

const executablePath = process.env.PW_CHROMIUM || undefined;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    launchOptions: { executablePath },
  },
  webServer: {
    command: "bun run build && bun run preview --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
