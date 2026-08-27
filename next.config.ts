import type { NextConfig } from "next";

// Site-v2 gate — same check as SITE_V2 in app/lib/flags.ts (next.config
// can't import app code). `npm run dev` defaults the env var to "on".
const SITE_V2 = process.env.NEXT_PUBLIC_SITE_V2 === "on";

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
  // Force the flag into the bundler's define map even when the env var is
  // unset — an undefined NEXT_PUBLIC_* is not statically replaced, which
  // would keep both site versions in every client bundle.
  env: {
    NEXT_PUBLIC_SITE_V2: process.env.NEXT_PUBLIC_SITE_V2 ?? "off",
  },
  async rewrites() {
    // Race slug URLs: /results/2026-06-09/south-carolina-us-senate-republican-primary
    // and the /results/archive/<date>/<slug> form. The first segment is
    // constrained to an ISO date so these can NEVER swallow real routes such as
    // /results/race/<id> (which 404'd in production when the segment was
    // unconstrained) or /results/archive itself. Slugs that own a page win
    // anyway: rewrites are checked after the filesystem.
    //
    // v1 reads the slug off the pathname and renders the race, so it wants
    // /results. v2 has no per-race surface — the night board for that date is
    // where the race is read.
    const destination = SITE_V2 ? "/results/archive/:date" : "/results";
    return [
      { source: "/results/:date(\\d{4}-\\d{2}-\\d{2})/:slug", destination },
      { source: "/results/archive/:date(\\d{4}-\\d{2}-\\d{2})/:slug", destination },
    ];
  },
  async redirects() {
    // v1 serves the original per-race pages directly — no redirects.
    if (!SITE_V2) return [];
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
