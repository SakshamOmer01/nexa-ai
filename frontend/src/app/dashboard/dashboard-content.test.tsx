import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardContent } from "@/app/dashboard/dashboard-content";
import { siteConfig } from "@/config/site";
import type { AuthUser } from "@/types/api";

const getSessionUser = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("next/navigation", () => ({
  redirect,
  // SignOutButton is a client component and needs an app-router context.
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const user: AuthUser = {
  id: "8d3c1c1e-5d3f-4a1c-9a5e-6f0b1f2c3d4e",
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  is_active: true,
  created_at: "2026-01-05T10:00:00Z",
};

// DashboardContent is an async server component: resolve it first, then render the resulting tree.
async function renderDashboard() {
  return render(await DashboardContent());
}

beforeEach(() => {
  redirect.mockReset();
  // next/navigation's redirect aborts rendering by throwing; mirror that so the test fails loudly
  // if the body keeps going after a redirect.
  redirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
});

describe("DashboardContent", () => {
  it("greets the viewer by full name and summarises the account", async () => {
    getSessionUser.mockResolvedValue(user);

    await renderDashboard();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back, Ada Lovelace");
    expect(screen.getByText("Authenticated")).toBeInTheDocument();
    // Once in the greeting line and once in the profile list.
    expect(screen.getAllByText(user.email)).toHaveLength(2);

    // Each profile row pairs a <dt> label with its <dd> value.
    expect(screen.getByText("Name").nextElementSibling).toHaveTextContent("Ada Lovelace");
    expect(screen.getByText("Member since").nextElementSibling).toHaveTextContent("Jan 5, 2026");
    expect(screen.getByText("User ID").nextElementSibling).toHaveTextContent(user.id);
  });

  it("falls back to the email local part when no full name is set", async () => {
    getSessionUser.mockResolvedValue({ ...user, full_name: null });

    await renderDashboard();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back, ada");
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("offers the overview, API docs and a sign-out control", async () => {
    getSessionUser.mockResolvedValue(user);

    await renderDashboard();

    expect(screen.getByRole("link", { name: "Back to overview" })).toHaveAttribute("href", "/");
    const apiDocs = screen.getByRole("link", { name: "API docs" });
    expect(apiDocs).toHaveAttribute("href", siteConfig.apiDocsUrl);
    expect(apiDocs).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("redirects signed-out visitors to the login page", async () => {
    getSessionUser.mockResolvedValue(null);

    await expect(DashboardContent()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
