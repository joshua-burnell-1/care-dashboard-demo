// ABOUTME: The home page: a status line answering "how is he doing, what's next", four KPI tiles,
// ABOUTME: the annotated PSA chart, Up next, What changed and the When-to-call tiers.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, Sparkles } from "lucide-react";
import { openAssistant } from "@/components/assistant/assistantStore";
import { PsaTimelineChart } from "@/components/charts/PsaTimelineChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { MascotLoader } from "@/components/MascotLoader";
import { StatusChip } from "@/components/StatusChip";
import { isoDaysFromToday } from "@/demo/dates";
import { useDocuments } from "@/hooks/useDocuments";
import { useEditHistory } from "@/hooks/useEditHistory";
import { useLabResults } from "@/hooks/useLabResults";
import { usePlanItems } from "@/hooks/usePlanItems";
import { usePsaReadings } from "@/hooks/usePsaReadings";
import { useAppSession } from "@/lib/appSession";
import { changeWindowStart, changesSince } from "@/lib/changes";
import { treatmentEvents } from "@/lib/events";
import { formatDate, formatRelative } from "@/lib/format";
import { postRadiationDoublingMonths } from "@/lib/psaDoubling";
import {
  PSA_READINESS_LINE,
  computeDelta,
  computeStatus,
  doublingBand,
  formatPsa,
} from "@/lib/status";
import { EditModeButton } from "@/features/shared/SectionUi";
import {
  useSections,
  type OpenQuestion,
  type PatientSection,
  type TitledItem,
} from "@/features/shared/sections";
import { KpiTile } from "./KpiTile";
import { PsaReadingsEditList } from "./PsaReadingsEditList";
import { StatusLine } from "./StatusLine";
import { UpNext } from "./UpNext";
import { WhatChanged } from "./WhatChanged";
import { WhenToCall } from "./WhenToCall";

const SECTION_KEYS = ["patient", "red_flags", "open_questions"];

const DELTA_ICONS = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

/** How far ahead the chart looks for a scan to mark, so the next scan sits on the timeline. */
const SCAN_LOOKAHEAD_DAYS = 45;

