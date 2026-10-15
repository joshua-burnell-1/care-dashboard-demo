// scripts/generate-seed-sql.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { TABLE_COLUMNS, toSeedSql } from "./generate-seed-sql";
import { buildSeed } from "../src/demo/seed";

const sql = toSeedSql(buildSeed(new Date("2026-10-14T12:00:00")));

it("inserts every non-empty table", () => {
  for (const t of [
    "psa_readings",
    "care_team_members",
    "medication_items",
    "kpi_cards",
    "plan_items",
    "dashboard_sections",
    "lab_results",
    "documents",
  ])
    expect(sql).toMatch(new RegExp(`INSERT INTO public\\.${t} `));
});
it("orders documents before lab_results", () =>
  expect(sql.indexOf("public.documents ")).toBeLessThan(sql.indexOf("public.lab_results ")));
it("orders chat_sessions before chat_messages", () =>
  expect(sql.indexOf("public.chat_sessions ")).toBeLessThan(sql.indexOf("public.chat_messages ")));
it("escapes single quotes", () =>
  expect(
    toSeedSql({
      ...buildSeed(),
      kpi_cards: [{ id: "x", label: "O'Neil", value: "1", sub: "", tone: "ok", sort_index: 0 }],
    } as never),
  ).toContain("'O''Neil'"));
it("upserts dashboard sections", () => expect(sql).toContain("ON CONFLICT (key) DO UPDATE"));
it("upserts the medical_cache singleton", () =>
  expect(sql).toMatch(/INSERT INTO public\.medical_cache [^;]*ON CONFLICT \(id\) DO UPDATE/));
it("dollar-quotes JSON columns", () => expect(sql).toMatch(/\$json\$[\s\S]*?\$json\$::jsonb/));
it("omits the demo-only documents.extracted_text field", () =>
  expect(sql).not.toContain("extracted_text"));
it("rejects a seeded column that is not in the schema", () =>
  expect(() =>
    toSeedSql({
      ...buildSeed(),
      kpi_cards: [{ id: "x", label: "a", value: "1", bogus: 1 }],
    } as never),
  ).toThrow(/bogus/));

// Parse CREATE TABLE blocks from the migrations so the generator's column
// lists cannot drift from the real schema.
function parseMigrationColumns(): Record<string, { name: string; jsonb: boolean }[]> {
  const dir = fileURLToPath(new URL("../supabase/migrations", import.meta.url));
  const ddl = readdirSync(dir)
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
  const tables: Record<string, { name: string; jsonb: boolean }[]> = {};
  for (const m of ddl.matchAll(/create table public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
    tables[m[1]] = m[2]
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) => /^[a-z_]+\s/.test(l) && !/^(constraint|primary|unique|check|foreign)\b/i.test(l),
      )
      .map((l) => ({ name: l.split(/\s+/)[0], jsonb: /^\w+\s+jsonb\b/i.test(l) }));
  }
  return tables;
}

describe("schema alignment", () => {
  const schema = parseMigrationColumns();
  it("TABLE_COLUMNS matches the migration DDL", () => {
    for (const [table, cols] of Object.entries(TABLE_COLUMNS))
      expect(
        cols.map((c) => ({ name: c.name, jsonb: c.jsonb })),
        table,
      ).toEqual(schema[table]);
  });
  it("every emitted column exists in the migrations", () => {
    const inserts = [...sql.matchAll(/INSERT INTO public\.(\w+) \(([^)]*)\)/g)];
    expect(inserts.length).toBeGreaterThan(0);
    for (const [, table, cols] of inserts) {
      const known = (schema[table] ?? []).map((c) => c.name);
      for (const col of cols.split(",").map((c) => c.trim()))
        expect(known, `${table}.${col}`).toContain(col);
    }
  });
});
