import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DocumentsPage } from "@/features/documents/DocumentsPage";

const documentsSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  type: z.string().optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/documents/")({
  validateSearch: documentsSearchSchema,
  component: DocumentsPage,
});
