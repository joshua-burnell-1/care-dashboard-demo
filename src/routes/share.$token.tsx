import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/features/placeholders/PlaceholderPage";

export const Route = createFileRoute("/share/$token")({
  component: ShareRoute,
});

function ShareRoute() {
  return (
    <PlaceholderPage
      title="Shared view"
      body="A read-only summary for a clinician share link will show here once care circle sharing is set up."
    />
  );
}
