// ABOUTME: A plan item's fields for editing in place, shared by the timeline row and the visit page.
import type { InlineField } from "@/components/InlineEdit";
import type { PlanItem } from "@/hooks/usePlanItems";
import { PLAN_STATUSES } from "@/lib/plan";

export const PLAN_ITEM_FIELDS: InlineField<PlanItem>[] = [
  { name: "title", label: "Title", required: true, maxLength: 200, wide: true },
  {
    name: "event_date",
    label: "Date (blank for ongoing)",
    type: "date",
    parse: (text) => text || null,
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: PLAN_STATUSES.map((s) => ({ value: s, label: s })),
  },
  { name: "body", label: "Notes", type: "textarea", maxLength: 2000 },
];
