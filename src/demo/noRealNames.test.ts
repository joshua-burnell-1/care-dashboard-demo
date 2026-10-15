// src/demo/noRealNames.test.ts — runs in CI with no denylist; guards against hardcoded identity in source
import { it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
it("no hardcoded patient name outside src/demo (persona and seed)", () => {
  const files = execSync("git ls-files src supabase/functions index.html")
    .toString()
    .split("\n")
    .filter(Boolean)
    .filter((f) => !f.startsWith("src/demo/"));
  const offenders = files.filter((f) => /Raymond|Ellis/.test(readFileSync(f, "utf8")));
  expect(offenders).toEqual([]);
});

it("only the demo backend builds the fictional seed, so real mode never shows it", () => {
  const files = execSync("git ls-files src")
    .toString()
    .split("\n")
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith("src/demo/"));
  const importers = files.filter((f) => /@\/demo\/seed|buildSeed/.test(readFileSync(f, "utf8")));
  // Tests may build it; client.ts builds it only inside the demo-mode branch.
  expect(importers).toEqual(["src/integrations/supabase/client.ts"]);
});
