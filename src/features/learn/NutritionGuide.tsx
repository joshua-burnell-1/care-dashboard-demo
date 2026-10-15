// ABOUTME: The nutrition guide: foods and drinks to emphasize, then ones to limit or avoid, as
// ABOUTME: two quiet cards in the reading column. Meaning is in the headings, not in red or green text.
import type { AvoidItem, NutritionItem } from "@/features/shared/sections";

const isDrink = (f: { category?: string }) => f.category === "drink";

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-4 first:border-0 first:pt-0">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted">{label}</h4>
      <ul className="space-y-4">{children}</ul>
    </div>
  );
}

function GuideCard({
  title,
  dot,
  groups,
}: {
  title: string;
  dot: string;
  groups: { label: string; items: React.ReactNode[] }[];
}) {
  const shown = groups.filter((g) => g.items.length > 0);
  return (
    <section
      aria-label={title}
      data-nutrition={title}
      className="space-y-4 rounded-[20px] border border-line bg-surface p-5 sm:p-6"
    >
      <h3 className="flex items-center gap-2 font-display text-2xl text-ink">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        {title}
      </h3>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">Nothing is listed here yet.</p>
      ) : (
        shown.map((g) => (
          <Group key={g.label} label={g.label}>
            {g.items}
          </Group>
        ))
      )}
    </section>
  );
}

export function NutritionGuide({
  emphasize,
  avoid,
}: {
  emphasize: NutritionItem[];
  avoid: AvoidItem[];
}) {
  const emphasizeRow = (f: NutritionItem, i: number) => (
    <li key={`${f.name}-${i}`}>
      <p className="text-base font-medium text-ink">{f.name}</p>
      <p className="text-sm text-ink">{f.goal}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-muted">{f.why}</p>
    </li>
  );
  const avoidRow = (f: AvoidItem, i: number) => (
    <li key={`${f.name}-${i}`}>
      <p className="text-base font-medium text-ink">{f.name}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-muted">{f.body}</p>
    </li>
  );

  return (
    <div className="mt-5 space-y-4">
      <GuideCard
        title="Emphasize"
        dot="bg-stable"
        groups={[
          { label: "Food", items: emphasize.filter((f) => !isDrink(f)).map(emphasizeRow) },
          { label: "Drinks", items: emphasize.filter(isDrink).map(emphasizeRow) },
        ]}
      />
      <GuideCard
        title="Limit or avoid"
        dot="bg-watch"
        groups={[
          { label: "Food", items: avoid.filter((f) => !isDrink(f)).map(avoidRow) },
          { label: "Drinks", items: avoid.filter(isDrink).map(avoidRow) },
        ]}
      />
    </div>
  );
}
