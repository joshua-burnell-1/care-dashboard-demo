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
  it("describes the routed layout, not the old tabs and banner", () => {
    for (const t of [text(true), text(false)]) {
      expect(t).toMatch(/Documents/);
      expect(t).toMatch(/Assistant from the button in the top bar/);
      expect(t).not.toMatch(/Records tab|Seven tabs|Daily Care|Background|side panel|banner/);
    }
    expect(text(true)).toMatch(/Demo menu/);
  });
  it("describes editing in place with Undo, not the retired edit mode", () => {
    for (const t of [text(true), text(false)]) {
      expect(t).toMatch(/edit it in place/);
      expect(t).toMatch(/Undo/);
      expect(t).not.toMatch(/edit mode/i);
    }
  });
  it("uses no em dashes", () => {
    expect(text(true) + text(false)).not.toContain("—");
  });
});
