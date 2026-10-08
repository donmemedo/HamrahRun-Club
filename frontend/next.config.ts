import type { NextConfig } from "next";

const backend = process.env.BACKEND_URL || "http://localhost:8000";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  rewrites: async () => [{ source: "/api/:path*", destination: `${backend}/api/:path*` }],
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ],
    },
  ],
};

export default config;
