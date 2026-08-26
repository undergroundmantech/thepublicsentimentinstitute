"use client";

/**
 * ARCHIVED BOARD — August 25, 2026 runoff night (Oklahoma, South Carolina, Georgia).
 * Route: /results/archive/2026-08-25
 *
 * Retired from /results/tonight after the runoffs, exactly as August 4 and
 * August 18 were retired before it; that route is the standing elections
 * landing page again. Live CivicAPI polling still runs, so the feed returns the
 * certified final numbers rather than a frozen snapshot — which is what an
 * archive should show.
 *
 * The board component is shared with the standalone race page at
 * /results/2026-08-25/oklahoma-governor-republican-runoff, which stays put: it
 * is the canonical indexed URL for the governor's race and must not move.
 */

import OklahomaBoard from "../../2026-08-25/OklahomaBoard";

export default function Archive20260825() {
  return <OklahomaBoard variant="board" />;
}
