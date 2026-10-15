import { describe, expect, it } from "vitest";
import { shortcutFor, type ShortcutEvent } from "./shortcuts";

const key = (k: string, mods: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("shortcutFor", () => {
  it("maps Meta or Ctrl with K to the palette and J to the assistant", () => {
    expect(shortcutFor(key("k", { metaKey: true }))).toBe("palette");
    expect(shortcutFor(key("K", { ctrlKey: true }))).toBe("palette");
    expect(shortcutFor(key("j", { metaKey: true }))).toBe("assistant");
    expect(shortcutFor(key("j", { ctrlKey: true }))).toBe("assistant");
  });

  it("ignores the keys without a modifier, and with extra modifiers", () => {
    expect(shortcutFor(key("k"))).toBeNull();
    expect(shortcutFor(key("j"))).toBeNull();
    expect(shortcutFor(key("k", { metaKey: true, shiftKey: true }))).toBeNull();
    expect(shortcutFor(key("j", { ctrlKey: true, altKey: true }))).toBeNull();
    expect(shortcutFor(key("l", { metaKey: true }))).toBeNull();
  });
});
