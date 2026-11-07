export type Theme = "light" | "dark";

/** Browser storage key for the explicit user choice. */
export const THEME_STORAGE_KEY = "nexa-theme";

/**
 * Runs before first paint so a dark-mode visitor never sees a white flash.
 * Kept as a string (not a function) because it is inlined into the document head.
 */
export const themeInitScript = `(function(){try{var stored=localStorage.getItem("${THEME_STORAGE_KEY}");var dark=stored==="dark"||(stored!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;

/** The theme a visitor should see before they make an explicit choice. */
export function resolveInitialTheme(
  stored: string | null,
  prefersDark: boolean,
): Theme {
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}
