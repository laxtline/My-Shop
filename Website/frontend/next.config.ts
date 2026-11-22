import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Importing TS from the sibling /shared folder (outside the app root) is
  // supported, but tracing must stay inside this app. Without this, Next walks
  // up to a parent lockfile and warns about an inferred workspace root.
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
