// ABOUTME: Compact "Demo · fictional data" pill for the top bar in demo builds; its menu resets
// ABOUTME: the in-browser database to its seed or opens the About dialog. Renders nothing otherwise.
import { useState } from "react";
import { ChevronDown, Info, RotateCcw } from "lucide-react";
import { AboutDemoDialog } from "@/components/AboutDemoDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { demoDb } from "@/integrations/supabase/client";
import { resetDemoData } from "@/lib/demoReset";

export function DemoBanner() {
  const [aboutOpen, setAboutOpen] = useState(false);
  if (!demoDb) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-watch" />
          <span>
            Demo<span className="sr-only sm:not-sr-only"> · fictional data</span>
          </span>
          <ChevronDown size={14} aria-hidden className="text-muted" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <p className="px-2 py-1.5 text-xs text-muted">
            Everything here is fictional and stays in this browser.
          </p>
          <DropdownMenuItem onSelect={resetDemoData}>
            <RotateCcw aria-hidden />
            Reset demo data
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAboutOpen(true)}>
            <Info aria-hidden />
            About this demo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AboutDemoDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
