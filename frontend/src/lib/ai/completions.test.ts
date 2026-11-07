import { describe, expect, it, vi } from "vitest";

import { AiRequestError, createCompletion } from "@/lib/ai/completions";

const base = {
  apiKey: "secret-key",
  baseUrl: "https://provider.test/v1",
  model: "gpt-4o-mini",
  messages: [{ role: "user" as const, content: "Hello" }],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createCompletion", () => {
  it("posts an OpenAI-compatible request and returns the assistant text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ model: "gpt-4o-mini-2026", choices: [{ message: { content: "Hi!" } }] }),
    );

    const result = await createCompletion({ ...base, fetchImpl: fetchMock });

    expect(result).toEqual({ content: "Hi!", model: "gpt-4o-mini-2026" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://provider.test/v1/chat/completions");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer secret-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "gpt-4o-mini",
      stream: false,
      messages: base.messages,
    });
  });

  it("falls back to the requested model when the provider omits one", async () => {
    const result = await createCompletion({
      ...base,
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "Hey" } }] })),
    });
    expect(result.model).toBe("gpt-4o-mini");
  });

  it.each([
    [401, 503, "ai_auth_failed"],
    [403, 503, "ai_auth_failed"],
    [429, 429, "ai_rate_limited"],
    [500, 502, "ai_upstream_error"],
  ])("maps HTTP %s to %s/%s", async (upstream, status, code) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { message: "nope" } }, upstream));
    await expect(createCompletion({ ...base, fetchImpl: fetchMock })).rejects.toMatchObject({
      status,
      code,
    });
  });

  it("handles non-JSON and empty upstream bodies", async () => {
    await expect(
      createCompletion({
        ...base,
        fetchImpl: vi.fn().mockResolvedValue(new Response("not json", { status: 502 })),
      }),
    ).rejects.toMatchObject({ status: 502, code: "ai_upstream_error" });

    await expect(
      createCompletion({
        ...base,
        fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "   " } }] })),
      }),
    ).rejects.toMatchObject({ status: 502, code: "ai_empty_response" });
  });

  it("distinguishes a timeout from an unreachable provider", async () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    await expect(
      createCompletion({ ...base, fetchImpl: vi.fn().mockRejectedValue(timeout) }),
    ).rejects.toMatchObject({ status: 504, code: "ai_timeout" });

    await expect(
      createCompletion({ ...base, fetchImpl: vi.fn().mockRejectedValue(new TypeError("network")) }),
    ).rejects.toMatchObject({ status: 504, code: "ai_unreachable" });
  });

  it("exposes a typed error class", async () => {
    const error = new AiRequestError("detail", 418, "teapot");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AiRequestError");
    expect(error.message).toBe("detail");
  });
});
