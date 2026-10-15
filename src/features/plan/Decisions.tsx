// ABOUTME: The Decisions view: two specialists' positions in aligned rows (topic, then each
// ABOUTME: clinician's view), then where they agree and differ, and how the plan could change.
import { StatusChip } from "@/components/StatusChip";
import type { DoctorOpinion, TitledItem } from "@/features/shared/sections";
import { comparisonRows, parseClinicianMeta } from "@/lib/plan";

export type DecisionTreeItem = { q: string; a: string };

const TOPIC_COLUMN = "10rem";

function ClinicianHeader({ doctor }: { doctor: DoctorOpinion }) {
  const meta = parseClinicianMeta(doctor.meta);
  const where = [meta.institution, meta.date].filter(Boolean).join(" · ");
  return (
    <div
      data-clinician={doctor.name}
      className="rounded-[20px] border border-line bg-surface p-4 md:rounded-none md:border-0 md:bg-transparent md:p-0"
    >
      <h3 className="font-display text-2xl leading-tight text-ink">{doctor.name}</h3>
      {meta.role && <p className="mt-0.5 text-sm text-ink">{capitalize(meta.role)}</p>}
      <p className="text-xs text-muted tabular-nums">{where}</p>
      <div className="mt-2.5">
        <StatusChip level="neutral" label={doctor.pillLabel} />
      </div>
      <blockquote className="mt-3 text-sm leading-relaxed text-muted">
        &ldquo;{doctor.quote}&rdquo;
      </blockquote>
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Comparison({ doctors }: { doctors: DoctorOpinion[] }) {
  const rows = comparisonRows(doctors);
  // The columns only exist from md up; below that, every topic stacks as its own card.
  const columns = `${TOPIC_COLUMN} repeat(${doctors.length}, minmax(0, 1fr))`;
  return (
    <div
      data-comparison
      style={{ "--cols": columns } as React.CSSProperties}
      className="space-y-3 md:space-y-0 md:overflow-hidden md:rounded-[20px] md:border md:border-line md:bg-surface"
    >
      <div className="grid gap-3 md:gap-6 md:border-b md:border-line md:p-6 md:[grid-template-columns:var(--cols)]">
        <div aria-hidden className="hidden md:block" />
        {doctors.map((d) => (
          <ClinicianHeader key={d.name} doctor={d} />
        ))}
      </div>
      <div className="space-y-3 md:space-y-0 md:divide-y md:divide-line">
        {rows.map((row) => (
          <div
            key={row.topic}
            data-topic={row.topic}
            className="grid gap-3 rounded-[20px] border border-line bg-surface p-4 md:gap-6 md:rounded-none md:border-0 md:bg-transparent md:px-6 md:py-4 md:[grid-template-columns:var(--cols)]"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted md:pt-0.5">
              {row.topic}
            </p>
            {row.views.map((view, i) => (
              <div key={doctors[i].name} data-view={doctors[i].name}>
                <p className="mb-0.5 text-xs font-medium text-muted md:hidden">{doctors[i].name}</p>
                {view ? (
                  <p className="text-sm leading-relaxed text-ink">{view}</p>
                ) : (
                  <p className="text-sm text-muted">No view recorded.</p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryList({
  title,
  dot,
  children,
}: {
  title: string;
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="rounded-[20px] border border-line bg-surface p-5 sm:p-6">
      <h3 className="flex items-center gap-2 font-display text-2xl text-ink">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        {title}
      </h3>
      <ul className="mt-3 divide-y divide-line">{children}</ul>
    </section>
  );
}

export function Decisions({
  doctors,
  agreements,
  disagreements,
  decisionTree,
}: {
  doctors: DoctorOpinion[];
  agreements: string[];
  disagreements: TitledItem[];
  decisionTree: DecisionTreeItem[];
}) {
  if (doctors.length === 0 && agreements.length === 0 && disagreements.length === 0) {
    return (
      <p className="rounded-[20px] border border-line bg-surface p-5 text-sm text-muted">
        No specialist opinions are recorded yet.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {doctors.length > 0 && <Comparison doctors={doctors} />}

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryList title="Where they agree" dot="bg-stable">
          {agreements.map((a, i) => (
            <li key={i} className="py-2.5 text-sm leading-relaxed text-ink first:pt-0 last:pb-0">
              {a}
            </li>
          ))}
        </SummaryList>
        <SummaryList title="Where they differ" dot="bg-watch">
          {disagreements.map((d, i) => (
            <li key={i} className="py-2.5 text-sm leading-relaxed first:pt-0 last:pb-0">
              <span className="font-medium text-ink">{d.title}</span>{" "}
              <span className="text-muted">{d.body}</span>
            </li>
          ))}
        </SummaryList>
      </div>

      {decisionTree.length > 0 && (
        <section
          aria-label="How the plan could change"
          className="rounded-[20px] border border-line bg-surface p-5 sm:p-6"
        >
          <h3 className="font-display text-2xl text-ink">How the plan could change</h3>
          <dl className="mt-3 divide-y divide-line">
            {decisionTree.map((d, i) => (
              <div
                key={i}
                className="py-3 first:pt-0 last:pb-0 md:grid md:grid-cols-[20rem_1fr] md:gap-6"
              >
                <dt className="text-sm font-medium text-ink">{d.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted md:mt-0">{d.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
