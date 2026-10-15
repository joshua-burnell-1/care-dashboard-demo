// ABOUTME: Holds the viewer's Anthropic API key for the current browser tab only.
// ABOUTME: sessionStorage, never localStorage; every access tolerates blocked storage.

const STORAGE_KEY = "care_demo_anthropic_key";

export const STORAGE_BLOCKED_MESSAGE =
  "Your browser blocked storage for this tab, so the key couldn't be saved.";

const listeners = new Set<() => void>();

/** Calls `cb` whenever this tab saves or clears the key; returns the unsubscribe function. */
export function subscribeApiKey(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  for (const cb of [...listeners]) cb();
}

export function getApiKey(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Returns false when the browser blocked storage, so the key was not saved. */
export function setApiKey(key: string): boolean {
  try {
    sessionStorage.setItem(STORAGE_KEY, key);
    notify();
    return true;
  } catch {
    return false;
  }
}

export function clearApiKey(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
  notify();
}
