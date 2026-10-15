// ABOUTME: The assistant slide-over (right side, full height on phones) and its two buttons: the
// ABOUTME: top bar one and the phone floating one. Chat stays mounted once opened so a draft, a
// ABOUTME: pending key prompt and the history survive closing; closed, the panel is inert and hidden.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MessageSquare, X } from "lucide-react";
import { Chat } from "@/components/Chat";
import { shortcutHint } from "@/lib/shortcuts";
import {
  clearAssistantContext,
  closeAssistant,
  markAssistantUnread,
  openAssistant,
  useAssistant,
} from "./assistantStore";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function UnreadDot() {
  return (
    <span
      aria-hidden
      className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-paper"
    />
  );
}

/** Top bar button (desktop and tablet widths; phones use the floating button). */
export function AssistantButton() {
  const { open, unread } = useAssistant();
  return (
    <button
      type="button"
      data-assistant-trigger
      onClick={() => openAssistant()}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts="Meta+J Control+J"
      aria-label={unread ? "Assistant, new reply" : "Assistant"}
      className="relative hidden h-9 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-2.5 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary lg:inline-flex"
    >
      <MessageSquare size={16} aria-hidden />
      <span>Assistant</span>
      <kbd className="rounded-md border border-line px-1.5 font-mono text-[11px] font-normal text-muted">
        {shortcutHint("J")}
      </kbd>
      {unread && <UnreadDot />}
    </button>
  );
}

/** Floating button above the phone tab bar. */
export function AssistantFab() {
  const { open, unread } = useAssistant();
  return (
    <button
      type="button"
      data-assistant-trigger
      data-no-print
      onClick={() => openAssistant()}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={unread ? "Open assistant, new reply" : "Open assistant"}
      className="fixed right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform duration-200 ease-out active:scale-95 lg:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.75rem)" }}
    >
      <MessageSquare size={20} aria-hidden />
      {unread && <UnreadDot />}
    </button>
  );
}

export function AssistantPanel({
  password,
  fallbackContext,
}: {
  password: string;
  /** Sent as the chat's page context when no "About" context is set (the current page's title). */
  fallbackContext: string;
}) {
  const { open, context, promptNonce } = useAssistant();
  const [everOpened, setEverOpened] = useState(false);
  if (open && !everOpened) setEverOpened(true);

  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();

  // Move focus in when it opens (and when a new prompt is prefilled while open).
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    panel.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    if (!panel.contains(document.activeElement)) panel.focus();
  }, [open, promptNonce]);

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape" && !e.nativeEvent.isComposing) {
      e.stopPropagation();
      closeAssistant();
      return;
    }
    if (e.key !== "Tab") return;
    const panel = e.currentTarget;
    const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.getClientRects().length > 0,
    );
    if (focusable.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <div
        aria-hidden
        data-no-print
        onClick={closeAssistant}
        className={`fixed inset-0 z-[44] bg-ink/40 transition-opacity duration-200 ease-out ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        data-assistant-panel
        data-no-print
        onKeyDown={onKeyDown}
        className={`fixed inset-y-0 right-0 z-[45] flex h-dvh w-full flex-col border-l border-line bg-surface text-ink shadow-xl focus:outline-none sm:w-[440px] ${
          // Visible at once when opening (so focus can move in); hidden only after sliding out.
          open
            ? "visible translate-x-0 transition-transform duration-200 ease-out"
            : "invisible translate-x-full [transition:transform_200ms_ease-out,visibility_0s_linear_200ms]"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id={titleId} className="font-display text-2xl leading-none">
            Assistant
          </h2>
          <button
            type="button"
            onClick={closeAssistant}
            aria-label="Close assistant"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors duration-200 ease-out hover:bg-secondary hover:text-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        {context && (
          <div className="flex items-center gap-2 border-b border-line px-4 py-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-secondary py-1 pr-1 pl-3 text-xs">
              <span className="text-muted">About:</span>
              <span className="truncate font-medium text-ink">{context.label}</span>
              <button
                type="button"
                onClick={clearAssistantContext}
                aria-label={`Remove context: ${context.label}`}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-200 ease-out hover:bg-line hover:text-ink"
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          </div>
        )}
        <div className="min-h-0 flex-1">
          {everOpened && (
            <Chat
              password={password}
              pageContext={context?.label ?? fallbackContext}
              prefill={context?.prompt ? { text: context.prompt, nonce: promptNonce } : undefined}
              onNewMessage={markAssistantUnread}
            />
          )}
        </div>
      </aside>
    </>
  );
}
