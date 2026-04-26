import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Runtime log paths (from DATA_DIR / LOG_FILE) must not be copied into standalone; the file may not exist at build time.
  outputFileTracingExcludes: {
    "*": [
      "**/sandbox/data/server.log",
      "**/sandbox/data/server.log.old",
    ],
  },
};

export default nextConfig;
