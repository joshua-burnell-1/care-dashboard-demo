const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Structured error response. Kept simple: {code, message, hint?} so the client
// can surface a specific message + fix hint instead of a generic toast.
function errorJson(code: string, message: string, hint: string | null = null, status = 400) {
  return json({ ok: false, error: { code, message, hint } }, status);
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;
// Belt-and-braces: after base64 encoding an image, if the payload to Claude
// would exceed this, refuse rather than hang. The client resize helper should
// prevent this in practice; this is the fallback.
const MAX_IMAGE_BASE64_BYTES = 8 * 1024 * 1024;

interface SuggestedLab {
  date?: string | null;
  metric: string;
  category?: string;
  value?: number | string | null;
  unit?: string;
  reference_range?: string;
  flag?: string | null;
  note?: string;
}

interface StructuredUpdates {
  psa_readings: Array<{
    date: string;
    value: number | null;
    unit: string;
    phase: string;
    note: string;
  }>;
  medications: Array<{ item: string; dose?: string; purpose?: string; started_by?: string }>;
  care_team: Array<{ name: string; role?: string; where_based?: string; note?: string }>;
  plan_items: Array<{ title: string; body?: string; event_date?: string | null; status?: string }>;
  lab_results: SuggestedLab[];
}

interface UploadContext {
  document_type?: string;
  context_note?: string;
  test_date?: string;
}

function contextPreamble(ctx: UploadContext): string {
  const parts: string[] = [];
  if (ctx.document_type) parts.push(`This document is a ${ctx.document_type}.`);
  if (ctx.test_date)
    parts.push(
      `Test date (per uploader): ${ctx.test_date}. Use this as the date for any lab values that do not have their own explicit date.`,
    );
  if (ctx.context_note) parts.push(`Additional context from the uploader: ${ctx.context_note}.`);
  if (parts.length === 0) return "";
  return parts.join(" ") + "\n\n";
}

/**
 * Treatment dates come from the SURGERY_DATE and RADIATION_END_DATE secrets (YYYY-MM-DD),
 * so no patient's timeline is baked into the code. Without them the rules stay relative and
 * phase assignment is best-effort: the model can only infer the phase from the document itself.
 */
function psaPhaseRules(): string {
  const surgery = Deno.env.get("SURGERY_DATE");
  const radiationEnd = Deno.env.get("RADIATION_END_DATE");
  const surgeryRef = surgery ? `${surgery} (date of prostatectomy)` : "the prostatectomy";
  const radiationRef = radiationEnd
    ? `${radiationEnd} (radiation completed)`
    : "the end of radiation";
  return [
    `- "pre-op"   = any reading BEFORE ${surgeryRef}`,
    `- "post-op"  = readings from ${surgeryRef} up to ${radiationRef} (before/during radiation)`,
    `- "post-rad" = readings AFTER ${radiationRef}`,
  ].join("\n");
}

async function extractStructuredUpdates(
  text: string,
  apiKey: string,
  ctx: UploadContext,
): Promise<StructuredUpdates> {
  const empty: StructuredUpdates = {
    psa_readings: [],
    medications: [],
    care_team: [],
    plan_items: [],
    lab_results: [],
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      tools: [
        {
          name: "propose_updates",
          description:
            "Extract structured medical data from document text. Only include items explicitly stated — never infer or guess.",
          input_schema: {
            type: "object",
            properties: {
              psa_readings: {
                type: "array",
                description:
                  "PSA lab values where BOTH date AND numeric value are explicitly stated.",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string", description: "YYYY-MM-DD" },
                    value: { type: ["number", "null"] },
                    unit: { type: "string", default: "ng/mL" },
                    phase: { type: "string", enum: ["pre-op", "post-op", "post-rad"] },
                    note: { type: "string" },
                  },
                  required: ["date", "unit", "phase", "note"],
                },
              },
              medications: {
                type: "array",
                description:
                  "Medications or supplements explicitly prescribed or recommended in this document.",
                items: {
                  type: "object",
                  properties: {
                    item: { type: "string" },
                    dose: { type: "string" },
                    purpose: { type: "string" },
                    started_by: { type: "string" },
                  },
                  required: ["item"],
                },
              },
              care_team: {
                type: "array",
                description:
                  "New providers explicitly introduced as part of care in this document.",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    role: { type: "string" },
                    where_based: { type: "string" },
                    note: { type: "string" },
                  },
                  required: ["name"],
                },
              },
              plan_items: {
                type: "array",
                description:
                  "Appointments, tests, or action items with specific dates or explicit triggers.",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    body: { type: "string" },
                    event_date: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
                    status: {
                      type: "string",
                      enum: ["Scheduled", "In flight", "Conditional", "Hold", "Locked", "Daily"],
                    },
                  },
                  required: ["title", "body", "status"],
                },
              },
              lab_results: {
                type: "array",
                description:
                  "Non-PSA lab values with an explicit value + unit. Include everything with a measured value that is NOT a PSA reading (Total Protein, Calcium, ALT, AST, Alkaline Phosphatase, Albumin, testosterone, CBC values, creatinine, etc.).",
                items: {
                  type: "object",
                  properties: {
                    date: {
                      type: ["string", "null"],
                      description:
                        "YYYY-MM-DD or null if the document shows no date and the uploader gave none",
                    },
                    metric: {
                      type: "string",
                      description:
                        "Human-readable metric name as written (e.g., 'Total Protein', 'Alkaline Phosphatase', 'AST')",
                    },
                    category: {
                      type: "string",
                      description:
                        "Optional grouping such as 'Chemistry', 'CBC', 'Endocrine' — leave blank if unclear",
                    },
                    value: {
                      type: ["number", "string", "null"],
                      description: "Numeric when possible, string only for non-numeric results",
                    },
                    unit: { type: "string", description: "e.g., 'g/dL', 'U/L', 'mg/dL'" },
                    reference_range: {
                      type: "string",
                      description:
                        "Verbatim range as shown, e.g., '6.4 - 8.3 g/dL' or '40 U/L or below'",
                    },
                    flag: {
                      type: ["string", "null"],
                      enum: ["HIGH", "LOW", "NORMAL", "ABNORMAL", null],
                    },
                    note: { type: "string" },
                  },
                  required: ["metric"],
                },
              },
            },
            required: ["psa_readings", "medications", "care_team", "plan_items", "lab_results"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "propose_updates" },
      messages: [
        {
          role: "user",
          content: `${contextPreamble(ctx)}Extract structured medical data from this document to propose dashboard updates. Leave arrays empty if nothing found — do not fabricate.

Phase assignment rules for PSA readings:
${psaPhaseRules()}

Use the reading DATE to assign phase — do NOT rely on lab note wording like "post-prostatectomy", which is boilerplate lab language that can appear on all readings regardless of phase.

Lab results rules:
- Do NOT include PSA readings in lab_results — those go in psa_readings.
- Extract every other lab metric that has an explicit value + unit.
- Compute the flag yourself from value vs reference range: HIGH if strictly above the range, LOW if strictly below, NORMAL if within the range. Set flag to null if the range is missing or you cannot tell.
- Reference ranges may be numeric bounds ("6.4 - 8.3 g/dL") or upper-bound only ("40 U/L or below"); handle both.
- If the document shows no test date, use the test_date from the uploader context above. If both are missing, set date to null rather than guessing.

Document text:
${text.slice(0, 25000)}`,
        },
      ],
    }),
  });
  if (!res.ok) return empty;
  const data = await res.json();
  const tool_result = data.content?.find((c: { type: string }) => c.type === "tool_use");
  const merged = { ...empty, ...(tool_result?.input ?? {}) };

  // Belt-and-braces: drop any lab_results row that looks like a PSA reading so
  // it doesn't end up on the labs chart AND the PSA chart.
  merged.lab_results = (merged.lab_results ?? []).filter(
    (r: SuggestedLab) => !/psa/i.test(r.metric ?? ""),
  );

  return merged;
}

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

