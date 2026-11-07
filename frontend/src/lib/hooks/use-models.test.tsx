import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useModels } from "@/lib/hooks/use-models";

const payload = {
  configured: true,
  provider: "OpenAI-compatible",
  defaultModel: "gpt-4o-mini",
  models: [{ id: "gpt-4o-mini", name: "GPT-4o mini", description: "Fast" }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useModels", () => {
  it("loads the catalog", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));

    const { result } = renderHook(() => useModels());
    expect(result.current.state.phase).toBe("loading");

    await waitFor(() => expect(result.current.state.phase).toBe("ready"));
    expect(result.current.state).toEqual({ phase: "ready", data: payload });
  });

  it("surfaces the API's error detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { detail: "Sign in to list models." } }), {
          status: 401,
        }),
      ),
    );

    const { result } = renderHook(() => useModels());
    await waitFor(() => expect(result.current.state.phase).toBe("error"));
    expect(result.current.state).toEqual({ phase: "error", message: "Sign in to list models." });
  });

  it("uses a status message when the error body is unreadable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    const { result } = renderHook(() => useModels());
    await waitFor(() => expect(result.current.state.phase).toBe("error"));
    expect(result.current.state).toEqual({
      phase: "error",
      message: "Could not load models (500).",
    });
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("boom"));
    const { result } = renderHook(() => useModels());
    await waitFor(() => expect(result.current.state.phase).toBe("error"));
    expect(result.current.state).toEqual({ phase: "error", message: "Could not load models." });
  });

  it("handles a network failure and can retry", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload)));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useModels());
    await waitFor(() => expect(result.current.state.phase).toBe("error"));
    expect(result.current.state).toEqual({ phase: "error", message: "offline" });

    act(() => result.current.retry());
    expect(result.current.state.phase).toBe("loading");
    await waitFor(() => expect(result.current.state.phase).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
