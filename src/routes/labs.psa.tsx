import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PsaPage } from "@/features/labs/PsaPage";

const psaSearchSchema = z.object({
  range: z.enum(["all", "post-op", "post-rad"]).optional().catch(undefined),
});

export const Route = createFileRoute("/labs/psa")({
  validateSearch: psaSearchSchema,
  component: PsaPage,
});
