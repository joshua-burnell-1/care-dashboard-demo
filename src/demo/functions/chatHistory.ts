// ABOUTME: Demo version of the chat-history edge function: chat sessions and their
// ABOUTME: messages, with the real function's auto-titling and response shapes.

import { fail, ok, patchRow, type Handler, type Row } from "./shared";

const DEFAULT_TITLE = "New conversation";
const DEFAULT_LIST_LIMIT = 30;

type IncomingMessage = { role: string; content: string };

export const chatHistory: Handler = (db, body) => {
  const { action, session_id, messages, title, limit } = body as {
    action?: string;
    session_id?: string;
    messages?: IncomingMessage[];
    title?: string;
    limit?: number;
  };

  if (action === "createSession") {
    return ok({ session: db.upsert("chat_sessions", { title: DEFAULT_TITLE }) });
  }

  if (action === "listSessions") {
    const sessions = db
      .all("chat_sessions")
      .sort((a, b) => String(b.last_message_at).localeCompare(String(a.last_message_at)));
    return ok({ sessions: sessions.slice(0, limit ?? DEFAULT_LIST_LIMIT) });
  }

  if (action === "getMessages") {
    if (!session_id) return fail("Missing session_id");
    // Array#sort is stable, so messages stamped in the same millisecond keep insertion order.
    const rows = db
      .all("chat_messages")
      .filter((m) => m.session_id === session_id)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    return ok({ messages: rows });
  }

  if (action === "saveMessages") {
    if (!session_id || !messages?.length) return fail("Missing session_id or messages");
    const session = db.all("chat_sessions").find((s) => s.id === session_id);
    // chat_messages.session_id is a foreign key, so an unknown session fails the insert.
    if (!session) return fail("Failed to save messages");
    for (const m of messages) {
      db.upsert("chat_messages", { session_id, role: m.role, content: m.content });
    }

    const firstUser = messages.find((m) => m.role === "user");
    const patch: Row = { last_message_at: new Date().toISOString() };
    if (session.title === DEFAULT_TITLE && firstUser) {
      patch.title = firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? "…" : "");
    }
    patchRow(db, "chat_sessions", "id", session_id, patch);
    return ok();
  }

  if (action === "updateTitle") {
    if (!session_id || !title) return fail("Missing session_id or title");
    patchRow(db, "chat_sessions", "id", session_id, { title });
    return ok();
  }

  if (action === "deleteSession") {
    if (!session_id) return fail("Missing session_id");
    // ON DELETE CASCADE on chat_messages.session_id.
    for (const m of db.all("chat_messages")) {
      if (m.session_id === session_id) db.remove("chat_messages", String(m.id));
    }
    db.remove("chat_sessions", session_id);
    return ok();
  }

  return fail(`Unknown action: ${action}`);
};
