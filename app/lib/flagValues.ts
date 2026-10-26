// Feature flag values for Vercel Web Analytics. Every page emits these into the DOM as
// <script type="application/json" data-flag-values>, which is how Web Analytics learns which
// features a visitor had, so page views and custom events can be filtered by flag in the dashboard.
// Server code imports the same values for server events. Values stay flat: strings, numbers, booleans.
import { SITE_V2, SHOW_FORECAST, SHOW_SITUATION_ROOM } from "./flags";
import { LATEST_VIDEO } from "./latestVideo";

// Bump on each release so a change in behavior can be read against the build that shipped it.
export const RELEASE = "2026-10-26a";

export const FLAG_VALUES = {
  "site-v2": SITE_V2,
  "forecast-desk": SHOW_FORECAST,
  "situation-room": SHOW_SITUATION_ROOM,
  // features shipped this week, kept as flags so their use can be compared release to release
  "linked-counties": true,
  "exact-entry": true,
  "candidate-stops": true,
  "people-files": true,
  "eday-breaks": true,
  "mobile-shell": true,
  // the video the pop up promotes, so views and events can be split by it
  "video-promo": LATEST_VIDEO.id,
  release: RELEASE,
} as const;

// Flags set in the visitor's browser by SiteEvents: the theme they read the site in, light rendering and the phone layout.
export const CLIENT_FLAGS = ["theme", "lite-render", "phone-layout"] as const;

export const FLAG_KEYS: string[] = [...Object.keys(FLAG_VALUES), ...CLIENT_FLAGS];

// JSON safe to drop inside a script tag
export const flagJson = (v: Record<string, unknown>) => JSON.stringify(v).replace(/</g, "\\u003c");
