#!/usr/bin/env node
// Scans every git-tracked file for leaks.
// Usage: node scripts/pii-scan.mjs [--denylist <path>] [--allow <path>]
// The allowlist is only read from --allow; it lives outside the repo next to the denylist.
// Prints `file:line rule` per finding (never the matched text); exits 1 on any finding.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  formatFinding,
  parseAllowlist,
  parseDenylist,
  scanPath,
  scanText,
} from "./pii-scan-core.mjs";

function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  if (!argv[i + 1]) {
    console.error(`pii-scan: ${flag} requires a path`);
    process.exit(2);
  }
  return argv[i + 1];
}

function parseArgs(argv) {
  return { denylistPath: flagValue(argv, "--denylist"), allowPath: flagValue(argv, "--allow") };
}

function loadAllowlist(path) {
  if (!path) return [];
  try {
    return parseAllowlist(readFileSync(path, "utf8"));
  } catch {
    console.error(`pii-scan: cannot read allowlist at ${path}`);
    process.exit(2);
  }
}

function loadDenylist(path) {
  if (!path) return [];
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(`pii-scan: cannot read denylist at ${path}`);
    process.exit(2);
  }
  const entries = parseDenylist(raw);
  if (entries.length === 0) {
    console.error(
      `pii-scan: denylist at ${path} has no entries (refusing to scan with an empty denylist)`,
    );
    process.exit(2);
  }
  return entries;
}

const { denylistPath, allowPath } = parseArgs(process.argv.slice(2));
const denylist = loadDenylist(denylistPath);
const allow = loadAllowlist(allowPath);
// Files are read as latin1 (byte-preserving), so also match each entry's UTF-8 byte form.
const denylistLatin1 = denylist.map((s) => Buffer.from(s, "utf8").toString("latin1"));

const files = execFileSync("git", ["ls-files", "-z"], { maxBuffer: 1 << 28 })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

const findings = [];
const indexOf = new Map(files.map((file, i) => [file, i + 1]));
const sensitivePaths = new Set();
for (const file of files) {
  const pathFindings = scanPath(file, denylist);
  if (pathFindings.length > 0) sensitivePaths.add(file);
  findings.push(...pathFindings);
}
for (const file of files) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    findings.push({ file, line: 0, rule: "unreadable" });
    continue;
  }
  findings.push(...scanText(buf.toString("latin1"), file, denylistLatin1, allow));
  // Second pass as UTF-8 so non-ASCII entries match case-insensitively (e.g. accented names).
  if (denylist.length > 0 && buf.some((b) => b >= 0x80)) {
    findings.push(...scanText(buf.toString("utf8"), file, denylist, allow));
  }
}

const seen = new Set();
for (const f of findings) {
  // A path that matches the denylist is never printed, under any rule.
  const key = formatFinding(f, indexOf.get(f.file), sensitivePaths.has(f.file));
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(key);
}
const fileCount = new Set(findings.map((f) => f.file)).size;
const active = denylistPath ? `, ${denylist.length} denylist entries active` : ", no denylist";
if (seen.size > 0) {
  console.log(
    `pii-scan: ${seen.size} findings in ${fileCount} files (${files.length} scanned${active})`,
  );
  process.exit(1);
}
console.log(`pii-scan: clean (${files.length} files scanned${active})`);
