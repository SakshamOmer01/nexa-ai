import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/chat/route";
import { AiRequestError, createCompletion } from "@/lib/ai/completions";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { getSessionToken } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const mockedToken = vi.mocked(getSessionToken);
const mockedApiRequest = vi.mocked(apiRequest);

vi.mock("@/lib/ai/completions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/completions")>();
  return { ...actual, createCompletion: vi.fn() };
});
const mockedCompletion = vi.mocked(createCompletion);

const user = {
  id: "u1",
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  is_active: true,
  created_at: "2026-01-05T10:00:00Z",
};

function request(body: unknown = { model: "gpt-4o-mini", messages: [{ role: "user", content: "Hi" }] }, headers: Record<string, string> = { "Content-Type": "application/json" }) {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedToken.mockResolvedValue("access-token");
  mockedApiRequest.mockResolvedValue(user);
  mockedCompletion.mockReset();
  vi.stubEnv("AI_API_KEY", "test-key");
  vi.stubEnv("AI_MODELS", "gpt-4o-mini,gpt-4o");
  vi.stubEnv("AI_BASE_URL", "");
  vi.stubEnv("AI_DEFAULT_MODEL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/chat", () => {
  it("rejects a cross-origin request before it can spend credits", async () => {
    const response = await POST(
      request(undefined, { "Content-Type": "application/json", Origin: "https://attacker.example" }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "csrf_rejected" } });
    expect(mockedCompletion).not.toHaveBeenCalled();
  });

  it("requires a valid session", async () => {
    mockedToken.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "not_authenticated" } });

    mockedToken.mockResolvedValue("token");
    mockedApiRequest.mockRejectedValue(new Error("401"));
    expect((await POST(request())).status).toBe(401);
    expect(mockedCompletion).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and invalid payloads", async () => {
    const malformed = await POST(request("not json"));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ error: { code: "invalid_request" } });

    const invalid = await POST(request({ model: "", messages: [] }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: "invalid_request" } });
  });

  it("explains when no provider is connected", async () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(request());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("ai_not_configured");
    expect(body.error.detail).toContain("AI_API_KEY");
  });

  it("refuses a model that is not allowlisted", async () => {
    const response = await POST(request({ model: "other-model", messages: [{ role: "user", content: "Hi" }] }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_model" } });
  });

  it("returns the provider's answer with a no-store policy", async () => {
    mockedCompletion.mockResolvedValue({ content: "A real answer", model: "gpt-4o-mini" });
    const response = await POST(
      request({
        model: "gpt-4o-mini",
        systemPrompt: "Be brief.",
        messages: [{ role: "user", content: "Hi" }],
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ content: "A real answer", model: "gpt-4o-mini" });
    expect(mockedCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Be brief." },
          { role: "user", content: "Hi" },
        ],
      }),
    );
    expect(mockedApiRequest).toHaveBeenCalledWith(
      "auth/me",
      expect.objectContaining({ headers: { Authorization: "Bearer access-token" } }),
    );
  });

  it("omits the system message when none is supplied", async () => {
    mockedCompletion.mockResolvedValue({ content: "ok", model: "gpt-4o" });
    const response = await POST(
      request({ model: "gpt-4o", messages: [{ role: "user", content: "Hi" }] }),
    );
    expect(response.status).toBe(200);
    expect(mockedCompletion.mock.calls[0][0].messages).toEqual([{ role: "user", content: "Hi" }]);
  });

  it("maps provider errors and hides unexpected failures", async () => {
    mockedCompletion.mockRejectedValueOnce(new AiRequestError("Rate limited", 429, "ai_rate_limited"));
    const limited = await POST(request());
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({
      error: { code: "ai_rate_limited", detail: "Rate limited" },
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedCompletion.mockRejectedValueOnce(new Error("secret provider detail"));
    const failed = await POST(request());
    expect(failed.status).toBe(502);
    expect(await failed.json()).toMatchObject({
      error: { code: "ai_upstream_error", detail: "The AI request failed. Try again." },
    });
    expect(errorSpy).toHaveBeenCalledWith("chat_completion_failed", "Error");

    mockedCompletion.mockRejectedValueOnce(new ApiClientError("refresh required", 401, "expired"));
    expect((await POST(request())).status).toBe(502);
    expect(errorSpy).toHaveBeenCalledWith("chat_completion_failed", "expired");
  });
});
