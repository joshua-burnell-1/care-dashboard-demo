// src/demo/seed/seed.test.ts
import { describe, it, expect } from "vitest";
import { buildSeed } from "./index";
import { PERSONA, TIMELINE } from "../persona";
import { formatLongDate, isoDaysFromToday } from "../dates";
import { psaDoublingMonths } from "@/lib/psaDoubling";
const days = (a: string, b: Date) =>
  Math.round((new Date(a + "T00:00:00").getTime() - b.getTime()) / 86400000);

describe.each([new Date("2026-10-14T12:00:00"), new Date("2028-03-01T12:00:00")])(
  "seed at %s",
  (today) => {
    const s = buildSeed(today);
    it("has 3 upcoming plan items", () =>
      expect(s.plan_items.filter((p) => days(p.event_date as string, today) > 0)).toHaveLength(3));
    it("ends with a rising post-rad PSA under 0.20", () => {
      const post = s.psa_readings.filter((r) => r.phase === "post-rad");
      expect(post.length).toBeGreaterThanOrEqual(5);
      const last = post.at(-1)!;
      expect(last.value).toBeLessThan(0.2);
      expect(days(last.date as string, today)).toBeGreaterThan(-30);
    });
    it("places every post-rad PSA after radiation ends, rising, about 2.5 months doubling", () => {
      const post = s.psa_readings.filter((r) => r.phase === "post-rad");
      const radEnd = isoDaysFromToday(TIMELINE.radiationEnd, today);
      expect(post.every((r) => (r.date as string) > radEnd)).toBe(true);
      for (let i = 1; i < post.length; i++) {
        expect(post[i].value!).toBeGreaterThan(post[i - 1].value!);
        // The decision tree escalates at "two draws with doubling under two months": the seed must not meet it.
        const days = (Date.parse(post[i].date) - Date.parse(post[i - 1].date)) / 86400000;
        const doubling = (days * Math.LN2) / Math.log(post[i].value! / post[i - 1].value!);
        expect(doubling).toBeGreaterThan(61);
      }
      expect(psaDoublingMonths(post)).toBeCloseTo(2.5, 0);
    });
    it("quotes the post-rad PSA values in the summary and the latest plan item", () => {
      const post = s.psa_readings.filter((r) => r.phase === "post-rad").map((r) => String(r.value));
      const summary = (
        s.dashboard_sections.find((r) => r.key === "summary")!.content as string[]
      )[0];
      for (const v of post) expect(summary).toContain(v);
      const done = s.plan_items.find((p) => p.status === "Completed")!;
      expect(done.body).toContain(`${post.at(-1)} ng/mL, up from ${post.at(-2)}`);
    });
    it("uses no family-relationship words in the seeded text", () => {
      expect(JSON.stringify(s)).not.toMatch(/\b(dad|father|mom|mother|son|daughter)('s)?\b/i);
    });
    it("names the fictional patient in the record", () => {
      const rec = s.dashboard_sections.find((r) => r.key === "patient_record_md")!;
      expect(String(rec.content)).toContain(PERSONA.fullName);
    });
    it("seeds 3 to 4 open questions, each tied to an upcoming plan item", () => {
      const questions = s.dashboard_sections.find((r) => r.key === "open_questions")!.content as {
        id: string;
        text: string;
        visit_id: string;
      }[];
      expect(questions.length).toBeGreaterThanOrEqual(3);
      expect(questions.length).toBeLessThanOrEqual(4);
      expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
      for (const q of questions) {
        const visit = s.plan_items.find((p) => p.id === q.visit_id)!;
        expect(days(visit.event_date as string, today)).toBeGreaterThan(0);
        expect(q.text.endsWith("?")).toBe(true);
      }
    });
    it("has all 12 dashboard section keys", () => {
      for (const k of [
        "patient",
        "summary",
        "doctors",
        "agreements",
        "disagreements",
        "red_flags",
        "decision_tree",
        "nutrition_foods",
        "nutrition_avoid",
        "pathology_features",
        "doubling_bands",
        "glossary",
      ])
        expect(s.dashboard_sections.some((r) => r.key === k)).toBe(true);
    });
    it("gives the patient section the fields the UI copy needs", () => {
      const p = s.dashboard_sections.find((r) => r.key === "patient")!.content as Record<
        string,
        unknown
      >;
      expect(p.name).toBe(PERSONA.fullName);
      expect(p.first_name).toBe(PERSONA.firstName);
      expect(p.surgery_date).toBe(isoDaysFromToday(TIMELINE.surgery, today));
      expect(p.radiation_end_date).toBe(isoDaysFromToday(TIMELINE.radiationEnd, today));
      for (const k of ["diagnosis", "status", "updated"]) expect(typeof p[k]).toBe("string");
    });
    it("flags exactly 2 lab results and has at least 20", () => {
      expect(s.lab_results.length).toBeGreaterThanOrEqual(20);
      expect(s.lab_results.filter((l) => l.flag)).toHaveLength(2);
    });
    it("has 3 indexed documents stored under demo/", () => {
      expect(s.documents).toHaveLength(3);
      for (const d of s.documents) {
        expect(d.status).toBe("indexed");
        expect(d.storage_path.startsWith("demo/")).toBe(true);
        expect(d.extracted_text.length).toBeGreaterThan(0);
      }
    });
    it("dates both specialist visits after the latest PSA draw", () => {
      const latest = s.psa_readings.at(-1)!.date;
      const rec = String(s.dashboard_sections.find((r) => r.key === "patient_record_md")!.content);
      for (const offset of [TIMELINE.urologyVisit, TIMELINE.secondOpinionVisit]) {
        expect(isoDaysFromToday(offset, today) > latest).toBe(true);
        expect(rec).toContain(formatLongDate(isoDaysFromToday(offset, today)));
      }
    });
    it("calls the radiation adjuvant, never salvage, since PSA was undetectable before it", () => {
      expect(JSON.stringify(s)).not.toMatch(/salvage/i);
      const beforeRadiation = s.psa_readings.filter((r) => r.phase === "post-op");
      expect(beforeRadiation.every((r) => r.value !== null && r.value < 0.01)).toBe(true);
    });
    it("derives the record's red flags, nutrition and glossary from the same items as the sections", () => {
      const content = (key: string) =>
        s.dashboard_sections.find((r) => r.key === key)!.content as Record<string, string>[];
      const rec = String(
        s.dashboard_sections.find((r) => r.key === "patient_record_md")!.content,
      ).split("\n");
      const has = (line: string) => expect(rec).toContain(line);
      expect(content("red_flags")).toHaveLength(9);
      content("red_flags").forEach((r) => has(`- ${r.title}: ${r.body}`));
      content("glossary").forEach((g) => has(`- ${g.term}: ${g.def}`));
      content("nutrition_foods").forEach((f) => has(`- ${f.name} (${f.goal}): ${f.why}`));
      content("nutrition_avoid").forEach((f) => has(`- ${f.name}: ${f.body}`));
    });
    it("tags every nutrition item as food or drink, with drinks on both lists", () => {
      for (const key of ["nutrition_foods", "nutrition_avoid"]) {
        const items = s.dashboard_sections.find((r) => r.key === key)!.content as {
          category: string;
        }[];
        expect(items.every((i) => i.category === "food" || i.category === "drink")).toBe(true);
        expect(items.some((i) => i.category === "drink")).toBe(true);
      }
    });
    it("keeps edit-history timestamps consistent with the rows they snapshot", () => {
      for (const e of s.edit_history) {
        const after = e.new_data as { created_at?: string; updated_at?: string };
        const before = e.old_data as { updated_at?: string } | null;
        if (e.operation === "INSERT") expect(e.changed_at).toBe(after.created_at);
        if (e.operation === "UPDATE") {
          expect(after.updated_at).toBe(e.changed_at);
          expect(e.changed_at >= before!.updated_at!).toBe(true);
        }
      }
    });
    it("gives every row a unique id per table", () => {
      for (const [t, rows] of Object.entries(s)) {
        if (t === "dashboard_sections") continue;
        const ids = (rows as { id?: unknown }[]).map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  },
);
