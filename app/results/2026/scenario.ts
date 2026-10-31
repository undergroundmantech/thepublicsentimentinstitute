// OnPoint Election-Night Scenario: an R+3.5 opening adjustment layered on the live estimate. It is not a forecast of a
// Republican lead: a D+10.5 forecast opens at D+7.0. The official forecast is read, never written. Off in public output.
import { expSides, isInd, liveOdds, project, type CCand, type CRegion, type Exp, type Proj, type XRace } from "./live";

export const SCENARIO = { id: "r35", label: "OnPoint Election-Night Scenario · R+3.5 opening adjustment", openingR: 3.5 } as const;
/** Flip only after review. While false the scenario needs a research build and `?scenario=r35`. */
export const SCENARIO_PUBLIC = false;

export function scenarioActive(search: string, research = process.env.NEXT_PUBLIC_ONPOINT_RESEARCH === "1"): boolean {
  if (!SCENARIO_PUBLIC && !research) return false;
  try { return new URLSearchParams(search).get("scenario") === SCENARIO.id; } catch { return false; }
}

/** One Democrat against one Republican in a Senate, governor or House race; anything else keeps the official estimate. */
export function scenarioEligible(r: XRace): { ok: boolean; reason?: string } {
  if (r.k !== "sen" && r.k !== "gov" && r.k !== "house") return { ok: false, reason: "not a Senate, governor or House race" };
  if (isInd(r)) return { ok: false, reason: "the main challenger is an independent" };
  const parties = (r.c ?? []).map((c) => c[1]);
  const d = parties.filter((p) => p === "D").length, rp = parties.filter((p) => p === "R").length;
  if (d !== 1 || rp !== 1) return { ok: false, reason: d + rp < 2 ? "no Democrat-Republican contest" : "more than one candidate of a major party" };
  const es = expSides(r);
  if (!(es.a > 0 && es.b > 0)) return { ok: false, reason: "the forecast has no expected vote for one side" };
  return { ok: true };
}

export type ScenarioView = {
  label: string; eligible: boolean; reason?: string;
  official: Proj; adjusted: Proj;
  /** adjusted minus official, margin points, positive toward the Republican */
  shift: number;
  /** counted votes over projected final votes */
  counted: number;
  pROfficial: number; pRAdjusted: number;
};

/** The official live estimate and the scenario estimate side by side. Uncertainty is the official spread, unchanged. */
export function scenarioProject(exp: Record<string, Exp> | null, live: Record<string, CRegion> | null, r: XRace, top: CCand[] | null, expTot?: number): ScenarioView {
  const official = project(exp, live, r, top, expTot);
  const pROfficial = liveOdds(r, official).pB;
  const el = scenarioEligible(r);
  if (!el.ok) return { label: SCENARIO.label, eligible: false, reason: el.reason, official, adjusted: official, shift: 0, counted: official.pctIn / 100, pROfficial, pRAdjusted: pROfficial };
  const adjusted = project(exp, live, r, top, expTot, SCENARIO.openingR);
  return { label: SCENARIO.label, eligible: true, official, adjusted, shift: adjusted.m - official.m, counted: official.pctIn / 100, pROfficial, pRAdjusted: liveOdds(r, adjusted, SCENARIO.openingR).pB };
}
