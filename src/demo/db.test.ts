import { describe, it, expect, vi, beforeEach } from "vitest";
import { DemoDb, EDIT_HISTORY_LIMIT } from "./db";
import { buildSeed, SEED_VERSION } from "./seed";

const KEY = `care_demo_db_v${SEED_VERSION}`;
const TODAY = new Date("2026-10-14T12:00:00");
const seed = () => buildSeed(TODAY);
const SEEDED_PSA = seed().psa_readings.length;

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

let storage: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  storage = memoryStorage();
});

describe("DemoDb", () => {
  it("seeds on first load", () => {
    const db = new DemoDb(seed, storage);
    expect(db.all("psa_readings").length).toBe(buildSeed().psa_readings.length);
  });

  it("returns copies, not live rows", () => {
    const db = new DemoDb(seed, storage);
    db.all("psa_readings")[0].value = 999;
    expect(db.all("psa_readings")[0].value).not.toBe(999);
  });

  it("persists writes across instances", () => {
    const db1 = new DemoDb(seed, storage);
    const row = db1.upsert("kpi_cards", { label: "Demo KPI", value: "42" });
    expect(typeof row.id).toBe("string");
    expect(row.created_at).toBeTruthy();
    expect(row.updated_at).toBeTruthy();

    const db2 = new DemoDb(seed, storage);
    expect(db2.all("kpi_cards").find((k) => k.id === row.id)?.label).toBe("Demo KPI");
  });

  it("removes copies stored by earlier seed versions", () => {
    storage.setItem("care_demo_db_v1", "{}");
    storage.setItem("care_demo_db_v2", "{}");
    new DemoDb(seed, storage);
    expect(storage.getItem("care_demo_db_v1")).toBeNull();
    expect(storage.getItem("care_demo_db_v2")).toBeNull();
  });

  it("works without storage", () => {
    const db = new DemoDb(seed, null);
    db.upsert("kpi_cards", { label: "x" });
    expect(db.all("kpi_cards").some((k) => k.label === "x")).toBe(true);
  });

  it("reseeds on corrupt JSON", () => {
    storage.setItem(KEY, "{bad");
    let db!: DemoDb;
    expect(() => (db = new DemoDb(seed, storage))).not.toThrow();
    expect(db.all("psa_readings").length).toBe(SEEDED_PSA);
  });

  it("reseeds a stored blob that has no seeded_on anchor", () => {
    const stale = { ...seed(), psa_readings: [] };
    storage.setItem(KEY, JSON.stringify({ version: SEED_VERSION, tables: stale }));
    expect(new DemoDb(seed, storage).all("psa_readings").length).toBe(SEEDED_PSA);
  });

  it("stores the local day it was seeded on", () => {
    const db = new DemoDb(seed, storage, () => TODAY);
    db.upsert("kpi_cards", { label: "x" });
    expect(JSON.parse(storage.getItem(KEY)!).seeded_on).toBe("2026-10-14");
  });

  it("re-anchors a blob seeded 40 days ago: no overdue plan items, edits kept", () => {
    const seededOn = new Date("2026-09-04T12:00:00");
    const old = new DemoDb(buildSeed, storage, () => seededOn);
    const checkIn = old.all("plan_items")[1];
    old.upsert("plan_items", { id: checkIn.id, title: "Check-in, moved by me" });

    const db = new DemoDb(buildSeed, storage, () => TODAY);
    const todayIso = "2026-10-14";
    const fresh = buildSeed(TODAY);
    const plan = db.all("plan_items");
    const overdue = plan.filter(
      (p) =>
        typeof p.event_date === "string" &&
        p.event_date < todayIso &&
        ["Scheduled", "In flight"].includes(p.status as string),
    );
    expect(overdue).toEqual([]);
    expect(plan.filter((p) => (p.event_date as string) > todayIso)).toHaveLength(3);
    expect(plan[1]).toMatchObject({
      title: "Check-in, moved by me",
      event_date: fresh.plan_items[1].event_date,
    });
    expect(db.all("kpi_cards")).toEqual(fresh.kpi_cards);
    expect(db.all("psa_readings")).toEqual(fresh.psa_readings);
    const edit = db.all("edit_history").at(-1)!;
    expect((edit.new_data as Record<string, unknown>).event_date).toBe(
      fresh.plan_items[1].event_date,
    );
    expect(JSON.parse(storage.getItem(KEY)!).seeded_on).toBe(todayIso);
  });

  it("reseeds on version mismatch", () => {
    const stale = { ...seed(), psa_readings: [] };
    storage.setItem(KEY, JSON.stringify({ version: 0, tables: stale }));
    const db = new DemoDb(seed, storage);
    expect(db.all("psa_readings").length).toBe(SEEDED_PSA);
  });

  it("updates in place, keeping created_at and unspecified columns", () => {
    const db = new DemoDb(seed, storage);
    const before = db.all("psa_readings")[0];
    const after = db.upsert("psa_readings", { id: before.id, value: 0.5 });
    expect(db.all("psa_readings").length).toBe(SEEDED_PSA);
    expect(after.value).toBe(0.5);
    expect(after.date).toBe(before.date);
    expect(after.created_at).toBe(before.created_at);
  });

  it("logs edit history for audited tables", () => {
    const db = new DemoDb(seed, storage);
    const before = db.all("psa_readings")[0];
    db.upsert("psa_readings", { id: before.id, value: 0.5 });
    const last = db.all("edit_history").at(-1)!;
    expect(last).toMatchObject({
      operation: "UPDATE",
      table_name: "psa_readings",
      record_id: before.id,
    });
    expect((last.old_data as Record<string, unknown>).value).toBe(before.value);
    expect((last.new_data as Record<string, unknown>).value).toBe(0.5);
    expect(typeof last.changed_at).toBe("string");
  });

  it("logs INSERT and DELETE on audited tables", () => {
    const db = new DemoDb(seed, storage);
    const row = db.upsert("plan_items", { title: "New visit" });
    expect(db.all("edit_history").at(-1)).toMatchObject({
      operation: "INSERT",
      table_name: "plan_items",
      record_id: row.id,
      old_data: null,
    });
    db.remove("plan_items", row.id as string);
    expect(db.all("edit_history").at(-1)).toMatchObject({
      operation: "DELETE",
      table_name: "plan_items",
      record_id: row.id,
      new_data: null,
    });
    expect(db.all("plan_items").some((p) => p.id === row.id)).toBe(false);
  });

  it("logs dashboard_sections updates only, keyed by key", () => {
    const db = new DemoDb(seed, storage);
    const count = () => db.all("edit_history").length;
    const n0 = count();

    db.upsert("dashboard_sections", { key: "summary", content: ["changed"] });
    expect(count()).toBe(n0 + 1);
    expect(db.all("edit_history").at(-1)).toMatchObject({
      operation: "UPDATE",
      table_name: "dashboard_sections",
      record_id: "summary",
    });
    expect(db.all("dashboard_sections").find((s) => s.key === "summary")?.content).toEqual([
      "changed",
    ]);

    db.upsert("dashboard_sections", { key: "brand_new", content: [] });
    expect(db.all("dashboard_sections").find((s) => s.key === "brand_new")).not.toHaveProperty(
      "id",
    );
    db.remove("dashboard_sections", "brand_new");
    expect(count()).toBe(n0 + 1);
  });

  it("keeps only the most recent edit_history rows", () => {
    const db = new DemoDb(seed, storage);
    const ids: unknown[] = [];
    for (let i = 0; i < EDIT_HISTORY_LIMIT + 50; i++) {
      ids.push(db.upsert("kpi_cards", { label: `KPI ${i}`, value: String(i) }).id);
    }
    const log = db.all("edit_history");
    expect(EDIT_HISTORY_LIMIT).toBe(200);
    expect(log).toHaveLength(EDIT_HISTORY_LIMIT);
    expect(log.map((r) => r.record_id)).toEqual(ids.slice(-EDIT_HISTORY_LIMIT));
    expect(new DemoDb(seed, storage).all("edit_history")).toHaveLength(EDIT_HISTORY_LIMIT);
  });

  it("survives storage whose every call throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    let db!: DemoDb;
    expect(() => (db = new DemoDb(seed, broken))).not.toThrow();
    expect(db.all("psa_readings")).toHaveLength(SEEDED_PSA);

    let row!: Record<string, unknown>;
    expect(() => (row = db.upsert("kpi_cards", { label: "kept in memory" }))).not.toThrow();
    expect(db.all("kpi_cards").some((k) => k.id === row.id)).toBe(true);
    expect(() => db.remove("kpi_cards", row.id as string)).not.toThrow();
    expect(() => db.reset()).not.toThrow();
  });

  it("does not log unaudited tables", () => {
    const db = new DemoDb(seed, storage);
    const n0 = db.all("edit_history").length;
    db.upsert("lab_results", { metric: "Hemoglobin", value_numeric: 14 });
    expect(db.all("edit_history").length).toBe(n0);
  });

  it("notifies subscribers of the written table only", () => {
    const db = new DemoDb(seed, storage);
    const psa = vi.fn();
    const kpi = vi.fn();
    db.subscribe("psa_readings", psa);
    const unsub = db.subscribe("kpi_cards", kpi);

    db.upsert("kpi_cards", { label: "x" });
    expect(kpi).toHaveBeenCalledTimes(1);
    expect(psa).not.toHaveBeenCalled();

    unsub();
    db.upsert("kpi_cards", { label: "y" });
    expect(kpi).toHaveBeenCalledTimes(1);
  });

  it("reset restores the seed", () => {
    const db = new DemoDb(seed, storage);
    const sub = vi.fn();
    db.subscribe("psa_readings", sub);
    db.remove("psa_readings", db.all("psa_readings")[0].id as string);
    expect(db.all("psa_readings").length).toBe(SEEDED_PSA - 1);

    db.reset();
    expect(db.all("psa_readings").length).toBe(SEEDED_PSA);
    expect(sub).toHaveBeenCalledTimes(2);
    expect(storage.getItem(KEY)).toBeNull();
    expect(new DemoDb(seed, storage).all("psa_readings").length).toBe(SEEDED_PSA);
  });
});
