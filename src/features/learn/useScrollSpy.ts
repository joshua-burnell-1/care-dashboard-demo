// ABOUTME: Scroll-spy for the Learn nav: which section is at the top of the reading area, via an
// ABOUTME: IntersectionObserver and a scroll check that share one rule, plus helpers for the URL hash.
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How far from the top of the viewport a section's heading should land: clear of the sticky top bar
 * (56px) and, on phones, the chip nav under it (about 53px). One number for both jobs, so they
 * cannot drift apart: sections use it as their scroll-margin-top, and the spy's reading band starts
 * at the same line, so a section scrolled to by a link is already the one the spy picks.
 */
export const SCROLL_OFFSET_PX = 128;
/** The band ends about a third of the way down the screen. */
const ROOT_MARGIN = `-${SCROLL_OFFSET_PX}px 0px -65% 0px`;
/** How long a clicked link stays active while the page scrolls to it. */
const PIN_MS = 900;

/** Put `id` (or nothing) in the URL hash without a new history entry or a scroll. */
export function replaceHash(id: string | null): void {
  const wanted = id ? `#${id}` : "";
  if (window.location.hash === wanted) return;
  const { pathname, search } = window.location;
  // Keep the router's own history state so back and forward still work.
  window.history.replaceState(window.history.state, "", `${pathname}${search}${wanted}`);
}

export function useScrollSpy(ids: string[]): { active: string; pin: (id: string) => void } {
  const [active, setActive] = useState(ids[0] ?? "");
  const pinnedUntil = useRef(0);
  const compute = useRef<(() => void) | null>(null);
  const key = ids.join("|");

  /** Make `id` active now and hold it while a scroll to it settles, then recheck. */
  const pin = useCallback((id: string) => {
    pinnedUntil.current = Date.now() + PIN_MS;
    setActive(id);
    window.setTimeout(() => compute.current?.(), PIN_MS + 50);
  }, []);

  useEffect(() => {
    const list = key ? key.split("|") : [];
    const elements = list
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return;

    const inBand = new Set<string>();

    // The one rule, run from both the observer and the scroll handler. The top of the page means
    // the first section; otherwise the end of the page wins
    // (a short last section never reaches the band), then the newest section in the band, then
    // the last section whose top is above the band, so a gap between sections keeps the right one.
    const run = () => {
      if (Date.now() < pinnedUntil.current) return;
      // At the very top the first section is the one being read. Without this, a later section
      // can sit in the band for a moment while the page fills in, and the hash sync then writes
      // it to the URL, which the router answers by scrolling there.
      if (window.scrollY <= 0) {
        setActive(list[0]);
        return;
      }
      const atBottom =
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) {
        setActive(list[list.length - 1]);
        return;
      }
      const inView = [...list].reverse().find((id) => inBand.has(id));
      if (inView) {
        setActive(inView);
        return;
      }
      let above = list[0];
      for (const el of elements) {
        if (el.getBoundingClientRect().top <= SCROLL_OFFSET_PX + 1) above = el.id;
      }
      setActive(above);
    };
    compute.current = run;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        run();
      },
      { rootMargin: ROOT_MARGIN },
    );
    elements.forEach((el) => observer.observe(el));
    window.addEventListener("scroll", run, { passive: true });
    return () => {
      compute.current = null;
      observer.disconnect();
      window.removeEventListener("scroll", run);
    };
  }, [key]);

  return { active, pin };
}
