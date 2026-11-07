"use client";

import { useCallback, useEffect, useState } from "react";

import type { ModelsResponse } from "@/app/api/chat/models/route";

type ModelsState =
  | { phase: "loading" }
  | { phase: "ready"; data: ModelsResponse }
  | { phase: "error"; message: string };

/**
 * Load the allowlisted model catalog once per component mount.
 * The API route requires a session, so signed-out pages never call it.
 */
export function useModels() {
  const [state, setState] = useState<ModelsState>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/chat/models", { cache: "no-store" });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: { detail?: string } }
            | null;
          throw new Error(body?.error?.detail ?? `Could not load models (${response.status}).`);
        }
        const data = (await response.json()) as ModelsResponse;
        if (active) {
          setState({ phase: "ready", data });
        }
      } catch (error) {
        if (active) {
          setState({
            phase: "error",
            message: error instanceof Error ? error.message : "Could not load models.",
          });
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ phase: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  return { state, retry };
}
