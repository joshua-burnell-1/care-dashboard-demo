// ABOUTME: The card and section-heading primitives the extracted dashboard pages share until the
// ABOUTME: visual pass (Task 9) replaces them.
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white border border-stone-200/80 rounded-2xl p-5 ${className}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-widest mt-8 mb-3 first:mt-0 flex items-center gap-2.5">
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-full border-2 border-stone-300 shrink-0"
      />
      {children}
    </h2>
  );
}

/** The global Edit mode switch (Task 8 replaces Edit mode with inline editing). */
export function EditModeButton({
  editMode,
  onToggle,
}: {
  editMode: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={editMode ? "Exit edit mode" : "Enter edit mode"}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors duration-200 ease-out ${
        editMode
          ? "border-ink bg-ink text-paper"
          : "border-line bg-surface text-ink hover:bg-secondary"
      }`}
    >
      {editMode ? "Done editing" : "Edit"}
    </button>
  );
}
