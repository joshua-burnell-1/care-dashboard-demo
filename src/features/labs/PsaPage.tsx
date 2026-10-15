// ABOUTME: /labs/psa: the full-size PSA timeline with a range selector, the latest value and doubling
// ABOUTME: time with a plain explanation, and every reading in a list, edited in place, plus Add reading.
import { useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Plus, Sparkles } from "lucide-react";
import { openAssistant } from "@/components/assistant/assistantStore";
import { PsaTimelineChart } from "@/components/charts/PsaTimelineChart";
import { InlineEdit, type InlineField } from "@/components/InlineEdit";
import { MascotLoader } from "@/components/MascotLoader";
import { Page } from "@/components/shell/Page";
import { StatusChip } from "@/components/StatusChip";
import { Button } from "@/components/ui/button";
import { useSections, type PatientSection } from "@/features/shared/sections";
import { usePlanItems } from "@/hooks/usePlanItems";
import {
  deletePsaReading,
  savePsaReading,
  usePsaReadings,
  type PsaReading,
} from "@/hooks/usePsaReadings";
import { useUndoableSave } from "@/hooks/useUndoableSave";
import { useAppSession } from "@/lib/appSession";
import { treatmentEvents } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { postRadiationDoublingMonths } from "@/lib/psaDoubling";
import {
  FAST_DOUBLING_MONTHS,
  MODERATE_DOUBLING_MONTHS,
  PSA_PHASE_LABELS,
  PSA_READINESS_LINE,
  STATUS_LABELS,
  computeStatus,
  doublingBand,
  formatPsa,
} from "@/lib/status";

type Range = "all" | "post-op" | "post-rad";

const RANGES: { value: Range; label: string }[] = [
  { value: "all", label: "All" },
  { value: "post-op", label: "Since surgery" },
  { value: "post-rad", label: "Since radiation" },
];

/** The default matches Today: pre-op values (up to ~8) would flatten the story after surgery. */
const DEFAULT_RANGE: Range = "post-op";

const inRange = (phase: string, range: Range) =>
  range === "all" || (range === "post-op" ? phase !== "pre-op" : phase === "post-rad");

const READING_FIELDS: InlineField<PsaReading>[] = [
  { name: "date", label: "Date", type: "date", required: true },
  {
    name: "value",
    label: "PSA (ng/mL, blank if not drawn yet)",
    type: "number",
    parse: (text) => (text.trim() === "" ? null : Number(text)),
  },
  {
    name: "phase",
    label: "Phase",
    type: "select",
    options: Object.entries(PSA_PHASE_LABELS).map(([value, label]) => ({ value, label })),
  },
  { name: "note", label: "Note", maxLength: 500 },
];

const READING_COLUMNS = "md:[grid-template-columns:8rem_7rem_minmax(0,9rem)_minmax(0,1fr)_2.25rem]";

