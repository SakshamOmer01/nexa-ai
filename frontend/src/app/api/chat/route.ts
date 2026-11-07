import { NextResponse } from "next/server";
import { z } from "zod";

import { AiRequestError, createCompletion } from "@/lib/ai/completions";
import { aiApiKey, aiBaseUrl, aiModelIds, isAiConfigured } from "@/lib/ai/config";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { rejectCrossOrigin } from "@/lib/auth/csrf";
import { getSessionToken } from "@/lib/auth/session";
import type { AuthUser } from "@/types/api";
import type { WireMessage } from "@/lib/workspace/chat";

const MESSAGE_MAX_CHARS = 12_000;
const MAX_MESSAGES = 24;

const requestSchema = z.object({
  model: z.string().min(1).max(120),
  systemPrompt: z.string().max(2_000).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MESSAGE_MAX_CHARS),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES),
});

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

function errorResponse(status: number, code: string, detail: string): NextResponse {
  return NextResponse.json(
    { error: { code, detail }, request_id: crypto.randomUUID() },
    { status, headers: NO_STORE },
  );
}

/** Verify the httpOnly session against the API before spending provider credits. */
async function currentUser(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }
  try {
    return await apiRequest<AuthUser>("auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 4_000,
    });
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const crossOrigin = rejectCrossOrigin(request);
  if (crossOrigin) {
    return crossOrigin;
  }

  const user = await currentUser();
  if (!user) {
    return errorResponse(401, "not_authenticated", "Sign in to send messages.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Request body must be valid JSON.");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_request",
      "Provide a supported model and 1–24 messages with non-empty text.",
    );
  }

  const apiKey = aiApiKey();
  if (!apiKey || !isAiConfigured()) {
    return errorResponse(
      503,
      "ai_not_configured",
      "No AI provider is connected. Set AI_API_KEY (or OPENAI_API_KEY) on the server, then reload the page.",
    );
  }

  if (!aiModelIds().includes(parsed.data.model)) {
    return errorResponse(
      400,
      "invalid_model",
      `Model "${parsed.data.model}" is not enabled. Choose one of: ${aiModelIds().join(", ")}.`,
    );
  }

  const messages: WireMessage[] = [
    ...(parsed.data.systemPrompt ? [{ role: "system" as const, content: parsed.data.systemPrompt }] : []),
    ...parsed.data.messages,
  ];

  try {
    const completion = await createCompletion({
      apiKey,
      baseUrl: aiBaseUrl(),
      model: parsed.data.model,
      messages,
    });

    return NextResponse.json(
      { content: completion.content, model: completion.model },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof AiRequestError) {
      return errorResponse(error.status, error.code, error.message);
    }
    // Keep provider details (and credentials) out of the response.
    console.error(
      "chat_completion_failed",
      error instanceof ApiClientError ? error.code : error instanceof Error ? error.name : "unknown",
    );
    return errorResponse(502, "ai_upstream_error", "The AI request failed. Try again.");
  }
}
