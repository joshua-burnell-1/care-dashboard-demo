// ABOUTME: The AI visit-prep brief for one plan item, shown inline on the visit page. It streams
// ABOUTME: from the viewer's own Anthropic key (asking for it first) and offers Stop, Copy and Print.
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Printer, Square } from "lucide-react";
import { ApiKeyForm } from "@/components/ApiKeyForm";
import { supabase } from "@/integrations/supabase/client";
import { clearApiKey, getApiKey, setApiKey, STORAGE_BLOCKED_MESSAGE } from "@/demo/apiKey";
import { streamVisitPrep, VisitPrepError } from "@/demo/visitPrep";
import type { PlanItem } from "@/hooks/usePlanItems";
import { formatDate } from "@/lib/format";

export type VisitPrepContext = {
  recentPsa: { date: string; value: number | null }[];
  medications: string[];
};

type Status = "streaming" | "done" | "stopped" | "error";

const DISCLAIMER = "Demo copy with fictional data. AI-generated; not medical advice.";

/** Heading and list spacing for the rendered brief; the app has no typography plugin. */
const BRIEF_CLASSES =
  "text-sm leading-relaxed text-ink [&_h2]:mt-6 [&_h2]:mb-1.5 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-normal [&_h2:first-child]:mt-0 " +
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1";

const BUTTON =
  "inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 disabled:hover:bg-surface";

// The print frame is its own document, so it carries plain colors instead of the app's tokens.
const PRINT_CSS = `
  body { font: 14px/1.5 system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 18px 0 6px; }
  p, ul, ol { margin: 6px 0; }
  ul, ol { padding-left: 22px; }
  .meta, .note { color: #555; font-size: 12px; }
  .note { margin-top: 24px; border-top: 1px solid #ccc; padding-top: 8px; }
`;

/** Prints just the brief: a hidden iframe holds only it, so the page never reaches the printer. */
async function printBrief(item: PlanItem, markdown: string) {
  // Loaded on demand: only printing needs the server renderer.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const body = renderToStaticMarkup(
    <>
      <h1>Visit prep: {item.title}</h1>
      {item.event_date && <p className="meta">{formatDate(item.event_date)}</p>}
      <ReactMarkdown>{markdown}</ReactMarkdown>
      <p className="note">{DISCLAIMER}</p>
    </>,
  );
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>Visit prep</title><style>${PRINT_CSS}</style></head><body>${body}</body></html>`;
  const cleanup = () => frame.remove();
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return cleanup();
    win.addEventListener("afterprint", cleanup);
    win.focus();
    win.print();
    // Some browsers never fire afterprint; don't leave the frame behind.
    setTimeout(cleanup, 60_000);
  };
  document.body.appendChild(frame);
}

async function loadRecord(): Promise<string> {
  try {
    const { data } = await supabase
      .from("dashboard_sections")
      .select("content")
      .eq("key", "patient_record_md")
      .maybeSingle();
    return typeof data?.content === "string" ? data.content : "";
  } catch {
    return "";
  }
}

export function VisitPrepBrief({ item, context }: { item: PlanItem; context: VisitPrepContext }) {
  const [apiKey, setKey] = useState<string | null>(() => getApiKey());
  const [keyError, setKeyError] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("streaming");
  const [error, setError] = useState("");
  // Transient result of the Copy button, kept apart from the brief's own `error`.
  const [copyState, setCopyState] = useState<"copied" | "failed" | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [attempt, setAttempt] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  const run = useCallback(
    async (key: string) => {
      const controller = new AbortController();
      controllerRef.current = controller;
      setText("");
      setError("");
      setStatus("streaming");
      try {
        const record = await loadRecord();
        if (controller.signal.aborted) return;
        await streamVisitPrep(
          {
            planItem: { title: item.title, event_date: item.event_date ?? "", body: item.body },
            record,
            recentPsa: contextRef.current.recentPsa,
            medications: contextRef.current.medications,
          },
          { apiKey: key, signal: controller.signal, onText: (d) => setText((t) => t + d) },
        );
        if (!controller.signal.aborted) setStatus("done");
      } catch (e) {
        if (controller.signal.aborted) return;
        const err =
          e instanceof VisitPrepError ? e : new VisitPrepError("Something went wrong.", "API");
        if (err.code === "BAD_KEY" || err.code === "NO_API_KEY") {
          clearApiKey();
          setKey(null);
          setKeyError(err.message);
          return;
        }
        setError(err.message);
        setStatus("error");
      }
    },
    [item],
  );

  useEffect(() => {
    if (!apiKey) return;
    void run(apiKey);
    return () => controllerRef.current?.abort();
    // `attempt` re-runs the brief for "Try again".
  }, [apiKey, run, attempt]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  function saveKey(key: string) {
    if (!setApiKey(key)) {
      setKeyError(STORAGE_BLOCKED_MESSAGE);
      return;
    }
    setKeyError(undefined);
    setKey(key);
  }

  function stop() {
    controllerRef.current?.abort();
    setStatus("stopped");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState(null), 3000);
  }

  const streaming = status === "streaming";

  return (
    <section
      aria-labelledby="visit-prep-heading"
      data-visit-prep
      className="rounded-[20px] border border-line bg-surface p-5 sm:p-6"
    >
      <h2 id="visit-prep-heading" className="font-display text-3xl text-ink">
        Visit prep brief
      </h2>
      <p className="mt-1 text-sm text-muted">{DISCLAIMER}</p>

      {!apiKey ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted">
            The brief is written by Claude using your own Anthropic API key.
          </p>
          <ApiKeyForm onSave={saveKey} error={keyError} />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div
            aria-live="polite"
            aria-busy={streaming}
            className="rounded-xl border border-line bg-paper p-4"
          >
            {text ? (
              <div className={BRIEF_CLASSES}>
                <ReactMarkdown>{text}</ReactMarkdown>
              </div>
            ) : (
              streaming && <p className="text-sm text-muted">Writing the brief…</p>
            )}
            {status === "stopped" && (
              <p className="mt-3 text-xs text-muted">Stopped. The brief may be incomplete.</p>
            )}
          </div>
          {copyState === "failed" && (
            <p role="alert" className="text-sm text-act">
              Couldn't copy. Select the text and copy it by hand.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-act">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {streaming && (
              <button type="button" onClick={stop} className={BUTTON}>
                <Square size={14} aria-hidden="true" />
                Stop
              </button>
            )}
            {status === "error" && (
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className={BUTTON}>
                Try again
              </button>
            )}
            <button type="button" onClick={copy} disabled={!text} className={BUTTON}>
              <Copy size={14} aria-hidden="true" />
              {copyState === "copied" ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => void printBrief(item, text)}
              disabled={!text}
              className={BUTTON}
            >
              <Printer size={14} aria-hidden="true" />
              Print
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
