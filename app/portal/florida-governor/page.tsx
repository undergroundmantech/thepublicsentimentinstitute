"use client";

/**
 * Internal expanded view of the Florida governor primary.
 *
 * Gated in middleware.ts (matcher: /portal/:path*). This page holds no secrets
 * of its own — everything on it is public election data — but it shows working
 * numbers at a level of detail we do not want indexed or quoted as published
 * TPSI output, so it is noindex'd and kept off every nav.
 */

import PortalDashboard from "./PortalDashboard";

export default function Portal() {
  return <PortalDashboard />;
}
