import { describe, expect, it } from "vitest";
import { humanError, invokeErrorText } from "./humanError";

describe("humanError", () => {
  it("names the common failures in words", () => {
    expect(humanError(new Error("History entry not found"))).toBe("That item no longer exists.");
    expect(humanError("Restore failed")).toBe("That item is already in the record.");
    expect(humanError(new Error("Invalid date"))).toBe("Use a valid date.");
    expect(humanError({ message: "Failed to fetch" })).toBe(
      "Could not reach the server. Try again.",
    );
    expect(humanError(new Error("The save took too long"))).toBe("That took too long. Try again.");
  });

  it("never passes raw database text through", () => {
    const raw = 'update or delete on table "documents" violates foreign key constraint "fk_x"';
    expect(humanError(new Error(raw))).toBe("Something went wrong. Try again.");
    expect(humanError(undefined)).toBe("Something went wrong. Try again.");
  });
});

describe("invokeErrorText", () => {
  it("prefers the body's error, then the error's context body, then the client message", async () => {
    expect(await invokeErrorText({ ok: false, error: "Invalid table" }, null)).toBe(
      "Invalid table",
    );
    const http = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: { json: async () => ({ ok: false, error: "That item no longer exists" }) },
    });
    expect(await invokeErrorText(null, http)).toBe("That item no longer exists");
    expect(await invokeErrorText(null, new Error("Failed to fetch"))).toBe("Failed to fetch");
  });
});
