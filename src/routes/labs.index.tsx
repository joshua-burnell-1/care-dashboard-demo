import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LabsPage } from "@/features/labs/LabsPage";

/** `?abnormal=1`, `?abnormal=true` and `?abnormal=false` all parse; anything else is dropped. */
const booleanParam = z
  .preprocess((v) => {
    if (v === true || v === 1 || v === "1" || v === "true") return true;
    if (v === false || v === 0 || v === "0" || v === "false") return false;
    return undefined;
  }, z.boolean().optional())
  .catch(undefined);

const labsSearchSchema = z.object({
  q: z.coerce.string().optional().catch(undefined),
  panel: z.coerce.string().optional().catch(undefined),
  abnormal: booleanParam,
  sort: z.enum(["date", "name"]).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/labs/")({
  validateSearch: labsSearchSchema,
  component: LabsPage,
});
