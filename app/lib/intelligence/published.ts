// Comparison with the published November 3 engine (app/results/2026/live.ts). Read only: the published functions
// are called exactly as the results desk calls them, and nothing here changes what the desk shows.

import { liveOdds, project, type CDetail, type Exp, type XRace } from "../../results/2026/live";
import type { PublishedComparison, ShadowProjection } from "./types";

export interface PublishedInput {
  race: XRace;
  /** The forecast's expected county vote for the race (public/results/2026/st/<ST>.json), or null. */
  exp: Record<string, Exp> | null;
  detail: CDetail | null;
}

export function comparePublished(input: PublishedInput | null, shadow: ShadowProjection | null): PublishedComparison {
  if (!input) return { available: false, reason: "no published-engine inputs supplied", published: null, diff: null };
  const { race, exp, detail } = input;
  const P = project(exp, detail?.regions ?? null, race, detail?.c ?? null, race.tot);
  const odds = liveOdds(race, P);
  const published = { expectedFinal: P.fin.t, pctIn: P.pctIn, margin: P.m, pB: odds.pB, sd: odds.sd };
  const ef = shadow?.expectedFinal?.central ?? null;
  const sc = shadow?.shareOfExpectedCounted?.central ?? null;
  const fs = shadow?.scenarios.find((s) => s.id === "OUTSTANDING_SPLITS_LIKE_FORECAST")?.finalMargin?.central ?? null;
  return {
    available: true,
    reason: null,
    published,
    diff: {
      expectedFinalVsShadowCentral: ef === null ? null : published.expectedFinal - ef,
      pctInVsShadowCentral: sc === null ? null : published.pctIn - sc,
      marginVsForecastScenario: fs === null ? null : published.margin - fs,
    },
  };
}
