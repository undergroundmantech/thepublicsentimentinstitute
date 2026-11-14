// Feature flags for the election-night pages. Every flag is OFF unless its variable is set to "on" at build time.
// They exist so the old behaviour can be compared with the new on the same data; none is needed for normal running.
const on = (v: string | undefined) => v === "on" || v === "1" || v === "true";

export const FLAGS = {
  /** Read a race's two sides as party letters, as before Phase 1 (independents spelt "IND" fall into "other"). Comparison only. */
  legacySides: on(process.env.NEXT_PUBLIC_ONPOINT_LEGACY_SIDES),
  /** The old normal-curve arithmetic, which rounds to exactly 0 and 1 in the tails, and no floor on a live chance. Comparison only. */
  legacyOdds: on(process.env.NEXT_PUBLIC_ONPOINT_LEGACY_ODDS),
  /**
   * Let the page label a race an "OnPoint Projection" from the model alone (the old 50% counted + 99.5% rule).
   * OFF by default. A model probability is not a call; turning this on is an operator decision and is still not an
   * official or editorial call.
   */
  autoProjection: on(process.env.NEXT_PUBLIC_ONPOINT_AUTO_PROJECTION),
} as const;
