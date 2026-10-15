import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ActivityPage } from "@/features/activity/ActivityPage";

const activitySearchSchema = z.object({
  table: z.coerce.string().optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/activity")({
  validateSearch: activitySearchSchema,
  component: ActivityPage,
});
