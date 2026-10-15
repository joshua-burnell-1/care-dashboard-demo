// Anthropic Claude proxy. Keeps API key server-side. Validates app password.
// Optional PATIENT_FIRST_NAME secret names the patient in the prompt (default "the patient").
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-app-password",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple in-memory rate limit (per edge instance). Best-effort cost guard.
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

function rateLimit(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= MAX_PER_WINDOW) return false;
  b.count++;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const appPassword = Deno.env.get("APP_PASSWORD");
    const provided = req.headers.get("x-app-password");
    if (!appPassword || provided !== appPassword) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("x-forwarded-for") ?? "anon";
    if (!rateLimit(ip)) {
      return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { messages, pageContext } = body as {
      messages: { role: "user" | "assistant"; content: string }[];
      pageContext?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read medical context server-side — keeps sensitive data out of the client bundle
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    const [recordRes, cacheRes, labsRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/dashboard_sections?key=eq.patient_record_md&select=content`, {
        headers: dbHeaders,
      }),
      fetch(`${supabaseUrl}/rest/v1/medical_cache?id=eq.1&select=context,last_synced_at`, {
        headers: dbHeaders,
      }),
      fetch(
        `${supabaseUrl}/rest/v1/lab_results?select=date,metric,category,value_numeric,value_text,unit,reference_range,flag,source,note&order=date.desc.nullslast,created_at.desc`,
        { headers: dbHeaders },
      ),
    ]);

    const recordData = await recordRes.json();
    const cacheData = await cacheRes.json();
    const labsData = await labsRes.json();

    const patientRecord: string =
      typeof recordData?.[0]?.content === "string" ? recordData[0].content : "";
    const cache = cacheData?.[0];
    const driveContext = cache?.context
      ? `\n\n## SOURCE FILES (last synced ${new Date(cache.last_synced_at).toLocaleString()})\n${cache.context}`
      : "";
    const sourceOfTruth = patientRecord
      ? `\n\n## PRIMARY SOURCE OF TRUTH — THE PATIENT'S COMPLETE MEDICAL RECORD (use this first)\n${patientRecord}`
      : "";

    // Structured lab table so the chat can answer "what was the latest MCH" or
    // "how has potassium trended" without having to parse raw document text.
    type LabRow = {
      date: string | null;
      metric: string;
      category: string | null;
      value_numeric: number | null;
      value_text: string | null;
      unit: string;
      reference_range: string | null;
      flag: string | null;
      source: string;
      note: string;
    };
    const labRows = Array.isArray(labsData) ? (labsData as LabRow[]) : [];
    const labSection =
      labRows.length > 0
        ? "\n\n## STRUCTURED LAB VALUES (one row per measurement, sorted newest first)\n" +
          "Note: some tests appear under multiple names in these records — e.g., MCH ≡ Mean Cell Hemoglobin, MCV ≡ Mean Cell Volume, Potassium ≡ Potassium Level, Total Bilirubin ≡ Bilirubin Total, CO2 ≡ Carbon Dioxide. Treat variants as the same test when answering.\n" +
          labRows
            .map((r) => {
              const value =
                r.value_numeric !== null ? String(r.value_numeric) : (r.value_text ?? "—");
              const date = r.date ?? "(no date)";
              const parts = [`${date} · ${r.metric}: ${value}${r.unit ? " " + r.unit : ""}`];
              if (r.reference_range) parts.push(`ref ${r.reference_range}`);
              if (r.flag) parts.push(r.flag);
              if (r.category) parts.push(r.category);
              if (r.source) parts.push(`src:${r.source}`);
              if (r.note) parts.push(r.note);
              return "- " + parts.join(" · ");
            })
            .join("\n")
        : "";

    const medicalContext = sourceOfTruth + labSection + driveContext;

    const patientName = Deno.env.get("PATIENT_FIRST_NAME") ?? "the patient";
    const pageContextClause = pageContext
      ? `\n\nContext: The caregiver was viewing the "${pageContext}" section of the dashboard when they opened this chat. If their question seems related to that section, you can reference it to give a more relevant answer.`
      : "";

    const systemPrompt = `You are a warm, plain-spoken helper for the caregivers supporting ${patientName} through cancer care. Think of yourself as a knowledgeable friend sitting beside them — patient, gentle, and honest.${pageContextClause}

Tone:
- Be comforting and human. This family is going through something hard. Acknowledge that when it feels right, but don't be saccharine or over-apologize.
- Use plain English. No jargon unless you explain it in one short sentence.
- Keep answers short, clear, and reassuring in tone — even when the news isn't great. Calm, not clinical.
- It's okay to say things like "that's a fair question" or "I know this is a lot" sparingly when it fits.

Strict rules:
- Answer ONLY based on the records provided below. Don't bring in outside medical knowledge.
- If the records don't contain the answer, say so honestly: "I don't see that in the records — worth asking the care team."
- Never speculate about prognosis, life expectancy, or predict outcomes.
- For decisions about treatment, dosing, symptoms, or what to do next, gently point the family to the care team named in the records.
- When citing a number, always include its date and unit (e.g., "4.2 units on March 12").
- Use short paragraphs or bullets. Avoid alarming language.

=== MEDICAL RECORDS ===
${medicalContext}
=== END OF RECORDS ===`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error", res.status, errText);
      return new Response(JSON.stringify({ error: `Claude API error (${res.status})` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text ?? "";
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat function error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
