import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Slug URLs: /results/2026-06-09/south-carolina-us-senate-republican-primary
      // → served by /results (the dashboard), which reads the slug client-side
      { source: "/results/:date/:slug", destination: "/results" },
    ];
  },
};

export default nextConfig;
