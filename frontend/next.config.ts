import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stable at prerender time, refreshed on every production build.
  env: { NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()) },
  // Emit a self-contained server bundle for the Docker runtime image.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
