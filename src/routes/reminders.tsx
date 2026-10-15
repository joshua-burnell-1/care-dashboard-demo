import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/features/placeholders/PlaceholderPage";

export const Route = createFileRoute("/reminders")({
  component: RemindersRoute,
});

function RemindersRoute() {
  return (
    <PlaceholderPage
      title="Reminders"
      body="Upcoming visits, prep nudges and lab draws that are due will show here, with your digest settings."
    />
  );
}
