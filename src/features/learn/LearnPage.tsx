// ABOUTME: The /learn page as an editorial reference: a sticky in-page nav beside (or, on phones,
// ABOUTME: above) four readable sections: pathology, doubling time, nutrition and the glossary.
import { useEffect, useMemo, useRef, useState } from "react";
import { Page } from "@/components/shell/Page";
import { usePsaReadings } from "@/hooks/usePsaReadings";
import { demoDb } from "@/integrations/supabase/client";
import { resolvePatientFirstName } from "@/lib/patientName";
import { postRadiationDoublingMonths } from "@/lib/psaDoubling";
import {
  useSections,
  type AvoidItem,
  type NutritionItem,
  type TitledItem,
} from "@/features/shared/sections";
import { DoublingBands } from "./DoublingBands";
import { Glossary } from "./Glossary";
import type { GlossaryEntry } from "./groupGlossary";
import { LearnNav, type LearnSection } from "./LearnNav";
import { NutritionGuide } from "./NutritionGuide";
import { prefersReducedMotion } from "@/lib/motion";
import { SCROLL_OFFSET_PX, replaceHash, useScrollSpy } from "./useScrollSpy";

const SECTION_KEYS = [
  "patient",
  "pathology_features",
  "nutrition_foods",
  "nutrition_avoid",
  "glossary",
];

const NAV: LearnSection[] = [
  { id: "pathology", label: "Pathology" },
  { id: "doubling-time", label: "Doubling time" },
  { id: "nutrition", label: "Nutrition" },
  { id: "glossary", label: "Glossary" },
];
const IDS = NAV.map((s) => s.id);

/** Where a section lands when scrolled to; shared with the spy's reading band. */
const SECTION_STYLE = { scrollMarginTop: SCROLL_OFFSET_PX };

function hashId(): string | null {
  const id = decodeURIComponent(window.location.hash.slice(1));
  return IDS.includes(id) ? id : null;
}

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-display text-3xl leading-tight text-ink sm:text-4xl">
      {children}
    </h2>
  );
}

export function LearnPage() {
  const { items: psaReadings, loading: psaLoading } = usePsaReadings();
  const { sections, sec, loading: sectionsLoading } = useSections(SECTION_KEYS);
  const { active, pin } = useScrollSpy(IDS);
  // From the live section only, so a real deployment never shows the seed's fictional name.
  const firstName = resolvePatientFirstName(sections.patient, demoDb !== null);
  const pathologyFeatures = sec<TitledItem[]>("pathology_features", []);
  const glossary = sec<GlossaryEntry[]>("glossary", []);
  const doublingMonths = useMemo(() => postRadiationDoublingMonths(psaReadings), [psaReadings]);

  // A link such as /learn#glossary lands on its section. The content above it loads after the
  // first paint, so scroll once everything has, not when the page mounts. Only once per mount:
  // a later refresh or realtime update must not pull the page back.
  const ready = !psaLoading && !sectionsLoading;
  const landed = useRef(false);
  // Read once at mount, so nothing below can rewrite the URL before we have landed on it.
  const [initialHash] = useState(hashId);
  const landingPending = () => initialHash !== null && !landed.current;
  useEffect(() => {
    if (!ready || landed.current) return;
    const frame = requestAnimationFrame(() => {
      if (landed.current) return;
      landed.current = true;
      if (!initialHash) return;
      const id = initialHash;
      pin(id);
      document.getElementById(id)?.scrollIntoView({ behavior: "instant", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, pin, initialHash]);

  // The hash changes after mount through an external link or a manual edit.
  useEffect(() => {
    function onHashChange() {
      const id = hashId();
      if (!id) return;
      pin(id);
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pin]);

  // Keep the hash on the section being read, so a reload minutes later does not jump somewhere the
  // reader left. Only when the spy's choice actually changes (not on mount or a StrictMode rerun,
  // which would stamp a hash onto a plain /learn or strip the one we are about to land on).
  const syncedFor = useRef(active);
  useEffect(() => {
    if (active === syncedFor.current) return;
    syncedFor.current = active;
    if (landingPending()) return;
    replaceHash(active === IDS[0] && window.scrollY < 100 ? null : active);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- landingPending only reads refs and state fixed at mount
  }, [active]);

  // Back at the top the hash goes, however gradually the reader got there.
  useEffect(() => {
    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!landingPending() && window.scrollY < 100) replaceHash(null);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- landingPending only reads refs and state fixed at mount
  }, []);

  return (
    <Page
      title="Learn"
      description="Plain-language reference for the pathology, the PSA and the diet."
      wide
    >
      <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-12">
        <aside className="contents lg:block">
          <LearnNav sections={NAV} active={active} onPick={pin} />
        </aside>

        <div className="mt-8 max-w-[68ch] space-y-14 lg:mt-0">
          <section id="pathology" aria-labelledby="pathology-heading" style={SECTION_STYLE}>
            <Heading id="pathology-heading">
              What is special about {firstName}&rsquo;s pathology
            </Heading>
            {pathologyFeatures.length === 0 ? (
              <p className="mt-5 text-sm text-muted">No pathology notes are recorded yet.</p>
            ) : (
              <dl className="mt-5 divide-y divide-line">
                {pathologyFeatures.map((p) => (
                  <div key={p.title} className="py-4 first:pt-0 last:pb-0">
                    <dt className="font-display text-xl leading-snug text-ink">{p.title}</dt>
                    <dd className="mt-1.5 text-base leading-relaxed text-ink/80">{p.body}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section id="doubling-time" aria-labelledby="doubling-heading" style={SECTION_STYLE}>
            <Heading id="doubling-heading">Doubling time, the number to watch</Heading>
            <p className="mt-4 text-base leading-relaxed text-ink/80">
              Doubling time is how long the PSA would take to double if it kept rising at its recent
              pace. The faster it doubles, the more it points toward finding and treating the
              source. It is a guide for the conversation with the care team, not a diagnosis.
            </p>
            <DoublingBands months={doublingMonths} firstName={firstName} />
          </section>

          <section id="nutrition" aria-labelledby="nutrition-heading" style={SECTION_STYLE}>
            <Heading id="nutrition-heading">Nutrition guide</Heading>
            <NutritionGuide
              emphasize={sec<NutritionItem[]>("nutrition_foods", [])}
              avoid={sec<AvoidItem[]>("nutrition_avoid", [])}
            />
          </section>

          <section id="glossary" aria-labelledby="glossary-heading" style={SECTION_STYLE}>
            <Heading id="glossary-heading">Glossary</Heading>
            <Glossary entries={glossary} />
          </section>
        </div>
      </div>
    </Page>
  );
}
