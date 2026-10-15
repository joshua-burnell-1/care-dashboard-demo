import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { isDemoMode } from "@/demo/isDemoMode";
import { DemoDb } from "@/demo/db";
import { createMockSupabase } from "@/demo/mockSupabase";
import { createDemoFunctions } from "@/demo/functions";
import { createDemoChat, type ChatBody } from "@/demo/functions/chat";
import { getApiKey } from "@/demo/apiKey";
import { buildSeed } from "@/demo/seed";

const env = import.meta.env;

/** Browser localStorage, or null where it is missing or blocked (private mode, SSR). */
function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** The in-browser demo database, or null when running against a real Supabase project. */
export const demoDb: DemoDb | null = isDemoMode(env)
  ? new DemoDb((today) => buildSeed(today), browserStorage())
  : null;

/** The router passes untyped bodies; only Chat calls this, always with `{ messages, pageContext }`. */
function demoChat(db: DemoDb) {
  const chat = createDemoChat(db, getApiKey);
  return (body: Record<string, unknown>) => chat(body as ChatBody);
}

export const supabase = demoDb
  ? createMockSupabase(demoDb, createDemoFunctions(demoDb, demoChat(demoDb)))
  : createClient<Database>(env.VITE_SUPABASE_URL!, env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
