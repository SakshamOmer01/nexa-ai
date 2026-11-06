import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleCredentials } from "@/lib/auth/bff";

import { POST } from "./route";

vi.mock("@/lib/auth/bff", () => ({ handleCredentials: vi.fn() }));

const mockedHandleCredentials = vi.mocked(handleCredentials);

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    mockedHandleCredentials.mockReset();
  });

  it("delegates to the shared credential proxy with the signup path", async () => {
    const created = NextResponse.json({ user: { email: "grace@example.com" } }, { status: 201 });
    mockedHandleCredentials.mockResolvedValue(created);
    const request = new Request("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "grace@example.com",
        password: "correct-horse-battery",
        full_name: "Grace Hopper",
      }),
    });

    await expect(POST(request)).resolves.toBe(created);
    expect(mockedHandleCredentials).toHaveBeenCalledExactlyOnceWith("auth/signup", request);
  });
});
