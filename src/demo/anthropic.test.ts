import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { mapAnthropicError } from "./anthropic";

const h = new Headers();

describe("mapAnthropicError", () => {
  it("maps rate limits", () => {
    const e = new Anthropic.RateLimitError(429, { type: "error" }, "slow down", h);
    expect(mapAnthropicError(e).code).toBe("RATE_LIMIT");
  });

  it("maps connection failures", () => {
    expect(mapAnthropicError(new Anthropic.APIConnectionError({ message: "offline" })).code).toBe(
      "NETWORK",
    );
  });

  it("maps other API errors with their status", () => {
    const e = new Anthropic.InternalServerError(500, { type: "error" }, "oops", h);
    const res = mapAnthropicError(e);
    expect(res.code).toBe("API");
    expect(res.error).toContain("500");
  });

  it("maps unknown throwables to API", () => {
    expect(mapAnthropicError("weird").code).toBe("API");
  });
});
