import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aiApiKey,
  aiBaseUrl,
  aiModelIds,
  aiModels,
  aiProviderName,
  defaultAiModel,
  isAiConfigured,
} from "@/lib/ai/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AI configuration", () => {
  it("prefers AI_API_KEY and falls back to OPENAI_API_KEY", () => {
    vi.stubEnv("AI_API_KEY", "  ");
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    expect(aiApiKey()).toBe("openai-key");
    expect(isAiConfigured()).toBe(true);

    vi.stubEnv("AI_API_KEY", "primary-key");
    expect(aiApiKey()).toBe("primary-key");

    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(aiApiKey()).toBeNull();
    expect(isAiConfigured()).toBe(false);
  });

  it("normalises the base URL and provider label", () => {
    expect(aiBaseUrl()).toBe("https://api.openai.com/v1");
    vi.stubEnv("AI_BASE_URL", " https://example.test/v1// ");
    expect(aiBaseUrl()).toBe("https://example.test/v1");
    expect(aiProviderName()).toBe("OpenAI-compatible");
    vi.stubEnv("AI_PROVIDER_NAME", "Example AI");
    expect(aiProviderName()).toBe("Example AI");
  });

  it("builds the model allowlist from the environment", () => {
    expect(aiModelIds()).toEqual(["gpt-4o-mini", "gpt-4o"]);
    vi.stubEnv("AI_MODELS", " custom-a, custom-b , custom-a ");
    expect(aiModelIds()).toEqual(["custom-a", "custom-b"]);
    expect(aiModels()).toEqual([
      { id: "custom-a", name: "custom-a", description: "Configured model" },
      { id: "custom-b", name: "custom-b", description: "Configured model" },
    ]);
    vi.stubEnv("AI_MODELS", " , ");
    expect(aiModelIds()).toEqual(["gpt-4o-mini", "gpt-4o"]);
  });

  it("labels known models and chooses a valid default", () => {
    expect(aiModels()[0]).toEqual({
      id: "gpt-4o-mini",
      name: "GPT-4o mini",
      description: "Fast and inexpensive — best default",
    });
    expect(defaultAiModel()).toBe("gpt-4o-mini");

    vi.stubEnv("AI_DEFAULT_MODEL", "gpt-4o");
    expect(defaultAiModel()).toBe("gpt-4o");

    vi.stubEnv("AI_DEFAULT_MODEL", "missing-model");
    expect(defaultAiModel()).toBe("gpt-4o-mini");
  });
});
