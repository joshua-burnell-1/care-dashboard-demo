// ABOUTME: Turns the fictional demo seed (src/demo/seed) into supabase/seed.sql.
// ABOUTME: Run with `bun run seed:sql`; dates are anchored to the day it runs.
// supabase/seed.sql is generated, not committed (it is gitignored): run
// `bun run seed:sql` or `bun run db:reset` to produce a current one.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSeed, type SeedData, type TableName } from "../src/demo/seed";

type Column = { name: string; jsonb: boolean };

const col = (name: string, jsonb = false): Column => ({ name, jsonb });

/**
 * Columns of each seeded table, in DDL order, as created by
 * supabase/migrations. generate-seed-sql.test.ts parses the migrations and
 * fails if these lists drift from the schema.
 */
export const TABLE_COLUMNS: Record<TableName, Column[]> = {
  psa_readings: [
    "id",
    "date",
    "value",
    "unit",
    "phase",
    "note",
    "sort_index",
    "created_at",
    "updated_at",
  ].map((n) => col(n)),
  care_team_members: [
    "id",
    "role",
    "name",
    "where_based",
    "note",
    "sort_index",
    "created_at",
    "updated_at",
    "phone",
    "email",
  ].map((n) => col(n)),
  medication_items: [
    "id",
    "item",
    "dose",
    "purpose",
    "started_by",
    "sort_index",
    "created_at",
    "updated_at",
  ].map((n) => col(n)),
  kpi_cards: ["id", "label", "value", "sub", "tone", "sort_index", "created_at", "updated_at"].map(
    (n) => col(n),
  ),
  plan_items: [
    "id",
    "event_date",
    "title",
    "body",
    "status",
    "sort_index",
    "created_at",
    "updated_at",
  ].map((n) => col(n)),
  dashboard_sections: [col("key"), col("content", true), col("updated_at")],
  documents: [
    "id",
    "name",
    "mime_type",
    "storage_path",
    "size_bytes",
    "uploaded_at",
    "status",
    "error",
    "extracted_chars",
  ].map((n) => col(n)),
  lab_results: [
    "id",
    "date",
    "metric",
    "category",
    "value_numeric",
    "value_text",
    "unit",
    "reference_range",
    "flag",
    "source",
    "source_document_id",
    "note",
    "sort_index",
    "created_at",
    "updated_at",
  ].map((n) => col(n)),
  chat_sessions: ["id", "title", "created_at", "last_message_at"].map((n) => col(n)),
  chat_messages: ["id", "session_id", "role", "content", "created_at"].map((n) => col(n)),
  medical_cache: [
    col("id"),
    col("data", true),
    col("context"),
    col("sources", true),
    col("last_synced_at"),
    col("last_error"),
  ],
  edit_history: [
    col("id"),
    col("table_name"),
    col("record_id"),
    col("operation"),
    col("old_data", true),
    col("new_data", true),
    col("changed_at"),
  ],
};

/** Fields the in-browser demo keeps that have no column in the schema. */
const DEMO_ONLY_FIELDS: Partial<Record<TableName, string[]>> = {
  documents: ["extracted_text"],
};

/** FK-safe insert order. edit_history goes last so the seeded history replaces trigger output. */
const TABLE_ORDER: TableName[] = [
  "psa_readings",
  "care_team_members",
  "medication_items",
  "kpi_cards",
  "plan_items",
  "dashboard_sections",
  "documents",
  "lab_results",
  "chat_sessions",
  "chat_messages",
  "medical_cache",
  "edit_history",
];

const UPSERT_KEY: Partial<Record<TableName, string>> = {
  dashboard_sections: "key",
  medical_cache: "id",
};

function quoteText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteJson(value: unknown): string {
  const json = JSON.stringify(value);
  if (json.includes("$json$")) throw new Error("JSON value contains the $json$ delimiter");
  return `$json$${json}$json$::jsonb`;
}

function literal(value: unknown, column: Column): string {
  if (value === undefined) return "DEFAULT";
  if (value === null) return "NULL";
  if (column.jsonb) return quoteJson(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Non-finite number in column ${column.name}`);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "string") return quoteText(value);
  throw new Error(`Unsupported value for column ${column.name}: ${typeof value}`);
}

function insertFor(table: TableName, rows: Record<string, unknown>[]): string {
  const schema = TABLE_COLUMNS[table];
  const known = new Set(schema.map((c) => c.name));
  const skipped = new Set(DEMO_ONLY_FIELDS[table] ?? []);
  const present = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (skipped.has(key)) continue;
      if (!known.has(key)) throw new Error(`Seeded column ${table}.${key} is not in the schema`);
      present.add(key);
    }
  }
  const columns = schema.filter((c) => present.has(c.name));
  const values = rows.map((row) => `  (${columns.map((c) => literal(row[c.name], c)).join(", ")})`);
  let sql = `INSERT INTO public.${table} (${columns.map((c) => c.name).join(", ")}) VALUES\n${values.join(",\n")}`;
  const key = UPSERT_KEY[table];
  if (key) {
    const updates = columns
      .filter((c) => c.name !== key)
      .map((c) => `${c.name} = EXCLUDED.${c.name}`);
    sql += `\nON CONFLICT (${key}) DO UPDATE SET ${updates.join(", ")}`;
  }
  return `${sql};`;
}

export function toSeedSql(seed: SeedData): string {
  const parts = [
    "-- Generated by scripts/generate-seed-sql.ts from src/demo/seed. Do not edit by hand.",
    "-- All patient data in this file is fictional.",
    "",
    "BEGIN;",
  ];
  for (const table of TABLE_ORDER) {
    const rows = seed[table] as unknown as Record<string, unknown>[];
    if (table === "edit_history") {
      parts.push(
        "",
        "-- seed.sql assumes a freshly reset database (`supabase db reset`).",
        "-- The audit triggers logged the inserts above; replace that output with the seeded history.",
      );
      parts.push("DELETE FROM public.edit_history;");
    }
    if (rows.length === 0) continue;
    parts.push("", insertFor(table, rows));
  }
  parts.push("", "COMMIT;", "");
  return parts.join("\n");
}

if (import.meta.main) {
  const out = fileURLToPath(new URL("../supabase/seed.sql", import.meta.url));
  writeFileSync(out, toSeedSql(buildSeed(new Date())));
  console.log(`Wrote ${out}`);
}