export function TodayPage() {
  const { editMode, setEditMode, openPsaReading } = useAppSession();
  const { items: psaReadings, loading: psaLoading } = usePsaReadings();
  const { items: planItems, loading: planLoading } = usePlanItems();
  const { items: labs } = useLabResults();
  const { documents } = useDocuments();
  const { entries: edits } = useEditHistory();
  const { sec, loading: sectionsLoading } = useSections(SECTION_KEYS);
  const patient = sec<PatientSection>("patient", {});
  const redFlags = sec<TitledItem[]>("red_flags", []);
  const questions = sec<OpenQuestion[]>("open_questions", []);

  // Local calendar day, the same helper the seed uses, so plan dates compare correctly.
  const today = useMemo(() => isoDaysFromToday(0), []);

  const valued = useMemo(
    () =>
      psaReadings
        .filter((r): r is typeof r & { value: number } => r.value != null)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [psaReadings],
  );
  const latest = valued.at(-1) ?? null;
  const doublingMonths = useMemo(() => postRadiationDoublingMonths(psaReadings), [psaReadings]);
  const band = doublingBand(doublingMonths);
  const postRadCount = valued.filter((r) => r.phase === "post-rad").length;

  const upcoming = useMemo(
    () =>
      planItems
        .filter((i) => i.status !== "Completed" && i.event_date && i.event_date >= today)
        .sort((a, b) => a.event_date!.localeCompare(b.event_date!)),
    [planItems, today],
  );
  const next = upcoming[0] ?? null;

  const status = computeStatus({
    latestPsa: latest?.value ?? null,
    doublingMonths,
    readinessLine: PSA_READINESS_LINE,
    readings: valued,
    nextStep: next ? { title: next.title, date: next.event_date! } : null,
  });

  // The chart starts after surgery: pre-op values (up to ~8) would flatten the post-op story.
  const chartReadings = useMemo(() => valued.filter((r) => r.phase !== "pre-op"), [valued]);
  const chartEvents = useMemo(() => {
    const horizon = isoDaysFromToday(SCAN_LOOKAHEAD_DAYS);
    return treatmentEvents({ patient, planItems }).filter(
      (e) =>
        e.kind === "surgery" ||
        e.kind === "radiation" ||
        (e.kind === "scan" && e.date >= today && e.date <= horizon),
    );
  }, [patient, planItems, today]);

  const changeWindow = useMemo(() => changeWindowStart(planItems, today), [planItems, today]);
  const changes = useMemo(
    () => changesSince(changeWindow.date, { edits, documents, labs, psa: psaReadings }),
    [changeWindow.date, edits, documents, labs, psaReadings],
  );

  const sparkValues = valued.filter((r) => r.phase === "post-rad").map((r) => r.value);
  const delta = computeDelta(valued);
  const previous = valued.at(-2);
  const DeltaIcon = delta ? DELTA_ICONS[delta.direction] : Minus;

  // Only questions for visits still ahead count as open; the first such visit is where they link.
  const upcomingQuestions = upcoming.flatMap((visit) =>
    questions.filter((q) => q.visit_id === visit.id),
  );
  const nextVisitQuestions = next ? questions.filter((q) => q.visit_id === next.id).length : 0;
  const questionsVisit = upcomingQuestions[0]?.visit_id ?? next?.id;

  const loading = psaLoading || planLoading || sectionsLoading;
  const eyebrow = [patient.name, patient.diagnosis].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 break-words sm:pt-8 lg:px-8 lg:pt-10">
      {loading ? (
        <MascotLoader label="Loading records…" />
      ) : (
        <>
          <StatusLine
            status={status}
            eyebrow={eyebrow || undefined}
            asOf={latest?.date}
            actions={
              <>
                <button
                  type="button"
                  onClick={() =>
                    openAssistant({
                      label: "Today",
                      prompt: `${status.headline} What does this mean, and what should we ask at the next visit?`,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary"
                >
                  <Sparkles size={14} aria-hidden />
                  Ask about today
                </button>
                <EditModeButton editMode={editMode} onToggle={() => setEditMode((e) => !e)} />
              </>
            }
          />

          <div className="mt-8 space-y-6 lg:mt-10">
            <section
              aria-label="Key numbers"
              className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
            >
              <KpiTile
                label="Latest PSA"
                to="/labs/psa"
                value={latest ? formatPsa(latest.value) : "None"}
                unit={latest ? "ng/mL" : undefined}
                aside={<Sparkline values={sparkValues} width={88} />}
                footer={
                  delta?.change != null && previous ? (
                    <span className="flex flex-wrap items-center gap-x-1 text-ink">
                      <DeltaIcon size={14} aria-hidden />
                      <span className="tabular-nums">
                        {delta.direction === "flat"
                          ? "No change"
                          : `${delta.direction === "up" ? "Up" : "Down"} ${formatPsa(Math.abs(delta.change))}`}
                      </span>
                      <span className="whitespace-nowrap text-muted">
                        since {formatDate(previous.date)}
                      </span>
                    </span>
                  ) : latest ? (
                    `Drawn ${formatDate(latest.date)}`
                  ) : (
                    "Add a reading to start the chart"
                  )
                }
              />
              <KpiTile
                label="Doubling time"
                to="/labs/psa"
                value={doublingMonths != null ? doublingMonths.toFixed(1) : "None"}
                unit={doublingMonths != null ? "months" : undefined}
                badge={band && <StatusChip level={band.level} label={band.label} />}
                footer={
                  doublingMonths != null
                    ? `Fitted across ${postRadCount} readings since radiation`
                    : "Not rising, so there is no doubling time"
                }
              />
              <KpiTile
                label="Next visit"
                to={next ? `/plan/${next.id}` : "/plan"}
                value={
                  next
                    ? (() => {
                        const r = formatRelative(next.event_date!);
                        return r.charAt(0).toUpperCase() + r.slice(1);
                      })()
                    : "None"
                }
                footer={
                  next ? (
                    <>
                      <span className="line-clamp-2 text-ink">{next.title}</span>
                      <span className="tabular-nums">{formatDate(next.event_date!)}</span>
                    </>
                  ) : (
                    "Nothing scheduled"
                  )
                }
              />
              <KpiTile
                label="Open questions"
                to={questionsVisit ? `/plan/${questionsVisit}` : "/plan"}
                value={upcomingQuestions.length}
                unit="to ask"
                footer={
                  next && nextVisitQuestions > 0
                    ? `${nextVisitQuestions} for the visit on ${formatDate(next.event_date!)}`
                    : upcomingQuestions.length
                      ? "Written down for upcoming visits"
                      : "None written down yet"
                }
              />
            </section>

            <section
              aria-labelledby="psa-chart-heading"
              className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="psa-chart-heading" className="font-display text-3xl text-ink">
                    PSA since surgery
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted">
                    Ultrasensitive results in ng/mL, spaced by date. The dashed line marks{" "}
                    {PSA_READINESS_LINE.toFixed(2)}, where a PSMA scan is more likely to find the
                    source.
                  </p>
                </div>
                <Link
                  to="/labs/psa"
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted transition-colors duration-200 ease-out hover:text-ink"
                >
                  View PSA details <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
              <div className="mt-6">
                <PsaTimelineChart
                  readings={chartReadings}
                  events={chartEvents}
                  readinessLine={PSA_READINESS_LINE}
                  height={300}
                />
              </div>
              {editMode && <PsaReadingsEditList readings={psaReadings} onEdit={openPsaReading} />}
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <UpNext items={upcoming.slice(0, 3)} />
              <WhatChanged
                items={changes}
                since={changeWindow.date}
                sinceLabel={changeWindow.label}
              />
            </div>

            <WhenToCall redFlags={redFlags} />
          </div>
        </>
      )}
    </div>
  );
}
