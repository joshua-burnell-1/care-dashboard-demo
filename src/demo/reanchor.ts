// ABOUTME: Moves a stored demo database to a new "today": untouched seed rows are rebuilt
// ABOUTME: from the seed, and every other row has its dates and timestamps shifted by the gap.

import { dateFromIso, isoDaysFromToday } from "./dates";
import type { SeedData, TableName } from "./seed";

type Row = Record<string, unknown>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const MS_PER_DAY = 86400000;

/**
 * Returns `value` with every `YYYY-MM-DD` date and ISO timestamp moved by `days`, at any depth
 * (edit-history snapshots and structured section content included). Free text is left alone.
 */
export function shiftDates<T>(value: T, days: number): T {
  if (typeof value === "string") {
    if (DATE_RE.test(value)) return isoDaysFromToday(days, dateFromIso(value)) as T;
    if (TIMESTAMP_RE.test(value)) {
      const ms = Date.parse(value);
      if (!Number.isNaN(ms)) return new Date(ms + days * MS_PER_DAY).toISOString() as T;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, days)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shiftDates(v, days)])) as T;
  }
  return value;
}

/** Structural equality for JSON-shaped values, ignoring object key order. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => jsonEqual(v, b[i]))
    );
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => jsonEqual((a as Row)[k], (b as Row)[k]));
  }
  return false;
}

/**
 * Re-anchors `stored` (seeded as `oldSeed`) to the day `newSeed` was built for, `days` later.
 * A row still identical to its seed row is replaced by the new seed row, so its free text
 * (record Markdown, "5 days away", month names) is current. Rows the viewer added or edited
 * keep their content and only have their dates shifted.
 */
export function reanchorTables(
  stored: SeedData,
  oldSeed: SeedData,
  newSeed: SeedData,
  days: number,
  primaryKey: (table: TableName) => string,
): SeedData {
  const out = {} as Record<TableName, Row[]>;
  for (const table of Object.keys(stored) as TableName[]) {
    const pk = primaryKey(table);
    const byKey = (rows: unknown[]) => new Map((rows as Row[]).map((r) => [r[pk], r]));
    const oldRows = byKey(oldSeed[table] ?? []);
    const newRows = byKey(newSeed[table] ?? []);
    out[table] = (stored[table] as unknown as Row[]).map((row) => {
      const fresh = newRows.get(row[pk]);
      const untouched = oldRows.has(row[pk]) && jsonEqual(row, oldRows.get(row[pk]));
      return untouched && fresh ? structuredClone(fresh) : shiftDates(row, days);
    });
  }
  return out as unknown as SeedData;
}
