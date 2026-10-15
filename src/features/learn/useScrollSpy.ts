// ABOUTME: Scroll-spy for the Learn nav: which section is at the top of the reading area, via an
// ABOUTME: IntersectionObserver, plus a way to pin a choice while a nav click scrolls.
import { useCallback, useEffect, useRef, useState } from "react";

/** A band from just under the sticky top bar (and the phone chip nav) to about a third down the screen. */
const ROOT_MARGIN = "-140px 0px -65% 0px";
/** How long a clicked link stays active while the page scrolls to it. */
const PIN_MS = 900;

export function useScrollSpy(ids: string[]): { active: string; pin: (id: string) => void } {
  const [active, setActive] = useState(ids[0] ?? "");
  const pinnedUntil = useRef(0);
  const key = ids.join("|");

  const pin = useCallback((id: string) => {
    pinnedUntil.current = Date.now() + PIN_MS;
    setActive(id);
  }, []);

  useEffect(() => {
    const list = key ? key.split("|") : [];
    const elements = list
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return;

    const inBand = new Set<string>();
    const update = () => {
      if (Date.now() < pinnedUntil.current) return;
      // The last section in the band is the newest one to reach the reading area.
      const current = [...list].reverse().find((id) => inBand.has(id));
      if (current) setActive(current);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        update();
      },
      { rootMargin: ROOT_MARGIN },
    );
    elements.forEach((el) => observer.observe(el));

    // A short last section never reaches the band, so the end of the page selects it.
    const onScroll = () => {
      if (Date.now() < pinnedUntil.current) return;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) setActive(list[list.length - 1]);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [key]);

  return { active, pin };
}
