import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError } from "@anthropic-ai/sdk";
import { DEMO_MODEL, FALLBACK_PARAMS } from "./anthropic";
import { buildVisitPrepPrompt, streamVisitPrep, VisitPrepError } from "./visitPrep";

const { stream, ctor } = vi.hoisted(() => ({ stream: vi.fn(), ctor: vi.fn() }));

// Keep the real error classes (the code under test uses instanceof); fake only the client.
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  const Fake = vi.fn(function (this: unknown, opts: unknown) {
    ctor(opts);
    return { beta: { messages: { stream } } };
  });
  return { ...actual, default: Fake };
});

const INPUT = {
  planItem: {
    title: "Radiation oncology consult",
    event_date: "2026-11-03",
    body: "Discuss salvage radiation timing.",
  },
  record: "Patient record: prostatectomy in the spring.",
  recentPsa: [
    { date: "2026-07-20", value: 0.12 },
    { date: "2026-09-15", value: 0.37 },
  ],
  medications: ["Vitamin D3 2000 IU", "Tamsulosin 0.4 mg"],
};

const delta = (text: string) => ({
  type: "content_block_delta",
  index: 0,
  delta: { type: "text_delta", text },
});

/** An async-iterable stand-in for the SDK's message stream. */
function fakeStream(
  events: unknown[],
  opts?: { throwAfter?: unknown; onEvent?: () => void; doneError?: unknown },
) {
  return {
    done: async () => {
      if (opts?.doneError) throw opts.doneError;
    },
    async *[Symbol.asyncIterator]() {
      for (const e of events) {
        opts?.onEvent?.();
        yield e;
      }
      if (opts?.throwAfter) throw opts.throwAfter;
    },
  };
}

beforeEach(() => {
  stream.mockReset();
  ctor.mockReset();
});

describe("buildVisitPrepPrompt", () => {
  it("prompt includes the plan item, latest PSA, and medications", () => {
    const { user } = buildVisitPrepPrompt(INPUT);
    expect(user).toContain("Radiation oncology consult");
    expect(user).toContain("2026-11-03");
    expect(user).toContain("Discuss salvage radiation timing.");
    expect(user).toContain("2026-09-15");
    expect(user).toContain("0.37");
    expect(user).toContain("Vitamin D3 2000 IU");
    expect(user).toContain("Tamsulosin 0.4 mg");
    expect(user).toContain("prostatectomy in the spring");
  });

  it("prompt caps questions at 8 and asks for the three headings", () => {
    const { system } = buildVisitPrepPrompt(INPUT);
    expect(system).toMatch(/at most 8 questions/i);
    for (const h of [
      "## What's changed since last visit",
      "## Questions to ask",
      "## Bring with you",
    ]) {
      expect(system).toContain(h);
    }
    expect(system).toContain("Not medical advice.");
  });

  it("says so when there are no PSA readings or medications", () => {
    const { user } = buildVisitPrepPrompt({ ...INPUT, recentPsa: [], medications: [] });
    expect(user).toMatch(/no PSA readings/i);
    expect(user).toMatch(/no medications/i);
  });

  it("shows a missing PSA value as not recorded", () => {
    const { user } = buildVisitPrepPrompt({
      ...INPUT,
      recentPsa: [{ date: "2026-09-15", value: null }],
    });
    expect(user).toMatch(/2026-09-15: not recorded/);
  });

  it("only sends the five most recent PSA readings", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ date: `2026-0${i + 1}-01`, value: i + 1 }));
    const { user } = buildVisitPrepPrompt({ ...INPUT, recentPsa: many });
    expect(user).toContain("2026-09-01");
    expect(user).toContain("2026-05-01");
    expect(user).not.toContain("2026-04-01");
  });
});

