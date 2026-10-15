// ABOUTME: In-memory demo database persisted to localStorage. Mirrors the column
// ABOUTME: defaults, updated_at triggers and edit-history triggers of the real schema.

import { dateFromIso, daysBetween, isoDaysFromToday } from "./dates";
import { reanchorTables } from "./reanchor";
import { SEED_VERSION, type SeedData, type TableName } from "./seed";

type Row = Record<string, unknown>;
type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Operation = "INSERT" | "UPDATE" | "DELETE";

export const DEMO_DB_STORAGE_KEY = `care_demo_db_v${SEED_VERSION}`;

/** Most recent edit_history rows kept, so repeated edits cannot fill localStorage. */
export const EDIT_HISTORY_LIMIT = 200;

const ROW_TIMESTAMPS = { onInsert: ["created_at", "updated_at"], onUpdate: ["updated_at"] };

/**
 * Timestamp columns per table: filled with now() on insert when absent (column
 * defaults) and overwritten on update (updated_at triggers, or the edge
 * function's explicit updated_at for dashboard_sections). Keyed by every table,
 * so it doubles as the table list.
 */
const TIMESTAMPS: Record<TableName, { onInsert: string[]; onUpdate: string[] }> = {
  psa_readings: ROW_TIMESTAMPS,
  care_team_members: ROW_TIMESTAMPS,
  medication_items: ROW_TIMESTAMPS,
  kpi_cards: ROW_TIMESTAMPS,
  plan_items: ROW_TIMESTAMPS,
  lab_results: ROW_TIMESTAMPS,
  dashboard_sections: { onInsert: ["updated_at"], onUpdate: ["updated_at"] },
  documents: { onInsert: ["uploaded_at"], onUpdate: [] },
  edit_history: { onInsert: ["changed_at"], onUpdate: [] },
  chat_sessions: { onInsert: ["created_at", "last_message_at"], onUpdate: [] },
  chat_messages: { onInsert: ["created_at"], onUpdate: [] },
  medical_cache: { onInsert: ["last_synced_at"], onUpdate: [] },
};

const TABLES = Object.keys(TIMESTAMPS) as TableName[];

/** Tables with the log_edit_history trigger: INSERT, UPDATE and DELETE, record_id = id. */
const AUDITED_BY_ID = new Set<TableName>([
  "psa_readings",
  "care_team_members",
  "medication_items",
  "kpi_cards",
  "plan_items",
]);
// dashboard_sections has log_edit_history_sections instead: UPDATE only, record_id = key.

const primaryKey = (table: TableName) => (table === "dashboard_sections" ? "key" : "id");

type Listener = { cb: () => void };

