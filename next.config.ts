import type { NextConfig } from "next";

// Old per-race poll pages now live as selectable aggregates on the unified
// Polling Averages page (/polling/genericballot?race=<id>). These redirects make
// every existing link across the site land on the updated experience.
// NOTE: the source page files are intentionally kept on disk — the aggregates
// registry imports their poll data; only browser navigation to the route redirects.
const RACE_REDIRECTS: Record<string, string> = {
  donaldtrumpapproval: "trump-approval",
  jdvanceapproval: "vance-favorability",
  rightorwrongtrack: "right-wrong-track",
  "2028polling": "2028-vance-newsom",
  "2025pollingview": "2025-va-gov",
  // 2024 president (national + states)
  "2024president": "2024-national",
  pa2024president: "2024-pa",
  ga2024president: "2024-ga",
  az2024president: "2024-az",
  mi2024president: "2024-mi",
  nv2024president: "2024-nv",
  wi2024president: "2024-wi",
  nc2024president: "2024-nc",
  mn2024president: "2024-mn",
  nm2024president: "2024-nm",
  nj2024president: "2024-nj",
  newhampshire: "2024-nh",
  tx2024president: "2024-tx",
  va2024president: "2024-va",
  // primaries (multi-candidate)
  floridarepublicanprimary: "fl-gop-gov",
  texasrepublicanprimary: "tx-gop-sen",
  texasdemocratprimary: "tx-dem-sen",
  mainedemocratprimary: "me-dem-gov",
};

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Guard: /results/race/<id> is a real dynamic route — a self-rewrite stops
      // the slug pattern below from swallowing it (rewrites run before dynamic routes).
      { source: "/results/race/:id", destination: "/results/race/:id" },
      // Active race slug URLs: /results/2026-06-09/south-carolina-us-senate-republican-primary
      { source: "/results/:date/:slug", destination: "/results" },
      // Archived race slug URLs: /results/archive/2026-06-09/south-carolina-...
      // Note: /results/archive (no trailing segments) is a real page — only match with date+slug
      { source: "/results/archive/:date/:slug", destination: "/results" },
    ];
  },
  async redirects() {
    return [
      // the old polling hub/index ("All averages →", "View All Polls →") → unified page
      { source: "/polling", destination: "/polling/genericballot", permanent: false },
      ...Object.entries(RACE_REDIRECTS).map(([slug, race]) => ({
        source: `/polling/${slug}`,
        destination: `/polling/genericballot?race=${race}`,
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