function ReadingRow({ reading, pencil }: { reading: PsaReading; pencil: React.ReactNode }) {
  const phase = PSA_PHASE_LABELS[reading.phase] ?? reading.phase;
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 md:items-start ${READING_COLUMNS}`}
    >
      <span className="text-sm text-muted tabular-nums md:pt-1.5">
        {formatDate(reading.date)}
        <span className="mt-0.5 block text-xs md:hidden">{phase}</span>
      </span>
      <span className="text-sm font-medium text-ink tabular-nums md:pt-1.5">
        {reading.value != null ? (
          formatPsa(reading.value)
        ) : (
          <span className="font-normal text-muted">Scheduled</span>
        )}
      </span>
      <span className="hidden text-sm text-muted md:block md:pt-1.5">{phase}</span>
      <span className="col-span-3 row-start-2 text-sm text-muted empty:hidden md:col-span-1 md:row-start-auto md:pt-1.5">
        {reading.note}
      </span>
      <span className="col-start-3 row-start-1 md:col-start-auto">{pencil}</span>
    </div>
  );
}

export function PsaPage() {
  const { range: rangeParam } = useSearch({ from: "/labs/psa" });
  const navigate = useNavigate({ from: "/labs/psa" });
  const range = rangeParam ?? DEFAULT_RANGE;
  const { password, openPsaReading } = useAppSession();
  const { items, loading: psaLoading, refresh } = usePsaReadings();
  // Saving the whole reading back is also how an edit is undone.
  const write = async (reading: PsaReading) => {
    const saved = await savePsaReading(password, reading);
    await refresh();
    return saved;
  };
  const saveReading = useUndoableSave(write, write);
  const { items: planItems, loading: planLoading } = usePlanItems();
  const { sec, loading: sectionsLoading } = useSections(["patient"]);
  const patient = sec<PatientSection>("patient", {});

  const valued = useMemo(
    () =>
      items
        .filter((r): r is typeof r & { value: number } => r.value != null)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [items],
  );
  const latest = valued.at(-1) ?? null;
  const doublingMonths = useMemo(() => postRadiationDoublingMonths(items), [items]);
  const band = doublingBand(doublingMonths);
  const postRadCount = valued.filter((r) => r.phase === "post-rad").length;
  const status = computeStatus({
    latestPsa: latest?.value ?? null,
    doublingMonths,
    readinessLine: PSA_READINESS_LINE,
    readings: valued,
  });

  const chartReadings = useMemo(
    () => valued.filter((r) => inRange(r.phase, range)),
    [valued, range],
  );
  // Markers before the first shown reading would stretch the axis, so they stay off.
  const chartEvents = useMemo(() => {
    const start = chartReadings[0]?.date ?? "";
    return treatmentEvents({ patient, planItems }).filter(
      (e) => e.kind !== "visit" && e.date >= start,
    );
  }, [patient, planItems, chartReadings]);

  const loading = psaLoading || planLoading || sectionsLoading;
  const count = valued.length;
  const table = [...items].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Page
      wide
      title="PSA"
      breadcrumbs={[{ label: "Labs", to: "/labs" }, { label: "PSA" }]}
      description={loading ? undefined : `${count} reading${count === 1 ? "" : "s"}`}
      actions={
        <>
          <button
            type="button"
            onClick={() =>
              openAssistant({
                label: "PSA",
                prompt: latest
                  ? `What does my latest PSA of ${formatPsa(latest.value)} ng/mL mean?`
                  : "What does my PSA history mean?",
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Sparkles size={14} aria-hidden />
            Ask about this
          </button>
          <Button type="button" onClick={() => openPsaReading()} className="h-9 rounded-xl">
            <Plus aria-hidden />
            Add reading
          </Button>
        </>
      }
    >
      {loading ? (
        <MascotLoader label="Loading PSA…" />
      ) : (
        <div className="space-y-6">
          <section aria-label="Key numbers" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-[20px] border border-line bg-surface p-5">
              <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
                  Latest PSA
                </h2>
                {latest && <StatusChip level={status.level} label={STATUS_LABELS[status.level]} />}
              </div>
              <p className="mt-3 font-display text-5xl leading-none text-ink tabular-nums">
                {latest ? formatPsa(latest.value) : "None"}
                {latest && <span className="ml-1.5 font-sans text-sm text-muted">ng/mL</span>}
              </p>
              <p className="mt-3 text-sm text-muted">
                {latest ? `Drawn ${formatDate(latest.date)}` : "Add a reading to start the chart"}
              </p>
            </div>

            <div className="rounded-[20px] border border-line bg-surface p-5">
              <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-medium tracking-[0.12em] text-muted uppercase">
                  Doubling time
                </h2>
                {band && <StatusChip level={band.level} label={band.label} />}
              </div>
              <p className="mt-3 font-display text-5xl leading-none text-ink tabular-nums">
                {doublingMonths != null ? doublingMonths.toFixed(1) : "None"}
                {doublingMonths != null && (
                  <span className="ml-1.5 font-sans text-sm text-muted">months</span>
                )}
              </p>
              <p className="mt-3 text-sm text-muted">
                {doublingMonths != null
                  ? `Fitted across ${postRadCount} readings since radiation`
                  : "Not rising, so there is no doubling time"}
              </p>
            </div>

            <div className="rounded-[20px] border border-line bg-surface p-5">
              <h2 className="flex min-h-6 items-center text-xs font-medium tracking-[0.12em] text-muted uppercase">
                Scan readiness line
              </h2>
              <p className="mt-3 font-display text-5xl leading-none text-ink tabular-nums">
                {PSA_READINESS_LINE.toFixed(2)}
                <span className="ml-1.5 font-sans text-sm text-muted">ng/mL</span>
              </p>
              <p className="mt-3 text-sm text-muted">
                {latest && latest.value < PSA_READINESS_LINE
                  ? `${formatPsa(Number((PSA_READINESS_LINE - latest.value).toFixed(3)))} below the line`
                  : latest
                    ? "At or above the line"
                    : "A PSMA scan is more likely to find the source above it"}
              </p>
            </div>
          </section>

          <section
            aria-labelledby="timeline-heading"
            className="rounded-[20px] border border-line bg-surface p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="timeline-heading" className="font-display text-2xl text-ink">
                  PSA over time
                </h2>
                <p className="mt-1 max-w-xl text-sm text-muted">
                  Ultrasensitive results in ng/mL, spaced by date. The dashed line marks{" "}
                  {PSA_READINESS_LINE.toFixed(2)}, where a PSMA scan is more likely to find the
                  source.
                </p>
              </div>
              <div role="group" aria-label="Range" className="flex flex-wrap gap-1.5">
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={range === r.value}
                    onClick={() =>
                      void navigate({
                        search: { range: r.value === DEFAULT_RANGE ? undefined : r.value },
                        resetScroll: false,
                      })
                    }
                    className={`h-9 rounded-xl border px-3 text-sm font-medium transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                      range === r.value
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-surface text-ink hover:bg-secondary"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <PsaTimelineChart
                readings={chartReadings}
                events={chartEvents}
                readinessLine={PSA_READINESS_LINE}
                height={380}
              />
            </div>
          </section>

          <section
            aria-labelledby="doubling-heading"
            className="rounded-[20px] border border-line bg-surface p-5 sm:p-6"
          >
            <h2 id="doubling-heading" className="font-display text-2xl text-ink">
              How doubling time works
            </h2>
            <div className="mt-3 max-w-2xl space-y-3 text-sm leading-relaxed text-ink">
              <p>
                Doubling time is how long the PSA would take to double if it kept rising at its
                recent pace. It is fitted across every reading since radiation, not just the last
                two, so one noisy result does not swing it.
              </p>
              <p className="text-muted">
                Under {FAST_DOUBLING_MONTHS} months is fast, {FAST_DOUBLING_MONTHS} to{" "}
                {MODERATE_DOUBLING_MONTHS} months is moderate, and over {MODERATE_DOUBLING_MONTHS}{" "}
                months is slow. It is a guide for the conversation with the care team, not a
                diagnosis.
              </p>
              <p>
                {doublingMonths != null
                  ? `Right now it is ${doublingMonths.toFixed(1)} months across ${postRadCount} readings since radiation.`
                  : postRadCount < 2
                    ? "There is no doubling time yet: it needs at least two readings since radiation."
                    : "There is no doubling time right now because the PSA is not rising across the readings since radiation."}
              </p>
            </div>
          </section>

          <section
            aria-labelledby="readings-heading"
            className="rounded-[20px] border border-line bg-surface"
          >
            <h2
              id="readings-heading"
              className="rounded-t-[20px] border-b border-line px-5 py-4 font-display text-2xl text-ink"
            >
              Readings
            </h2>
            <div
              aria-hidden
              className={`hidden gap-x-4 border-b border-line px-5 py-2.5 text-xs font-medium tracking-[0.08em] text-muted uppercase md:grid ${READING_COLUMNS}`}
            >
              <span>Date</span>
              <span>PSA (ng/mL)</span>
              <span>Phase</span>
              <span>Note</span>
            </div>
            <ul className="divide-y divide-line">
              {table.map((r) => (
                <li key={r.id} data-psa-reading={r.date}>
                  <InlineEdit
                    value={r}
                    fields={READING_FIELDS}
                    subject={`PSA reading from ${formatDate(r.date)}`}
                    onSave={saveReading}
                    onDelete={async () => {
                      await deletePsaReading(password, r.id);
                      await refresh();
                    }}
                    className="px-5 py-2.5"
                  >
                    {(shown, pencil) => <ReadingRow reading={shown} pencil={pencil} />}
                  </InlineEdit>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Page>
  );
}
