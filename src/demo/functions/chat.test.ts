import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "@anthropic-ai/sdk";
import { DemoDb } from "../db";
import { PERSONA } from "../persona";
import { buildSeed } from "../seed";
import { createDemoChat } from "./chat";

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

const TODAY = new Date("2026-10-14T12:00:00");
const history = [{ role: "user" as const, content: "What was the last PSA?" }];

let db: DemoDb;
beforeEach(() => {
  db = new DemoDb(() => buildSeed(TODAY), null);
  create.mockReset();
  ctor.mockReset();
  create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] });
});

describe("createDemoChat", () => {
  it("returns NO_API_KEY without calling the SDK when no key", async () => {
    const chat = createDemoChat(db, () => null);
    const res = await chat({ messages: history });
    expect(res).toEqual({ error: "Add your Anthropic API key to chat.", code: "NO_API_KEY" });
    expect(ctor).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("sends model claude-opus-5-5, the fallback beta, and the persona's record in system", async () => {
    const record = db.all("dashboard_sections").find((s) => s.key === "patient_record_md")!
      .content as string;
    const chat = createDemoChat(db, () => "sk-test");
    await chat({ messages: history, pageContext: "PSA trend" });

    expect(ctor).toHaveBeenCalledWith({ apiKey: "sk-test", dangerouslyAllowBrowser: true });
    const args = create.mock.calls[0][0];
    expect(args).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      messages: history,
    });
    expect(args.system).toContain(PERSONA.fullName);
    expect(args.system).toContain(record);
    expect(args.system).toContain('"PSA trend"');
    expect(args.system).toContain("STRUCTURED LAB VALUES");
  });

  it("omits the page context line when there is none", async () => {
    await createDemoChat(db, () => "sk-test")({ messages: history });
    expect(create.mock.calls[0][0].system).not.toContain("was viewing");
  });

  it("maps AuthenticationError to BAD_KEY", async () => {
    create.mockRejectedValue(
      new AuthenticationError(401, { type: "error" }, "invalid x-api-key", new Headers()),
    );
    const res = await createDemoChat(db, () => "sk-bad")({ messages: history });
    expect(res).toEqual({
      error: "That API key was rejected. Check it and try again.",
      code: "BAD_KEY",
    });
  });

  it("clears the stored key when it is rejected", async () => {
    const removeItem = vi.fn();
    vi.stubGlobal("sessionStorage", { removeItem });
    create.mockRejectedValue(
      new AuthenticationError(401, { type: "error" }, "invalid x-api-key", new Headers()),
    );
    await createDemoChat(db, () => "sk-bad")({ messages: history });
    expect(removeItem).toHaveBeenCalledWith("care_demo_anthropic_key");
    vi.unstubAllGlobals();
  });

  it("keeps the stored key on other errors", async () => {
    const removeItem = vi.fn();
    vi.stubGlobal("sessionStorage", { removeItem });
    create.mockRejectedValue(new Error("boom"));
    await createDemoChat(db, () => "sk-ok")({ messages: history });
    expect(removeItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("maps refusal stop_reason to REFUSAL", async () => {
    create.mockResolvedValue({ stop_reason: "refusal", content: [] });
    const res = await createDemoChat(db, () => "sk-test")({ messages: history });
    expect(res).toMatchObject({ code: "REFUSAL" });
  });

  it("joins text blocks", async () => {
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: "", signature: "" },
        { type: "text", text: "Hello " },
        { type: "text", text: "there" },
      ],
    });
    const res = await createDemoChat(db, () => "sk-test")({ messages: history });
    expect(res).toEqual({ text: "Hello there" });
  });

  it("never echoes the key in an error", async () => {
    create.mockRejectedValue(new Error("boom sk-secret"));
    const res = await createDemoChat(db, () => "sk-secret")({ messages: history });
    expect(JSON.stringify(res)).not.toContain("sk-secret");
    expect(res).toMatchObject({ code: "API" });
  });
});
