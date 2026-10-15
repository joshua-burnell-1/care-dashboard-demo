import { describe, it, expect } from "vitest";
import { tourCopy } from "./tourCopy";

const text = (demo: boolean) =>
  tourCopy("Sam", demo)
    .map((s) => `${s.title} ${s.body}`)
    .join("\n");

describe("tourCopy", () => {
  it("describes the demo accurately", () => {
    const t = text(true);
    expect(t).toMatch(/fictional/);
    expect(t).toMatch(/only in this browser/);
    expect(t).toMatch(/no key needed/);
    expect(t).toMatch(/\.txt, \.md or \.csv/);
    expect(t).toMatch(/Reset demo data/);
    expect(t).not.toMatch(/secure|family members|PDF, photo/);
  });
  it("makes no claims beyond the shared app in real mode", () => {
    expect(text(false)).not.toMatch(/family members|secure|fictional/);
  });
  it("uses no em dashes", () => {
    expect(text(true) + text(false)).not.toContain("—");
  });
});
