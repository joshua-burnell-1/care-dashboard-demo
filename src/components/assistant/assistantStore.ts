// ABOUTME: Tiny external store for the assistant slide-over: open or closed, the context chip and
// ABOUTME: prefilled prompt a page can attach, and an unread flag for replies that arrive while closed.
import { useSyncExternalStore } from "react";

export type AssistantContext = { label: string; prompt?: string };

export type AssistantState = {
  open: boolean;
  context?: AssistantContext;
  /** A reply arrived while the panel was closed. Cleared when it opens. */
  unread: boolean;
  /** Bumps whenever an open call carries a prompt, so the same prompt can be prefilled again. */
  promptNonce: number;
};

let state: AssistantState = { open: false, unread: false, promptNonce: 0 };
let returnFocusTo: HTMLElement | null = null;
const listeners = new Set<() => void>();

function setState(next: Partial<AssistantState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAssistantState(): AssistantState {
  return state;
}

export function useAssistant(): AssistantState {
  return useSyncExternalStore(subscribe, getAssistantState, getAssistantState);
}

/** The visible assistant button, for restoring focus when nothing better was focused. */
function visibleTrigger(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const all = document.querySelectorAll<HTMLElement>("[data-assistant-trigger]");
  return [...all].find((el) => el.getClientRects().length > 0) ?? null;
}

/** The element focus should come back to: whatever opened the panel, else the assistant button. */
function captureTrigger(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  const usable =
    active instanceof HTMLElement &&
    active !== document.body &&
    !active.closest("[data-assistant-panel], [cmdk-root]");
  return usable ? active : visibleTrigger();
}

/**
 * Open the panel. With a context, the panel shows an "About" chip and, if the context has a
 * prompt, prefills it in the input without sending. With none, any earlier context is cleared.
 */
export function openAssistant(context?: AssistantContext): void {
  if (!state.open) returnFocusTo = captureTrigger();
  setState({
    open: true,
    unread: false,
    context,
    promptNonce: context?.prompt ? state.promptNonce + 1 : state.promptNonce,
  });
}

export function closeAssistant(): void {
  if (!state.open) return;
  setState({ open: false });
  const target = returnFocusTo?.isConnected ? returnFocusTo : visibleTrigger();
  returnFocusTo = null;
  target?.focus();
}

/** Put focus back in the chat input, for when something layered over the panel closes. */
export function focusAssistantInput(): void {
  if (typeof document === "undefined") return;
  document.querySelector<HTMLElement>("[data-assistant-panel] [data-autofocus]")?.focus();
}

export function toggleAssistant(): void {
  if (state.open) closeAssistant();
  else openAssistant();
}

export function clearAssistantContext(): void {
  setState({ context: undefined });
}

/** Flag a reply that arrived while the panel was closed. */
export function markAssistantUnread(): void {
  if (!state.open) setState({ unread: true });
}

/** Back to a closed, empty panel. For tests. */
export function resetAssistantForTests(): void {
  state = { open: false, unread: false, promptNonce: 0 };
  returnFocusTo = null;
}
