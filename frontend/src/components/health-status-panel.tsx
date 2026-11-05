"use client";

import { Activity, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { DependencyHealth, FrontendHealth } from "@/types/api";

type CheckState =
  | { phase: "loading" }
  | { phase: "ready"; health: FrontendHealth; checkedAt: Date }
  | { phase: "error"; message: string };

const STATUS_DOT: Record<string, string> = {
  up: "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/70",
  down: "bg-red-400 shadow-[0_0_8px] shadow-red-400/70",
  pending: "bg-amber-400/70",
};

function StatusRow({ name, status, latencyMs }: { name: string; status: string; latencyMs?: number | null }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status] ?? STATUS_DOT.pending}`} aria-hidden />
        <span className="truncate font-mono text-xs text-foreground/90">{name}</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {typeof latencyMs === "number" ? (
          <span className="font-mono text-muted-foreground">{latencyMs}ms</span>
        ) : null}
        <span className={status === "down" ? "font-medium text-red-400" : status === "up" ? "font-medium text-emerald-400" : "text-muted-foreground"}>
          {status === "pending" ? "checking" : status}
        </span>
      </div>
    </li>
  );
}

function rowsFor(state: CheckState): Array<{ name: string; status: string; latencyMs: number | null }> {
  if (state.phase === "ready") {
    const api = state.health.dependencies.map((dependency: DependencyHealth) => ({
      name: dependency.name,
      status: dependency.status,
      latencyMs: dependency.latency_ms,
    }));
    return [{ name: "frontend-web", status: "up", latencyMs: null }, ...api];
  }
  if (state.phase === "error") {
    return [{ name: "frontend-web", status: "down", latencyMs: null }];
  }
  return [
    { name: "frontend-web", status: "up", latencyMs: null },
    { name: "backend-api", status: "pending", latencyMs: null },
    { name: "postgresql", status: "pending", latencyMs: null },
  ];
}

export function HealthStatusPanel() {
  const [state, setState] = useState<CheckState>({ phase: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Health check returned ${response.status}`);
        }
        const health = (await response.json()) as FrontendHealth;
        if (active) {
          setState({ phase: "ready", health, checkedAt: new Date() });
        }
      } catch (error) {
        if (active) {
          setState({
            phase: "error",
            message: error instanceof Error ? error.message : "Health check failed",
          });
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const refresh = () => {
    setState({ phase: "loading" });
    setRefreshKey((key) => key + 1);
  };

  const overall = state.phase === "ready" ? state.health.status : state.phase === "error" ? "unreachable" : "checking";

  return (
    <Card className="w-full gap-0 border-border/70 bg-card/60 py-0 shadow-2xl shadow-black/20 backdrop-blur">
      <CardHeader className="border-b border-border/60 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="size-4 text-primary" aria-hidden />
              Foundation status
            </CardTitle>
            <CardDescription className="text-xs">Live probes served by this app and the API</CardDescription>
          </div>
          <span className="rounded-full border border-border/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {overall}
          </span>
        </div>
      </CardHeader>
      <CardContent className="py-2">
        <ul className="divide-y divide-border/50" aria-live="polite">
          {rowsFor(state).map((row) => (
            <StatusRow key={row.name} name={row.name} status={row.status} latencyMs={row.latencyMs} />
          ))}
        </ul>
        {state.phase === "error" ? (
          <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{state.message}</p>
        ) : null}
      </CardContent>
      <CardFooter className="justify-between gap-4 border-t border-border/60 py-3 text-[11px] text-muted-foreground">
        <span>
          {state.phase === "ready"
            ? `v${state.health.version} · checked ${state.checkedAt.toLocaleTimeString()}`
            : state.phase === "loading"
              ? "Checking dependencies…"
              : "Last check failed"}
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={refresh}
          disabled={state.phase === "loading"}
          aria-label="Re-run health check"
        >
          <RefreshCw className={state.phase === "loading" ? "animate-spin" : undefined} aria-hidden />
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}
