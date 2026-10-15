import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoDb } from "../db";
import { buildSeed } from "../seed";
import { SAMPLE_DOCUMENTS } from "../samples";
import { createDemoFunctions, type DemoFunctionRouter } from "./index";

const { extract } = vi.hoisted(() => ({ extract: vi.fn() }));
vi.mock("../extract", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../extract")>()),
  extractSuggestedUpdates: extract,
}));

const NO_SUGGESTIONS = {
  psa_readings: [],
  medications: [],
  care_team: [],
  plan_items: [],
  lab_results: [],
};
const NO_KEY_HINT = "Add an API key in chat to extract updates from your own files.";

const TODAY = new Date("2026-10-14T12:00:00");

let db: DemoDb;
let call: DemoFunctionRouter;
let chat: ReturnType<typeof vi.fn>;

beforeEach(() => {
  db = new DemoDb(() => buildSeed(TODAY), null);
  chat = vi.fn(async () => ({ text: "hello" }));
  call = createDemoFunctions(db, chat);
});

const dash = (body: Record<string, unknown>) => call("dashboard-data", body);

describe("router", () => {
  it("throws for an unknown function", async () => {
    await expect(call("nope", {})).rejects.toThrow("Unknown function: nope");
    await expect(call("toString", {})).rejects.toThrow("Unknown function: toString");
  });

  it("passes chat bodies to the chat handler", async () => {
    await expect(call("chat", { messages: [] })).resolves.toEqual({ text: "hello" });
    expect(chat).toHaveBeenCalledWith({ messages: [] });
  });
});

