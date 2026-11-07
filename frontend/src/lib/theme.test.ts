import { afterEach, describe, expect, it } from "vitest";

import { applyTheme, resolveInitialTheme, themeInitScript } from "@/lib/theme";

afterEach(() => {
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
});

describe("theme", () => {
  it("prefers an explicit stored choice over the system preference", () => {
    expect(resolveInitialTheme("light", true)).toBe("light");
    expect(resolveInitialTheme("dark", false)).toBe("dark");
    expect(resolveInitialTheme(null, true)).toBe("dark");
    expect(resolveInitialTheme(null, false)).toBe("light");
    expect(resolveInitialTheme("unknown", false)).toBe("light");
  });

  it("applies and removes the dark class", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");

    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("ships a pre-paint script that reads the stored key and the system preference", () => {
    expect(themeInitScript).toContain("nexa-theme");
    expect(themeInitScript).toContain("prefers-color-scheme: dark");
    expect(themeInitScript).toContain('classList.toggle("dark"');
  });
});
