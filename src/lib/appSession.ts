// ABOUTME: Shell-wide state the routed pages share: the family password, the global Edit mode
// ABOUTME: and a way to reopen the tour. AppShell provides it; pages read it with useAppSession.
import { createContext, useContext } from "react";

export type AppSession = {
  /** The family password (the literal "demo" in demo mode), sent with every write. */
  password: string;
  editMode: boolean;
  setEditMode: (next: boolean | ((current: boolean) => boolean)) => void;
  openTour: () => void;
};

export const AppSessionContext = createContext<AppSession | null>(null);

export function useAppSession(): AppSession {
  const session = useContext(AppSessionContext);
  if (!session) throw new Error("useAppSession must be used inside AppShell");
  return session;
}
