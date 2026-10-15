// ABOUTME: Builds and streams the AI "visit-prep brief" for an upcoming appointment, written
// ABOUTME: for a family caregiver, using the viewer's own Anthropic key straight from the browser.

import {
  createAnthropicClient,
  DEMO_MODEL,
  FALLBACK_PARAMS,
  mapAnthropicError,
  type DemoAiErrorCode,
} from "./anthropic";

export type VisitPrepInput = {
  planItem: { title: string; event_date: string; body: string };
  /** The patient's record as Markdown. */
  record: string;
  recentPsa: { date: string; value: number | null }[];
  medications: string[];
};

const MAX_RECORD_CHARS = 60000;
const MAX_PSA_READINGS = 5;

const SYSTEM_PROMPT = `You help a family caregiver get ready for a medical appointment. You are given the appointment, the patient's record, recent PSA readings and current medications.

Write a short visit-prep brief in plain language, as Markdown, with exactly these three headings in this order:

## What's changed since last visit
## Questions to ask
## Bring with you

Rules:
- Use only the record and details provided. Never invent results, dates, doses or history. If something is not in the record, say so or leave it out.
- "What's changed since last visit": a few short bullets on recent PSA movement, medication changes and anything else the record shows since the previous visit.
- "Questions to ask": at most 8 questions, most important first, specific to this appointment and this patient.
- "Bring with you": a short checklist of documents, results, medication lists and notes worth bringing.
- Plain language a non-clinician can follow. Explain any medical term the first time you use it.
- Do not give treatment advice or tell the caregiver what to decide. The questions are for the care team to answer.
- End with the line: Not medical advice.`;

function psaLines(readings: VisitPrepInput["recentPsa"]): string {
  if (readings.length === 0) return "No PSA readings on file.";
  return [...readings]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_PSA_READINGS)
    .map((r) => `- ${r.date}: ${r.value === null ? "not recorded" : `${r.value} ng/mL`}`)
    .join("\n");
}

/** Pure: the system prompt and the user message for one appointment. */
export function buildVisitPrepPrompt(input: VisitPrepInput): { system: string; user: string } {
  const { planItem, record, recentPsa, medications } = input;
  const meds =
    medications.length > 0
      ? medications.map((m) => `- ${m}`).join("\n")
      : "No medications on file.";
  const user = [
    "Appointment",
    `Title: ${planItem.title}`,
    `Date: ${planItem.event_date}`,
    `Details: ${planItem.body || "(none)"}`,
    "",
    "Recent PSA readings (oldest to newest)",
    psaLines(recentPsa),
    "",
    "Current medications",
    meds,
    "",
    "Patient record",
    record.slice(0, MAX_RECORD_CHARS) || "(no record on file)",
  ].join("\n");
  return { system: SYSTEM_PROMPT, user };
}

/** A problem already phrased for the viewer, with a code to branch on. */
export class VisitPrepError extends Error {
  constructor(
    message: string,
    readonly code: DemoAiErrorCode,
  ) {
    super(message);
    this.name = "VisitPrepError";
  }
}

export type StreamVisitPrepOptions = {
  apiKey: string;
  onText: (delta: string) => void;
  /** Aborting stops the request and resolves quietly; text already forwarded stays with the caller. */
  signal?: AbortSignal;
};

/** Streams the brief, calling `onText` with each text delta in order. */
export async function streamVisitPrep(
  input: VisitPrepInput,
  { apiKey, onText, signal }: StreamVisitPrepOptions,
): Promise<void> {
  const { system, user } = buildVisitPrepPrompt(input);
  let stopReason: string | null = null;
  try {
    const stream = createAnthropicClient(apiKey).beta.messages.stream(
      {
        model: DEMO_MODEL,
        max_tokens: 16000,
        ...FALLBACK_PARAMS,
        output_config: { effort: "low" },
        system,
        messages: [{ role: "user", content: user }],
      },
      { signal },
    );
    for await (const event of stream) {
      if (signal?.aborted) return;
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        onText(event.delta.text);
      } else if (event.type === "message_delta") {
        stopReason = event.delta.stop_reason ?? stopReason;
      }
    }
    // Surfaces a failure the iterator did not throw (the stream ends and reports it here).
    await stream.done();
  } catch (e) {
    // The SDK throws when the request is aborted; that is the viewer pressing Stop, not a failure.
    if (signal?.aborted) return;
    const mapped = mapAnthropicError(e);
    throw new VisitPrepError(mapped.error, mapped.code);
  }
  if (signal?.aborted) return;
  if (stopReason === "refusal") {
    throw new VisitPrepError("Claude declined to write this brief.", "REFUSAL");
  }
  if (stopReason === "max_tokens" || stopReason === "model_context_window_exceeded") {
    throw new VisitPrepError("The brief was cut off before it finished.", "API");
  }
}
