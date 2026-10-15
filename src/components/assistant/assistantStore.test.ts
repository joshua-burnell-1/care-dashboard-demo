import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAssistantContext,
  closeAssistant,
  getAssistantState,
  markAssistantUnread,
  openAssistant,
  resetAssistantForTests,
  toggleAssistant,
} from "./assistantStore";

describe("assistantStore", () => {
  beforeEach(resetAssistantForTests);

  it("opens and closes", () => {
    expect(getAssistantState().open).toBe(false);
    openAssistant();
    expect(getAssistantState().open).toBe(true);
    closeAssistant();
    expect(getAssistantState().open).toBe(false);
  });

  it("toggles", () => {
    toggleAssistant();
    expect(getAssistantState().open).toBe(true);
    toggleAssistant();
    expect(getAssistantState().open).toBe(false);
  });

  it("keeps the context given on open, and drops it when opened without one", () => {
    openAssistant({ label: "Hemoglobin result", prompt: "Is this normal?" });
    expect(getAssistantState().context).toEqual({
      label: "Hemoglobin result",
      prompt: "Is this normal?",
    });
    closeAssistant();
    openAssistant();
    expect(getAssistantState().context).toBeUndefined();
  });

  it("bumps the prompt nonce only when a prompt is given, so a repeat prompt prefills again", () => {
    openAssistant({ label: "A", prompt: "one" });
    const first = getAssistantState().promptNonce;
    openAssistant({ label: "A", prompt: "one" });
    expect(getAssistantState().promptNonce).toBe(first + 1);
    openAssistant({ label: "B" });
    expect(getAssistantState().promptNonce).toBe(first + 1);
  });

  it("clears the context chip", () => {
    openAssistant({ label: "A" });
    clearAssistantContext();
    expect(getAssistantState().context).toBeUndefined();
    expect(getAssistantState().open).toBe(true);
  });

  it("flags a reply that arrives while closed, and clears the flag on open", () => {
    markAssistantUnread();
    expect(getAssistantState().unread).toBe(true);
    openAssistant();
    expect(getAssistantState().unread).toBe(false);
  });

  it("does not flag a reply that arrives while open", () => {
    openAssistant();
    markAssistantUnread();
    expect(getAssistantState().unread).toBe(false);
  });
});
