// ABOUTME: The Learn page's in-page nav: a sticky list on the left from desktop up, and a sticky,
// ABOUTME: horizontally scrollable row of chips under the top bar on phones. aria-current marks the section in view.
import { prefersReducedMotion } from "@/lib/motion";
import { replaceHash } from "./useScrollSpy";

export type LearnSection = { id: string; label: string };

const LINK =
  "inline-flex h-9 items-center rounded-full border border-line bg-surface px-3.5 text-sm whitespace-nowrap text-muted transition-colors duration-200 ease-out hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none " +
  "aria-[current=true]:border-ink aria-[current=true]:bg-ink aria-[current=true]:font-medium aria-[current=true]:text-paper " +
  "lg:h-auto lg:rounded-none lg:border-0 lg:border-l-2 lg:border-line lg:bg-transparent lg:py-1.5 lg:pr-0 lg:pl-4 lg:whitespace-normal " +
  "lg:aria-[current=true]:border-ink lg:aria-[current=true]:bg-transparent lg:aria-[current=true]:text-ink";

export function LearnNav({
  sections,
  active,
  onPick,
}: {
  sections: LearnSection[];
  active: string;
  onPick: (id: string) => void;
}) {
  function go(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    // Let the browser handle modified clicks (new tab, new window).
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onPick(id);
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    // Record the section in the URL without a second scroll or a new history entry.
    replaceHash(id);
  }

  return (
    <nav
      aria-label="On this page"
      data-no-print
      className="sticky top-14 z-20 -mx-4 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur-sm lg:top-24 lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
    >
      <p className="mb-3 hidden text-xs font-medium uppercase tracking-wider text-muted lg:block">
        On this page
      </p>
      <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {sections.map((s) => (
          <li key={s.id} className="shrink-0 lg:shrink">
            <a
              href={`#${s.id}`}
              onClick={(e) => go(e, s.id)}
              aria-current={s.id === active ? "true" : undefined}
              className={`${LINK} lg:flex`}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
