import type { NextConfig } from "next";
import { redirects } from "./next.redirects";

// Site-v2 gate, the same check as SITE_V2 in app/lib/flags.ts (next.config
// can't import app code). The site defaults to v2 unless the env var says off.
const SITE_V2 = (process.env.NEXT_PUBLIC_SITE_V2 ?? "on") === "on";

const nextConfig: NextConfig = {
  // Oct 23 2026: two static page workers on small build machines, so no single worker holds every page in memory.
  // Vercel's build machines already run several.
  ...(process.env.VERCEL ? {} : { experimental: { cpus: 3, staticGenerationMaxConcurrency: 4 } }),
  // The early vote tracker falls back to the saved civicAPI snapshots when the live feed is down, so ship
  // them with the routes that read them.
  outputFileTracingIncludes: {
    "/maps/early-vote": ["./scripts/forecast/earlyvote/snapshots/**/*.json", "./public/earlyvote-history.json", "./public/forecast/model.json"],
    "/maps/early-vote/[state]": ["./scripts/forecast/earlyvote/snapshots/**/*.json", "./public/earlyvote-history.json", "./public/forecast/model.json"],
    "/forecast": ["./public/forecast/model.json", "./public/forecast/downballot.json", "./public/forecast/statehouse_hub.json", "./public/forecast/measures_hub.json", "./public/forecast/measures.json"],
    "/on-point-polling": ["./public/forecast/model.json"],
    "/on-point-polling/polls": ["./public/forecast/model.json"],
    "/sitemap.xml": ["./scripts/forecast/earlyvote/snapshots/**/*.json", "./public/results/2026/index.json"],
    // The recorder reads the tracked-race list and the forecast index from the deployment's files.
    "/api/intelligence/capture": ["./data/intelligence/states/priority15-2026-10-26.json", "./public/results/2026/index.json"],
    "/portal/intelligence": ["./data/intelligence/states/priority15-2026-10-26.json", "./public/results/2026/index.json"],
    "/portal/intelligence/history": ["./data/intelligence/history/frozen-forecasts.json.gz", "./data/intelligence/states/priority15-2026-10-26.json", "./public/results/2026/index.json"],
    "/api/race-history/[id]": ["./data/intelligence/history/frozen-forecasts.json.gz"],
  },
  // Force the flag into the bundler's define map even when the env var is
  // unset — an undefined NEXT_PUBLIC_* is not statically replaced, which
  // would keep both site versions in every client bundle.
  env: {
    // On Point Politics launches on the v2 site. Set NEXT_PUBLIC_SITE_V2=off to preview v1.
    NEXT_PUBLIC_SITE_V2: process.env.NEXT_PUBLIC_SITE_V2 ?? "on",
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
    return redirects;
  },
};

export default nextConfig;
