import { useState } from "react";
import { AppMark } from "@/components/AppMark";
import { usePatientFirstName } from "@/hooks/usePatientFirstName";
import { demoDb } from "@/integrations/supabase/client";
import { tourCopy } from "@/lib/tourCopy";
import {
  LayoutDashboard,
  Activity,
  Pencil,
  FolderOpen,
  MessageSquare,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

const STORAGE_KEY = "care_hub_onboarded_v1";

/** False when storage is blocked, so the tour simply shows again. */
export function hasCompletedOnboarding() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markOnboardingComplete() {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // Storage blocked: the tour closes now and may show again on the next visit.
  }
}

const STEP_LOOKS = [
  { icon: <AppMark className="h-14 w-14" />, accent: "rose" as const },
  { icon: <LayoutDashboard size={36} className="text-blue-600" />, accent: "blue" as const },
  { icon: <Activity size={36} className="text-rose-600" />, accent: "rose" as const },
  { icon: <Pencil size={36} className="text-amber-600" />, accent: "amber" as const },
  { icon: <FolderOpen size={36} className="text-teal-600" />, accent: "teal" as const },
  { icon: <MessageSquare size={36} className="text-violet-600" />, accent: "violet" as const },
  { icon: <CheckCircle2 size={36} className="text-emerald-600" />, accent: "emerald" as const },
];

function buildSteps(name: string, demo: boolean) {
  return tourCopy(name, demo).map((copy, i) => ({ ...copy, ...STEP_LOOKS[i] }));
}

const accentBg: Record<string, string> = {
  rose: "bg-rose-50",
  blue: "bg-blue-50",
  amber: "bg-amber-50",
  teal: "bg-teal-50",
  violet: "bg-violet-50",
  emerald: "bg-emerald-50",
};

const accentDot: Record<string, string> = {
  rose: "bg-rose-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  teal: "bg-teal-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
};

interface OnboardingProps {
  onDone: () => void;
}

export function Onboarding({ onDone }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const steps = buildSteps(usePatientFirstName(), demoDb !== null);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  function finish() {
    markOnboardingComplete();
    onDone();
  }

  function next() {
    if (isLast) finish();
    else setStep((s) => s + 1);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" style={{ backdropFilter: "blur(4px)" }} />

      {/* Card */}
      <div
        className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl overflow-hidden"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.1)" }}
      >
        {/* Dismiss */}
        <button
          onClick={finish}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition"
          aria-label="Skip tour"
        >
          <X size={16} />
        </button>

        {/* Icon area */}
        <div className={`flex items-center justify-center py-10 ${accentBg[current.accent]}`}>
          <div className="flex items-center justify-center w-20 h-20">{current.icon}</div>
        </div>

        {/* Content */}
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-lg font-bold text-stone-900 leading-snug">{current.title}</h2>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">{current.body}</p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 py-3">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`rounded-full transition-all duration-200 ${
                i === step
                  ? `w-5 h-2 ${accentDot[current.accent]}`
                  : "w-2 h-2 bg-stone-200 hover:bg-stone-300"
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2 px-6 pb-6 pt-1">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition"
            >
              <ChevronLeft size={15} />
              Back
            </button>
          ) : (
            <div className="flex-1" />
          )}
          <button
            onClick={next}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition"
            style={{
              background: isLast
                ? "linear-gradient(135deg, #059669, #065f46)"
                : "linear-gradient(135deg, #1c1917, #292524)",
            }}
          >
            {isLast ? "Get started" : "Next"}
            {!isLast && <ChevronRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
