import { describe, it, expect } from "vitest";
import { isDemoMode } from "./isDemoMode";

const creds = { VITE_SUPABASE_URL: "u", VITE_SUPABASE_PUBLISHABLE_KEY: "k" };

describe("isDemoMode", () => {
  it("defaults to demo with an empty env", () => expect(isDemoMode({})).toBe(true));
  it("stays in demo when opted out without credentials", () =>
    expect(isDemoMode({ VITE_DEMO_MODE: "false" })).toBe(true));
  it("stays in demo when opted out with only one credential", () =>
    expect(isDemoMode({ VITE_DEMO_MODE: "false", VITE_SUPABASE_URL: "u" })).toBe(true));
  it("uses the real backend when opted out with both credentials", () =>
    expect(isDemoMode({ VITE_DEMO_MODE: "false", ...creds })).toBe(false));
  it("stays in demo when explicitly on, even with credentials", () =>
    expect(isDemoMode({ VITE_DEMO_MODE: "true", ...creds })).toBe(true));
});
