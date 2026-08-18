"use client";

/**
 * Internal expanded view of the Florida governor primary.
 *
 * Gated by HTTP Basic auth in middleware.ts (matcher: /portal/:path*). This
 * page holds no secrets of its own — everything on it is public election data —
 * but it shows working numbers at a level of detail we do not want indexed or
 * quoted as published TPSI output, so it is noindex'd and kept off every nav.
 */

import FloridaBoard from "../../results/2026-08-18/FloridaBoard";

export default function Portal() {
  return <FloridaBoard variant="portal" />;
}
