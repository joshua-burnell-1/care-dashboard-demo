import { createFileRoute } from "@tanstack/react-router";
import { VisitPage } from "@/features/plan/VisitPage";

export const Route = createFileRoute("/plan/$visitId")({
  component: VisitRoute,
});

function VisitRoute() {
  const { visitId } = Route.useParams();
  return <VisitPage visitId={visitId} />;
}
