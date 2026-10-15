// ABOUTME: A tiny change signal for PSA readings: whoever saves or deletes one calls notify, and
// ABOUTME: every mounted usePsaReadings refetches. Realtime alone is not enough (the table may not
// ABOUTME: be in the realtime publication), so writes announce themselves.

const listeners = new Set<() => void>();

/** Run `listener` whenever PSA readings change. Returns the unsubscribe function. */
export function subscribePsaReadingsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyPsaReadingsChanged(): void {
  for (const listener of [...listeners]) listener();
}
