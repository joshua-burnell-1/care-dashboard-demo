import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "@anthropic-ai/sdk";
import { DEMO_MODEL, FALLBACK_PARAMS } from "./anthropic";
import { emptyUpdates, extractSuggestedUpdates, SUGGESTED_UPDATES_SCHEMA } from "./extract";
import { SAMPLE_DOCUMENTS } from "./samples";

const { create, ctor } = vi.hoisted(() => ({ create: vi.fn(), ctor: vi.fn() }));

// Keep the real error classes (the code under test uses instanceof); fake only the client.
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  const Fake = vi.fn(function (this: unknown, opts: unknown) {
    ctor(opts);
    return { beta: { messages: { create } } };
  });
  return { ...actual, default: Fake };
});

const EMPTY_UPDATES = emptyUpdates();
const OPTS = { apiKey: "sk-test", existing: { labs: ["Sodium"], medications: ["Vitamin D3"] } };

function reply(json: unknown, stop_reason = "end_turn") {
  return { stop_reason, content: [{ type: "text", text: JSON.stringify(json) }] };
}

beforeEach(() => {
  create.mockReset();
  ctor.mockReset();
  create.mockResolvedValue(reply(EMPTY_UPDATES));
});

describe("extractSuggestedUpdates", () => {
  it("sends the json_schema format, model, and fallback params", async () => {
    await extractSuggestedUpdates("Sodium 140 mmol/L", OPTS);
    expect(ctor).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "sk-test" }));
    const args = create.mock.calls[0][0];
    expect(args.model).toBe(DEMO_MODEL);
    expect(args.betas).toEqual(FALLBACK_PARAMS.betas);
    expect(args.fallbacks).toBe(FALLBACK_PARAMS.fallbacks);
    expect(args.output_config).toEqual({
      effort: "medium",
      format: { type: "json_schema", schema: SUGGESTED_UPDATES_SCHEMA },
    });
    expect(args.system).toMatch(/only what the document (explicitly )?states/i);
    const prompt = args.messages[0].content as string;
    expect(prompt).toContain("Sodium 140 mmol/L");
    expect(prompt).toContain("Vitamin D3");
  });

  it("returns the parsed updates and drops PSA rows from lab_results", async () => {
    create.mockResolvedValue(
      reply({
        ...EMPTY_UPDATES,
        lab_results: [
          { metric: "PSA Total", value: 0.2, unit: "ng/mL" },
          { metric: "Glucose", value: 104, unit: "mg/dL", flag: "HIGH" },
        ],
      }),
    );
    const res = await extractSuggestedUpdates("text", OPTS);
    expect(res.lab_results?.map((l) => l.metric)).toEqual(["Glucose"]);
    expect(res.medications).toEqual([]);
  });

  it("maps AuthenticationError via mapAnthropicError", async () => {
    create.mockRejectedValue(new AuthenticationError(401, { type: "error" }, "no", new Headers()));
    await expect(extractSuggestedUpdates("text", OPTS)).rejects.toMatchObject({
      code: "BAD_KEY",
      message: "That API key was rejected. Check it and try again.",
    });
  });

  it.each(["max_tokens", "model_context_window_exceeded"])(
    "reports stop_reason %s as too long",
    async (stop_reason) => {
      create.mockResolvedValue({ stop_reason, content: [{ type: "text", text: '{"psa_rea' }] });
      await expect(extractSuggestedUpdates("text", OPTS)).rejects.toMatchObject({
        message: "The document was too long to extract in one pass.",
      });
    },
  );

  it("returns a fresh empty object each time", () => {
    expect(emptyUpdates()).toEqual(EMPTY_UPDATES);
    expect(emptyUpdates().lab_results).not.toBe(emptyUpdates().lab_results);
  });

  it("reports a refusal and unparseable output as errors", async () => {
    create.mockResolvedValue({ stop_reason: "refusal", content: [] });
    await expect(extractSuggestedUpdates("text", OPTS)).rejects.toMatchObject({ code: "REFUSAL" });
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "nope" }],
    });
    await expect(extractSuggestedUpdates("text", OPTS)).rejects.toMatchObject({ code: "API" });
  });
});

type Schema = {
  type?: string;
  anyOf?: Schema[];
  enum?: unknown[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
};

/** Just enough JSON Schema for the subset the extraction schema uses. Returns error strings. */
function validate(value: unknown, schema: Schema, path = "$"): string[] {
  if (schema.anyOf) {
    const attempts = schema.anyOf.map((s) => validate(value, s, path));
    return attempts.some((e) => e.length === 0) ? [] : [`${path}: matches no anyOf branch`];
  }
  if (schema.enum && !schema.enum.includes(value)) return [`${path}: not in enum`];
  switch (schema.type) {
    case "null":
      return value === null ? [] : [`${path}: expected null`];
    case "string":
    case "number":
    case "boolean":
      return typeof value === schema.type ? [] : [`${path}: expected ${schema.type}`];
    case "array":
      return Array.isArray(value)
        ? value.flatMap((v, i) => validate(v, schema.items!, `${path}[${i}]`))
        : [`${path}: expected array`];
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return [`${path}: expected object`];
      }
      const obj = value as Record<string, unknown>;
      const props = schema.properties ?? {};
      const errors = (schema.required ?? [])
        .filter((k) => !(k in obj))
        .map((k) => `${path}.${k}: missing`);
      for (const [k, v] of Object.entries(obj)) {
        if (props[k]) errors.push(...validate(v, props[k], `${path}.${k}`));
        else if (schema.additionalProperties === false) errors.push(`${path}.${k}: unexpected`);
      }
      return errors;
    }
    default:
      return [`${path}: unsupported schema`];
  }
}

describe("sample documents", () => {
  it("every precomputed sample validates against the same schema", () => {
    for (const sample of SAMPLE_DOCUMENTS) {
      expect(validate(sample.precomputed, SUGGESTED_UPDATES_SCHEMA as Schema), sample.id).toEqual(
        [],
      );
    }
  });

  it("the validator rejects bad data", () => {
    const bad = { ...EMPTY_UPDATES, plan_items: [{ title: "x", status: "Nope" }] };
    expect(validate(bad, SUGGESTED_UPDATES_SCHEMA as Schema).length).toBeGreaterThan(0);
  });

  it("holds the extractions the brief calls for", () => {
    const lab = SAMPLE_DOCUMENTS.find((s) => s.id === "lab-report")!.precomputed;
    expect(lab.lab_results!.length).toBeGreaterThanOrEqual(4);
    const note = SAMPLE_DOCUMENTS.find((s) => s.id === "visit-note")!.precomputed;
    expect(note.plan_items).toHaveLength(1);
    expect(note.medications).toHaveLength(1);
    expect(note.care_team).toHaveLength(1);
  });
});
