import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleCredentials } from "@/lib/auth/bff";

import { POST } from "./route";

vi.mock("@/lib/auth/bff", () => ({ handleCredentials: vi.fn() }));

const mockedHandleCredentials = vi.mocked(handleCredentials);

function loginRequest(): Request {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "ada@example.com", password: "correct-horse-battery" }),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockedHandleCredentials.mockReset();
  });

  it("delegates to the shared credential proxy with the login path", async () => {
    const proxied = NextResponse.json({ user: { email: "ada@example.com" } }, { status: 200 });
    mockedHandleCredentials.mockResolvedValue(proxied);
    const request = loginRequest();

    await expect(POST(request)).resolves.toBe(proxied);
    // Same path the backend exposes, and the very request object the browser sent.
    expect(mockedHandleCredentials).toHaveBeenCalledExactlyOnceWith("auth/login", request);
  });

  it("passes a failed proxy response through unchanged", async () => {
    const failure = NextResponse.json(
      { error: { code: "invalid_credentials", detail: "Incorrect email or password." } },
      { status: 401 },
    );
    mockedHandleCredentials.mockResolvedValue(failure);

    const response = await POST(loginRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_credentials" },
    });
  });
});
