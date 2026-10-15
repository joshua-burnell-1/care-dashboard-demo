// ABOUTME: Bottom sheet listing the sections that do not fit in the mobile tab bar; picking one
// ABOUTME: navigates there and closes the sheet.
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { NavItem } from "@/lib/nav";

export function MoreSheet({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        className="rounded-t-[20px] border-line bg-surface px-4 pt-5 lg:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
      >
        <SheetTitle className="px-2 font-display text-2xl font-normal text-ink">More</SheetTitle>
        <ul className="mt-3 space-y-0.5">
          {items.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={() => onOpenChange(false)}
                className="group flex items-center gap-3 rounded-xl px-3 py-3 text-base text-ink transition-colors duration-200 ease-out hover:bg-secondary data-[status=active]:bg-secondary data-[status=active]:font-medium"
              >
                <item.icon
                  size={20}
                  aria-hidden
                  className="text-muted group-data-[status=active]:text-accent"
                />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
