import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredTheme, resolveTheme, setTheme, THEME_STORAGE_KEY, toggleTheme } from "./theme";

function stubEnvironment({
  prefersDark = false,
  storage,
}: {
  prefersDark?: boolean;
  storage?: unknown;
}) {
  const classes = new Set<string>();
  vi.stubGlobal("document", {
    documentElement: {
      classList: {
        toggle: (name: string, force?: boolean) => {
          if (force) classes.add(name);
          else classes.delete(name);
          return !!force;
        },
        contains: (name: string) => classes.has(name),
      },
    },
  });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: prefersDark }) });
  vi.stubGlobal("localStorage", storage);
  return classes;
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    data,
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("resolveTheme", () => {
  it("passes explicit themes through", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("follows the system preference for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("getStoredTheme", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("defaults to system when nothing is stored", () => {
    stubEnvironment({ storage: memoryStorage() });
    expect(getStoredTheme()).toBe("system");
  });
  it("returns a stored valid theme", () => {
    stubEnvironment({ storage: memoryStorage({ [THEME_STORAGE_KEY]: "dark" }) });
    expect(getStoredTheme()).toBe("dark");
  });
  it("ignores garbage values", () => {
    stubEnvironment({ storage: memoryStorage({ [THEME_STORAGE_KEY]: "purple" }) });
    expect(getStoredTheme()).toBe("system");
  });
  it("survives a throwing localStorage", () => {
    stubEnvironment({ storage: throwingStorage });
    expect(getStoredTheme()).toBe("system");
  });
});

describe("setTheme", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("applies the dark class and persists", () => {
    const storage = memoryStorage();
    const classes = stubEnvironment({ storage });
    setTheme("dark");
    expect(classes.has("dark")).toBe(true);
    expect(storage.data[THEME_STORAGE_KEY]).toBe("dark");
    setTheme("light");
    expect(classes.has("dark")).toBe(false);
    expect(storage.data[THEME_STORAGE_KEY]).toBe("light");
  });
  it("resolves system against the media query", () => {
    const classes = stubEnvironment({ prefersDark: true, storage: memoryStorage() });
    setTheme("system");
    expect(classes.has("dark")).toBe(true);
  });
  it("survives a throwing localStorage and still applies the theme", () => {
    const classes = stubEnvironment({ storage: throwingStorage });
    expect(() => setTheme("dark")).not.toThrow();
    expect(classes.has("dark")).toBe(true);
  });
  it("survives a missing localStorage", () => {
    const classes = stubEnvironment({ storage: undefined });
    expect(() => setTheme("dark")).not.toThrow();
    expect(classes.has("dark")).toBe(true);
  });
});

describe("toggleTheme", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("flips from what is showing now and persists the explicit choice", () => {
    const storage = memoryStorage();
    const classes = stubEnvironment({ prefersDark: true, storage });
    setTheme("system");
    expect(classes.has("dark")).toBe(true);
    toggleTheme();
    expect(classes.has("dark")).toBe(false);
    expect(storage.data[THEME_STORAGE_KEY]).toBe("light");
    toggleTheme();
    expect(classes.has("dark")).toBe(true);
    expect(storage.data[THEME_STORAGE_KEY]).toBe("dark");
  });
});
