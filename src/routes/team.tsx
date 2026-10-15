import { createFileRoute } from "@tanstack/react-router";
import { TeamPage } from "@/features/team/TeamPage";

export const Route = createFileRoute("/team")({
  component: TeamPage,
});
