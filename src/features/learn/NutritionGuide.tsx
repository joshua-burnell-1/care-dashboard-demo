// ABOUTME: Two-column nutrition guide: foods and drinks to emphasize, and ones to limit or avoid.
import type { AvoidItem, NutritionItem } from "@/features/shared/sections";

const isDrink = (f: { category?: string }) => f.category === "drink";

export function NutritionGuide({
  emphasize,
  avoid,
}: {
  emphasize: NutritionItem[];
  avoid: AvoidItem[];
}) {
  const goodFood = emphasize.filter((f) => !isDrink(f));
  const goodDrink = emphasize.filter(isDrink);
  const avoidFood = avoid.filter((f) => !isDrink(f));
  const avoidDrink = avoid.filter(isDrink);

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {/* Emphasize */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-3">
          Emphasize
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/60 mb-2">
          Food
        </p>
        <ul className="space-y-3 mb-4">
          {goodFood.map((f, i) => (
            <EmphasizeRow key={i} item={f} />
          ))}
        </ul>
        {goodDrink.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/60 mb-2 border-t border-emerald-200/60 pt-3">
              Drinks
            </p>
            <ul className="space-y-3">
              {goodDrink.map((f, i) => (
                <EmphasizeRow key={i} item={f} />
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Limit */}
      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
        <p className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-3">
          Limit or avoid
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700/60 mb-2">
          Food
        </p>
        <ul className="space-y-3 mb-4">
          {avoidFood.map((f, i) => (
            <AvoidRow key={i} item={f} />
          ))}
        </ul>
        {avoidDrink.length > 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700/60 mb-2 border-t border-rose-200/60 pt-3">
              Drinks
            </p>
            <ul className="space-y-3">
              {avoidDrink.map((f, i) => (
                <AvoidRow key={i} item={f} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function EmphasizeRow({ item }: { item: NutritionItem }) {
  return (
    <li className="text-sm">
      <p className="font-semibold text-emerald-900 leading-tight">
        {item.name} <span className="font-normal text-emerald-700/70">— {item.goal}</span>
      </p>
      <p className="text-emerald-800/60 text-xs mt-0.5 leading-relaxed">{item.why}</p>
    </li>
  );
}

function AvoidRow({ item }: { item: AvoidItem }) {
  return (
    <li className="text-sm">
      <p className="font-semibold text-rose-900 leading-tight">{item.name}</p>
      <p className="text-rose-800/60 text-xs mt-0.5 leading-relaxed">{item.body}</p>
    </li>
  );
}
