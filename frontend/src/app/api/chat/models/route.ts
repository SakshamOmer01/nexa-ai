import { NextResponse } from "next/server";

import {
  aiModels,
  aiProviderName,
  defaultAiModel,
  isAiConfigured,
} from "@/lib/ai/config";
import { getSessionToken } from "@/lib/auth/session";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

export interface ModelsResponse {
  configured: boolean;
  provider: string;
  defaultModel: string;
  models: Array<{ id: string; name: string; description: string }>;
}

/**
 * The model menu is configuration, not a provider call: only the allowlisted ids are exposed and
 * the browser never learns the provider key. Requires a session so the catalog is not public.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionToken())) {
    return NextResponse.json(
      { error: { code: "not_authenticated", detail: "Sign in to list models." } },
      { status: 401, headers: NO_STORE },
    );
  }

  return NextResponse.json<ModelsResponse>(
    {
      configured: isAiConfigured(),
      provider: aiProviderName(),
      defaultModel: defaultAiModel(),
      models: aiModels(),
    },
    { headers: NO_STORE },
  );
}
