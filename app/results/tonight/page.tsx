"use client";

/**
 * /results/tonight — the board on an election night, the landing page between them.
 *
 * The August 25 runoff board is retired and lives on unchanged at
 * /results/archive/2026-08-25, alongside August 4 and August 18. The standalone
 * race page at /results/2026-08-25/oklahoma-governor-republican-runoff stays put
 * — it is the canonical indexed URL and must not move.
 *
 * To mount the next night's board, import it here in place of `<Landing />` and
 * point NEXT_ELECTION in Landing.tsx at whatever follows it.
 */

import Landing from "./Landing";

export default function Tonight() {
  return <Landing />;
}
