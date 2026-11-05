import { NextResponse } from "next/server";

import { fetchBackendHealth } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { DependencyHealth, FrontendHealth } from "@/types/api";

// Route handlers are dynamic under `cacheComponents`; the response is explicitly uncached.
const startedAt = Date.now();

/**
 * Frontend liveness probe.
 *
 * Always answers 200 while the web process is serving: a down backend must not make the container
 * look dead. Backend/API status is reported separately so the panel and operators can see it.
 */
export async function GET(): Promise<NextResponse<FrontendHealth>> {
  const backend = await fetchBackendHealth();

  const dependencies: DependencyHealth[] = [
    {
      name: "backend-api",
      status: backend ? "up" : "down",
      latency_ms: null,
      detail: backend ? null : "unreachable",
    },
    ...(backend?.dependencies ?? []),
  ];

  const degraded = dependencies.some((dependency) => dependency.status === "down");

  return NextResponse.json(
    {
      status: degraded ? "degraded" : "ok",
      service: `${env.NEXT_PUBLIC_APP_NAME} Web`,
      version: env.NEXT_PUBLIC_APP_VERSION,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.round((Date.now() - startedAt) / 10) / 100,
      dependencies,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
