// ABOUTME: Demo chat handler: calls the Anthropic Messages API straight from the browser
// ABOUTME: with the viewer's own key, grounded in the demo database's record and labs.

import type { DemoDb } from "../db";
import {
  createAnthropicClient,
  DEMO_MODEL,
  FALLBACK_PARAMS,
  mapAnthropicError,
  type DemoAiError,
} from "../anthropic";
import { clearApiKey } from "../apiKey";
import { PERSONA } from "../persona";

type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatBody = { messages: ChatMessage[]; pageContext?: string };
export type ChatResult = { text: string } | DemoAiError;

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
  created_at: string;
};

const NAME = PERSONA.firstName;

function recordSection(db: DemoDb): string {
  const section = db.all("dashboard_sections").find((s) => s.key === "patient_record_md");
  const record = typeof section?.content === "string" ? section.content : "";
  return record
    ? `\n\n## PRIMARY SOURCE OF TRUTH — ${NAME.toUpperCase()}'S COMPLETE MEDICAL RECORD (use this first)\n${record}`
    : "";
}

/** Newest first, undated last: the same ordering the edge function asks Postgres for. */
function byNewest(a: LabRow, b: LabRow): number {
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return b.date.localeCompare(a.date);
  }
  return String(b.created_at).localeCompare(String(a.created_at));
}

function labSection(db: DemoDb): string {
  const rows = (db.all("lab_results") as LabRow[]).sort(byNewest);
  if (rows.length === 0) return "";
  const lines = rows.map((r) => {
    const value = r.value_numeric !== null ? String(r.value_numeric) : (r.value_text ?? "—");
    const parts = [`${r.date ?? "(no date)"} · ${r.metric}: ${value}${r.unit ? " " + r.unit : ""}`];
    if (r.reference_range) parts.push(`ref ${r.reference_range}`);
    if (r.flag) parts.push(r.flag);
    if (r.category) parts.push(r.category);
    if (r.source) parts.push(`src:${r.source}`);
    if (r.note) parts.push(r.note);
    return "- " + parts.join(" · ");
  });
  return (
    "\n\n## STRUCTURED LAB VALUES (one row per measurement, sorted newest first)\n" +
    "Note: some tests appear under multiple names in these records — e.g., MCH ≡ Mean Cell Hemoglobin, MCV ≡ Mean Cell Volume, Potassium ≡ Potassium Level, Total Bilirubin ≡ Bilirubin Total, CO2 ≡ Carbon Dioxide. Treat variants as the same test when answering.\n" +
    lines.join("\n")
  );
}

function buildSystemPrompt(db: DemoDb, pageContext?: string): string {
  const pageContextClause = pageContext
    ? `\n\nContext: The caregiver was viewing the "${pageContext}" section of ${NAME}'s dashboard when they opened this chat. If their question seems related to that section, you can reference it to give a more relevant answer.`
    : "";

  return `You are a warm, plain-spoken helper for the caregivers supporting ${NAME} as they navigate his cancer journey. Think of yourself as a knowledgeable friend sitting beside them — patient, gentle, and honest.${pageContextClause}

Tone:
- Be comforting and human. This is a hard stretch for the people caring for ${NAME}. Acknowledge that when it feels right, but don't be saccharine or over-apologize.
- Use plain English. No jargon unless you explain it in one short sentence.
- Keep answers short, clear, and reassuring in tone — even when the news isn't great. Calm, not clinical.
- It's okay to say things like "that's a fair question" or "I know this is a lot" sparingly when it fits.

Strict rules:
- Answer ONLY based on the records provided below. Don't bring in outside medical knowledge.
- If the records don't contain the answer, say so honestly: "I don't see that in his records — worth asking the care team."
- Never speculate about prognosis, life expectancy, or predict outcomes.
- For decisions about treatment, dosing, symptoms, or what to do next, gently point the caregiver to the care team named in the records.
- When citing a number, always include its date and unit (e.g., "4.2 units on March 12").
- Use short paragraphs or bullets. Avoid alarming language.

=== ${NAME.toUpperCase()}'S MEDICAL RECORDS ===
${recordSection(db)}${labSection(db)}
=== END OF RECORDS ===`;
}

export function createDemoChat(
  db: DemoDb,
  getKey: () => string | null,
): (body: ChatBody) => Promise<ChatResult> {
  return async ({ messages, pageContext }) => {
    const apiKey = getKey();
    if (!apiKey) return { error: "Add your Anthropic API key to chat.", code: "NO_API_KEY" };

    try {
      const res = await createAnthropicClient(apiKey).beta.messages.create({
        model: DEMO_MODEL,
        max_tokens: 16000,
        ...FALLBACK_PARAMS,
        output_config: { effort: "low" },
        system: buildSystemPrompt(db, pageContext),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      if (res.stop_reason === "refusal") {
        return { error: "Claude declined to answer that one. Try rephrasing.", code: "REFUSAL" };
      }
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      return { text };
    } catch (e) {
      const mapped = mapAnthropicError(e);
      // A rejected key must not linger: the viewer is asked for a fresh one.
      if (mapped.code === "BAD_KEY") clearApiKey();
      return mapped;
    }
  };
}
