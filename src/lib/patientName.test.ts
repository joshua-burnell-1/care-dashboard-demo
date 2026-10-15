import { describe, it, expect } from "vitest";
import { PERSONA } from "@/demo/persona";
import { resolvePatientFirstName } from "./patientName";

describe("resolvePatientFirstName", () => {
  it("uses first_name from the patient section when present", () => {
    expect(resolvePatientFirstName({ first_name: "Alex" }, false)).toBe("Alex");
    expect(resolvePatientFirstName({ first_name: "  Alex " }, true)).toBe("Alex");
  });

  it("falls back to the persona in demo mode", () => {
    expect(resolvePatientFirstName(null, true)).toBe(PERSONA.firstName);
    expect(resolvePatientFirstName({ first_name: "" }, true)).toBe(PERSONA.firstName);
  });

  it("falls back to 'the patient' outside demo mode", () => {
    expect(resolvePatientFirstName(undefined, false)).toBe("the patient");
    expect(resolvePatientFirstName({ name: "Someone" }, false)).toBe("the patient");
    expect(resolvePatientFirstName({ first_name: 42 }, false)).toBe("the patient");
    expect(resolvePatientFirstName("not an object", false)).toBe("the patient");
  });
});
