import { createFileRoute } from "@tanstack/react-router";
import { PsaPage } from "@/features/labs/PsaPage";

export const Route = createFileRoute("/labs/psa")({
  component: PsaPage,
});
