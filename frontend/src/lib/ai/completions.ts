import type { WireMessage } from "@/lib/workspace/chat";

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export class AiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "AiRequestError";
  }
}

interface CompletionOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: WireMessage[];
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export interface CompletionResult {
  content: string;
  model: string;
}

interface UpstreamPayload {
  choices?: Array<{ message?: { content?: unknown } }>;
  error?: { message?: unknown };
  model?: unknown;
}

const ERROR_STATUS: Array<[number, number, string, string]> = [
  [401, 503, "ai_auth_failed", "The AI provider rejected the configured API key."],
  [403, 503, "ai_auth_failed", "The AI provider denied access to the configured key."],
  [429, 429, "ai_rate_limited", "The AI provider is rate limiting requests. Try again shortly."],
];

/**
 * Call an OpenAI-compatible `/chat/completions` endpoint and return the assistant text.
 * Errors are normalised into safe, actionable messages that never contain upstream credentials.
 */
export async function createCompletion({
  apiKey,
  baseUrl,
  model,
  messages,
  fetchImpl = fetch,
  timeoutMs = 45_000,
}: CompletionOptions): Promise<CompletionResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: false }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new AiRequestError(
      timedOut
        ? "The AI provider took too long to respond. Try again."
        : "Could not reach the AI provider. Check the server's network and base URL.",
      504,
      timedOut ? "ai_timeout" : "ai_unreachable",
    );
  }

  let payload: UpstreamPayload = {};
  try {
    payload = (await response.json()) as UpstreamPayload;
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const mapped = ERROR_STATUS.find(([status]) => status === response.status);
    if (mapped) {
      const [, status, code, detail] = mapped;
      throw new AiRequestError(detail, status, code);
    }
    throw new AiRequestError(
      `The AI provider returned an unexpected error (HTTP ${response.status}).`,
      502,
      "ai_upstream_error",
    );
  }

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new AiRequestError(
      "The AI provider returned an empty response. Try regenerating.",
      502,
      "ai_empty_response",
    );
  }

  return {
    content,
    model: typeof payload.model === "string" && payload.model ? payload.model : model,
  };
}
