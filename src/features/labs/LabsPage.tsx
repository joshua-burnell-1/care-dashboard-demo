// ABOUTME: The /labs content until Task 5: the PSA readings table and every lab value pulled from
// ABOUTME: records (LabsPanel).
import { Link } from "@tanstack/react-router";
import { MascotLoader } from "@/components/MascotLoader";
import { LabsPanel } from "@/components/dashboard/LabsPanel";
import { Page } from "@/components/shell/Page";
import { usePsaReadings } from "@/hooks/usePsaReadings";
import { formatDate } from "@/lib/format";
import { H2 } from "@/features/shared/SectionUi";

export function LabsPage() {
  const { items: psaReadings, loading } = usePsaReadings();

  return (
    <Page title="Labs">
      {loading ? (
        <MascotLoader label="Loading labs…" />
      ) : (
        <section className="space-y-4">
          <H2>PSA readings</H2>
          <div
            className="bg-white border border-stone-200/80 rounded-2xl overflow-hidden"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between gap-3">
              <Link to="/labs/psa" className="text-xs font-semibold text-stone-700 hover:underline">
                PSA history
              </Link>
              <p className="text-[11px] text-stone-400">
                {psaReadings.filter((r) => r.value !== null).length} readings
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100">
                    <th className="text-left px-5 py-2">Date</th>
                    <th className="text-left px-5 py-2">PSA (ng/mL)</th>
                    <th className="text-left px-5 py-2">Phase</th>
                    <th className="text-left px-5 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {[...psaReadings].reverse().map((r) => (
                    <tr key={r.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-5 py-2.5 tabular-nums text-stone-600 text-xs">
                        {formatDate(r.date)}
                      </td>
                      <td className="px-5 py-2.5 tabular-nums font-semibold text-stone-900">
                        {r.value != null ? (
                          r.value
                        ) : (
                          <span className="text-stone-400 font-normal">(scheduled)</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-stone-500 text-xs capitalize">
                        {r.phase.replace("-", " ")}
                      </td>
                      <td className="px-5 py-2.5 text-stone-500 text-xs">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <H2>All lab values from records</H2>
          <p className="text-sm text-stone-600 -mt-1">
            Every metric the AI could pull from uploaded documents — CBC, chemistry, and more.
          </p>
          <LabsPanel />
        </section>
      )}
    </Page>
  );
}
