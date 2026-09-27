import type { NextConfig } from "next";

const backend = process.env.BACKEND_URL || "http://localhost:8000";

const config: NextConfig = {
  output: "standalone",
  rewrites: async () => [{ source: "/api/:path*", destination: `${backend}/api/:path*` }],
};

export default config;
