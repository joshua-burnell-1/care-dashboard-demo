import { describe, it, expect, vi } from "vitest";
import { DemoDb } from "./db";
import { createMockSupabase } from "./mockSupabase";
import { buildSeed, type SeedData } from "./seed";
import type { DemoFunctionRouter } from "./functions";

const okRouter: DemoFunctionRouter = async () => ({ ok: true });

/** A seed with every table empty except the given overrides. */
const TABLES = Object.keys(buildSeed());
function seedWith(overrides: Partial<SeedData>): () => SeedData {
  return () =>
    ({
      ...Object.fromEntries(TABLES.map((t) => [t, []])),
      ...structuredClone(overrides),
    }) as SeedData;
}

function psa(id: string, date: string, created_at: string, value: number | null = 0.1) {
  return {
    id,
    date,
    created_at,
    updated_at: created_at,
    value,
    unit: "ng/mL",
    phase: "post-rad",
    note: "",
    sort_index: 0,
  };
}

describe("createMockSupabase", () => {
  it("orders by date then created_at", async () => {
    const db = new DemoDb(
      seedWith({
        psa_readings: [
          psa("c", "2026-02-01", "2026-02-01T10:00:00Z"),
          psa("b", "2026-01-01", "2026-01-02T00:00:00Z"),
          psa("a", "2026-01-01", "2026-01-01T00:00:00Z"),
        ],
      }),
      null,
    );
    const sb = createMockSupabase(db, okRouter);

    const asc = await sb
      .from("psa_readings")
      .select("*")
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });
    expect(asc.error).toBeNull();
    expect(asc.data!.map((r) => r.id)).toEqual(["a", "b", "c"]);

    const desc = await sb
      .from("psa_readings")
      .select("*")
      .order("date", { ascending: false })
      .limit(2);
    expect(desc.data!.map((r) => r.id)).toEqual(["c", "b"]);
  });

  it("puts nulls last by default and first on request", async () => {
    const db = new DemoDb(
      seedWith({
        psa_readings: [
          psa("n", "2026-01-01", "2026-01-01T00:00:00Z", null),
          psa("lo", "2026-01-02", "2026-01-02T00:00:00Z", 0.1),
          psa("hi", "2026-01-03", "2026-01-03T00:00:00Z", 0.3),
        ],
      }),
      null,
    );
    const sb = createMockSupabase(db, okRouter);
    const last = await sb.from("psa_readings").select("*").order("value", { ascending: false });
    expect(last.data!.map((r) => r.id)).toEqual(["hi", "lo", "n"]);
    const first = await sb.from("psa_readings").select("*").order("value", { nullsFirst: true });
    expect(first.data!.map((r) => r.id)).toEqual(["n", "lo", "hi"]);
  });

  it("filters with eq and in", async () => {
    const db = new DemoDb(seedWith({}), null);
    const sb = createMockSupabase(db, okRouter);
    db.upsert("dashboard_sections", { key: "a", content: 1 });
    db.upsert("dashboard_sections", { key: "b", content: 2 });
    db.upsert("dashboard_sections", { key: "c", content: 3 });

    const eq = await sb.from("dashboard_sections").select("*").eq("key", "b");
    expect(eq.data!.map((r) => r.content)).toEqual([2]);

    const inn = await sb.from("dashboard_sections").select("*").in("key", ["a", "c", "zzz"]);
    expect(inn.data!.map((r) => r.key).sort()).toEqual(["a", "c"]);
  });

  it("maybeSingle returns the row, or null when no row", async () => {
    const db = new DemoDb(buildSeed, null);
    const sb = createMockSupabase(db, okRouter);

    const hit = await sb.from("medical_cache").select("*").eq("id", 1).maybeSingle();
    expect(hit.error).toBeNull();
    expect(hit.data).toMatchObject({ id: 1 });

    const miss = await sb.from("dashboard_sections").select("*").eq("key", "nope").maybeSingle();
    expect(miss).toEqual({ data: null, error: null });
  });

  it("reads the table when awaited, not when built", async () => {
    const db = new DemoDb(seedWith({}), null);
    const sb = createMockSupabase(db, okRouter);
    const query = sb.from("kpi_cards").select("*");
    db.upsert("kpi_cards", { label: "late" });
    expect((await query).data).toHaveLength(1);
  });

  it("realtime callback fires after functions.invoke writes", async () => {
    const db = new DemoDb(seedWith({}), null);
    const router: DemoFunctionRouter = async (name, body) => {
      const item = db.upsert("psa_readings", body.item as Record<string, unknown>);
      return { ok: true, name, item };
    };
    const sb = createMockSupabase(db, router);
    const cb = vi.fn();
    sb.channel("psa_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "psa_readings" }, cb)
      .subscribe();

    const { data, error } = await sb.functions.invoke("dashboard-data", {
      body: { action: "upsert-psa", item: { date: "2026-03-01", value: 0.2 } },
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: true, name: "dashboard-data" });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("passes body and headers to the router", async () => {
    const router = vi.fn<DemoFunctionRouter>(async () => ({ ok: true }));
    const sb = createMockSupabase(new DemoDb(seedWith({}), null), router);
    await sb.functions.invoke("chat", { body: { q: 1 }, headers: { "x-test": "y" } });
    expect(router).toHaveBeenCalledWith("chat", { q: 1 }, { "x-test": "y" });
  });

  it("removeChannel stops callbacks", async () => {
    const db = new DemoDb(seedWith({}), null);
    const sb = createMockSupabase(db, okRouter);
    const cb = vi.fn();
    const channel = sb.channel("kpi_rt");
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "kpi_cards" }, cb)
      .subscribe();

    db.upsert("kpi_cards", { label: "one" });
    expect(cb).toHaveBeenCalledTimes(1);

    await sb.removeChannel(channel);
    db.upsert("kpi_cards", { label: "two" });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("invoke error becomes { error: { message } }", async () => {
    const router: DemoFunctionRouter = async () => {
      throw new Error("boom");
    };
    const sb = createMockSupabase(new DemoDb(seedWith({}), null), router);
    const res = await sb.functions.invoke("dashboard-data", { body: {} });
    expect(res.data).toBeNull();
    expect(res.error).toEqual({ message: "boom" });
  });

  it("auth always has a demo session and accepts any password", async () => {
    const sb = createMockSupabase(new DemoDb(seedWith({}), null), okRouter);
    const { data } = await sb.auth.getSession();
    expect(data.session?.user.id).toBe("demo");
    expect(
      (await sb.auth.signInWithPassword({ email: "x@y.z", password: "anything" })).error,
    ).toBeNull();
    expect((await sb.auth.signOut()).error).toBeNull();
  });
});
