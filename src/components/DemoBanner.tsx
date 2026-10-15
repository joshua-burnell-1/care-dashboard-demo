// ABOUTME: Strip across the top of the app in demo mode saying the data is fictional,
// ABOUTME: with a button that puts the in-browser database back to its seed.
import { useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import { AboutDemoDialog } from "@/components/AboutDemoDialog";
import { demoDb } from "@/integrations/supabase/client";

export function DemoBanner() {
  const [aboutOpen, setAboutOpen] = useState(false);
  if (!demoDb) return null;
  const db = demoDb;

  function resetDemo() {
    db.reset();
    window.location.reload();
  }

  return (
    <div
      role="status"
      className="shrink-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-100 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-900"
    >
      <span className="font-medium">Demo mode · All patient data is fictional</span>
      <button
        type="button"
        onClick={resetDemo}
        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium underline-offset-2 hover:bg-amber-200 hover:underline"
      >
        <RotateCcw size={12} aria-hidden="true" />
        Reset demo data
      </button>
      <button
        type="button"
        onClick={() => setAboutOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium underline-offset-2 hover:bg-amber-200 hover:underline"
      >
        <Info size={12} aria-hidden="true" />
        About this demo
      </button>
      <AboutDemoDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
