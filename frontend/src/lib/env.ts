import { z } from "zod";

/**
 * Public environment schema.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so they must be referenced statically.
 * Defaults keep `next build` working without a local `.env` (CI, previews, Docker builds).
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).default("Nexa AI"),
  NEXT_PUBLIC_APP_VERSION: z.string().trim().min(1).default("0.1.0"),
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:8000/api/v1"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid public environment configuration — ${issues}`);
}

export const env = parsed.data;

/** Backend origin without the versioned API suffix (used for docs links). */
export const apiOrigin = env.NEXT_PUBLIC_API_URL.replace(/\/api\/v\d+\/?$/, "").replace(/\/$/, "");
