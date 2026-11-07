import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RootLayout, { metadata, viewport } from "@/app/layout";
import { siteConfig } from "@/config/site";

// next/font/google downloads and self-hosts fonts during `next build`; in the test renderer the
// loaders only need to expose the CSS variables the layout puts on <html>.
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

describe("RootLayout", () => {
  it("renders a light-first document that carries both font variables and the theme script", () => {
    // Static markup avoids mounting a second <html> inside the test container's <div>.
    const html = renderToStaticMarkup(
      <RootLayout params={Promise.resolve({})}>
        <main>page content</main>
      </RootLayout>,
    );

    expect(html).toContain('lang="en"');
    expect(html).toContain("--font-geist-sans --font-geist-mono");
    expect(html).not.toContain('class="dark ');
    // The inline script reads the stored/system preference before the first paint.
    expect(html).toContain("nexa-theme");
    expect(html).toContain("h-full");
    expect(html).toContain("<main>page content</main>");
  });

  it("describes the site through metadata, including a title template", () => {
    expect(metadata.description).toBe(siteConfig.description);
    expect(metadata.applicationName).toBe(siteConfig.name);
    expect(metadata.title).toEqual({
      default: `${siteConfig.name} — ${siteConfig.tagline}`,
      template: `%s · ${siteConfig.name}`,
    });
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      url: siteConfig.url,
      siteName: siteConfig.name,
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(metadata.keywords).toContain("AI assistant");
  });

  it("advertises both colour schemes", () => {
    expect(viewport).toEqual({
      themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#12131a" },
      ],
      colorScheme: "light dark",
    });
  });
});