describe("dashboard-data", () => {
  it("round-trips upsert-psa and delete-psa", async () => {
    const before = db.all("psa_readings").length;
    const res = (await dash({
      action: "upsert-psa",
      item: { date: "2026-10-01", value: 0.31, phase: "post-rad", note: " new " },
    })) as { ok: boolean; item: { id: string; note: string; unit: string } };
    expect(res.ok).toBe(true);
    expect(res.item).toMatchObject({ note: "new", unit: "ng/mL" });
    expect(db.all("psa_readings")).toHaveLength(before + 1);

    expect(await dash({ action: "delete-psa", id: res.item.id })).toEqual({ ok: true });
    expect(db.all("psa_readings")).toHaveLength(before);
  });

  it("updates the existing PSA reading when the date matches", async () => {
    const existing = db.all("psa_readings")[0];
    const before = db.all("psa_readings").length;
    const res = (await dash({
      action: "upsert-psa",
      item: { date: existing.date, value: 9.9 },
    })) as { item: { id: string; value: number } };
    expect(res.item).toMatchObject({ id: existing.id, value: 9.9 });
    expect(db.all("psa_readings")).toHaveLength(before);
  });

  it("validates the PSA date and phase", async () => {
    expect(await dash({ action: "upsert-psa", item: { date: "10/01/2026" } })).toEqual({
      ok: false,
      error: "Invalid date",
    });
    expect(await dash({ action: "upsert-psa", item: { date: "2026-10-01", phase: "x" } })).toEqual({
      ok: false,
      error: "Invalid phase",
    });
    expect(await dash({ action: "upsert-psa" })).toEqual({ ok: false, error: "Missing item" });
  });

  it("validates KPI tone and requires a label", async () => {
    expect(
      await dash({ action: "upsert-kpi", item: { label: "A", value: "1", tone: "blue" } }),
    ).toEqual({ ok: false, error: "Invalid tone" });
    expect(await dash({ action: "upsert-kpi", item: { value: "1" } })).toEqual({
      ok: false,
      error: "Invalid label",
    });
  });

  it("round-trips care team and medication rows", async () => {
    const team = (await dash({
      action: "upsert-care-team",
      item: { name: "Dr. Test", role: "Tester" },
    })) as { item: { id: string } };
    expect(db.all("care_team_members").some((m) => m.id === team.item.id)).toBe(true);
    await dash({ action: "delete-care-team", id: team.item.id });
    expect(db.all("care_team_members").some((m) => m.id === team.item.id)).toBe(false);

    const med = (await dash({ action: "upsert-medication", item: { item: "Vitamin D" } })) as {
      item: { id: string };
    };
    expect(db.all("medication_items").some((m) => m.id === med.item.id)).toBe(true);
    await dash({ action: "delete-medication", id: med.item.id });
    expect(db.all("medication_items").some((m) => m.id === med.item.id)).toBe(false);
  });

  it("splits lab values into numeric and text, and dedupes by date, metric and value", async () => {
    const first = (await dash({
      action: "upsert-lab-result",
      item: { date: "2026-09-01", metric: "Test marker", value: "4.5", flag: "high" },
    })) as { item: { id: string; value_numeric: number; flag: string } };
    expect(first.item).toMatchObject({ value_numeric: 4.5, flag: "HIGH" });

    const again = (await dash({
      action: "upsert-lab-result",
      item: { date: "2026-09-01", metric: "Test marker", value: 4.5, note: "edited" },
    })) as { item: { id: string } };
    expect(again.item.id).toBe(first.item.id);

    const text = (await dash({
      action: "upsert-lab-result",
      item: { metric: "Culture", value: "negative" },
    })) as { item: { value_numeric: null; value_text: string; source: string } };
    expect(text.item).toMatchObject({
      value_numeric: null,
      value_text: "negative",
      source: "upload",
    });

    await dash({ action: "delete-lab-result", id: first.item.id });
    expect(db.all("lab_results").some((r) => r.id === first.item.id)).toBe(false);
  });

  it("deletes a KPI card", async () => {
    const kpi = (await dash({
      action: "upsert-kpi",
      item: { label: "L", value: "V", tone: "ok" },
    })) as { item: { id: string } };
    expect(await dash({ action: "delete-kpi", id: kpi.item.id })).toEqual({ ok: true });
    expect(await dash({ action: "delete-kpi" })).toEqual({ ok: false, error: "Missing id" });
  });

  it("update-section writes content", async () => {
    const key = db.all("dashboard_sections")[0].key as string;
    expect(await dash({ action: "update-section", key, content: ["a", "b"] })).toEqual({
      ok: true,
    });
    expect(db.all("dashboard_sections").find((s) => s.key === key)?.content).toEqual(["a", "b"]);
    expect(await dash({ action: "update-section", key })).toEqual({
      ok: false,
      error: "Missing key or content",
    });
  });

  it("rollback of an UPDATE restores the old value", async () => {
    const row = db.all("kpi_cards")[0];
    await dash({
      action: "upsert-kpi",
      item: { id: row.id, label: row.label, value: "changed", tone: row.tone },
    });
    const entry = db
      .all("edit_history")
      .filter((e) => e.operation === "UPDATE" && e.record_id === row.id)
      .pop()!;

    const listener = vi.fn();
    db.subscribe("kpi_cards", listener);
    expect(await dash({ action: "rollback", history_id: entry.id })).toEqual({ ok: true });
    expect(db.all("kpi_cards").find((r) => r.id === row.id)?.value).toBe(row.value);
    expect(listener).toHaveBeenCalled();
  });

  it("rollback of an INSERT deletes the row", async () => {
    const created = (await dash({
      action: "upsert-kpi",
      item: { label: "Temp", value: "1", tone: "ok" },
    })) as { item: { id: string } };
    const entry = db
      .all("edit_history")
      .find((e) => e.operation === "INSERT" && e.record_id === created.item.id)!;

    expect(await dash({ action: "rollback", history_id: entry.id })).toEqual({ ok: true });
    expect(db.all("kpi_cards").some((r) => r.id === created.item.id)).toBe(false);
  });

  it("rollback of a DELETE restores the row", async () => {
    const row = db.all("medication_items")[0];
    await dash({ action: "delete-medication", id: row.id });
    const entry = db
      .all("edit_history")
      .find((e) => e.operation === "DELETE" && e.record_id === row.id)!;

    expect(await dash({ action: "rollback", history_id: entry.id })).toEqual({ ok: true });
    expect(db.all("medication_items").find((r) => r.id === row.id)).toMatchObject({
      item: row.item,
    });
  });

  it("rollback reports a missing history entry and a missing id", async () => {
    expect(await dash({ action: "rollback" })).toEqual({ ok: false, error: "Missing history_id" });
    expect(await dash({ action: "rollback", history_id: "nope" })).toEqual({
      ok: false,
      error: "History entry not found",
    });
  });

  it("rejects unknown actions", async () => {
    expect(await dash({ action: "explode" })).toEqual({
      ok: false,
      error: "Unknown action: explode",
    });
  });
});

