// ABOUTME: Demo version of the dashboard-data edge function: CRUD for the configurable
// ABOUTME: dashboard tables, section updates and edit-history rollback.

import type { DemoDb } from "../db";
import type { TableName } from "../seed";
import { fail, ok, patchRow, saveItem, type Body, type Handler, type Row } from "./shared";

const ALLOWED_TONES = ["rose", "warn", "info", "ok", "neutral", "danger"];
const ALLOWED_PHASES = ["pre-op", "post-op", "post-rad"];
const ALLOWED_FLAGS = ["HIGH", "LOW", "NORMAL", "ABNORMAL"];
const ROLLBACK_TABLES: TableName[] = [
  "psa_readings",
  "care_team_members",
  "medication_items",
  "kpi_cards",
  "plan_items",
  "dashboard_sections",
  "lab_results",
];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Trimmed string, or null when the field is absent or null (the real `String(x ?? "")` idiom). */
const text = (value: unknown) => String(value ?? "").trim();
const nullableText = (value: unknown) =>
  value === null || value === undefined ? null : text(value) || null;

function upsertPsa(db: DemoDb, item: Body) {
  const date = text(item.date);
  const value = item.value === null || item.value === undefined ? null : Number(item.value);
  const unit = text(item.unit ?? "ng/mL") || "ng/mL";
  const phase = String(item.phase ?? "post-rad");
  const note = text(item.note);
  const sort_index = Number(item.sort_index ?? 0);

  if (!date || !DATE_PATTERN.test(date)) return fail("Invalid date");
  if (value !== null && isNaN(value)) return fail("Invalid value");
  if (!ALLOWED_PHASES.includes(phase)) return fail("Invalid phase");

  // The source document is written only when given, so an edit keeps the existing link.
  const sourceDoc = item.source_document_id;
  const payload: Row = { date, value, unit, phase, note, sort_index };
  if (sourceDoc !== undefined) {
    payload.source_document_id =
      typeof sourceDoc === "string" && sourceDoc.length > 0 ? sourceDoc : null;
  }
  if (item.id) return saveItem(db, "psa_readings", item, payload);

  // Upsert-by-date: update the existing reading for this date, otherwise insert.
  const existing = db.all("psa_readings").find((r) => r.date === date);
  return existing
    ? ok({ item: patchRow(db, "psa_readings", "id", existing.id, payload) })
    : ok({ item: db.upsert("psa_readings", payload) });
}

function upsertCareTeam(db: DemoDb, item: Body) {
  const name = text(item.name);
  if (!name || name.length > 200) return fail("Invalid name");
  return saveItem(db, "care_team_members", item, {
    name,
    role: text(item.role),
    where_based: text(item.where_based),
    note: text(item.note),
    phone: text(item.phone),
    email: text(item.email),
    sort_index: Number(item.sort_index ?? 0),
  });
}

function upsertMedication(db: DemoDb, item: Body) {
  const itemName = text(item.item);
  if (!itemName || itemName.length > 300) return fail("Invalid item name");
  return saveItem(db, "medication_items", item, {
    item: itemName,
    dose: text(item.dose),
    purpose: text(item.purpose),
    started_by: text(item.started_by),
    sort_index: Number(item.sort_index ?? 0),
  });
}

function upsertKpi(db: DemoDb, item: Body) {
  const label = text(item.label);
  const value = text(item.value);
  if (!label || label.length > 100) return fail("Invalid label");
  if (!value || value.length > 100) return fail("Invalid value");
  const tone = String(item.tone ?? "neutral");
  if (!ALLOWED_TONES.includes(tone)) return fail("Invalid tone");
  return saveItem(db, "kpi_cards", item, {
    label,
    value,
    sub: text(item.sub),
    tone,
    sort_index: Number(item.sort_index ?? 0),
  });
}

