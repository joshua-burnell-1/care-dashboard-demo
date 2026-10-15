import { useEffect, useRef } from "react";
import { demoDb, supabase } from "@/integrations/supabase/client";
import { PASSWORD_STORAGE_KEY } from "@/components/PasswordGate";

const TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes of inactivity

export function useSessionTimeout() {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function resetTimer() {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await supabase.auth.signOut();
      try {
        localStorage.removeItem(PASSWORD_STORAGE_KEY);
      } catch {
        // Storage blocked: nothing was stored to clear.
      }
      window.location.reload();
    }, TIMEOUT_MS);
  }

  useEffect(() => {
    // The demo has no session to expire; reloading an idle demo tab would only lose the view.
    if (demoDb) return;
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      clearTimeout(timer.current);
    };
  }, []);
}
