// ABOUTME: Shell-wide state the routed pages share: the family password, a way to reopen the tour
// ABOUTME: and the Add PSA reading dialog. AppShell provides it; pages read it with useAppSession.
import { createContext, useContext } from "react";

export type AppSession = {
  /** The family password (the literal "demo" in demo mode), sent with every write. */
  password: string;
  openTour: () => void;
  /** Opens the one shell-level dialog for adding a PSA reading (readings are edited in place). */
  openPsaReading: () => void;
};

export const AppSessionContext = createContext<AppSession | null>(null);

export function useAppSession(): AppSession {
  const session = useContext(AppSessionContext);
  if (!session) throw new Error("useAppSession must be used inside AppShell");
  return session;
}
