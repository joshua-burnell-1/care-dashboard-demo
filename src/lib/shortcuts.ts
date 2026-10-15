// ABOUTME: Global keyboard shortcuts (Cmd or Ctrl with K for the command palette, with J for the
// ABOUTME: assistant) and the platform-aware label shown in the top bar buttons.

export type Shortcut = "palette" | "assistant";

/** The slice of a KeyboardEvent the shortcut match reads, so it can be tested without a DOM. */
export type ShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

/**
 * Which shortcut an event is, if any. Both need Cmd or Ctrl and no Shift or Alt, so they stay
 * live inside inputs and textareas while a bare letter never triggers anything while typing.
 */
export function shortcutFor(e: ShortcutEvent): Shortcut | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return null;
  const key = e.key.toLowerCase();
  if (key === "k") return "palette";
  if (key === "j") return "assistant";
  return null;
}

/** True on Apple platforms, where the modifier is Cmd rather than Ctrl. */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

/** "⌘K" on Apple platforms, "Ctrl K" elsewhere. */
export function shortcutHint(letter: "K" | "J"): string {
  return isApplePlatform() ? `⌘${letter}` : `Ctrl ${letter}`;
}
