import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { supabase, demoDb } from "@/integrations/supabase/client";
import { ApiKeyForm } from "@/components/ApiKeyForm";
import {
  clearApiKey,
  getApiKey,
  setApiKey,
  STORAGE_BLOCKED_MESSAGE,
  subscribeApiKey,
} from "@/demo/apiKey";
import { useMedicalCache } from "@/hooks/useMedicalCache";
import { AppMark } from "@/components/AppMark";
import { usePatientFirstName } from "@/hooks/usePatientFirstName";
import { PlusCircle, MessageSquare, Trash2, ChevronLeft } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };
type Session = { id: string; title: string; created_at: string; last_message_at: string };

async function callHistory(password: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("chat-history", {
    body: { ...body, password },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "chat-history error");
  return data;
}

export function Chat({
  password,
  onNewMessage,
  pageContext,
  prefill,
}: {
  password: string;
  onNewMessage?: () => void;
  /** What the caregiver was looking at; sent with each question so the answer can lean on it. */
  pageContext?: string;
  /** Text to drop in the input (not sent) each time `nonce` changes. */
  prefill?: { text: string; nonce: number };
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Demo only: the chat needs the viewer's key. `keyPrompt` holds the form's error text ("" for none).
  const [keyPrompt, setKeyPrompt] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(() => demoDb !== null && getApiKey() !== null);
  const pendingRef = useRef<{ messages: Msg[]; sid: string | null } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { cache } = useMedicalCache();
  const patientName = usePatientFirstName();

  const prefillText = prefill?.text;
  const prefillNonce = prefill?.nonce;
  useEffect(() => {
    if (prefillNonce && prefillText !== undefined) setInput(prefillText);
  }, [prefillText, prefillNonce]);

  // Demo only: follow a key saved or cleared elsewhere in the tab (visit prep, uploads).
  useEffect(() => {
    if (!demoDb) return;
    return subscribeApiKey(() => setHasKey(getApiKey() !== null));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const loadSessions = useCallback(async () => {
    try {
      const data = await callHistory(password, { action: "listSessions" });
      const list = (data.sessions ?? []) as Session[];
      setSessions(list);
      return list;
    } catch {
      return [];
    }
  }, [password]);

  const loadMessages = useCallback(
    async (sessionId: string) => {
      try {
        const data = await callHistory(password, { action: "getMessages", session_id: sessionId });
        setMessages(
          (data.messages ?? []).map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        );
      } catch {
        setMessages([]);
      }
    },
    [password],
  );

  const createSession = useCallback(async () => {
    try {
      const data = await callHistory(password, { action: "createSession" });
      const s = data.session as Session;
      setSessions((prev) => [s, ...prev]);
      setActiveSession(s.id);
      setMessages([]);
      return s.id;
    } catch {
      return null;
    }
  }, [password]);

  // Init: load sessions, open most recent or create new
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const list = await loadSessions();
      if (cancelled) return;
      if (list.length > 0) {
        setActiveSession(list[0].id);
        await loadMessages(list[0].id);
      } else {
        await createSession();
      }
      setHistoryReady(true);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [loadSessions, loadMessages, createSession]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setError("");
    const next = [...messages, { role: "user" as const, content: text }];
    setKeyPrompt(null);
    setMessages(next);
    setInput("");
    setLoading(true);

    let sid = activeSession;
    if (!sid) {
      sid = await createSession();
    }
    await ask(next, sid);
  }

  async function ask(next: Msg[], sid: string | null) {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("chat", {
        body: { messages: next, pageContext },
        headers: { "x-app-password": password },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (demoDb && (data?.code === "NO_API_KEY" || data?.code === "BAD_KEY")) {
        // Keep the question so it is sent as soon as a working key is entered.
        pendingRef.current = { messages: next, sid };
        setHasKey(false);
        setKeyPrompt(data.code === "BAD_KEY" ? data.error : "");
        return;
      }
      if (data?.error) throw new Error(data.error);

      const reply: Msg = { role: "assistant", content: data.text || "(no reply)" };
      const withReply = [...next, reply];
      setMessages(withReply);
      onNewMessage?.();

      // Persist — save only the new pair (user + assistant)
      if (sid) {
        const newPair = withReply.slice(-2);
        await callHistory(password, {
          action: "saveMessages",
          session_id: sid,
          messages: newPair,
        }).catch(() => {});
        // Refresh session list to get updated title + timestamp
        const list = await loadSessions();
        setSessions(list);
      }
    } catch (err) {
      setError((err as Error).message || "Could not send.");
    } finally {
      setLoading(false);
    }
  }

  function saveKey(key: string) {
    if (!setApiKey(key)) {
      // The key is read back from sessionStorage, so it cannot be used if it was not stored.
      setKeyPrompt(STORAGE_BLOCKED_MESSAGE);
      return;
    }
    setHasKey(true);
    setKeyPrompt(null);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) {
      setLoading(true);
      void ask(pending.messages, pending.sid);
    }
  }

  function forgetKey() {
    clearApiKey();
    setHasKey(false);
  }

  async function switchSession(id: string) {
    setActiveSession(id);
    setSidebarOpen(false);
    await loadMessages(id);
  }

  async function newChat() {
    setSidebarOpen(false);
    await createSession();
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    await callHistory(password, { action: "deleteSession", session_id: id }).catch(() => {});
    const list = await loadSessions();
    setSessions(list);
    if (id === activeSession) {
      if (list.length > 0) {
        setActiveSession(list[0].id);
        await loadMessages(list[0].id);
      } else {
        const newId = await createSession();
        if (newId) setActiveSession(newId);
      }
    }
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-surface border-r border-line">
      <div className="p-3 border-b border-line">
        <button
          onClick={newChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-ink text-paper text-sm font-medium transition-opacity duration-200 ease-out hover:opacity-90"
        >
          <PlusCircle size={15} />
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => switchSession(s.id)}
            className={`w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-secondary transition-colors duration-200 ease-out group ${s.id === activeSession ? "bg-secondary" : ""}`}
          >
            <MessageSquare size={13} className="text-muted shrink-0" />
            <span className="text-xs text-ink truncate flex-1">{s.title}</span>
            <button
              onClick={(e) => deleteSession(s.id, e)}
              className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded text-muted hover:text-act transition-colors duration-200 ease-out"
              aria-label="Delete conversation"
            >
              <Trash2 size={12} />
            </button>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full bg-surface text-ink overflow-hidden">
      {/* Desktop sidebar — hidden by default, toggled open */}
      {sidebarOpen && (
        <div className="hidden lg:flex flex-col w-44 xl:w-48 border-r border-line shrink-0 overflow-hidden">
          <Sidebar />
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden absolute inset-0 z-20 flex">
          <div className="w-64 h-full shadow-xl">
            <Sidebar />
          </div>
          <div className="flex-1 bg-ink/30" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="border-b border-line px-3 py-3 flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-1.5 rounded-lg text-muted hover:bg-secondary transition-colors duration-200 ease-out"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <MessageSquare size={16} />}
          </button>
          <AppMark className="h-8 w-8" />
          <div className="min-w-0">
            <h2 className="font-semibold text-ink text-sm leading-tight">
              Ask about {patientName}'s records
            </h2>
            <p className="text-xs text-muted truncate">
              {cache?.sources?.length
                ? `${cache.sources.filter((s) => !s.error).length} file${cache.sources.filter((s) => !s.error).length === 1 ? "" : "s"} indexed · not medical advice`
                : "Not medical advice"}
            </p>
          </div>
          {demoDb && hasKey && (
            <button
              onClick={forgetKey}
              className="ml-auto shrink-0 text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Forget key
            </button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-[300px]">
          {historyReady && messages.length === 0 && (
            <div className="text-sm text-muted space-y-2">
              <p>Try asking:</p>
              <ul className="space-y-1.5">
                {[
                  `What was ${patientName}'s last PSA?`,
                  "When is the next scan?",
                  "Where do the doctors disagree?",
                ].map((q) => (
                  <li key={q}>
                    <button
                      onClick={() => setInput(q)}
                      className="text-left text-ink underline-offset-2 hover:underline"
                    >
                      "{q}"
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user" ? "bg-ink text-paper" : "bg-secondary text-ink"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm prose-stone dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          {loading && <div className="text-xs text-muted">Thinking…</div>}
          {demoDb && keyPrompt !== null ? (
            <ApiKeyForm onSave={saveKey} error={keyPrompt || undefined} />
          ) : (
            error && <div className="text-xs text-act">{error}</div>
          )}
        </div>

        <form onSubmit={send} className="border-t border-line p-3 flex gap-2 items-end">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            data-autofocus
            className="flex-1 min-w-0 rounded-lg border border-input bg-surface px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-lg bg-accent text-accent-foreground text-sm font-medium px-4 py-2 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
