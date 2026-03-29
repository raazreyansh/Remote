import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".next-prod",
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
