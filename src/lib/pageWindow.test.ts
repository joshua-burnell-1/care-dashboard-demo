import { describe, expect, it } from "vitest";
import { pageWindow } from "./pageWindow";

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("skips the middle of a long run, keeping the ends and the neighbors of the current page", () => {
    expect(pageWindow(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
  });

  it("shows a longer run near either end", () => {
    expect(pageWindow(1, 12)).toEqual([1, 2, 3, 4, null, 12]);
    expect(pageWindow(12, 12)).toEqual([1, null, 9, 10, 11, 12]);
  });
});
