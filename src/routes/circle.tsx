import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/features/placeholders/PlaceholderPage";

export const Route = createFileRoute("/circle")({
  component: CircleRoute,
});

function CircleRoute() {
  return (
    <PlaceholderPage
      title="Care circle"
      body="The family members and clinicians who can see this record, their roles, and read-only share links will live here."
    />
  );
}
