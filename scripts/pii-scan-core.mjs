// Pure leak-detection rules. A Finding never contains the matched text,
// so reporting a finding can never echo a secret.

const ALLOWED_EMAIL_DOMAINS = ["example.com", "resend.dev"];

const EMAIL_RE = /[A-Za-z0-9._%+-]+@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})/g;

const PATTERN_RULES = [
  { rule: "anthropic-key", re: /sk-ant-[\w-]{10,}/ },
  { rule: "jwt", re: /eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]+/ },
  { rule: "supabase-ref", re: /\b[a-z]{20}\.supabase\.co\b/ },
  { rule: "supabase-ref", re: /project_id\s*=\s*"[a-z]{20}"/ },
  { rule: "postgres-url", re: /postgres(?:ql)?:\/\/\S+/i },
];

function isAllowedDomain(domain) {
  const d = domain.toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((a) => d === a || d.endsWith(`.${a}`));
}

function hasRealEmail(line) {
  for (const m of line.matchAll(EMAIL_RE)) {
    if (!isAllowedDomain(m[1])) return true;
  }
  return false;
}

const collapse = (s) => s.replace(/\s+/g, " ").toLowerCase();

/** Parses denylist file text: trims lines, drops blanks and `#` comments. */
export function parseDenylist(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

/** Parses allowlist file text: same format as the denylist (trimmed lines, `#` comments, blanks dropped). */
export const parseAllowlist = parseDenylist;

/** Blanks every exact, case-sensitive allowlisted literal in a line. */
export function blankAllowed(line, allow) {
  let out = line;
  for (const literal of allow) if (literal) out = out.split(literal).join(" ");
  return out;
}

function normalizeNeedles(denylist) {
  return denylist.map(collapse).filter((s) => s.trim().length > 0);
}

/**
 * Flags denylist literals inside a tracked file path (line 0).
 * @returns {{file: string, line: number, rule: string}[]}
 */
export function scanPath(path, denylist) {
  const lower = collapse(path);
  return normalizeNeedles(denylist).some((n) => lower.includes(n))
    ? [{ file: path, line: 0, rule: "denylist-path" }]
    : [];
}

/**
 * Denylist literals match as case-insensitive substrings, with runs of
 * whitespace collapsed to one space on both sides.
 * @param {string} text
 * @param {string} file
 * @param {string[]} denylist plain literals
 * @param {string[]} [allow] exact literals blanked out of a line before denylist matching
 * @returns {{file: string, line: number, rule: string}[]}
 */
export function scanText(text, file, denylist, allow = []) {
  const needles = normalizeNeedles(denylist);
  const findings = [];
  text.split("\n").forEach((line, i) => {
    const rules = new Set();
    if (hasRealEmail(line)) rules.add("email");
    for (const { rule, re } of PATTERN_RULES) if (re.test(line)) rules.add(rule);
    if (needles.length > 0) {
      const normalized = collapse(blankAllowed(line, allow));
      if (needles.some((n) => normalized.includes(n))) rules.add("denylist");
    }
    for (const rule of rules) findings.push({ file, line: i + 1, rule });
  });
  return findings;
}

/**
 * Renders a finding as `where:line rule`. When the file path itself matches the
 * denylist (pathIsSensitive), the path is replaced by its 1-based position in
 * `git ls-files` so no rule can echo it.
 */
export function formatFinding(finding, index, pathIsSensitive) {
  const where = pathIsSensitive ? `<tracked path #${index}>` : finding.file;
  return `${where}:${finding.line} ${finding.rule}`;
}
