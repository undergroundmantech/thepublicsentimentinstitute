"use client";

/**
 * /results/tonight — the board on an election night, the landing page between them.
 *
 * Tonight is August 18: Florida, Wyoming and Alaska. To retire this board, swap
 * the render back to <Landing /> and move the board to
 * /results/archive/2026-08-18, exactly as August 4 was retired. Landing.tsx is
 * the standing page and is left intact for that swap.
 */

import FloridaBoard from "../2026-08-18/FloridaBoard";

export default function Tonight() {
  return <FloridaBoard variant="board" />;
}
