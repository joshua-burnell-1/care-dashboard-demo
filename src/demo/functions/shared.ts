// ABOUTME: Small helpers shared by the demo edge-function handlers: request and row
// ABOUTME: types, response builders, and the PostgREST-style "patch by key" write.

import type { DemoDb } from "../db";
import type { TableName } from "../seed";

export type Body = Record<string, unknown>;
export type Row = Record<string, unknown>;

/** A demo handler: reads and writes the DemoDb and returns the edge function's JSON body. */
export type Handler = (db: DemoDb, body: Body) => unknown;

export const ok = (extra: Row = {}) => ({ ok: true, ...extra });
export const fail = (error: unknown) => ({ ok: false, error });

/**
 * PATCH ... ?<pk>=eq.<value>: merges `payload` into the matching row and returns it, or
 * returns undefined when no row matches (PostgREST updates nothing and does not insert).
 */
export function patchRow(
  db: DemoDb,
  table: TableName,
  pk: "id" | "key",
  value: unknown,
  payload: Row,
): Row | undefined {
  if (!db.all(table).some((row) => row[pk] === value)) return undefined;
  return db.upsert(table, { ...payload, [pk]: value });
}

/** Insert-or-update by primary key, the way the edge functions branch on `item.id`. */
export function saveItem(db: DemoDb, table: TableName, item: Body, payload: Row) {
  const saved = item.id ? patchRow(db, table, "id", item.id, payload) : db.upsert(table, payload);
  return ok({ item: saved });
}
