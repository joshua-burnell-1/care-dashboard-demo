// ABOUTME: Resets the in-browser demo database to its seed and reloads. One code path for the
// ABOUTME: Demo pill menu and the command palette.
import { demoDb } from "@/integrations/supabase/client";

/** True where there is a demo database to reset (demo builds only). */
export const canResetDemo = demoDb !== null;

export function resetDemoData(): void {
  if (!demoDb) return;
  demoDb.reset();
  window.location.reload();
}
