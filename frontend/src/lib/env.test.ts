import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `@/lib/env` validates and freezes its values at import time, so each case re-imports the module
 * after stubbing the environment it would have seen at build time.
 */
async function importEnv() {
  return import("@/lib/env");
}

describe("public env", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("trims configured values and derives the backend origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", " 2.1.0 ");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.nexa.example.com/api/v1/");

    const { env, apiOrigin } = await importEnv();

    expect(env.NEXT_PUBLIC_APP_VERSION).toBe("2.1.0");
    expect(apiOrigin).toBe("https://api.nexa.example.com");
  });

  it("keeps an API base that has no versioned suffix intact", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.nexa.example.com/");

    const { apiOrigin } = await importEnv();

    expect(apiOrigin).toBe("https://api.nexa.example.com");
  });

  it("fails fast on an invalid URL and names the offending variable", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not-a-url");

    await expect(importEnv()).rejects.toThrow(/Invalid public environment configuration/);
    await expect(importEnv()).rejects.toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("rejects a blank value rather than silently falling back to the default", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_NAME", "   ");

    await expect(importEnv()).rejects.toThrow(/NEXT_PUBLIC_APP_NAME/);
  });
});
