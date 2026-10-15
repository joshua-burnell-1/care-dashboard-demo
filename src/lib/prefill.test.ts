import { describe, expect, it } from "vitest";
import { mergePrefill } from "./prefill";

describe("mergePrefill", () => {
  it("uses the prompt alone when there is no draft", () => {
    expect(mergePrefill("", "Is this normal?")).toBe("Is this normal?");
    expect(mergePrefill("   ", "Is this normal?")).toBe("Is this normal?");
  });

  it("keeps a typed draft and adds the prompt after it", () => {
    expect(mergePrefill("also, one more thing ", "Is this normal?")).toBe(
      "also, one more thing Is this normal?",
    );
  });

  it("does not add the same prompt twice", () => {
    expect(mergePrefill("Is this normal?", "Is this normal?")).toBe("Is this normal?");
    expect(mergePrefill("hi Is this normal?", "Is this normal?")).toBe("hi Is this normal?");
  });
});