describe("streamVisitPrep", () => {
  it("streamVisitPrep forwards text deltas in order", async () => {
    stream.mockReturnValue(
      fakeStream([
        { type: "message_start" },
        delta("## What's "),
        { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "x" } },
        delta("changed"),
        { type: "message_delta", delta: { stop_reason: "end_turn" } },
      ]),
    );
    const chunks: string[] = [];
    await streamVisitPrep(INPUT, { apiKey: "sk-test", onText: (t) => chunks.push(t) });
    expect(chunks).toEqual(["## What's ", "changed"]);
    expect(ctor).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "sk-test" }));
  });

  it("sends the model, fallback params, low effort, and the built prompt", async () => {
    stream.mockReturnValue(fakeStream([]));
    const ac = new AbortController();
    await streamVisitPrep(INPUT, { apiKey: "k", onText: () => {}, signal: ac.signal });
    const [args, options] = stream.mock.calls[0];
    const prompt = buildVisitPrepPrompt(INPUT);
    expect(args.model).toBe(DEMO_MODEL);
    expect(args.max_tokens).toBe(16000);
    expect(args.betas).toEqual(FALLBACK_PARAMS.betas);
    expect(args.fallbacks).toBe(FALLBACK_PARAMS.fallbacks);
    expect(args.output_config).toEqual({ effort: "low" });
    expect(args.system).toBe(prompt.system);
    expect(args.messages).toEqual([{ role: "user", content: prompt.user }]);
    expect(options.signal).toBe(ac.signal);
  });

  it("streamVisitPrep maps errors", async () => {
    stream.mockReturnValue(
      fakeStream([], {
        throwAfter: new AuthenticationError(401, { type: "error" }, "no", new Headers()),
      }),
    );
    const err = await streamVisitPrep(INPUT, { apiKey: "k", onText: () => {} }).catch((e) => e);
    expect(err).toBeInstanceOf(VisitPrepError);
    expect(err).toMatchObject({
      code: "BAD_KEY",
      message: "That API key was rejected. Check it and try again.",
    });
  });

  it("maps an error thrown while opening the stream", async () => {
    stream.mockImplementation(() => {
      throw new Error("boom");
    });
    await expect(streamVisitPrep(INPUT, { apiKey: "k", onText: () => {} })).rejects.toMatchObject({
      code: "API",
    });
  });

  it("maps an error that only done() reports", async () => {
    stream.mockReturnValue(
      fakeStream([delta("partial")], {
        doneError: new AuthenticationError(401, { type: "error" }, "no", new Headers()),
      }),
    );
    await expect(streamVisitPrep(INPUT, { apiKey: "k", onText: () => {} })).rejects.toMatchObject({
      code: "BAD_KEY",
    });
  });

  it("reports a refusal", async () => {
    stream.mockReturnValue(
      fakeStream([{ type: "message_delta", delta: { stop_reason: "refusal" } }]),
    );
    await expect(streamVisitPrep(INPUT, { apiKey: "k", onText: () => {} })).rejects.toMatchObject({
      code: "REFUSAL",
    });
  });

  it("reports a reply cut off at the token limit", async () => {
    stream.mockReturnValue(
      fakeStream([
        delta("partial"),
        { type: "message_delta", delta: { stop_reason: "max_tokens" } },
      ]),
    );
    await expect(streamVisitPrep(INPUT, { apiKey: "k", onText: () => {} })).rejects.toMatchObject({
      code: "API",
      message: expect.stringMatching(/cut off/i),
    });
  });

  it("abort stops forwarding", async () => {
    const ac = new AbortController();
    stream.mockReturnValue(fakeStream([delta("one"), delta("two"), delta("three")]));
    const chunks: string[] = [];
    await streamVisitPrep(INPUT, {
      apiKey: "k",
      signal: ac.signal,
      onText: (t) => {
        chunks.push(t);
        if (t === "one") ac.abort();
      },
    });
    expect(chunks).toEqual(["one"]);
  });

  it("resolves quietly when the SDK throws because of an abort", async () => {
    const ac = new AbortController();
    ac.abort();
    stream.mockReturnValue(fakeStream([], { throwAfter: new Error("Request was aborted.") }));
    await expect(
      streamVisitPrep(INPUT, { apiKey: "k", signal: ac.signal, onText: () => {} }),
    ).resolves.toBeUndefined();
  });
});
