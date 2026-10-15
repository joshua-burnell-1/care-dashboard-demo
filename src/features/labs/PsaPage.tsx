// ABOUTME: Placeholder /labs/psa page until Task 5's PSA deep dive: the existing PSA chart under
// ABOUTME: breadcrumbs back to Labs.
import { MascotLoader } from "@/components/MascotLoader";
import { PsaChart } from "@/components/dashboard/PsaChart";
import { Page } from "@/components/shell/Page";
import { usePsaReadings } from "@/hooks/usePsaReadings";
import { Card } from "@/features/shared/SectionUi";

export function PsaPage() {
  const { items, loading } = usePsaReadings();
  const count = items.filter((r) => r.value !== null).length;

  return (
    <Page
      title="PSA"
      breadcrumbs={[{ label: "Labs", to: "/labs" }, { label: "PSA" }]}
      description={loading ? undefined : `${count} reading${count === 1 ? "" : "s"}`}
    >
      {loading ? (
        <MascotLoader label="Loading PSA…" />
      ) : (
        <Card>
          <PsaChart dbPsa={items} />
        </Card>
      )}
    </Page>
  );
}
