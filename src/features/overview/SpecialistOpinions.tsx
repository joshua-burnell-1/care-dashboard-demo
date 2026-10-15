// ABOUTME: The overview's specialist opinions side by side, where they agree and disagree, and
// ABOUTME: the red flags that call for a same-day call.
import { Card, H2 } from "@/features/shared/SectionUi";
import { pillClasses, type DoctorOpinion, type TitledItem } from "@/features/shared/sections";

export function SpecialistOpinions({
  doctors,
  agreements,
  disagreements,
  redFlags,
}: {
  doctors: DoctorOpinion[];
  agreements: string[];
  disagreements: TitledItem[];
  redFlags: TitledItem[];
}) {
  return (
    <>
      <H2>Latest specialist opinions</H2>
      <p className="text-sm text-stone-500 -mt-1 mb-2">
        Each specialist's most recent view, side by side. Where they agree and disagree is
        summarized below.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {doctors.map((d) => (
          <Card key={d.name}>
            <span
              className={`inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full mb-2 ${pillClasses[d.pillTone]}`}
            >
              {d.pillLabel}
            </span>
            <h3 className="font-semibold text-stone-900">{d.name}</h3>
            <p className="text-xs text-stone-500 mb-2">{d.meta}</p>
            <blockquote className="border-l-2 border-stone-200 pl-3 text-sm italic text-stone-600 my-2">
              "{d.quote}"
            </blockquote>
            <div className="mt-3 divide-y divide-stone-100">
              {d.rows.map((r) => (
                <div key={r.k} className="py-2 text-xs">
                  <p className="uppercase tracking-wider text-[10px] text-stone-500 mb-0.5">
                    {r.k}
                  </p>
                  <p className="text-stone-700">{r.v}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <H2>Where they agree</H2>
      <Card>
        <ul className="space-y-2">
          {agreements.map((a, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-stone-700">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
              {a}
            </li>
          ))}
        </ul>
      </Card>

      <H2>Where they disagree</H2>
      <Card>
        <ul className="space-y-3">
          {disagreements.map((d, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-stone-700">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
              <span>
                <span className="font-semibold text-stone-900">{d.title}</span> {d.body}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <H2>Call a doctor if any of these red flags pop up</H2>
      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5">
        <h3 className="font-semibold text-rose-800 mb-3">Same-day call for any of these</h3>
        <ul className="space-y-2.5">
          {redFlags.map((r, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-stone-700 break-words">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
              <span>
                <span className="font-semibold text-stone-900">{r.title}</span> — {r.body}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
