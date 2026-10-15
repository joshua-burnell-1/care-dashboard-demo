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

/** A trailing extension such as "x12", "ext 12" or "ext. 12". */
const EXTENSION = /\s*(?:x|ext\.?|extension)\s*(\d{1,6})\s*$/i;

/**
 * `tel:` link from whatever was typed, or null when there are no digits to dial. An extension is
 * kept apart as `;ext=12` (RFC 3966) rather than merged into the number.
 */
export function telHref(phone: string | undefined): string | null {
  let trimmed = (phone ?? "").trim();
  const extension = EXTENSION.exec(trimmed)?.[1];
  if (extension) trimmed = trimmed.replace(EXTENSION, "");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}${extension ? `;ext=${extension}` : ""}`;
}

/** One plain address: no spaces, commas, semicolons or the characters that start mailto headers. */
const EMAIL = /^[^\s@,;?&=<>"]+@[^\s@,;?&=<>"]+\.[^\s@,;?&=<>"]+$/;

/** `mailto:` link for a valid-looking address, or null so the Email action hides. */
export function mailHref(email: string | undefined): string | null {
  const trimmed = (email ?? "").trim();
  if (!EMAIL.test(trimmed)) return null;
  return `mailto:${encodeURIComponent(trimmed).replace("%40", "@")}`;
}
