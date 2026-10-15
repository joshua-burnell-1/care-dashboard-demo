import { describe, expect, it } from "vitest";
import { parseSearch, stringifySearch } from "./searchParams";

describe("parseSearch", () => {
  it("keeps every value a string, numbers and flags included", () => {
    expect(parseSearch("?q=123&page=2&abnormal=1&flag=true")).toEqual({
      q: "123",
      page: "2",
      abnormal: "1",
      flag: "true",
    });
  });

  it("decodes values and handles an empty string", () => {
    expect(parseSearch("?q=red%20cells")).toEqual({ q: "red cells" });
    expect(parseSearch("")).toEqual({});
  });
});

describe("stringifySearch", () => {
  it("writes strings as typed and primitives with String", () => {
    expect(stringifySearch({ q: "123", page: 2, abnormal: true })).toBe(
      "?q=123&page=2&abnormal=true",
    );
  });

  it("drops undefined and null and returns empty for nothing", () => {
    expect(stringifySearch({ q: undefined, page: null })).toBe("");
  });

  it("round-trips free text through parseSearch", () => {
    const search = { q: "123", panel: "CBC & diff" };
    expect(parseSearch(stringifySearch(search))).toEqual(search);
  });
});
