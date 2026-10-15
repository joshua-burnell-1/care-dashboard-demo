import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/features/overview/OverviewPage";

// Today: renders the existing overview until Task 4 builds the Today page.
export const Route = createFileRoute("/")({
  component: OverviewPage,
});
