import type { NextConfig } from "next";

const DETECTOR = process.env.DETECTOR_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "172.30.0.2"],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${DETECTOR}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
