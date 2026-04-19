import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: import.meta.dirname,
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
