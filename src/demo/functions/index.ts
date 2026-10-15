// ABOUTME: Router that stands in for the Supabase edge functions in demo mode.
// ABOUTME: Maps each function name to its in-browser handler over the demo database.

import type { DemoDb } from "../db";
import { chatHistory } from "./chatHistory";
import { dashboardData } from "./dashboardData";
import { ingestDocument } from "./ingestDocument";
import { planItems } from "./planItems";
import type { Body, Handler } from "./shared";

export type DemoFunctionRouter = (
  name: string,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
) => Promise<unknown>;

export function createDemoFunctions(
  db: DemoDb,
  chat: (body: Body) => Promise<unknown>,
): DemoFunctionRouter {
  const handlers: Record<string, Handler> = {
    "dashboard-data": dashboardData,
    "plan-items": planItems,
    "chat-history": chatHistory,
    "ingest-document": ingestDocument,
    chat: (_db, body) => chat(body),
  };

  return async (name, body) => {
    const handler = Object.hasOwn(handlers, name) ? handlers[name] : undefined;
    if (!handler) throw new Error(`Unknown function: ${name}`);
    return handler(db, body);
  };
}
