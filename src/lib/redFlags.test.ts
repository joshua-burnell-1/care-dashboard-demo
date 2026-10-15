import { describe, it, expect } from "vitest";
import { buildSeed } from "@/demo/seed";
import { groupRedFlags } from "./redFlags";

describe("groupRedFlags", () => {
  it("sorts flags into the three tiers by their title prefix and drops the prefix", () => {
    const tiers = groupRedFlags([
      { title: "Go to the emergency department now: cannot pass urine at all", body: "a" },
      { title: "Call the care team the same day: fever of 100.4°F or higher", body: "b" },
      { title: "Mention at the next visit: tiredness that does not lift", body: "c" },
    ]);
    expect(tiers.er).toEqual([{ title: "Cannot pass urine at all", body: "a" }]);
    expect(tiers.today).toEqual([{ title: "Fever of 100.4°F or higher", body: "b" }]);
    expect(tiers.next).toEqual([{ title: "Tiredness that does not lift", body: "c" }]);
  });

  it("treats an unprefixed flag as a same-day call", () => {
    expect(groupRedFlags([{ title: "Something new", body: "" }]).today).toHaveLength(1);
  });

  it("splits the seed's nine flags three ways", () => {
    const flags = buildSeed().dashboard_sections.find((s) => s.key === "red_flags")!.content as {
      title: string;
      body: string;
    }[];
    const tiers = groupRedFlags(flags);
    expect([tiers.er.length, tiers.today.length, tiers.next.length]).toEqual([3, 3, 3]);
  });
});
