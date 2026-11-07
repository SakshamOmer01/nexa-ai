import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkspaceLayout, { WorkspaceGuard, WorkspaceLoading } from "@/app/(workspace)/layout";
import type { AuthUser } from "@/types/api";

const getSessionUserMock = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getSessionUser: getSessionUserMock }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/components/workspace/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));
vi.mock("@/lib/workspace/provider", () => ({
  WorkspaceProvider: ({ children, user }: { children: ReactNode; user: AuthUser }) => (
    <div data-testid="provider" data-user={user.email}>
      {children}
    </div>
  ),
}));

const user: AuthUser = {
  id: "u1",
  email: "ada@example.com",
  full_name: "Ada",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  getSessionUserMock.mockReset();
  redirect.mockReset();
  redirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
});

describe("WorkspaceLayout", () => {
  it("wraps the workspace in the provider and shell for a signed-in user", async () => {
    getSessionUserMock.mockResolvedValue(user);

    render(await WorkspaceGuard({ children: <p>page</p> }));

    expect(screen.getByTestId("provider")).toHaveAttribute("data-user", user.email);
    expect(screen.getByTestId("app-shell")).toHaveTextContent("page");
  });

  it("redirects signed-out visitors to login", async () => {
    getSessionUserMock.mockResolvedValue(null);

    await expect(WorkspaceGuard({ children: <p>page</p> })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("streams a branded loading shell", () => {
    const { container } = render(<WorkspaceLoading />);
    expect(container.querySelector('[aria-busy="true"]')).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Loading your workspace…")).toBeInTheDocument();
  });

  it("exposes a suspense boundary for the guarded tree", () => {
    expect(WorkspaceLayout({ children: <p>page</p> })).toBeTruthy();
  });
});
