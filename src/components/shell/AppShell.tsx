// ABOUTME: The one layout around every routed page: skip link, desktop sidebar, top bar, main
// ABOUTME: region and mobile tab bar, plus shell-wide state (password, Edit mode, tour, assistant).
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { Chat } from "@/components/Chat";
import { Onboarding, hasCompletedOnboarding } from "@/components/Onboarding";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { AppSessionContext, type AppSession } from "@/lib/appSession";
import { BRAND_NAME } from "@/lib/brand";
import { navItemForPath } from "@/lib/nav";
import { MobileTabBar } from "./MobileTabBar";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ password, children }: { password: string; children: ReactNode }) {
  const [editMode, setEditMode] = useState(false);
  const [showTour, setShowTour] = useState(() => !hasCompletedOnboarding());
  const [assistantOpen, setAssistantOpen] = useState(false);
  useSessionTimeout();

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = navItemForPath(pathname)?.label ?? BRAND_NAME;

  useEffect(() => {
    document.title = title === BRAND_NAME ? BRAND_NAME : `${title} · ${BRAND_NAME}`;
  }, [title]);

  const session = useMemo<AppSession>(
    () => ({ password, editMode, setEditMode, openTour: () => setShowTour(true) }),
    [password, editMode],
  );

  return (
    <AppSessionContext.Provider value={session}>
      <div className="min-h-dvh bg-paper text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <Sidebar />
        <div className="flex min-h-dvh min-w-0 flex-col lg:pl-60 print:pl-0">
          <TopBar
            title={title}
            assistantSlot={
              // Placeholder until the assistant slide-over (Task 3): the existing Chat in a sheet.
              <button
                type="button"
                onClick={() => setAssistantOpen(true)}
                aria-haspopup="dialog"
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface px-2.5 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary"
              >
                <MessageSquare size={16} aria-hidden />
                <span className="sr-only lg:not-sr-only">Assistant</span>
              </button>
            }
          />
          <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-24 focus:outline-none lg:pb-0">
            {children}
          </main>
        </div>
        <MobileTabBar />

        <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
          <SheetContent
            side="right"
            aria-describedby={undefined}
            className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px] [&>button:first-child]:z-10"
          >
            <SheetTitle className="sr-only">Assistant</SheetTitle>
            <div className="min-h-0 flex-1">
              <Chat password={password} pageContext={title} />
            </div>
          </SheetContent>
        </Sheet>

        <Toaster richColors position="bottom-right" />
        {showTour && <Onboarding onDone={() => setShowTour(false)} />}
      </div>
    </AppSessionContext.Provider>
  );
}
