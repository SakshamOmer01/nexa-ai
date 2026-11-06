import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthNav } from "@/components/auth/auth-nav";
import type { AuthUser } from "@/types/api";

const getSessionUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
// SignOutButton is a client component and needs an app-router context.
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

const user: AuthUser = {
  id: "8d3c1c1e-5d3f-4a1c-9a5e-6f0b1f2c3d4e",
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

async function renderNav(signedInAs: AuthUser | null) {
  getSessionUser.mockResolvedValue(signedInAs);
  // AuthNav is an async server component: resolve it first, then render the resulting tree.
  return render(await AuthNav());
}

describe("AuthNav", () => {
  it("offers sign-in and sign-up links to signed-out visitors", async () => {
    await renderNav(null);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/signup",
    );
    expect(screen.queryByText(user.email)).not.toBeInTheDocument();
  });

  it("shows the signed-in email, a dashboard link and a sign-out control", async () => {
    await renderNav(user);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    // The email is truncated by CSS, so the full address stays in the title attribute.
    expect(screen.getByText(user.email)).toHaveAttribute("title", user.email);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("re-reads the session on every render instead of caching the viewer", async () => {
    getSessionUser.mockClear();

    await renderNav(user);
    await renderNav(user);

    expect(getSessionUser).toHaveBeenCalledTimes(2);
  });
});