class UserFacingError extends Error {
  code: string;
  hint: string | null;
  status: number;
  constructor(code: string, message: string, hint: string | null = null, status = 400) {
    super(message);
    this.code = code;
    this.hint = hint;
    this.status = status;
  }
}

async function extractText(
  bytes: Uint8Array,
  mimeType: string,
  apiKey: string,
  ctx: UploadContext,
): Promise<string> {
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return new TextDecoder().decode(bytes);
  }
  if (mimeType === "application/pdf" || mimeType.startsWith("image/")) {
    const base64 = bytesToBase64(bytes);
    if (mimeType.startsWith("image/") && base64.length > MAX_IMAGE_BASE64_BYTES) {
      throw new UserFacingError(
        "IMAGE_TOO_LARGE",
        "Image is too large to process even after encoding.",
        "Please resize the image to about 2000 pixels on the longest side (or under 4 MB) and try again.",
        413,
      );
    }
    const contentBlock =
      mimeType === "application/pdf"
        ? {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          }
        : { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } };
    const preamble = contextPreamble(ctx);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              contentBlock,
              {
                type: "text",
                text: `${preamble}Extract ALL text from this document. Preserve dates, numbers with units, names, section headings, and table structure. Return extracted text with light markdown.`,
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new UserFacingError(
        "CLAUDE_EXTRACTION_FAILED",
        `Claude extraction failed (${res.status}).`,
        detail.slice(0, 300),
        502,
      );
    }
    const data = await res.json();
    return data.content?.[0]?.text ?? "";
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const {
      action,
      password,
      filename,
      mime_type,
      size_bytes,
      document_id,
      document_type,
      context_note,
      test_date,
    } = body as {
      action: string;
      password: string;
      filename?: string;
      mime_type?: string;
      size_bytes?: number;
      document_id?: string;
      document_type?: string;
      context_note?: string;
      test_date?: string;
    };

    const expected = Deno.env.get("APP_PASSWORD");
    if (!expected || password !== expected) {
      return errorJson("UNAUTHORIZED", "Password does not match server configuration.", null, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const authHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // ── health-check ──────────────────────────────────────────────────────────
    if (action === "health-check") {
      const checks = {
        anthropic_key: Boolean(Deno.env.get("ANTHROPIC_API_KEY")),
        app_password: Boolean(Deno.env.get("APP_PASSWORD")),
        supabase_url: Boolean(Deno.env.get("SUPABASE_URL")),
        service_role: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
        bucket: false,
        realtime_documents: false,
        realtime_lab_results: false,
      };

      try {
        const bucketRes = await fetch(`${supabaseUrl}/storage/v1/bucket/medical-documents`, {
          method: "GET",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        });
        checks.bucket = bucketRes.ok;
      } catch (_) {
        checks.bucket = false;
      }

      try {
        const rtRes = await fetch(
          `${supabaseUrl}/rest/v1/realtime_status?table_name=in.(documents,lab_results)&select=table_name,enabled`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        );
        if (rtRes.ok) {
          const rows = (await rtRes.json()) as Array<{ table_name: string; enabled: boolean }>;
          checks.realtime_documents = rows.some((r) => r.table_name === "documents" && r.enabled);
          checks.realtime_lab_results = rows.some(
            (r) => r.table_name === "lab_results" && r.enabled,
          );
        }
      } catch (_) {
        // leave both false
      }

      const allOk = Object.values(checks).every(Boolean);
      return json({ ok: allOk, checks });
    }

    // ── upload-url ────────────────────────────────────────────────────────────
    if (action === "upload-url") {
      if (!filename || !mime_type)
        return errorJson("MISSING_FIELDS", "Missing filename or mime_type.", null, 400);
      if (!ALLOWED_MIME_TYPES.has(mime_type)) {
        return errorJson(
          "UNSUPPORTED_TYPE",
          `Unsupported file type: ${mime_type}.`,
          "Supported: PDF, PNG, JPG, WebP, DOCX, XLSX, CSV, TXT, MD.",
          400,
        );
      }
      if (size_bytes !== undefined && size_bytes > MAX_FILE_BYTES) {
        return errorJson(
          "FILE_TOO_LARGE",
          "File exceeds 20 MB limit.",
          "Please resize or split the file before uploading.",
          413,
        );
      }
      const ext = filename.includes(".") ? filename.split(".").pop() : "";
      const storagePath = `${crypto.randomUUID()}${ext ? "." + ext : ""}`;

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/documents`, {
        method: "POST",
        headers: { ...authHeaders, Prefer: "return=representation" },
        body: JSON.stringify({
          name: filename,
          mime_type,
          storage_path: storagePath,
          size_bytes: size_bytes ?? 0,
          status: "pending",
        }),
      });
      if (!insertRes.ok) {
        return errorJson(
          "DOCUMENT_INSERT_FAILED",
          "Failed to create document record.",
          await insertRes
            .text()
            .then((t) => t.slice(0, 300))
            .catch(() => null),
          500,
        );
      }
      const [doc] = await insertRes.json();

      const signedRes = await fetch(
        `${supabaseUrl}/storage/v1/object/upload/sign/medical-documents/${storagePath}`,
        {
          method: "POST",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        },
      );
      if (!signedRes.ok) {
        const detail = await signedRes.text();
        return errorJson(
          "SIGN_URL_FAILED",
          "Could not sign upload URL.",
          detail.includes("Bucket not found")
            ? "The 'medical-documents' storage bucket does not exist. Create it in Supabase Storage."
            : detail.slice(0, 300),
          500,
        );
      }
      const { url: signedPath } = await signedRes.json();

      return json({
        ok: true,
        upload_url: `${supabaseUrl}/storage/v1${signedPath}`,
        storage_path: storagePath,
        document_id: doc.id,
      });
    }

    // ── process ───────────────────────────────────────────────────────────────
    if (action === "process") {
      if (!document_id) return errorJson("MISSING_FIELDS", "Missing document_id.", null, 400);

      const docRes = await fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${document_id}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      const docs = await docRes.json();
      if (!Array.isArray(docs) || docs.length === 0)
        return errorJson("DOCUMENT_NOT_FOUND", "Document not found.", null, 404);
      const doc = docs[0];

      await fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${document_id}`, {
        method: "PATCH",
        headers: { ...authHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ status: "processing" }),
      });

      const fileRes = await fetch(
        `${supabaseUrl}/storage/v1/object/medical-documents/${doc.storage_path}`,
        {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        },
      );
      if (!fileRes.ok) {
        await fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${document_id}`, {
          method: "PATCH",
          headers: { ...authHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ status: "error", error: "Could not download file from storage" }),
        });
        return errorJson(
          "STORAGE_DOWNLOAD_FAILED",
          "Could not download file from storage.",
          "Check that the medical-documents bucket exists and the service role has access.",
          500,
        );
      }

      const bytes = new Uint8Array(await fileRes.arrayBuffer());
      const ctx: UploadContext = { document_type, context_note, test_date };
      let extractedText = "";
      try {
        extractedText = await extractText(bytes, doc.mime_type, apiKey, ctx);
      } catch (e) {
        const err =
          e instanceof UserFacingError
            ? e
            : new UserFacingError("EXTRACTION_FAILED", (e as Error).message);
        await fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${document_id}`, {
          method: "PATCH",
          headers: { ...authHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ status: "error", error: err.message }),
        });
        return errorJson(err.code, err.message, err.hint, err.status);
      }

      const truncated = extractedText.length > 50000;
      const finalText = truncated ? extractedText.slice(0, 50000) : extractedText;

      await fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${document_id}`, {
        method: "PATCH",
        headers: { ...authHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ status: "indexed", extracted_chars: finalText.length, error: null }),
      });

      // Update medical_cache — chat function reads from here.
      const cacheRes = await fetch(`${supabaseUrl}/rest/v1/medical_cache?id=eq.1`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      const cacheRows = await cacheRes.json();
      const cache = cacheRows[0] ?? { sources: [], context: "" };
      const sources = Array.isArray(cache.sources) ? [...cache.sources] : [];
      const existingIdx = sources.findIndex((s: { id: string }) => s.id === document_id);
      const entry = {
        id: document_id,
        name: doc.name,
        mimeType: doc.mime_type,
        modifiedTime: new Date().toISOString(),
        textChars: finalText.length,
        truncated,
        error: null,
      };
      if (existingIdx >= 0) sources[existingIdx] = entry;
      else sources.push(entry);

      const chunks = (cache.context ?? "")
        .split("\n\n---\n\n")
        .filter((c: string) => !c.startsWith(`### ${doc.name}`));
      chunks.push(`### ${doc.name}\n${finalText}`);
      const newContext = chunks.join("\n\n---\n\n");

      await fetch(`${supabaseUrl}/rest/v1/medical_cache?id=eq.1`, {
        method: "PATCH",
        headers: { ...authHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({
          sources,
          context: newContext,
          last_synced_at: new Date().toISOString(),
          last_error: null,
        }),
      });

      // Run structured extraction for dashboard suggestions (non-fatal if it fails)
      let suggested_updates: StructuredUpdates = {
        psa_readings: [],
        medications: [],
        care_team: [],
        plan_items: [],
        lab_results: [],
      };
      if (finalText.length > 200) {
        try {
          suggested_updates = await extractStructuredUpdates(finalText, apiKey, ctx);
        } catch (e) {
          console.warn("Structure extraction failed (non-fatal):", e);
        }
      }

      return json({ ok: true, extracted_chars: finalText.length, suggested_updates });
    }

    // ── delete ────────────────────────────────────────────────────────────────
    if (action === "delete") {
      if (!document_id) return errorJson("MISSING_FIELDS", "Missing document_id.", null, 400);

      const docRes = await fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${document_id}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      const docs = await docRes.json();
      const doc = docs?.[0];

      if (doc) {
        await fetch(`${supabaseUrl}/storage/v1/object/medical-documents/${doc.storage_path}`, {
          method: "DELETE",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        });
        const cacheRes = await fetch(`${supabaseUrl}/rest/v1/medical_cache?id=eq.1`, {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        });
        const cacheRows = await cacheRes.json();
        const cache = cacheRows?.[0];
        if (cache) {
          const sources = (cache.sources ?? []).filter((s: { id: string }) => s.id !== document_id);
          const newContext = (cache.context ?? "")
            .split("\n\n---\n\n")
            .filter((c: string) => !c.startsWith(`### ${doc.name}`))
            .join("\n\n---\n\n");
          await fetch(`${supabaseUrl}/rest/v1/medical_cache?id=eq.1`, {
            method: "PATCH",
            headers: { ...authHeaders, Prefer: "return=minimal" },
            body: JSON.stringify({ sources, context: newContext }),
          });
        }
      }

      await fetch(`${supabaseUrl}/rest/v1/documents?id=eq.${document_id}`, {
        method: "DELETE",
        headers: { ...authHeaders, Prefer: "return=minimal" },
      });
      return json({ ok: true });
    }

    return errorJson("UNKNOWN_ACTION", `Unknown action: ${action}.`, null, 400);
  } catch (e) {
    console.error("ingest-document error", e);
    return errorJson("INTERNAL_ERROR", (e as Error).message, null, 500);
  }
});
