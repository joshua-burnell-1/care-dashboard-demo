// ABOUTME: The /documents content until Task 8: uploads, sample documents and the document list
// ABOUTME: (RecordsPanel).
import { RecordsPanel } from "@/components/dashboard/RecordsPanel";
import { Page } from "@/components/shell/Page";
import { useAppSession } from "@/lib/appSession";

export function DocumentsPage() {
  const { password } = useAppSession();
  return (
    <Page title="Documents">
      <section className="space-y-4">
        <RecordsPanel password={password} />
      </section>
    </Page>
  );
}
