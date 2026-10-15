// ABOUTME: URL search serialization for the router that keeps every value a plain string, so
// ABOUTME: free text like `?q=123` round-trips as typed; route schemas coerce numbers and flags.

/** Parse `?a=1&b=x` into `{ a: "1", b: "x" }` (last value wins for repeated keys). */
export function parseSearch(searchStr: string): Record<string, string> {
  const params = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr);
  const out: Record<string, string> = {};
  for (const [key, value] of params) out[key] = value;
  return out;
}

/** Serialize a search object; undefined and null drop out, objects are written as JSON. */
export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;
    params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}
