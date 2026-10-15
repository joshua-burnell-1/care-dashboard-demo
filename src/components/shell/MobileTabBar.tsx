// ABOUTME: Primary navigation under 1024px: a bottom bar with the four main sections and a More
// ABOUTME: button that opens the rest in a sheet.
import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { AssistantFab } from "@/components/assistant/AssistantPanel";
import { NAV_ITEMS, navItemForPath } from "@/lib/nav";
import { MoreSheet } from "./MoreSheet";

const TAB_ITEMS = NAV_ITEMS.filter((item) => item.mobile === "tab");
const MORE_ITEMS = NAV_ITEMS.filter((item) => item.mobile === "more");

const tabClass =
  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium leading-none text-muted transition-colors duration-200 ease-out hover:text-ink";

export function MobileTabBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inMore = navItemForPath(pathname)?.mobile === "more";

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex gap-1 px-2 py-1.5">
          {TAB_ITEMS.map((item) => (
            <li key={item.to} className="flex min-w-0 flex-1">
              <Link
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className={`${tabClass} group data-[status=active]:text-ink`}
              >
                <item.icon
                  size={20}
                  aria-hidden
                  className="group-data-[status=active]:text-accent"
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          ))}
          <li className="flex min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={`${tabClass} ${inMore ? "text-ink" : ""}`}
            >
              <MoreHorizontal size={20} aria-hidden className={inMore ? "text-accent" : ""} />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>
      <AssistantFab />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} items={MORE_ITEMS} />
    </>
  );
}
