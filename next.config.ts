import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Active race slug URLs: /results/2026-06-09/south-carolina-us-senate-republican-primary
      { source: "/results/:date/:slug", destination: "/results" },
      // Archived race slug URLs: /results/archive/2026-06-09/south-carolina-... 
      // Note: /results/archive (no trailing segments) is a real page — only match with date+slug
      { source: "/results/archive/:date/:slug", destination: "/results" },
    ];
  },
};

export default nextConfig;
