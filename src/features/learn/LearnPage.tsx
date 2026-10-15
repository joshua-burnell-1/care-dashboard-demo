// ABOUTME: The /learn content: what is special about the pathology, the doubling-time bands with
// ABOUTME: the current estimate, the nutrition guide and the glossary.
import { useMemo } from "react";
import { Page } from "@/components/shell/Page";
import { usePsaReadings } from "@/hooks/usePsaReadings";
import { demoDb } from "@/integrations/supabase/client";
import { resolvePatientFirstName } from "@/lib/patientName";
import { formatDoublingTime, postRadiationDoublingMonths } from "@/lib/psaDoubling";
import { Card, H2 } from "@/features/shared/SectionUi";
import {
  toneClasses,
  useSections,
  type AvoidItem,
  type NutritionItem,
  type TitledItem,
  type Tone,
} from "@/features/shared/sections";
import { NutritionGuide } from "./NutritionGuide";

const SECTION_KEYS = [
  "patient",
  "pathology_features",
  "doubling_bands",
  "nutrition_foods",
  "nutrition_avoid",
  "glossary",
];

export function LearnPage() {
  const { items: psaReadings } = usePsaReadings();
  const { sections, sec } = useSections(SECTION_KEYS);
  // From the live section only, so a real deployment never shows the seed's fictional name.
  const firstName = resolvePatientFirstName(sections.patient, demoDb !== null);
  const pathologyFeatures = sec<TitledItem[]>("pathology_features", []);
  const doublingBands = sec<{ range: string; note: string; tone: Tone }[]>("doubling_bands", []);
  const glossary = sec<{ term: string; def: string }[]>("glossary", []);

  const doublingTimeStr = useMemo(() => {
    const months = postRadiationDoublingMonths(psaReadings);
    return months == null ? null : formatDoublingTime(months);
  }, [psaReadings]);

  return (
    <Page title="Learn">
      <section className="space-y-4">
        <H2>What's special about {firstName}'s pathology</H2>
        <div className="space-y-2">
          {pathologyFeatures.map((p, i) => (
            <details key={i} className="bg-white border border-stone-200 rounded-xl group">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-stone-900 flex justify-between items-center gap-3">
                <span>{p.title}</span>
                <span className="text-stone-400 group-open:rotate-45 transition">+</span>
              </summary>
              <div className="px-4 pb-3 text-sm text-stone-600 leading-relaxed">{p.body}</div>
            </details>
          ))}
        </div>

        <H2>Doubling time — the number to watch</H2>
        <Card>
          <div className="divide-y divide-stone-100">
            {doublingBands.map((b) => (
              <div key={b.range} className="flex gap-4 py-2.5 text-sm">
                <span className={`w-20 font-semibold shrink-0 ${toneClasses[b.tone]}`}>
                  {b.range}
                </span>
                <span className="text-stone-700">{b.note}</span>
              </div>
            ))}
          </div>
          {doublingTimeStr && (
            <p className="text-xs text-stone-500 mt-4 leading-relaxed">
              Current best estimate for {firstName}: {doublingTimeStr}, fitted across all
              post-radiation PSA readings.
            </p>
          )}
        </Card>

        <H2>Nutrition guide</H2>
        <NutritionGuide
          emphasize={sec<NutritionItem[]>("nutrition_foods", [])}
          avoid={sec<AvoidItem[]>("nutrition_avoid", [])}
        />

        <H2>Glossary</H2>
        <Card>
          <dl className="space-y-3 text-sm">
            {glossary.map((g) => (
              <div key={g.term}>
                <dt className="font-semibold text-stone-900">{g.term}</dt>
                <dd className="text-stone-600 mt-0.5">{g.def}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>
    </Page>
  );
}
