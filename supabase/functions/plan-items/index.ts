import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_STATUS = [
  "Locked",
  "Scheduled",
  "In flight",
  "Conditional",
  "Hold",
  "Daily",
  "Completed",
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
    const { action, password, item, id } = await req.json();
    const expected = Deno.env.get("APP_PASSWORD");
    if (!expected || password !== expected) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "delete") {
      if (!id || typeof id !== "string") return json({ ok: false, error: "Missing id" }, 400);
      const { error } = await supabase.from("plan_items").delete().eq("id", id);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "upsert") {
      if (!item || typeof item !== "object") return json({ ok: false, error: "Missing item" }, 400);
      const title = String(item.title ?? "").trim();
      const body = String(item.body ?? "").trim();
      const status = String(item.status ?? "Scheduled");
      const event_date = item.event_date ? String(item.event_date) : null;
      if (!title || title.length > 200) return json({ ok: false, error: "Invalid title" }, 400);
      if (body.length > 2000) return json({ ok: false, error: "Body too long" }, 400);
      if (!ALLOWED_STATUS.includes(status))
        return json({ ok: false, error: "Invalid status" }, 400);
      if (event_date && !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
        return json({ ok: false, error: "Invalid date" }, 400);
      }

      const payload = { title, body, status, event_date };
      if (item.id) {
        const { data, error } = await supabase
          .from("plan_items")
          .update(payload)
          .eq("id", item.id)
          .select()
          .single();
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true, item: data });
      } else {
        const { data, error } = await supabase.from("plan_items").insert(payload).select().single();
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true, item: data });
      }
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
