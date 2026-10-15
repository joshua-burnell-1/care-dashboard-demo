import { createFileRoute } from "@tanstack/react-router";
import { PasswordGate } from "@/components/PasswordGate";
import { DemoBanner } from "@/components/DemoBanner";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { Chat } from "@/components/Chat";
import { Onboarding, hasCompletedOnboarding } from "@/components/Onboarding";
import { useState, useCallback } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { LayoutDashboard, MessageSquare, X } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <PasswordGate>{(pw) => <AppShell password={pw} />}</PasswordGate>;
}

function AppShell({ password }: { password: string }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [showTour, setShowTour] = useState(() => !hasCompletedOnboarding());
  const [currentTab, setCurrentTab] = useState("Overview");
  useSessionTimeout();

  const handleNewMessage = useCallback(() => setHasUnread(true), []);

  function openChat() {
    setChatOpen(true);
    setHasUnread(false);
  }

  function closeChat() {
    setChatOpen(false);
  }

  return (
    <div className="h-screen overflow-hidden bg-stone-50 text-stone-900 flex flex-col">
      <DemoBanner />
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-w-0 overflow-y-auto pb-16 lg:pb-0">
          <Dashboard
            password={password}
            onOpenTour={() => setShowTour(true)}
            onTabChange={setCurrentTab}
          />
        </main>
        {/* Desktop chat panel */}
        <aside className="hidden lg:flex lg:w-[400px] xl:w-[440px] border-l border-stone-200 flex-col min-h-0 overflow-hidden">
          <Chat password={password} onNewMessage={handleNewMessage} pageContext={currentTab} />
        </aside>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-stone-200/80 z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex px-3 py-1.5 gap-2">
          <button
            onClick={closeChat}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-3 rounded-2xl transition-all duration-200 ${
              !chatOpen
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-400 hover:text-stone-600 active:bg-stone-100"
            }`}
          >
            <LayoutDashboard size={18} strokeWidth={!chatOpen ? 2.5 : 2} />
            <span className="text-[11px] font-medium leading-none tracking-wide">Dashboard</span>
          </button>
          <button
            onClick={openChat}
            className={`flex-1 relative flex flex-col items-center gap-1 py-2.5 px-3 rounded-2xl transition-all duration-200 ${
              chatOpen
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-400 hover:text-stone-600 active:bg-stone-100"
            }`}
          >
            <span className="relative inline-flex">
              <MessageSquare size={18} strokeWidth={chatOpen ? 2.5 : 2} />
              {hasUnread && !chatOpen && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
              )}
            </span>
            <span className="text-[11px] font-medium leading-none tracking-wide">Chat</span>
          </button>
        </div>
      </nav>

      <Toaster richColors position="bottom-right" />

      {/* Mobile chat — always mounted, shown/hidden via transform so onNewMessage fires */}
      <div
        className={`lg:hidden fixed inset-0 z-50 flex flex-col justify-end transition-all duration-300 ${
          chatOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40"
          style={{ backdropFilter: "blur(2px)" }}
          onClick={closeChat}
        />
        {/* Sheet */}
        <div
          className={`relative bg-white rounded-t-3xl flex flex-col overflow-hidden transition-transform duration-300 ${
            chatOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ height: "91dvh" }}
        >
          {/* Sheet header: drag handle + close button */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
            <div className="w-8" />
            <button
              onClick={closeChat}
              className="w-10 h-1.5 rounded-full bg-stone-200 hover:bg-stone-300 transition cursor-pointer"
              aria-label="Drag to close"
            />
            <button
              onClick={closeChat}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-800 transition"
              aria-label="Close chat"
            >
              <X size={15} />
            </button>
          </div>
          <Chat password={password} onNewMessage={handleNewMessage} pageContext={currentTab} />
        </div>
      </div>

      {/* Onboarding tour */}
      {showTour && <Onboarding onDone={() => setShowTour(false)} />}
    </div>
  );
}
