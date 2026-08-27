/**
 * Nights with a hand-built board of their own. Every other date on the calendar
 * is served by the generic board at /results/archive/[date], so these dates are
 * also the ones its generateStaticParams has to skip.
 */
export const DEDICATED_BOARDS: Record<string, string> = {
  "2026-08-25": "/results/archive/2026-08-25",
  "2026-08-18": "/results/archive/2026-08-18",
  "2026-08-04": "/results/archive/2026-08-04",
};

/** The only races with a page of their own. */
export const RACE_PAGES = new Set([
  "oklahoma-governor-republican-runoff",
  "florida-governor-republican-primary",
]);
