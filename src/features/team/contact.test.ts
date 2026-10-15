import { describe, expect, it } from "vitest";
import { mainContactId, mailHref, telHref } from "./contact";

const member = (id: string, role: string) => ({ id, role });

describe("mainContactId", () => {
  it("picks the nurse navigator or coordinator", () => {
    const team = [
      member("a", "Urologic oncologist"),
      member("b", "Nurse navigator"),
      member("c", "Primary care"),
    ];
    expect(mainContactId(team)).toBe("b");
    expect(mainContactId([member("x", "Nurse coordinator")])).toBe("x");
  });

  it("marks only the first match, and nobody when no one fits", () => {
    expect(mainContactId([member("a", "Care Navigator"), member("b", "Nurse navigator")])).toBe(
      "a",
    );
    expect(mainContactId([member("a", "Primary care")])).toBeNull();
    expect(mainContactId([])).toBeNull();
  });
});

describe("contact links", () => {
  it("builds a tel link from digits and a leading plus only", () => {
    expect(telHref("(555) 010-0142")).toBe("tel:5550100142");
    expect(telHref("+1 555 010 0142")).toBe("tel:+15550100142");
  });

  it("keeps an extension apart instead of merging its digits", () => {
    expect(telHref("(555) 010-0142 x12")).toBe("tel:5550100142;ext=12");
    expect(telHref("(555) 010-0142 ext 12")).toBe("tel:5550100142;ext=12");
    expect(telHref("+1 555 010 0142 ext. 7")).toBe("tel:+15550100142;ext=7");
  });

  it("refuses an address that could add mailto headers or a second recipient", () => {
    expect(mailHref("a@example.com?bcc=x@example.com")).toBeNull();
    expect(mailHref("a@example.com&cc=b@example.com")).toBeNull();
    expect(mailHref("a@example.com, b@example.com")).toBeNull();
    expect(mailHref("not an email")).toBeNull();
    expect(mailHref("a@example")).toBeNull();
    expect(mailHref("a+tag@example.com")).toBe("mailto:a%2Btag@example.com");
  });

  it("returns null for blank or digitless values", () => {
    expect(telHref("")).toBeNull();
    expect(telHref("ask the desk")).toBeNull();
    expect(mailHref("  ")).toBeNull();
    expect(mailHref(" a@example.com ")).toBe("mailto:a@example.com");
  });
});
