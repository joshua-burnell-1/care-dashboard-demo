export type Theme = "light" | "dark" | "system";

/** Shared with the inline no-flash script in index.html. */
export const THEME_STORAGE_KEY = "tend-theme";

const THEMES: readonly Theme[] = ["light", "dark", "system"];

export function resolveTheme(t: Theme, prefersDark: boolean): "light" | "dark" {
  if (t === "system") return prefersDark ? "dark" : "light";
  return t;
}

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(stored as Theme) ? (stored as Theme) : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** Apply a theme to the document without persisting it. */
export function applyTheme(t: Theme): void {
  const dark = resolveTheme(t, systemPrefersDark()) === "dark";
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(t: Theme): void {
  applyTheme(t);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, t);
  } catch {
    // Storage can be blocked (private windows); the theme still applies for this page.
  }
}
