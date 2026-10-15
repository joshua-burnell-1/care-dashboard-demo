// ABOUTME: Demo version of the plan-items edge function: upsert and delete on plan_items,
// ABOUTME: with the same validation and response shapes as the real function.

import { fail, ok, saveItem, type Handler } from "./shared";

const ALLOWED_STATUS = [
  "Locked",
  "Scheduled",
  "In flight",
  "Conditional",
  "Hold",
  "Daily",
  "Completed",
];

export const planItems: Handler = (db, body) => {
  const { action, item, id } = body;

  if (action === "delete") {
    if (!id || typeof id !== "string") return fail("Missing id");
    db.remove("plan_items", id);
    return ok();
  }

  if (action === "upsert") {
    if (!item || typeof item !== "object") return fail("Missing item");
    const fields = item as Record<string, unknown>;
    const title = String(fields.title ?? "").trim();
    const text = String(fields.body ?? "").trim();
    const status = String(fields.status ?? "Scheduled");
    const event_date = fields.event_date ? String(fields.event_date) : null;
    if (!title || title.length > 200) return fail("Invalid title");
    if (text.length > 2000) return fail("Body too long");
    if (!ALLOWED_STATUS.includes(status)) return fail("Invalid status");
    if (event_date && !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) return fail("Invalid date");

    return saveItem(db, "plan_items", fields, { title, body: text, status, event_date });
  }

  return fail("Unknown action");
};
