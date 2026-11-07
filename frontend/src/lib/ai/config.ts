/**
 * Server-only AI provider configuration.
 *
 * Nexa talks to any OpenAI-compatible Chat Completions endpoint. The key is read from the
 * environment at request time and is never returned to the browser: the client only ever sees
 * `{ configured, models, defaultModel }`.
 */

export interface AiModel {
  id: string;
  name: string;
  description: string;
}

const KNOWN_MODELS: Record<string, { name: string; description: string }> = {
  "gpt-4o-mini": { name: "GPT-4o mini", description: "Fast and inexpensive — best default" },
  "gpt-4o": { name: "GPT-4o", description: "Stronger reasoning for complex work" },
  "gpt-4.1": { name: "GPT-4.1", description: "Long-context coding and analysis" },
  "gpt-4.1-mini": { name: "GPT-4.1 mini", description: "Balanced speed and quality" },
  "o4-mini": { name: "o4-mini", description: "Compact reasoning model" },
};

const DEFAULT_MODELS = ["gpt-4o-mini", "gpt-4o"];

export function aiApiKey(): string | null {
  const key = process.env.AI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  return key ? key : null;
}

export function aiBaseUrl(): string {
  return (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
}

export function aiProviderName(): string {
  return process.env.AI_PROVIDER_NAME?.trim() || "OpenAI-compatible";
}

/** Configured allowlist. Only models in this list can be requested, so the UI cannot fan out. */
export function aiModelIds(): string[] {
  const configured = (process.env.AI_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  const ids = configured.length > 0 ? configured : DEFAULT_MODELS;
  return [...new Set(ids)];
}

export function aiModels(): AiModel[] {
  return aiModelIds().map((id) => {
    const known = KNOWN_MODELS[id];
    return {
      id,
      name: known?.name ?? id,
      description: known?.description ?? "Configured model",
    };
  });
}

export function defaultAiModel(): string {
  const configured = process.env.AI_DEFAULT_MODEL?.trim();
  const ids = aiModelIds();
  if (configured && ids.includes(configured)) {
    return configured;
  }
  return ids[0] ?? "";
}

export function isAiConfigured(): boolean {
  return aiApiKey() !== null;
}