/** The persisted blob. `seeded_on` is the local day the seed dates are relative to. */
type StoredDb = { version: number; seeded_on: string; tables: SeedData };

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class DemoDb {
  private state: SeedData;
  /** Local `YYYY-MM-DD` the stored dates are anchored to. */
  private seededOn: string;
  private listeners = new Map<TableName, Set<Listener>>();

  /**
   * @param seedFactory builds the seed relative to the given day
   * @param clock the current time; injectable so tests can move "today"
   */
  constructor(
    private readonly seedFactory: (today: Date) => SeedData,
    private readonly storage: DemoStorage | null,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.seededOn = this.todayIso();
    this.dropOldVersions();
    this.state = this.load() ?? seedFactory(this.clock());
  }

  all(table: TableName): Row[] {
    return structuredClone(this.rows(table));
  }

  upsert(table: TableName, row: Row): Row {
    const pk = primaryKey(table);
    if (pk === "key" && typeof row.key !== "string") {
      throw new Error("dashboard_sections rows need a string key");
    }
    const rows = this.rows(table);
    const now = this.clock().toISOString();
    const index = row[pk] == null ? -1 : rows.findIndex((r) => r[pk] === row[pk]);

    let stored: Row;
    if (index >= 0) {
      const old = rows[index];
      stored = { ...old, ...structuredClone(row) };
      for (const col of TIMESTAMPS[table].onUpdate) stored[col] = now;
      rows[index] = stored;
      this.audit(table, "UPDATE", old, stored, now);
    } else {
      stored = structuredClone(row);
      if (pk === "id" && stored.id == null) stored.id = crypto.randomUUID();
      for (const col of TIMESTAMPS[table].onInsert) stored[col] ??= now;
      rows.push(stored);
      this.audit(table, "INSERT", null, stored, now);
    }

    this.commit(table);
    return structuredClone(stored);
  }

  remove(table: TableName, id: string): void {
    const pk = primaryKey(table);
    const rows = this.rows(table);
    const index = rows.findIndex((r) => r[pk] === id);
    if (index < 0) return;
    const [old] = rows.splice(index, 1);
    this.audit(table, "DELETE", old, null, this.clock().toISOString());
    this.commit(table);
  }

  subscribe(table: TableName, cb: () => void): () => void {
    const listener: Listener = { cb };
    let set = this.listeners.get(table);
    if (!set) this.listeners.set(table, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  reset(): void {
    this.seededOn = this.todayIso();
    this.state = this.seedFactory(this.clock());
    try {
      this.storage?.removeItem(DEMO_DB_STORAGE_KEY);
    } catch {
      // Storage unavailable: the in-memory reset still applies.
    }
    for (const table of this.listeners.keys()) this.notify(table);
  }

  private rows(table: TableName): Row[] {
    return this.state[table] as unknown as Row[];
  }

  private todayIso(): string {
    return isoDaysFromToday(0, this.clock());
  }

  /**
   * Returns the stored state moved to today, or null when it is absent, unparsable, another
   * version, or missing its anchor day.
   */
  private load(): SeedData | null {
    let stored: SeedData;
    let seededOn: string;
    try {
      const raw = this.storage?.getItem(DEMO_DB_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Record<keyof StoredDb, unknown>>;
      if (parsed?.version !== SEED_VERSION || typeof parsed.tables !== "object" || !parsed.tables)
        return null;
      if (typeof parsed.seeded_on !== "string" || !ISO_DAY_RE.test(parsed.seeded_on)) return null;
      const tables = parsed.tables as Record<string, unknown>;
      if (!TABLES.every((t) => Array.isArray(tables[t]))) return null;
      stored = tables as unknown as SeedData;
      seededOn = parsed.seeded_on;
    } catch {
      return null;
    }
    const today = this.todayIso();
    if (seededOn === today) return stored;
    // A returning visitor: move every date by the days since seeding, keeping their edits.
    const moved = reanchorTables(
      stored,
      this.seedFactory(dateFromIso(seededOn)),
      this.seedFactory(this.clock()),
      daysBetween(seededOn, today),
      primaryKey,
    );
    this.persist(moved);
    return moved;
  }

  /** Earlier seed versions are never read again, so their stored copies only take up space. */
  private dropOldVersions(): void {
    try {
      for (let v = 1; v < SEED_VERSION; v++) this.storage?.removeItem(`care_demo_db_v${v}`);
    } catch {
      // Storage blocked: nothing to clean up.
    }
  }

  private persist(tables: SeedData): void {
    const blob: StoredDb = { version: SEED_VERSION, seeded_on: this.seededOn, tables };
    try {
      this.storage?.setItem(DEMO_DB_STORAGE_KEY, JSON.stringify(blob));
    } catch {
      // Quota exceeded or storage blocked: keep working in memory for this visit.
    }
  }

  private commit(table: TableName): void {
    this.persist(this.state);
    this.notify(table);
  }

  private notify(table: TableName): void {
    for (const listener of [...(this.listeners.get(table) ?? [])]) listener.cb();
  }

  /** Appends the edit_history row the SQL triggers would write for this change. */
  private audit(
    table: TableName,
    operation: Operation,
    oldRow: Row | null,
    newRow: Row | null,
    now: string,
  ): void {
    let recordId: string;
    if (table === "dashboard_sections") {
      if (operation !== "UPDATE") return;
      recordId = String(newRow!.key);
    } else if (AUDITED_BY_ID.has(table)) {
      recordId = String((newRow ?? oldRow)!.id);
    } else {
      return;
    }
    const log = this.rows("edit_history");
    log.push({
      id: crypto.randomUUID(),
      table_name: table,
      record_id: recordId,
      operation,
      old_data: oldRow && structuredClone(oldRow),
      new_data: newRow && structuredClone(newRow),
      changed_at: now,
    });
    // The seed log is chronological and new rows are stamped now(), so the oldest are first.
    if (log.length > EDIT_HISTORY_LIMIT) log.splice(0, log.length - EDIT_HISTORY_LIMIT);
  }
}
