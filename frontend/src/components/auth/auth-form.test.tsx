import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/auth-form";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function fetchMockReturning(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: ReturnType<typeof vi.fn>, call = 0): Record<string, unknown> {
  const init = fetchMock.mock.calls[call][1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("AuthForm", () => {
  beforeEach(() => {
    router.replace.mockReset();
    router.refresh.mockReset();
  });

  it("posts trimmed credentials to the login route and redirects on success", async () => {
    const fetchMock = fetchMockReturning(jsonResponse({ user: { email: "ada@example.com" } }));

    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Email"), "  ada@example.com ");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
    expect(bodyOf(fetchMock)).toEqual({ email: "ada@example.com", password: "correct-horse" });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows the API error detail and re-enables the submit button", async () => {
    fetchMockReturning(
      jsonResponse({ error: { code: "invalid_credentials", detail: "Invalid email or password." } }, 401),
    );

    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the error body cannot be parsed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        // A proxy or CDN in front of the app can answer with HTML instead of the API envelope.
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      } as unknown as Response),
    );

    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("reports an unreachable server instead of failing silently", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not reach the server.");
  });

  it("sends the trimmed full name to the signup route", async () => {
    const fetchMock = fetchMockReturning(jsonResponse({ user: { email: "ada@example.com" } }));

    render(<AuthForm mode="signup" />);
    expect(screen.getByText(/Stored as a salted Argon2id hash/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Full name/), "  Ada Lovelace ");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/signup");
    expect(bodyOf(fetchMock)).toEqual({
      email: "ada@example.com",
      password: "correct-horse",
      full_name: "Ada Lovelace",
    });
  });

  it("sends a null full name when the optional signup field is blank", async () => {
    const fetchMock = fetchMockReturning(jsonResponse({ user: { email: "ada@example.com" } }));

    render(<AuthForm mode="signup" />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
    expect(bodyOf(fetchMock).full_name).toBeNull();
  });

  it("validates required fields and signup password length before calling the API", async () => {
    const fetchMock = fetchMockReturning(jsonResponse({ user: {} }));

    const { rerender } = render(<AuthForm mode="login" />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter your email and password to continue.",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    rerender(<AuthForm mode="signup" />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at least 8 characters");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("toggles password visibility without losing the value", async () => {
    render(<AuthForm mode="login" />);
    const password = screen.getByLabelText("Password");
    await userEvent.type(password, "correct-horse");
    expect(password).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Password")).toHaveValue("correct-horse");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("disables the form while a request is in flight", async () => {
    let resolveRequest: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    render(<AuthForm mode="login" />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    resolveRequest(jsonResponse({ user: {} }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });
});
