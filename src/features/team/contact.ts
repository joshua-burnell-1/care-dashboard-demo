// ABOUTME: Small helpers for the Team cards: which member is the family's single point of contact,
// ABOUTME: and safe tel: and mailto: links from the stored phone and email text.

const MAIN_CONTACT_ROLE = /\b(navigator|coordinator)\b/i;

/**
 * The id of the member the family calls first: the first nurse navigator or coordinator, or null
 * when the team has none. Roles are free text, so this reads the role rather than a stored flag.
 */
export function mainContactId(members: { id: string; role: string }[]): string | null {
  return members.find((m) => MAIN_CONTACT_ROLE.test(m.role))?.id ?? null;
}

/** `tel:` link from whatever was typed, or null when there are no digits to dial. */
export function telHref(phone: string | undefined): string | null {
  const trimmed = (phone ?? "").trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

export function mailHref(email: string | undefined): string | null {
  const trimmed = (email ?? "").trim();
  return trimmed ? `mailto:${trimmed}` : null;
}
