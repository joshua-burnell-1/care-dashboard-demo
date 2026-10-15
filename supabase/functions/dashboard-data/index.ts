// CRUD edge function for all configurable dashboard tables.
// Mirrors the plan-items/index.ts pattern exactly.
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_TONES = ["rose", "warn", "info", "ok", "neutral", "danger"];
const ALLOWED_PHASES = ["pre-op", "post-op", "post-rad"];
const ALLOWED_FLAGS = ["HIGH", "LOW", "NORMAL", "ABNORMAL"];
const ALLOWED_TABLES = [
  "psa_readings",
  "care_team_members",
  "medication_items",
  "kpi_cards",
  "plan_items",
  "dashboard_sections",
  "lab_results",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, password, item, id, key, content, history_id } = body as {
      action: string;
      password: string;
      item?: Record<string, unknown>;
      id?: string;
      key?: string;
      content?: unknown;
      history_id?: string;
    };

    const expected = Deno.env.get("APP_PASSWORD");
    if (!expected || password !== expected) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    async function dbPost(path: string, payload: unknown) {
      const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      return { ok: res.ok, data: await res.json(), status: res.status };
    }

    async function dbPatch(path: string, payload: unknown) {
      const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      });
      return { ok: res.ok, data: await res.json(), status: res.status };
    }

    async function dbDelete(path: string) {
      const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=minimal" },
      });
      return { ok: res.ok };
    }

    async function dbGet(path: string) {
      const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      return { ok: res.ok, data: await res.json() };
    }

    // ── PSA readings ──────────────────────────────────────────────────────────
    if (action === "upsert-psa") {
      if (!item) return json({ ok: false, error: "Missing item" }, 400);
      const date = String(item.date ?? "").trim();
      const value = item.value === null || item.value === undefined ? null : Number(item.value);
      const unit = String(item.unit ?? "ng/mL").trim() || "ng/mL";
      const phase = String(item.phase ?? "post-rad");
      const note = String(item.note ?? "").trim();
      const sort_index = Number(item.sort_index ?? 0);

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
        return json({ ok: false, error: "Invalid date" }, 400);
      if (value !== null && isNaN(value)) return json({ ok: false, error: "Invalid value" }, 400);
      if (!ALLOWED_PHASES.includes(phase)) return json({ ok: false, error: "Invalid phase" }, 400);

      const payload = { date, value, unit, phase, note, sort_index };

      if (item.id) {
        const r = await dbPatch(`psa_readings?id=eq.${item.id}`, payload);
        if (!r.ok) return json({ ok: false, error: "Update failed" }, 500);
        return json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
      } else {
        // Upsert-by-date: update existing row if one exists for this date, otherwise insert
        const dupRes = await dbGet(`psa_readings?date=eq.${date}&select=id`);
        if (dupRes.ok && Array.isArray(dupRes.data) && dupRes.data.length > 0) {
          const existingId = dupRes.data[0].id;
          const r = await dbPatch(`psa_readings?id=eq.${existingId}`, payload);
          if (!r.ok) return json({ ok: false, error: "Update failed" }, 500);
          return json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
        }
        const r = await dbPost("psa_readings", payload);
        if (!r.ok) return json({ ok: false, error: "Insert failed" }, 500);
        return json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
      }
    }

    if (action === "delete-psa") {
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      const r = await dbDelete(`psa_readings?id=eq.${id}`);
      if (!r.ok) return json({ ok: false, error: "Delete failed" }, 500);
      return json({ ok: true });
    }

    // ── Care team ─────────────────────────────────────────────────────────────
    if (action === "upsert-care-team") {
      if (!item) return json({ ok: false, error: "Missing item" }, 400);
      const name = String(item.name ?? "").trim();
      if (!name || name.length > 200) return json({ ok: false, error: "Invalid name" }, 400);
      const payload = {
        name,
        role: String(item.role ?? "").trim(),
        where_based: String(item.where_based ?? "").trim(),
        note: String(item.note ?? "").trim(),
        phone: String(item.phone ?? "").trim(),
        email: String(item.email ?? "").trim(),
        sort_index: Number(item.sort_index ?? 0),
      };
      if (item.id) {
        const r = await dbPatch(`care_team_members?id=eq.${item.id}`, payload);
        if (!r.ok) return json({ ok: false, error: "Update failed" }, 500);
        return json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
      } else {
        const r = await dbPost("care_team_members", payload);
        if (!r.ok) return json({ ok: false, error: "Insert failed" }, 500);
        return json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
      }
    }

    if (action === "delete-care-team") {
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      const r = await dbDelete(`care_team_members?id=eq.${id}`);
      if (!r.ok) return json({ ok: false, error: "Delete failed" }, 500);
      return json({ ok: true });
    }

    // ── Medications ───────────────────────────────────────────────────────────
    if (action === "upsert-medication") {
      if (!item) return json({ ok: false, error: "Missing item" }, 400);
      const itemName = String(item.item ?? "").trim();
      if (!itemName || itemName.length > 300)
        return json({ ok: false, error: "Invalid item name" }, 400);
      const payload = {
        item: itemName,
        dose: String(item.dose ?? "").trim(),
        purpose: String(item.purpose ?? "").trim(),
        started_by: String(item.started_by ?? "").trim(),
        sort_index: Number(item.sort_index ?? 0),
      };
      if (item.id) {
        const r = await dbPatch(`medication_items?id=eq.${item.id}`, payload);
        if (!r.ok) return json({ ok: false, error: "Update failed" }, 500);
        return json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
      } else {
        const r = await dbPost("medication_items", payload);
        if (!r.ok) return json({ ok: false, error: "Insert failed" }, 500);
        return json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
      }
    }

    if (action === "delete-medication") {
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      const r = await dbDelete(`medication_items?id=eq.${id}`);
      if (!r.ok) return json({ ok: false, error: "Delete failed" }, 500);
      return json({ ok: true });
    }

    // ── KPI cards ─────────────────────────────────────────────────────────────
    if (action === "upsert-kpi") {
      if (!item) return json({ ok: false, error: "Missing item" }, 400);
      const label = String(item.label ?? "").trim();
      const value = String(item.value ?? "").trim();
      if (!label || label.length > 100) return json({ ok: false, error: "Invalid label" }, 400);
      if (!value || value.length > 100) return json({ ok: false, error: "Invalid value" }, 400);
      const tone = String(item.tone ?? "neutral");
      if (!ALLOWED_TONES.includes(tone)) return json({ ok: false, error: "Invalid tone" }, 400);
      const payload = {
        label,
        value,
        sub: String(item.sub ?? "").trim(),
        tone,
        sort_index: Number(item.sort_index ?? 0),
      };
      if (item.id) {
        const r = await dbPatch(`kpi_cards?id=eq.${item.id}`, payload);
        if (!r.ok) return json({ ok: false, error: "Update failed" }, 500);
        return json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
      } else {
        const r = await dbPost("kpi_cards", payload);
        if (!r.ok) return json({ ok: false, error: "Insert failed" }, 500);
        return json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
      }
    }

    if (action === "delete-kpi") {
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      const r = await dbDelete(`kpi_cards?id=eq.${id}`);
      if (!r.ok) return json({ ok: false, error: "Delete failed" }, 500);
      return json({ ok: true });
    }

    // ── Lab results ───────────────────────────────────────────────────────────
    if (action === "upsert-lab-result") {
      if (!item) return json({ ok: false, error: "Missing item" }, 400);
      const metric = String(item.metric ?? "").trim();
      if (!metric || metric.length > 300) return json({ ok: false, error: "Invalid metric" }, 400);

      const rawDate =
        item.date === null || item.date === undefined ? null : String(item.date).trim();
      const date = rawDate && rawDate.length > 0 ? rawDate : null;
      if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date))
        return json({ ok: false, error: "Invalid date" }, 400);

      let value_numeric: number | null = null;
      let value_text: string | null = null;
      if (item.value !== null && item.value !== undefined && item.value !== "") {
        const asNumber = Number(item.value);
        if (Number.isFinite(asNumber)) {
          value_numeric = asNumber;
        } else {
          value_text = String(item.value);
        }
      }

      const flagRaw =
        item.flag === null || item.flag === undefined ? null : String(item.flag).toUpperCase();
      const flag = flagRaw && ALLOWED_FLAGS.includes(flagRaw) ? flagRaw : null;

      const source = String(item.source ?? "upload").trim() || "upload";
      const sourceDocRaw = item.source_document_id;
      const source_document_id =
        typeof sourceDocRaw === "string" && sourceDocRaw.length > 0 ? sourceDocRaw : null;

      const payload = {
        date,
        metric,
        category:
          item.category === null || item.category === undefined
            ? null
            : String(item.category).trim() || null,
        value_numeric,
        value_text,
        unit: String(item.unit ?? "").trim(),
        reference_range:
          item.reference_range === null || item.reference_range === undefined
            ? null
            : String(item.reference_range).trim() || null,
        flag,
        source,
        source_document_id,
        note: String(item.note ?? "").trim(),
        sort_index: Number(item.sort_index ?? 0),
      };

      if (item.id) {
        const r = await dbPatch(`lab_results?id=eq.${item.id}`, payload);
        if (!r.ok) return json({ ok: false, error: "Update failed" }, 500);
        return json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
      }

      // Dedupe: when a date is present, upsert against (date, metric, value_numeric).
      // When date is null we always insert — different undated uploads may legitimately differ.
      if (date !== null) {
        const dupQuery = new URLSearchParams({
          date: `eq.${date}`,
          metric: `eq.${metric}`,
          select: "id",
        });
        if (value_numeric !== null) dupQuery.set("value_numeric", `eq.${value_numeric}`);
        else dupQuery.set("value_numeric", "is.null");
        const dupRes = await dbGet(`lab_results?${dupQuery.toString()}`);
        if (dupRes.ok && Array.isArray(dupRes.data) && dupRes.data.length > 0) {
          const existingId = dupRes.data[0].id;
          const r = await dbPatch(`lab_results?id=eq.${existingId}`, payload);
          if (!r.ok) return json({ ok: false, error: "Update failed" }, 500);
          return json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
        }
      }

      const r = await dbPost("lab_results", payload);
      if (!r.ok) return json({ ok: false, error: "Insert failed" }, 500);
      return json({ ok: true, item: Array.isArray(r.data) ? r.data[0] : r.data });
    }

    if (action === "delete-lab-result") {
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      const r = await dbDelete(`lab_results?id=eq.${id}`);
      if (!r.ok) return json({ ok: false, error: "Delete failed" }, 500);
      return json({ ok: true });
    }

    // ── Dashboard sections (JSONB blobs) ──────────────────────────────────────
    if (action === "update-section") {
      if (!key || content === undefined)
        return json({ ok: false, error: "Missing key or content" }, 400);
      const res = await fetch(
        `${supabaseUrl}/rest/v1/dashboard_sections?key=eq.${encodeURIComponent(key)}`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ content, updated_at: new Date().toISOString() }),
        },
      );
      if (!res.ok) return json({ ok: false, error: "Update failed" }, 500);
      return json({ ok: true });
    }

    // ── Rollback (added in Phase 3) ───────────────────────────────────────────
    if (action === "rollback") {
      if (!history_id) return json({ ok: false, error: "Missing history_id" }, 400);
      const { ok, data } = await dbGet(`edit_history?id=eq.${history_id}`);
      if (!ok || !Array.isArray(data) || data.length === 0) {
        return json({ ok: false, error: "History entry not found" }, 404);
      }
      const entry = data[0] as {
        table_name: string;
        record_id: string;
        operation: string;
        old_data: Record<string, unknown> | null;
      };

      const { table_name, record_id, operation, old_data } = entry;

      if (!ALLOWED_TABLES.includes(table_name)) {
        return json({ ok: false, error: "Invalid table" }, 400);
      }

      if (operation === "DELETE" && old_data) {
        const r = await dbPost(table_name, old_data);
        if (!r.ok) return json({ ok: false, error: "Restore failed" }, 500);
      } else if (operation === "UPDATE" && old_data) {
        const pkField = table_name === "dashboard_sections" ? "key" : "id";
        const r = await dbPatch(`${table_name}?${pkField}=eq.${record_id}`, old_data);
        if (!r.ok) return json({ ok: false, error: "Restore failed" }, 500);
      } else if (operation === "INSERT") {
        const pkField = table_name === "dashboard_sections" ? "key" : "id";
        const r = await dbDelete(`${table_name}?${pkField}=eq.${record_id}`);
        if (!r.ok) return json({ ok: false, error: "Delete failed" }, 500);
      }

      return json({ ok: true });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("dashboard-data error", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
