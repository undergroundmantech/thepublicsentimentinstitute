"use client";

/**
 * ARCHIVED BOARD — August 18, 2026 primary night (Florida, Wyoming, Alaska).
 * Route: /results/archive/2026-08-18
 *
 * Retired from /results/tonight after the August 18 primaries, exactly as
 * August 4 was retired before it; that route is the standing elections landing
 * page again. Live CivicAPI polling still runs, so the feed returns the
 * certified final numbers rather than a frozen snapshot — which is what an
 * archive should show.
 *
 * The board component is shared with the standalone race page at
 * /results/2026-08-18/florida-governor-republican-primary, which stays put:
 * it is the canonical indexed URL for the governor's race and must not move.
 */

import FloridaBoard from "../../2026-08-18/FloridaBoard";

export default function Archive20260818() {
  return <FloridaBoard variant="board" />;
}
