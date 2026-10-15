// ABOUTME: The one layout around every routed page: skip link, desktop sidebar, top bar, main
// ABOUTME: region and mobile tab bar, plus shell-wide state (password, tour, palette, assistant),
// ABOUTME: the Add PSA reading dialog and the global shortcuts.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AssistantButton, AssistantPanel } from "@/components/assistant/AssistantPanel";
import { toggleAssistant } from "@/components/assistant/assistantStore";
import { CommandPalette } from "@/components/command/CommandPalette";
import { PsaReadingDialog } from "@/components/dashboard/PsaReadingDialog";
import { Onboarding, hasCompletedOnboarding } from "@/components/Onboarding";
import { Toaster } from "@/components/ui/sonner";
import { savePsaReading } from "@/hooks/usePsaReadings";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { AppSessionContext, type AppSession } from "@/lib/appSession";
import { BRAND_NAME } from "@/lib/brand";
import { navItemForPath } from "@/lib/nav";
import { shortcutFor } from "@/lib/shortcuts";
import { MobileTabBar } from "./MobileTabBar";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** A Radix dialog other than our own panel and palette is open (they own Cmd or Ctrl K and J). */
function anotherModalIsOpen(): boolean {
  return (
    document.querySelector(
      '[role="alertdialog"][data-state="open"], [role="dialog"][data-state="open"]:not([data-assistant-panel]):not(:has([cmdk-root]))',
    ) !== null
  );
}

export function AppShell({ password, children }: { password: string; children: ReactNode }) {
  const [showTour, setShowTour] = useState(() => !hasCompletedOnboarding());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [psaDialogOpen, setPsaDialogOpen] = useState(false);
  useSessionTimeout();

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = navItemForPath(pathname)?.label ?? BRAND_NAME;

  useEffect(() => {
    document.title = title === BRAND_NAME ? BRAND_NAME : `${title} · ${BRAND_NAME}`;
  }, [title]);

  // K opens the palette and J the assistant, with Cmd on Apple platforms and Ctrl elsewhere. They
  // work everywhere, including inside inputs; nothing else is bound.
  // They do nothing while the tour, the PSA dialog or another modal is open, and a held key
  // does not repeat them.
  const modalOpen = showTour || psaDialogOpen;
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const shortcut = shortcutFor(e);
      if (!shortcut) return;
      e.preventDefault();
      if (e.repeat || modalOpen || anotherModalIsOpen()) return;
      if (shortcut === "palette") {
        setPaletteOpen((open) => !open);
      } else {
        setPaletteOpen(false);
        toggleAssistant();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  const openTour = useCallback(() => setShowTour(true), []);
  const openPsaReading = useCallback(() => setPsaDialogOpen(true), []);

  const session = useMemo<AppSession>(
    () => ({ password, openTour, openPsaReading }),
    [password, openTour, openPsaReading],
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
            onSearch={() => setPaletteOpen(true)}
            assistantSlot={<AssistantButton />}
          />
          <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-24 focus:outline-none lg:pb-0">
            {children}
          </main>
        </div>
        <MobileTabBar />

        <AssistantPanel password={password} fallbackContext={title} />
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          onTour={openTour}
          onAddPsaReading={openPsaReading}
        />
        <PsaReadingDialog
          open={psaDialogOpen}
          onClose={() => setPsaDialogOpen(false)}
          onSave={async (item) => {
            await savePsaReading(password, item);
          }}
        />

        <Toaster richColors position="bottom-right" />
        {showTour && <Onboarding onDone={() => setShowTour(false)} />}
      </div>
    </AppSessionContext.Provider>
  );
}
