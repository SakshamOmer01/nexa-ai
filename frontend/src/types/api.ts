/**
 * Wire contracts shared with the FastAPI backend.
 * Keep in sync with `backend/app/schemas` — these are the only types the API returns.
 */

export type ServiceStatus = "ok" | "degraded";
export type DependencyStatus = "up" | "down";

export interface DependencyHealth {
  name: string;
  status: DependencyStatus;
  latency_ms: number | null;
  detail: string | null;
}

export interface LivenessResponse {
  status: ServiceStatus;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptime_seconds: number;
}

export interface BackendHealth extends LivenessResponse {
  dependencies: DependencyHealth[];
}

export interface FrontendHealth {
  status: ServiceStatus;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptime_seconds: number;
  dependencies: DependencyHealth[];
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    detail: string;
  };
  request_id: string;
}

/** Public user projection returned by the API; never contains credential material. */
export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

/** Backend token payload. The BFF keeps `access_token` server-side and returns only the user. */
export interface AuthTokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: AuthUser;
}

/** Same-origin auth response consumed by the browser. */
export interface AuthSession {
  user: AuthUser;
}
