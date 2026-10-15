import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    outDir: "dist",
  },
  // Unit tests only; the Playwright specs in e2e/ run via `bun run e2e`.
  test: { exclude: [...configDefaults.exclude, "e2e/**"] },
});
