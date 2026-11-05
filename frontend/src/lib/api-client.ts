import { env } from "@/lib/env";
import type { BackendHealth, ApiErrorEnvelope } from "@/types/api";

/**
 * Server-side base URL.
 *
 * Browser traffic uses `NEXT_PUBLIC_API_URL`; server components and route handlers run inside the
 * Docker network and should set `API_INTERNAL_URL` (e.g. http://backend:8000/api/v1) to avoid a
 * round trip through the public origin.
 */
function serverBaseUrl(): string {
  const base = process.env.API_INTERNAL_URL?.trim() || env.NEXT_PUBLIC_API_URL;
  return base.replace(/\/$/, "");
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = "api_error",
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface RequestOptions extends Omit<RequestInit, "signal"> {
  timeoutMs?: number;
}

function send(path: string, options: RequestOptions): Promise<Response> {
  const { timeoutMs = 5_000, headers, ...init } = options;
  const url = `${serverBaseUrl()}/${path.replace(/^\//, "")}`;

  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function throwForStatus(response: Response): Promise<never> {
  let code = "api_error";
  let detail = `Request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as ApiErrorEnvelope;
    code = body.error?.code ?? code;
    detail = body.error?.detail ?? detail;
  } catch {
    // Non-JSON error body: keep the status-based message.
  }
  throw new ApiClientError(detail, response.status, code);
}

/** Perform a JSON request against the backend with a hard timeout and typed errors. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (!response.ok) {
    return throwForStatus(response);
  }
  return (await response.json()) as T;
}

/** Perform a request whose success response has no body (for example `204 No Content`). */
export async function apiRequestVoid(
  path: string,
  options: RequestOptions = {},
): Promise<void> {
  const response = await send(path, options);
  if (!response.ok) {
    await throwForStatus(response);
  }
}

/** Readiness snapshot from the backend; returns `null` when it is unreachable. */
export async function fetchBackendHealth(timeoutMs = 2_500): Promise<BackendHealth | null> {
  try {
    return await apiRequest<BackendHealth>("health", { timeoutMs });
  } catch {
    return null;
  }
}
