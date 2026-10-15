import { afterEach, describe, expect, it, vi } from "vitest";
import { isApplePlatform, shortcutFor, shortcutHint, type ShortcutEvent } from "./shortcuts";

const key = (k: string, mods: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("shortcutFor", () => {
  it("maps Ctrl K and J to the palette and assistant off Apple platforms", () => {
    expect(shortcutFor(key("k", { ctrlKey: true }), false)).toBe("palette");
    expect(shortcutFor(key("K", { ctrlKey: true }), false)).toBe("palette");
    expect(shortcutFor(key("j", { ctrlKey: true }), false)).toBe("assistant");
    expect(shortcutFor(key("k", { metaKey: true }), false)).toBeNull();
  });

  it("maps only Cmd on Apple platforms, leaving Ctrl K and J to the text field", () => {
    expect(shortcutFor(key("k", { metaKey: true }), true)).toBe("palette");
    expect(shortcutFor(key("j", { metaKey: true }), true)).toBe("assistant");
    expect(shortcutFor(key("k", { ctrlKey: true }), true)).toBeNull();
    expect(shortcutFor(key("j", { ctrlKey: true }), true)).toBeNull();
  });

  it("ignores the keys without a modifier, with extra modifiers, and other letters", () => {
    expect(shortcutFor(key("k"), false)).toBeNull();
    expect(shortcutFor(key("j"), true)).toBeNull();
    expect(shortcutFor(key("k", { ctrlKey: true, shiftKey: true }), false)).toBeNull();
    expect(shortcutFor(key("j", { metaKey: true, altKey: true }), true)).toBeNull();
    expect(shortcutFor(key("l", { ctrlKey: true }), false)).toBeNull();
  });
});

describe("platform", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("detects Apple platforms from navigator.platform", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "" });
    expect(isApplePlatform()).toBe(true);
    expect(shortcutHint("K")).toBe("⌘K");
    expect(shortcutHint("J")).toBe("⌘J");
  });

  it("treats iPhone and iPad as Apple", () => {
    vi.stubGlobal("navigator", { platform: "iPhone", userAgent: "" });
    expect(isApplePlatform()).toBe(true);
  });

  it("shows Ctrl elsewhere", () => {
    vi.stubGlobal("navigator", { platform: "Win32", userAgent: "" });
    expect(isApplePlatform()).toBe(false);
    expect(shortcutHint("K")).toBe("Ctrl K");
  });

  it("falls back to the user agent when platform is empty", () => {
    vi.stubGlobal("navigator", {
      platform: "",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
    });
    expect(isApplePlatform()).toBe(true);
  });

  it("is not Apple without a navigator", () => {
    vi.stubGlobal("navigator", undefined);
    expect(isApplePlatform()).toBe(false);
  });
});
