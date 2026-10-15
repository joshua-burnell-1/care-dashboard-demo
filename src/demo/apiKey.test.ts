import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearApiKey, getApiKey, setApiKey, subscribeApiKey } from "./apiKey";

const KEY = "care_demo_anthropic_key";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void data.set(k, v)),
    removeItem: vi.fn((k: string) => void data.delete(k)),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("apiKey", () => {
  let session: ReturnType<typeof fakeStorage>;
  let local: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    session = fakeStorage();
    local = fakeStorage();
    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("localStorage", local);
  });

  it("stores only in sessionStorage", () => {
    expect(setApiKey("sk-test")).toBe(true);
    expect(session.setItem).toHaveBeenCalledWith(KEY, "sk-test");
    expect(getApiKey()).toBe("sk-test");
    clearApiKey();
    expect(getApiKey()).toBeNull();
    expect(session.removeItem).toHaveBeenCalledWith(KEY);
    for (const fn of Object.values(local)) expect(fn).not.toHaveBeenCalled();
  });

  it("returns null when sessionStorage throws", () => {
    const boom = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("sessionStorage", { getItem: boom, setItem: boom, removeItem: boom });
    expect(getApiKey()).toBeNull();
    expect(setApiKey("sk-test")).toBe(false);
    expect(() => clearApiKey()).not.toThrow();
  });

  it("returns null when sessionStorage does not exist", () => {
    vi.stubGlobal("sessionStorage", undefined);
    expect(getApiKey()).toBeNull();
  });

  it("notifies subscribers when the key is saved or cleared, until they unsubscribe", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeApiKey(cb);
    setApiKey("sk-test");
    clearApiKey();
    expect(cb).toHaveBeenCalledTimes(2);
    unsubscribe();
    setApiKey("sk-again");
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