function upsertLabResult(db: DemoDb, item: Body) {
  const metric = text(item.metric);
  if (!metric || metric.length > 300) return fail("Invalid metric");

  const date = nullableText(item.date);
  if (date !== null && !DATE_PATTERN.test(date)) return fail("Invalid date");

  let value_numeric: number | null = null;
  let value_text: string | null = null;
  if (item.value !== null && item.value !== undefined && item.value !== "") {
    const asNumber = Number(item.value);
    if (Number.isFinite(asNumber)) value_numeric = asNumber;
    else value_text = String(item.value);
  }

  const flagRaw =
    item.flag === null || item.flag === undefined ? null : String(item.flag).toUpperCase();
  const sourceDoc = item.source_document_id;

  const payload = {
    date,
    metric,
    category: nullableText(item.category),
    value_numeric,
    value_text,
    unit: text(item.unit),
    reference_range: nullableText(item.reference_range),
    flag: flagRaw && ALLOWED_FLAGS.includes(flagRaw) ? flagRaw : null,
    source: text(item.source ?? "upload") || "upload",
    source_document_id: typeof sourceDoc === "string" && sourceDoc.length > 0 ? sourceDoc : null,
    note: text(item.note),
    sort_index: Number(item.sort_index ?? 0),
  };

  if (item.id) return saveItem(db, "lab_results", item, payload);

  // Dedupe on (date, metric, value_numeric) when a date is present; undated uploads always insert.
  if (date !== null) {
    const existing = db
      .all("lab_results")
      .find((r) => r.date === date && r.metric === metric && r.value_numeric === value_numeric);
    if (existing) return ok({ item: patchRow(db, "lab_results", "id", existing.id, payload) });
  }
  return ok({ item: db.upsert("lab_results", payload) });
}

function rollback(db: DemoDb, historyId: unknown) {
  if (!historyId) return fail("Missing history_id");
  const entry = db.all("edit_history").find((e) => e.id === historyId);
  if (!entry) return fail("History entry not found");

  const table = entry.table_name as TableName;
  const operation = entry.operation;
  const oldData = entry.old_data as Row | null;
  if (!ROLLBACK_TABLES.includes(table)) return fail("Invalid table");

  const pk = table === "dashboard_sections" ? "key" : "id";
  const recordId = entry.record_id;

  // A rollback that changes no row reports why instead of claiming success.
  const exists = db.all(table).some((r) => r[pk] === recordId);
  if (operation === "DELETE" && oldData) {
    // Re-inserting a row whose key is taken is a unique-violation in Postgres.
    if (db.all(table).some((r) => r[pk] === oldData[pk])) {
      return fail("That item is already in the record");
    }
    db.upsert(table, oldData);
  } else if (operation === "UPDATE" && oldData) {
    if (!patchRow(db, table, pk, recordId, oldData)) return fail("That item no longer exists");
  } else if (operation === "INSERT") {
    if (!exists) return fail("That item no longer exists");
    db.remove(table, String(recordId));
  } else {
    return fail("Nothing to undo");
  }
  return ok();
}

export const dashboardData: Handler = (db, body) => {
  const { action, item, id, key, content, history_id } = body;
  const fields = (item ?? undefined) as Body | undefined;
  const upserts: Record<string, (db: DemoDb, item: Body) => unknown> = {
    "upsert-psa": upsertPsa,
    "upsert-care-team": upsertCareTeam,
    "upsert-medication": upsertMedication,
    "upsert-kpi": upsertKpi,
    "upsert-lab-result": upsertLabResult,
  };
  const deletes: Record<string, TableName> = {
    "delete-psa": "psa_readings",
    "delete-care-team": "care_team_members",
    "delete-medication": "medication_items",
    "delete-kpi": "kpi_cards",
    "delete-lab-result": "lab_results",
  };

  const upsert = typeof action === "string" ? upserts[action] : undefined;
  if (upsert) return fields ? upsert(db, fields) : fail("Missing item");

  const deleteTable = typeof action === "string" ? deletes[action] : undefined;
  if (deleteTable) {
    if (!id) return fail("Missing id");
    db.remove(deleteTable, String(id));
    return ok();
  }

  if (action === "update-section") {
    if (!key || content === undefined) return fail("Missing key or content");
    // Updates only: a missing section key matches no row and is not created.
    patchRow(db, "dashboard_sections", "key", key, { content });
    return ok();
  }

  if (action === "rollback") return rollback(db, history_id);

  return fail(`Unknown action: ${action}`);
};
