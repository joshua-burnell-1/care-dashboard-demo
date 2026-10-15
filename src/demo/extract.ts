// ABOUTME: Turns the text of an uploaded document into reviewable dashboard updates by
// ABOUTME: asking Claude for structured JSON that matches what SuggestionsModal consumes.

import type { SuggestedUpdates } from "@/components/dashboard/SuggestionsModal";
import {
  createAnthropicClient,
  DEMO_MODEL,
  FALLBACK_PARAMS,
  mapAnthropicError,
  type DemoAiErrorCode,
} from "./anthropic";
import { DEMO_DOCUMENT_TEXT_LIMIT } from "./limits";

/** A fresh object each call, so callers can never share or mutate the same arrays. */
export const emptyUpdates = (): Required<SuggestedUpdates> => ({
  psa_readings: [],
  medications: [],
  care_team: [],
  plan_items: [],
  lab_results: [],
});

const string = { type: "string" } as const;
const nullable = <T extends object>(schema: T) => ({ anyOf: [schema, { type: "null" }] });

/**
 * Mirrors SuggestedUpdates. Every property is required so the model states each field
 * ("" or null when the document says nothing) and the schema stays inside the structured
 * outputs limit on optional parameters.
 */
export const SUGGESTED_UPDATES_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["psa_readings", "medications", "care_team", "plan_items", "lab_results"],
  properties: {
    psa_readings: {
      type: "array",
      description: "PSA values where BOTH the date AND a numeric value are explicitly stated.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "value", "unit", "phase", "note"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          value: nullable({ type: "number" }),
          unit: { type: "string", description: "Usually ng/mL" },
          phase: { type: "string", enum: ["pre-op", "post-op", "post-rad"] },
          note: string,
        },
      },
    },
    medications: {
      type: "array",
      description: "Medications or supplements explicitly prescribed or recommended.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "dose", "purpose", "started_by"],
        properties: { item: string, dose: string, purpose: string, started_by: string },
      },
    },
    care_team: {
      type: "array",
      description: "Providers explicitly introduced as part of care in this document.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "role", "where_based", "note"],
        properties: { name: string, role: string, where_based: string, note: string },
      },
    },
    plan_items: {
      type: "array",
      description:
        "Appointments, tests or action items with a specific date or an explicit trigger.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body", "event_date", "status"],
        properties: {
          title: string,
          body: string,
          event_date: nullable({ type: "string", description: "YYYY-MM-DD" }),
          status: {
            type: "string",
            enum: ["Scheduled", "In flight", "Conditional", "Hold", "Locked", "Daily"],
          },
        },
      },
    },
    lab_results: {
      type: "array",
      description: "Every non-PSA lab value with an explicit value and unit.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "date",
          "metric",
          "category",
          "value",
          "unit",
          "reference_range",
          "flag",
          "note",
        ],
        properties: {
          date: nullable({ type: "string", description: "YYYY-MM-DD, or null if unknown" }),
          metric: { type: "string", description: "The test name as written in the document" },
          category: { type: "string", description: "Grouping such as Chemistry or CBC, or empty" },
          value: { anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }] },
          unit: string,
          reference_range: { type: "string", description: "The range as printed, or empty" },
          flag: nullable({ type: "string", enum: ["HIGH", "LOW", "NORMAL", "ABNORMAL"] }),
          note: string,
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You read one medical document and propose updates to a family's care dashboard.

Rules:
- Extract only what the document states. Never infer, estimate or guess. If the document does not say it, leave it out.
- Leave an array empty when nothing in the document fits it.
- Use "" for a text field the document does not give and null for a missing date or value.
- PSA readings go in psa_readings and never in lab_results. Assign the phase from the reading date and the treatment history in the document: pre-op before surgery, post-op after surgery up to the end of radiation, post-rad after radiation.
- For lab_results, extract every other measured value that has a unit. Set flag by comparing the value to the printed reference range: HIGH if above, LOW if below, NORMAL if within, null if there is no range. Copy the range as printed.
- Use the collection date printed on the document for lab dates, as YYYY-MM-DD.
- Medications are only those the document prescribes or recommends. Care team entries are only providers it introduces.
- Plan items are appointments, tests or actions with a specific date or an explicit trigger.`;

export type ExtractOptions = {
  apiKey: string;
  /** What the dashboard already holds, so the model matches spellings and skips repeats. */
  existing: { labs: string[]; medications: string[] };
  /** Optional details the uploader gave about the document. */
  uploader?: { documentType?: string; testDate?: string; note?: string };
};

/** An Anthropic or output problem, already phrased for the viewer, with a code to branch on. */
export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly code: DemoAiErrorCode,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

function userPrompt(text: string, { existing, uploader }: ExtractOptions): string {
  const parts: string[] = [];
  if (uploader?.documentType) parts.push(`The uploader says this is a ${uploader.documentType}.`);
  if (uploader?.testDate) {
    parts.push(
      `Test date per the uploader: ${uploader.testDate}. Use it for lab values with no date of their own.`,
    );
  }
  if (uploader?.note) parts.push(`Note from the uploader: ${uploader.note}`);
  if (existing.labs.length > 0) {
    parts.push(
      `Lab metrics already on the dashboard (reuse these exact names when the document reports the same test): ${existing.labs.join(", ")}.`,
    );
  }
  if (existing.medications.length > 0) {
    parts.push(
      `Medications already on the dashboard (do not suggest these again unless the document changes them): ${existing.medications.join(", ")}.`,
    );
  }
  return `${parts.join("\n")}${parts.length ? "\n\n" : ""}Document text:\n${text.slice(0, DEMO_DOCUMENT_TEXT_LIMIT)}`;
}

/** Fills missing arrays and drops PSA rows from labs so a reading is not charted twice. */
function normalize(raw: unknown): Required<SuggestedUpdates> {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as SuggestedUpdates;
  const list = <T>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);
  return {
    psa_readings: list(obj.psa_readings),
    medications: list(obj.medications),
    care_team: list(obj.care_team),
    plan_items: list(obj.plan_items),
    lab_results: list(obj.lab_results).filter((r) => !/psa/i.test(r.metric ?? "")),
  };
}

export async function extractSuggestedUpdates(
  text: string,
  opts: ExtractOptions,
): Promise<Required<SuggestedUpdates>> {
  let response;
  try {
    response = await createAnthropicClient(opts.apiKey).beta.messages.create({
      model: DEMO_MODEL,
      max_tokens: 16000,
      ...FALLBACK_PARAMS,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SUGGESTED_UPDATES_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt(text, opts) }],
    });
  } catch (e) {
    const mapped = mapAnthropicError(e);
    throw new ExtractionError(mapped.error, mapped.code);
  }

  if (response.stop_reason === "refusal") {
    throw new ExtractionError("Claude declined to read that document.", "REFUSAL");
  }
  if (
    response.stop_reason === "max_tokens" ||
    response.stop_reason === "model_context_window_exceeded"
  ) {
    throw new ExtractionError("The document was too long to extract in one pass.", "API");
  }
  const json = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return normalize(JSON.parse(json));
  } catch {
    throw new ExtractionError("Claude's reply could not be read as updates.", "API");
  }
}
