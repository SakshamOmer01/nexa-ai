import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/chat/models/route";
import { getSessionToken } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn() }));

const mockedToken = vi.mocked(getSessionToken);

beforeEach(() => {
  vi.stubEnv("AI_API_KEY", "test-key");
  vi.stubEnv("AI_MODELS", "gpt-4o-mini,gpt-4o");
  vi.stubEnv("AI_DEFAULT_MODEL", "gpt-4o");
  vi.stubEnv("AI_PROVIDER_NAME", "Example AI");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/chat/models", () => {
  it("requires a session", async () => {
    mockedToken.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ error: { code: "not_authenticated" } });
  });

  it("returns the allowlisted catalog and provider status", async () => {
    mockedToken.mockResolvedValue("token");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      configured: true,
      provider: "Example AI",
      defaultModel: "gpt-4o",
      models: [
        { id: "gpt-4o-mini", name: "GPT-4o mini", description: "Fast and inexpensive — best default" },
        { id: "gpt-4o", name: "GPT-4o", description: "Stronger reasoning for complex work" },
      ],
    });
  });

  it("reports an unconfigured provider without exposing a key", async () => {
    mockedToken.mockResolvedValue("token");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await GET();
    const body = await response.json();
    expect(body.configured).toBe(false);
    expect(JSON.stringify(body)).not.toContain("test-key");
  });
});
