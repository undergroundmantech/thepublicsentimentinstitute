"use client";

/**
 * /results/tonight — the board on an election night, the landing page between them.
 *
 * Tonight is August 25, 2026: the Oklahoma Governor Republican runoff, the South
 * Carolina U.S. Senate special runoff, and the rest of the Oklahoma and Georgia
 * runoff slate.
 *
 * To retire this board, restore `<Landing />` here and add an archive route at
 * /results/archive/2026-08-25 rendering `<OklahomaBoard variant="board" />`,
 * exactly as August 4 and August 18 were retired. The standalone race page at
 * /results/2026-08-25/oklahoma-governor-republican-runoff stays put — it is the
 * canonical indexed URL and must not move.
 */

import OklahomaBoard from "../2026-08-25/OklahomaBoard";

export default function Tonight() {
  return <OklahomaBoard variant="board" />;
}
