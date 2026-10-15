import { describe, expect, it, vi } from "vitest";
import { buildCommands, scoreCommand } from "./commands";
import { NAV_ITEMS } from "./nav";

const DATA = {
  metrics: ["Hemoglobin", "HbA1c (Hemoglobin A1c)", "PSA Total"],
  planItems: [{ id: "plan-1", title: "Scan with the oncologist" }],
  documents: [{ id: "doc-1", name: "Lab report.pdf" }],
};

describe("buildCommands", () => {
  const commands = buildCommands(DATA);

  it("has a page command for every nav item, in nav order", () => {
    const pages = commands.filter((c) => c.group === "Pages");
    expect(pages.map((c) => [c.label, c.to])).toEqual(NAV_ITEMS.map((i) => [i.label, i.to]));
  });

  it("has one lab result command per metric, routed by slug", () => {
    const labs = commands.filter((c) => c.group === "Lab results");
    expect(labs.map((c) => [c.label, c.to])).toEqual([
      ["Hemoglobin", "/labs/hemoglobin"],
      ["HbA1c (Hemoglobin A1c)", "/labs/hba1c"],
      ["PSA Total", "/labs/psa-total"],
    ]);
  });

  it("skips a metric whose slug repeats an earlier one", () => {
    const deduped = buildCommands({
      ...DATA,
      metrics: ["Hemoglobin", "hemoglobin", "Hemoglobin A1c", "HbA1c"],
    });
    expect(deduped.filter((c) => c.group === "Lab results").map((c) => c.to)).toEqual([
      "/labs/hemoglobin",
      "/labs/hba1c",
    ]);
  });

  it("routes plan items and documents to their detail pages", () => {
    expect(commands.find((c) => c.group === "Plan")).toMatchObject({
      label: "Scan with the oncologist",
      to: "/plan/plan-1",
    });
    expect(commands.find((c) => c.group === "Documents")).toMatchObject({
      label: "Lab report.pdf",
      to: "/documents/doc-1",
    });
  });

  it("lists the six actions", () => {
    const actions = commands.filter((c) => c.group === "Actions");
    expect(actions.map((c) => c.label)).toEqual([
      "Ask the assistant",
      "Upload a document",
      "Add PSA reading",
      "Toggle theme",
      "Reset demo data",
      "Take the tour",
    ]);
  });

  it("gives every command a unique id", () => {
    const ids = commands.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("attaches the matching handler as an action's run, and leaves the rest without one", () => {
    const tour = vi.fn();
    const withHandler = buildCommands(DATA, { "take-tour": tour });
    const actions = withHandler.filter((c) => c.group === "Actions");
    actions.find((c) => c.label === "Take the tour")?.run?.();
    expect(tour).toHaveBeenCalledOnce();
    expect(actions.find((c) => c.label === "Toggle theme")?.run).toBeUndefined();
  });
});

describe("scoreCommand", () => {
  it("shows everything for an empty query", () => {
    expect(scoreCommand("Hemoglobin", "")).toBeGreaterThan(0);
    expect(scoreCommand("Hemoglobin", "   ")).toBeGreaterThan(0);
  });

  it("hides a command that does not contain every word", () => {
    expect(scoreCommand("Hemoglobin", "xyz")).toBe(0);
    expect(scoreCommand("Take the tour", "tour zebra")).toBe(0);
  });

  it("does not match scattered letters", () => {
    expect(scoreCommand("eGFR (Estimated Glomerular Filtration Rate)", "tour")).toBe(0);
  });

  it("ranks label start, then word start, then mid-word, then keyword", () => {
    const start = scoreCommand("Hemoglobin", "hemo");
    const word = scoreCommand("MCH (Mean Cell Hemoglobin)", "hemo");
    const middle = scoreCommand("Oxyhemoglobin", "hemo");
    const keyword = scoreCommand("Take the tour", "intro", ["intro"]);
    expect(start).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(keyword);
    expect(keyword).toBeGreaterThan(0);
  });

  it("matches words in any order and ignores case", () => {
    expect(scoreCommand("Add PSA reading", "READING add")).toBeGreaterThan(0);
  });

  it("puts the shorter label first on an equal match", () => {
    expect(scoreCommand("Plan", "plan")).toBeGreaterThan(scoreCommand("Plan review notes", "plan"));
  });
});
