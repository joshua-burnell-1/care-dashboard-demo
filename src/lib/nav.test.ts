import { describe, expect, it } from "vitest";
import { NAV_ITEMS, navItemForPath } from "./nav";

describe("NAV_ITEMS", () => {
  it("lists the sections in order with four tabs and the rest under More", () => {
    expect(NAV_ITEMS.map((i) => [i.to, i.label, i.mobile])).toEqual([
      ["/", "Today", "tab"],
      ["/labs", "Labs", "tab"],
      ["/plan", "Plan", "tab"],
      ["/documents", "Documents", "tab"],
      ["/team", "Team", "more"],
      ["/learn", "Learn", "more"],
      ["/activity", "Activity", "more"],
      ["/circle", "Care circle", "more"],
      ["/reminders", "Reminders", "more"],
    ]);
  });
});

describe("navItemForPath", () => {
  it("matches the home route only exactly", () => {
    expect(navItemForPath("/")?.label).toBe("Today");
    expect(navItemForPath("/nope")).toBeUndefined();
  });

  it("matches a section and its detail pages, ignoring a trailing slash", () => {
    expect(navItemForPath("/labs")?.label).toBe("Labs");
    expect(navItemForPath("/labs/")?.label).toBe("Labs");
    expect(navItemForPath("/labs/hemoglobin")?.label).toBe("Labs");
    expect(navItemForPath("/plan/abc")?.label).toBe("Plan");
  });

  it("does not match a path that only shares a prefix", () => {
    expect(navItemForPath("/labsx")).toBeUndefined();
  });
});