describe("plan-items", () => {
  it("rejects an upsert with a missing title", async () => {
    expect(await call("plan-items", { action: "upsert", item: { body: "x" } })).toEqual({
      ok: false,
      error: "Invalid title",
    });
  });

  it("validates status and date", async () => {
    expect(
      await call("plan-items", { action: "upsert", item: { title: "T", status: "Nope" } }),
    ).toEqual({ ok: false, error: "Invalid status" });
    expect(
      await call("plan-items", { action: "upsert", item: { title: "T", event_date: "tomorrow" } }),
    ).toEqual({ ok: false, error: "Invalid date" });
  });

  it("inserts, updates and deletes", async () => {
    const created = (await call("plan-items", {
      action: "upsert",
      item: { title: "  Follow-up  ", event_date: "2026-11-01" },
    })) as { ok: true; item: { id: string; title: string; status: string } };
    expect(created.item).toMatchObject({ title: "Follow-up", status: "Scheduled" });

    const updated = (await call("plan-items", {
      action: "upsert",
      item: { id: created.item.id, title: "Follow-up", status: "Completed" },
    })) as { item: { id: string; status: string } };
    expect(updated.item).toMatchObject({ id: created.item.id, status: "Completed" });

    expect(await call("plan-items", { action: "delete", id: created.item.id })).toEqual({
      ok: true,
    });
    expect(db.all("plan_items").some((p) => p.id === created.item.id)).toBe(false);
    expect(await call("plan-items", { action: "delete" })).toEqual({
      ok: false,
      error: "Missing id",
    });
  });
});

describe("chat-history", () => {
  const history = (body: Record<string, unknown>) => call("chat-history", body);

  it("creates, saves, reads and deletes a session", async () => {
    const created = (await history({ action: "createSession" })) as {
      ok: true;
      session: { id: string; title: string };
    };
    expect(created.session.title).toBe("New conversation");
    const sid = created.session.id;

    expect(
      await history({
        action: "saveMessages",
        session_id: sid,
        messages: [
          { role: "user", content: "What changed in the latest PSA?" },
          { role: "assistant", content: "It rose slightly." },
        ],
      }),
    ).toEqual({ ok: true });

    const got = (await history({ action: "getMessages", session_id: sid })) as {
      messages: { role: string; content: string }[];
    };
    expect(got.messages.map((m) => m.role)).toEqual(["user", "assistant"]);

    const listed = (await history({ action: "listSessions" })) as {
      sessions: { id: string; title: string }[];
    };
    expect(listed.sessions[0]).toMatchObject({ id: sid, title: "What changed in the latest PSA?" });

    expect(await history({ action: "updateTitle", session_id: sid, title: "Renamed" })).toEqual({
      ok: true,
    });
    expect(db.all("chat_sessions").find((s) => s.id === sid)?.title).toBe("Renamed");

    expect(await history({ action: "deleteSession", session_id: sid })).toEqual({ ok: true });
    expect(db.all("chat_sessions").some((s) => s.id === sid)).toBe(false);
    expect(db.all("chat_messages").some((m) => m.session_id === sid)).toBe(false);
  });

  it("truncates long auto-titles and validates inputs", async () => {
    const { session } = (await history({ action: "createSession" })) as {
      session: { id: string };
    };
    await history({
      action: "saveMessages",
      session_id: session.id,
      messages: [{ role: "user", content: "x".repeat(80) }],
    });
    expect(db.all("chat_sessions").find((s) => s.id === session.id)?.title).toBe(
      `${"x".repeat(60)}…`,
    );

    expect(await history({ action: "getMessages" })).toEqual({
      ok: false,
      error: "Missing session_id",
    });
    expect(await history({ action: "saveMessages", session_id: session.id })).toEqual({
      ok: false,
      error: "Missing session_id or messages",
    });
    expect(await history({ action: "bogus" })).toEqual({
      ok: false,
      error: "Unknown action: bogus",
    });
  });
});

