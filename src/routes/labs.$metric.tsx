import { createFileRoute } from "@tanstack/react-router";
import { LabMetricPage } from "@/features/labs/LabMetricPage";

export const Route = createFileRoute("/labs/$metric")({
  component: LabMetricRoute,
});

function LabMetricRoute() {
  const { metric } = Route.useParams();
  return <LabMetricPage slug={metric} />;
}
