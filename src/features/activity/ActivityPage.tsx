// ABOUTME: The /activity content until Task 8: the edit history list with restore.
import { EditHistoryList } from "@/components/dashboard/EditHistoryList";
import { Page } from "@/components/shell/Page";
import { useAppSession } from "@/lib/appSession";

export function ActivityPage() {
  const { password } = useAppSession();
  return (
    <Page title="Activity" description="Last 50 changes. Open any row to restore.">
      <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
        <EditHistoryList password={password} />
      </div>
    </Page>
  );
}
