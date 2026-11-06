import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignOutButton } from "@/components/auth/sign-out-button";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("SignOutButton", () => {
  beforeEach(() => {
    router.replace.mockReset();
    router.refresh.mockReset();
  });

  it("posts to the logout route and returns the visitor to the landing page", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    // The header is server-rendered, so the cached tree must be re-fetched to show the signed-out state.
    expect(router.refresh).toHaveBeenCalled();
  });

  it("disables itself while the request is in flight", async () => {
    let resolveLogout: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveLogout = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending));

    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(screen.getByText("Signing out…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled();
    expect(router.replace).not.toHaveBeenCalled();

    resolveLogout({ ok: true, status: 204 } as Response);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });
});
