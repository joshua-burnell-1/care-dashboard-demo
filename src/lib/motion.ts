// ABOUTME: One check for the OS "reduce motion" setting, so charts draw without animating.

/** True when the viewer asked the OS for less motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}
