// ABOUTME: Stable, hardcoded-looking UUIDs for seed rows, so seed.sql stays
// ABOUTME: deterministic and edit-history rows can point at real records.

const TABLE_PREFIX = {
  psa: "00000001",
  team: "00000002",
  medication: "00000003",
  kpi: "00000004",
  plan: "00000005",
  lab: "00000006",
  document: "00000007",
  edit: "00000008",
  session: "00000009",
  message: "0000000a",
} as const;

export type IdKind = keyof typeof TABLE_PREFIX;

export function seedId(kind: IdKind, n: number): string {
  return `${TABLE_PREFIX[kind]}-5eed-4000-8000-${String(n).padStart(12, "0")}`;
}
