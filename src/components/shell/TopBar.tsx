// ABOUTME: Sticky header above every page: the section title, search, a slot for the bell, a slot
// ABOUTME: for the assistant button, the theme toggle and (in demo builds) the demo pill.
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { DemoBanner } from "@/components/DemoBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { shortcutHint } from "@/lib/shortcuts";

export function TopBar({
  title,
  onSearch,
  bellSlot,
  assistantSlot,
}: {
  title: string;
  /** Opens the command palette. */
  onSearch: () => void;
  bellSlot?: ReactNode;
  assistantSlot?: ReactNode;
}) {
  return (
    <header
      data-no-print
      className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-sm"
    >
      <div className="flex h-14 items-center gap-2 px-4 lg:px-6">
        <div className="min-w-0 flex-1">
          {title !== BRAND_NAME && (
            <span className="block truncate text-xs text-muted lg:hidden">{BRAND_NAME}</span>
          )}
          <p className="truncate text-sm font-semibold text-ink lg:text-base">{title}</p>
        </div>
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search"
          aria-keyshortcuts="Meta+K Control+K"
          aria-haspopup="dialog"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-2.5 text-sm text-muted transition-colors duration-200 ease-out hover:text-ink lg:w-56"
        >
          <Search size={16} aria-hidden />
          <span className="hidden lg:inline">Search</span>
          <kbd className="ml-auto hidden rounded-md border border-line px-1.5 font-mono text-[11px] lg:inline">
            {shortcutHint("K")}
          </kbd>
        </button>
        {bellSlot}
        {assistantSlot}
        <ThemeToggle className="shrink-0 rounded-xl" />
        <DemoBanner />
      </div>
    </header>
  );
}
