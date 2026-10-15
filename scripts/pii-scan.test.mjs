import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  blankAllowed,
  formatFinding,
  parseAllowlist,
  parseDenylist,
  scanPath,
  scanText,
} from "./pii-scan-core.mjs";
const rules = (t, deny = []) => scanText(t, "f.ts", deny).map((f) => f.rule);
describe("scanText", () => {
  it("flags real-looking emails but allows example.com and resend.dev", () => {
    expect(rules("a" + "@gmail.com")).toEqual(["email"]);
    expect(rules("x@example.com onboarding@resend.dev")).toEqual([]);
  });
  it("flags anthropic keys", () =>
    expect(rules("sk-" + "ant-api03-abcdefghijkl")).toEqual(["anthropic-key"]));
  it("flags JWTs", () =>
    expect(rules("ey" + "JhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.sig")).toEqual(["jwt"]));
  it("flags supabase project refs", () =>
    expect(rules("https://abcdefghijklmnopqrst" + ".supabase.co")).toEqual(["supabase-ref"]));
  it("flags postgres URLs", () =>
    expect(rules("postgres" + "ql://u@host:5432/db")).toEqual(["postgres-url"]));
  it("flags denylist literals case-insensitively and reports line numbers", () => {
    expect(scanText("ok\nJohn SMITH", "f.ts", ["john smith"])).toEqual([
      { file: "f.ts", line: 2, rule: "denylist" },
    ]);
  });
  it("does not flag a lockfile integrity hash", () =>
    expect(rules("sha512-eyJIkqGIDMZPw==")).toEqual([]));
  it("collapses whitespace runs on both entry and line before matching", () => {
    expect(rules("John Smith", ["john  smith"])).toEqual(["denylist"]);
    expect(rules("John \t  Smith", ["john smith"])).toEqual(["denylist"]);
  });
});

describe("scanPath", () => {
  it("flags denylist literals in file paths at line 0", () => {
    expect(scanPath("src/data/John-Smith.md", ["john-smith"])).toEqual([
      { file: "src/data/John-Smith.md", line: 0, rule: "denylist-path" },
    ]);
    expect(scanPath("src/app.ts", ["john-smith"])).toEqual([]);
  });
});

describe("parseDenylist", () => {
  it("drops comments and blanks, so a comment-only file yields zero entries", () => {
    expect(parseDenylist("# c\n\n  \n")).toEqual([]);
    expect(parseDenylist("# c\n Foo Bar \r\n\nbaz\n")).toEqual(["Foo Bar", "baz"]);
  });
});

describe("formatFinding", () => {
  const f = (file, rule) => ({ file, line: 0, rule });
  it("withholds a sensitive path for every rule", () => {
    expect(formatFinding(f("Gone-Secret.md", "unreadable"), 7, true)).toBe(
      "<tracked path #7>:0 unreadable",
    );
    expect(formatFinding({ file: "Gone-Secret.md", line: 3, rule: "denylist" }, 7, true)).toBe(
      "<tracked path #7>:3 denylist",
    );
    expect(formatFinding(f("Gone-Secret.md", "denylist-path"), 7, true)).toBe(
      "<tracked path #7>:0 denylist-path",
    );
  });
  it("prints a non-sensitive path normally", () => {
    expect(formatFinding({ file: "src/a.ts", line: 4, rule: "email" }, 2, false)).toBe(
      "src/a.ts:4 email",
    );
  });
});

describe("allowlist", () => {
  const allow = ["beta-zq-77"];
  it("does not flag an allowlisted literal that contains a denylisted substring", () => {
    expect(rules("betas: ['beta-zq-77']", ["zq-77"])).toEqual(["denylist"]);
    expect(scanText("betas: ['beta-zq-77']", "f.ts", ["zq-77"], allow)).toEqual([]);
  });
  it("still flags the same substring elsewhere on the line", () => {
    expect(scanText("beta-zq-77 seen on zq-77", "f.ts", ["zq-77"], allow)).toEqual([
      { file: "f.ts", line: 1, rule: "denylist" },
    ]);
  });
  it("matches case-sensitively and exactly", () => {
    expect(scanText("BETA-zq-77", "f.ts", ["zq-77"], allow)).toHaveLength(1);
  });
  it("blanks every occurrence and parses comments like the denylist", () => {
    expect(blankAllowed("a x a", ["a"])).toBe("  x  ");
    expect(parseAllowlist("# c\nfoo\n\n")).toEqual(["foo"]);
  });
});

describe("pii-scan CLI", () => {
  const run = (...args) =>
    spawnSync(process.execPath, ["scripts/pii-scan.mjs", ...args], { encoding: "utf8" });
  it("keeps no allowlist in the repo", () => {
    expect(existsSync("scripts/pii-allow.txt")).toBe(false);
  });
  it("names the missing allowlist path instead of printing undefined", () => {
    const r = run("--allow", "no-such-allowlist.txt");
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("no-such-allowlist.txt");
    expect(r.stderr).not.toContain("undefined");
  });
});
