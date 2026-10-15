import { createFileRoute, redirect } from "@tanstack/react-router";
import { MetricPage } from "@/features/labs/MetricPage";
import { PSA_METRIC_SLUG } from "@/lib/labs";

export const Route = createFileRoute("/labs/$metric")({
  // PSA has its own deep dive; a link to the PSA lab row ends up there.
  beforeLoad: ({ params }) => {
    if (params.metric === PSA_METRIC_SLUG) throw redirect({ to: "/labs/psa", replace: true });
  },
  component: LabMetricRoute,
});

function LabMetricRoute() {
  const { metric } = Route.useParams();
  return <MetricPage slug={metric} />;
}