describe("ingest-document", () => {
  const ingest = (body: Record<string, unknown>) => call("ingest-document", body);

  it("reports every health check as passing", async () => {
    const res = (await ingest({ action: "health-check" })) as {
      ok: boolean;
      checks: Record<string, boolean>;
    };
    expect(res.ok).toBe(true);
    expect(Object.keys(res.checks).sort()).toEqual([
      "anthropic_key",
      "app_password",
      "bucket",
      "realtime_documents",
      "realtime_lab_results",
      "service_role",
      "supabase_url",
    ]);
    expect(Object.values(res.checks).every(Boolean)).toBe(true);
  });

  it("runs upload-url, process and delete, indexing the demo_text", async () => {
    const before = db.all("documents").length;
    const url = (await ingest({
      action: "upload-url",
      filename: "notes.txt",
      mime_type: "text/plain",
      size_bytes: 12,
    })) as { ok: true; document_id: string; upload_url: string };
    expect(url.upload_url).toBe(`demo://upload/${url.document_id}`);
    expect(db.all("documents").find((d) => d.id === url.document_id)?.status).toBe("pending");

    const text = "PSA 0.31 ng/mL on a fictional date.";
    const processed = await ingest({
      action: "process",
      document_id: url.document_id,
      demo_text: text,
    });
    expect(processed).toEqual({
      ok: true,
      extracted_chars: text.length,
      suggested_updates: NO_SUGGESTIONS,
      hint: NO_KEY_HINT,
    });
    expect(db.all("documents").find((d) => d.id === url.document_id)).toMatchObject({
      status: "indexed",
      extracted_chars: text.length,
      extracted_text: text,
    });
    const cache = db.all("medical_cache")[0];
    expect(String(cache.context)).toContain(`### notes.txt\n${text}`);
    expect((cache.sources as { id: string }[]).some((s) => s.id === url.document_id)).toBe(true);

    expect(await ingest({ action: "delete", document_id: url.document_id })).toEqual({ ok: true });
    expect(db.all("documents")).toHaveLength(before);
    const after = db.all("medical_cache")[0];
    expect(String(after.context)).not.toContain("notes.txt");
    expect((after.sources as { id: string }[]).some((s) => s.id === url.document_id)).toBe(false);
  });

  it("indexes a binary upload with no text", async () => {
    const url = (await ingest({
      action: "upload-url",
      filename: "scan.pdf",
      mime_type: "application/pdf",
    })) as { document_id: string };
    expect(await ingest({ action: "process", document_id: url.document_id })).toEqual({
      ok: true,
      extracted_chars: 0,
      suggested_updates: NO_SUGGESTIONS,
      hint: NO_KEY_HINT,
    });
  });

  it("returns structured errors", async () => {
    expect(
      await ingest({ action: "upload-url", filename: "a.exe", mime_type: "x/y" }),
    ).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_TYPE" },
    });
    expect(await ingest({ action: "upload-url" })).toMatchObject({
      error: { code: "MISSING_FIELDS" },
    });
    expect(
      await ingest({
        action: "upload-url",
        filename: "big.pdf",
        mime_type: "application/pdf",
        size_bytes: 21 * 1024 * 1024,
      }),
    ).toMatchObject({ error: { code: "FILE_TOO_LARGE" } });
    expect(await ingest({ action: "process", document_id: "nope" })).toMatchObject({
      error: { code: "DOCUMENT_NOT_FOUND" },
    });
    expect(await ingest({ action: "zip" })).toMatchObject({ error: { code: "UNKNOWN_ACTION" } });
  });

  describe("suggested updates", () => {
    beforeEach(() => {
      extract.mockReset();
    });
    afterEach(() => vi.unstubAllGlobals());

    const stubKey = (key: string | null) => vi.stubGlobal("sessionStorage", { getItem: () => key });

    async function upload(filename: string, mime_type: string) {
      const url = (await ingest({ action: "upload-url", filename, mime_type })) as {
        document_id: string;
      };
      return url.document_id;
    }

    it("sample process returns precomputed updates without a key", async () => {
      stubKey(null);
      const sample = SAMPLE_DOCUMENTS[0];
      const document_id = await upload(sample.filename, sample.mimeType);
      const res = (await ingest({
        action: "process",
        document_id,
        sample_id: sample.id,
        demo_text: "lab text",
      })) as { ok: boolean; suggested_updates: unknown; hint?: string };
      expect(res.ok).toBe(true);
      expect(res.suggested_updates).toEqual(sample.precomputed);
      expect(res.hint).toBeUndefined();
      expect(extract).not.toHaveBeenCalled();
      expect(db.all("documents").find((d) => d.id === document_id)?.extracted_text).toBe(
        "lab text",
      );
    });

    it("own-file process without a key returns no suggestions and the hint", async () => {
      stubKey(null);
      const document_id = await upload("mine.txt", "text/plain");
      const res = await ingest({ action: "process", document_id, demo_text: "Sodium 140" });
      expect(res).toMatchObject({
        ok: true,
        suggested_updates: NO_SUGGESTIONS,
        hint: NO_KEY_HINT,
      });
      expect(extract).not.toHaveBeenCalled();
    });

    it("own-file process with a key extracts from the text, telling it what already exists", async () => {
      stubKey("sk-test");
      const updates = { ...NO_SUGGESTIONS, lab_results: [{ metric: "Sodium", value: 140 }] };
      extract.mockResolvedValue(updates);
      const document_id = await upload("mine.txt", "text/plain");
      const res = (await ingest({ action: "process", document_id, demo_text: "Sodium 140" })) as {
        suggested_updates: unknown;
        hint?: string;
      };
      expect(res.suggested_updates).toEqual(updates);
      expect(res.hint).toBeUndefined();
      const [text, opts] = extract.mock.calls[0];
      expect(text).toBe("Sodium 140");
      expect(opts.apiKey).toBe("sk-test");
      expect(opts.existing.labs).toContain("Hemoglobin");
      expect(opts.existing.medications).toContain("Vitamin D3");
    });

    it("keeps the document indexed and explains when extraction fails", async () => {
      stubKey("sk-test");
      extract.mockRejectedValue(new Error("That API key was rejected."));
      const document_id = await upload("mine.txt", "text/plain");
      const res = await ingest({ action: "process", document_id, demo_text: "Sodium 140" });
      expect(res).toMatchObject({
        ok: true,
        suggested_updates: NO_SUGGESTIONS,
        hint: "That API key was rejected.",
      });
      expect(db.all("documents").find((d) => d.id === document_id)?.status).toBe("indexed");
    });

    it("forgets a rejected key, but keeps it after other extraction errors", async () => {
      const { ExtractionError } = await import("../extract");
      const removeItem = vi.fn();
      vi.stubGlobal("sessionStorage", { getItem: () => "sk-bad", removeItem });
      const document_id = await upload("mine.txt", "text/plain");

      extract.mockRejectedValueOnce(new ExtractionError("Rate limited.", "RATE_LIMIT"));
      await ingest({ action: "process", document_id, demo_text: "Sodium 140" });
      expect(removeItem).not.toHaveBeenCalled();

      extract.mockRejectedValueOnce(new ExtractionError("That API key was rejected.", "BAD_KEY"));
      await ingest({ action: "process", document_id, demo_text: "Sodium 140" });
      expect(removeItem).toHaveBeenCalledWith("care_demo_anthropic_key");
    });

    it("cuts own-file text at the shared demo limit", async () => {
      stubKey(null);
      const { DEMO_DOCUMENT_TEXT_LIMIT } = await import("../limits");
      const document_id = await upload("big.txt", "text/plain");
      await ingest({
        action: "process",
        document_id,
        demo_text: "x".repeat(DEMO_DOCUMENT_TEXT_LIMIT + 10),
      });
      const doc = db.all("documents").find((d) => d.id === document_id)!;
      expect(doc.extracted_chars).toBe(DEMO_DOCUMENT_TEXT_LIMIT);
    });

    it("sample lab values do not duplicate seeded rows, so accepting them adds rows", async () => {
      const labs = SAMPLE_DOCUMENTS[0].precomputed.lab_results!;
      const seeded = db.all("lab_results");
      for (const l of labs) {
        expect(
          seeded.some((r) => r.date === l.date && r.metric === l.metric),
          l.metric,
        ).toBe(false);
      }
      const before = seeded.length;
      for (const l of labs) {
        await dash({ action: "upsert-lab-result", item: { ...l, source: "upload" } });
      }
      expect(db.all("lab_results")).toHaveLength(before + labs.length);
    });
  });

  it("deleting a seeded document removes it from the chat context", async () => {
    const doc = db.all("documents")[0];
    await ingest({ action: "delete", document_id: doc.id });
    expect(String(db.all("medical_cache")[0].context)).not.toContain(`### ${doc.name}`);
  });
});
