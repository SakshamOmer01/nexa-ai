import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HealthStatusPanel } from "@/components/health-status-panel";
import type { FrontendHealth } from "@/types/api";

const HEALTHY: FrontendHealth = {
  status: "ok",
  service: "frontend-web",
  version: "0.1.0",
  environment: "test",
  timestamp: "2026-01-01T00:00:00Z",
  uptime_seconds: 12,
  dependencies: [
    { name: "backend-api", status: "up", latency_ms: 4, detail: null },
    { name: "postgresql", status: "up", latency_ms: 3, detail: null },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

describe("HealthStatusPanel", () => {
  it("shows a checking state until the health probe resolves", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    render(<HealthStatusPanel />);

    expect(screen.getByText("frontend-web")).toBeInTheDocument();
    // Both dependency rows and the overall badge read "checking" until the probe answers.
    expect(screen.getAllByText("checking")).toHaveLength(3);
    expect(screen.getByText("Checking dependencies…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Re-run health check" })).toBeDisabled();
  });

  it("renders one row per dependency once the probe succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(HEALTHY));
    vi.stubGlobal("fetch", fetchMock);

    render(<HealthStatusPanel />);

    expect(await screen.findByText("postgresql")).toBeInTheDocument();
    expect(screen.getByText("backend-api")).toBeInTheDocument();
    expect(screen.getAllByText("up")).toHaveLength(3);
    expect(screen.getByText("3ms")).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(screen.getByText(/v0\.1\.0 · checked/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/health", { cache: "no-store" });
  });

  it("surfaces an unhealthy API response as a down dependency", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "degraded" }, 503)));

    render(<HealthStatusPanel />);

    expect(await screen.findByText("Health check returned 503")).toBeInTheDocument();
    expect(screen.getByText("unreachable")).toBeInTheDocument();
    // The dependency list is unknown, so only the web tier's own row is reported as down.
    expect(screen.getAllByText("down")).toHaveLength(1);
    expect(screen.getByText("Last check failed")).toBeInTheDocument();
  });

  it("re-runs the probe when Refresh is clicked", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(HEALTHY));
    vi.stubGlobal("fetch", fetchMock);

    render(<HealthStatusPanel />);
    await screen.findByText("postgresql");

    await userEvent.click(screen.getByRole("button", { name: "Re-run health check" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("postgresql")).toBeInTheDocument();
  });
});
