import { createFileRoute, redirect } from "@tanstack/react-router";
import { MetricPage } from "@/features/labs/MetricPage";

export const Route = createFileRoute("/labs/$metric")({
  // PSA has its own deep dive; a link to the PSA lab row ends up there.
  beforeLoad: ({ params }) => {
    if (params.metric === "psa-total") throw redirect({ to: "/labs/psa", replace: true });
  },
  component: LabMetricRoute,
});

function LabMetricRoute() {
  const { metric } = Route.useParams();
  return <MetricPage slug={metric} />;
}
