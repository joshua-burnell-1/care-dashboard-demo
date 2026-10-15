// ABOUTME: Desktop primary navigation (1024px and up): the brand, then every section from
// ABOUTME: NAV_ITEMS with the current one marked.
import { Link } from "@tanstack/react-router";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { NAV_ITEMS } from "@/lib/nav";

export function Sidebar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex"
    >
      <Link to="/" className="block px-6 pt-6 pb-5">
        <span className="block font-display text-3xl leading-none text-ink">{BRAND_NAME}</span>
        <span className="mt-1 block text-xs text-muted">{BRAND_TAGLINE}</span>
      </Link>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition-colors duration-200 ease-out hover:bg-secondary hover:text-ink data-[status=active]:bg-secondary data-[status=active]:font-medium data-[status=active]:text-ink"
            >
              <item.icon
                size={18}
                aria-hidden
                className="shrink-0 group-data-[status=active]:text-accent"
              />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
