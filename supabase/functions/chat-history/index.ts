const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, password, session_id, messages, title, limit } = body as {
      action: string;
      password: string;
      session_id?: string;
      messages?: { role: string; content: string }[];
      title?: string;
      limit?: number;
    };

    const expected = Deno.env.get("APP_PASSWORD");
    if (!expected || password !== expected) return json({ ok: false, error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    if (action === "createSession") {
      const res = await fetch(`${supabaseUrl}/rest/v1/chat_sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "New conversation" }),
      });
      if (!res.ok) return json({ ok: false, error: "Failed to create session" }, 500);
      const [session] = await res.json();
      return json({ ok: true, session });
    }

    if (action === "listSessions") {
      const n = limit ?? 30;
      const res = await fetch(
        `${supabaseUrl}/rest/v1/chat_sessions?order=last_message_at.desc&limit=${n}`,
        {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        },
      );
      const sessions = await res.json();
      return json({ ok: true, sessions });
    }

    if (action === "getMessages") {
      if (!session_id) return json({ ok: false, error: "Missing session_id" }, 400);
      const res = await fetch(
        `${supabaseUrl}/rest/v1/chat_messages?session_id=eq.${session_id}&order=created_at.asc`,
        {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        },
      );
      const msgs = await res.json();
      return json({ ok: true, messages: msgs });
    }

    if (action === "saveMessages") {
      if (!session_id || !messages?.length)
        return json({ ok: false, error: "Missing session_id or messages" }, 400);
      const rows = messages.map((m) => ({ session_id, role: m.role, content: m.content }));
      const res = await fetch(`${supabaseUrl}/rest/v1/chat_messages`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(rows),
      });
      if (!res.ok) return json({ ok: false, error: "Failed to save messages" }, 500);

      // Auto-title from first user message if still default
      const sessionRes = await fetch(`${supabaseUrl}/rest/v1/chat_sessions?id=eq.${session_id}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      const sessions = await sessionRes.json();
      const session = sessions?.[0];
      const firstUser = messages.find((m) => m.role === "user");
      const newTitle =
        session?.title === "New conversation" && firstUser
          ? firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? "…" : "")
          : null;

      await fetch(`${supabaseUrl}/rest/v1/chat_sessions?id=eq.${session_id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          last_message_at: new Date().toISOString(),
          ...(newTitle ? { title: newTitle } : {}),
        }),
      });
      return json({ ok: true });
    }

    if (action === "updateTitle") {
      if (!session_id || !title)
        return json({ ok: false, error: "Missing session_id or title" }, 400);
      await fetch(`${supabaseUrl}/rest/v1/chat_sessions?id=eq.${session_id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ title }),
      });
      return json({ ok: true });
    }

    if (action === "deleteSession") {
      if (!session_id) return json({ ok: false, error: "Missing session_id" }, 400);
      await fetch(`${supabaseUrl}/rest/v1/chat_sessions?id=eq.${session_id}`, {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=minimal" },
      });
      return json({ ok: true });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("chat-history error", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
