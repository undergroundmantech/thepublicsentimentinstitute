// One race: from what has been counted to a distribution over the final count, candidate by candidate.
//
//   final votes[c] = reported votes[c] + outstanding votes allotted to c, summed over units (counties, or the race
//                    total when there is no county detail), in each of `draws` simulated outcomes.
//
// What is uncertain, and how each piece is drawn:
//   turnout       each unit's final total = forecast total x exp(state shift + unit shift). Evidence: a unit at 100%
//                 of precincts (counted is close to final), or counted / precinct-percent as a NOISY estimate. The
//                 provider's percent is never taken as the share of ballots counted.
//   swing (mu)    the race's shift in margin from the forecast, shared by its units. Prior: the published forecast's
//                 own spread (or a pooled national prior from national.ts).
//   order (beta)  when the method of counted and outstanding ballots is UNKNOWN, the counted ballots may lean
//                 differently from those still out (early and mail v Election Day). counted margin = final margin +
//                 (1 - share counted) x beta. A first batch therefore moves the estimate only as far as the evidence
//                 allows; it cannot identify the swing by itself while beta is unknown.
//   method        when the provider labels counted votes by method AND method priors are switched on, each method's
//                 outstanding ballots get their own expected share and margin offset instead of beta.
//   unit noise    each county's margin varies around the race's swing.
// The weight of the evidence comes from these variances (how complete each unit is, how many votes, how much of
// the race it represents), never from a fixed blend such as "50% forecast, 50% count".
// Margins are B minus A, in points of ALL votes, B and A being the forecast's two principals (candidates.ts).
import type { XRace } from "../../results/2026/live";
import { assignSides, candidateId, expectedSides, isPooledLine, partyCanon, principals, raceRule, type RaceRule } from "../../results/2026/candidates";
import { DEFAULT_CONFIG, MODEL_VERSION, type EngineConfig } from "./config";
import type { MethodPrior, MethodPriorTable } from "./methodPriors";
import { dist, PhiInv } from "./normal";
import { Rng } from "./rng";
import type { CandidateForecast, DataMode, OutstandingUnit, QualityFlag, RaceForecast, RaceObservation, VotingMethod } from "./types";

export type UnitBaseline = Record<string, readonly [number, number, number, number]>;

type Cand = { id: string; name: string; partyRaw: string | null; side: "a" | "b" | "o"; counted: number; unknown: boolean; pooledLine: boolean; fcVotes: number; providerWinner: boolean };
type Stratum = { method: Exclude<VotingMethod, "UNKNOWN">; C: number; votes: Float64Array; y: number | null; prior: MethodPrior };
type Unit = {
  id: string; name: string | null; E: number; bA: number; bB: number; bO: number; bm: number;
  C: number; votes: Float64Array; pr: number | null; y: number | null; oObs: number | null;
  evid: { e: number; q: number } | null; strata: Stratum[] | null;
  /** county mode: the chance that the county's count is finished (null in a race modeled from its total); doneT is the part of it that comes from quiet time alone */
  done: number | null; doneT?: number; /** sd of the late-ballot allowance once finished */ late?: number; /** sd of the open remainder, when not the county model's */ rem?: number;
};
/** Passing rules beyond the Yes-share threshold. Stated on the race, not modeled. */
const MEASURE_RULE_NOTES: Record<string, string> = {
  MA: "Massachusetts: a majority of the votes on the question passes it, and for an initiative or a referendum petition the winning side must also be at least 30% of all ballots cast in the election. That second test is not modeled here.",
};
export type RacePrep = {
  race: XRace; rule: RaceRule; obs: RaceObservation | null; cands: Cand[]; units: Unit[]; mode: "county" | "topline";
  forecastAvailable: boolean; expM: number; pubFinalM: number; rcvT0: number; pB0: number; sdF: number; cut: number; thr: number;
  countedTotal: number; flags: Set<QualityFlag>; notes: string[]; uncontested: number | null; cfg: EngineConfig;
  turnoutPost: { M: number; P: number };
  /** county mode: what the race's finished-looking counties say about the statewide turnout shift, without the prior (sum of weights, weighted sum) */
  turnoutEv: { W: number; H: number } | null;
  /** county mode: the spread of counties around the state's turnout level, read from the finished ones (placeCounties) */
  turnoutSdUnit?: number;
};
export type SwingPrior = { m0: number; v0: number; b0?: number; vb?: number };
export type Fit = { mean: [number, number]; cov: [[number, number], [number, number]]; prior: Required<SwingPrior>; lik: { mu: number; v: number }; sumW2: number; dO: number };

const sampVar = (a: number, b: number, n: number) => { if (!(n > 0)) return Infinity; const pa = a / n, pb = b / n; return Math.max(1e-6, (1e4 * (pa + pb - (pb - pa) ** 2)) / n); };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** County noise around the state's swing, margin points: larger for a small county (county mode); 0 for a race read from its total. */
const unitSd = (p: Pick<RacePrep, "mode" | "cfg">, u: Pick<Unit, "E">): number => { if (p.mode !== "county") return 0; const M = p.cfg.margin; return Math.sqrt(M.sdUnit ** 2 + M.sdUnitSmall ** 2 * Math.sqrt(2000 / Math.max(u.E, 2000))); };
const sideSum = (cands: Cand[], v: ArrayLike<number>, s: "a" | "b" | "o") => { let t = 0; cands.forEach((c, i) => { if (c.side === s) t += v[i]; }); return t; };

/** Margin points to shares for the principal pair: a margin shift of d points moves B's share by d/2 and A's by -d/2
 *  within their combined share, so a county at R+30 with a D+10 adjustment is at R+20 (not R+25 or R+10). */
export function sharesFromMargin(marginPp: number, othersShare: number): { a: number; b: number; o: number } {
  const o = clamp(othersShare, 0, 1), P = 1 - o, m = clamp(marginPp / 100, -P, P);
  return { a: (P - m) / 2, b: (P + m) / 2, o };
}

export function prepareRace(race: XRace, obs: RaceObservation | null, baseline: UnitBaseline | null, cfg: EngineConfig = DEFAULT_CONFIG, priors: MethodPriorTable | null = null): RacePrep {
  const flags = new Set<QualityFlag>(); const notes: string[] = [];
  const rule = raceRule(race);
  if (rule === "ranked_choice") flags.add("RULE_RANKED_CHOICE");
  if (rule === "majority_runoff") flags.add("RULE_RUNOFF");
  if (rule === "multi_seat") flags.add("RULE_NOT_MODELED");
  if (obs?.test) flags.add("TEST_DATA");
  // a second test some states apply to a measure, which the Yes share alone does not show
  if (race.k === "measure" && MEASURE_RULE_NOTES[race.st]) notes.push(MEASURE_RULE_NOTES[race.st]);
  if (obs?.integrity?.length) { flags.add("PROVIDER_ROWS_INCONSISTENT"); notes.push(...obs.integrity.map((x) => `data check: ${x}. No model call is made on this race while it lasts.`)); }
  // candidates: the provider's list when there is one, else the forecast's
  const list = obs ? obs.candidates.map((c) => ({ id: c.candidateId, name: c.name, partyRaw: c.partyRaw, votes: c.votes, win: c.providerWinner }))
    : (race.c ?? []).map(([n, p]) => ({ id: candidateId(race.id, n), name: n, partyRaw: p, votes: 0 as number | null, win: false }));
  const as = assignSides(race, list.map((c) => [c.name, c.partyRaw ?? ""] as const));
  if (as.ambiguous.some(Boolean)) flags.add("AMBIGUOUS_CANDIDATE");
  if (as.pooled.some(Boolean)) flags.add("SAME_PARTY_POOLED");
  const cands: Cand[] = list.map((c, i) => {
    const fi = obs ? as.forecast[i] : i;
    return { id: c.id, name: c.name, partyRaw: c.partyRaw, side: as.side[i], counted: c.votes ?? 0, unknown: c.votes == null, pooledLine: isPooledLine(c.name), fcVotes: fi != null ? race.c?.[fi]?.[2] ?? 0 : 0, providerWinner: c.win };
  });
  if (cands.some((c) => c.unknown)) flags.add("COUNT_UNKNOWN");
  const countedTotal = cands.reduce((s, c) => s + c.counted, 0);

  // the forecast's prior for the principal margin, read exactly as the published forecast states it
  const isM = race.k === "measure";
  const thr = race.thr ?? 0.5;
  const cut = isM ? 100 - 200 * thr : 0;
  const es = expectedSides(race);
  // The published margin is the centre of the prior. The index's expected VOTES do not always agree with it: a
  // ranked-choice race lists first-choice votes while its margin is the final round's, and a measure's listed votes
  // are not its forecast Yes share. Where they differ, every unit's baseline is shifted so the engine starts from
  // the published margin (before this, Alaska's Senate race started at 77% Republican against a published 25%).
  //
  // Ranked choice is different again: the counts that arrive are FIRST CHOICES, so they are modeled as first choices
  // (no shift), and the final round is simulated in each draw from the two leading candidates plus a transfer of
  // everyone else's ballots. The transfer is centred on the split the published final-round margin implies (rcvT0)
  // and is uncertain (cfg.rcv.sdTransfer). Shifting the baseline instead, as before, faded out as the count came in
  // and left the first-choice leader as the certain winner.
  const isRcv = rule === "ranked_choice";
  const esM = es.t ? (100 * (es.b - es.a)) / es.t : null;
  const pubM = isM ? (race.yes != null ? 100 - 2 * race.yes : null) : isRcv && race.m != null ? race.m : null;
  const expM = isRcv ? esM ?? race.m ?? 0 : pubM ?? esM ?? race.m ?? 0;
  const mShift = !isRcv && esM != null && pubM != null && Math.abs(pubM) < 99 ? pubM - esM : 0;
  const pubFinalM = isRcv ? pubM ?? expM : expM;
  const pB0 = isM ? 1 - (race.pPass ?? NaN) : race.pR ?? NaN;
  const forecastAvailable = Number.isFinite(pB0) && es.t > 0 && rule !== "multi_seat";
  if (!forecastAvailable) flags.add("NO_FORECAST");
  const z0 = forecastAvailable ? PhiInv(pB0) : 0;
  const kindSd = cfg.priorSd.byKind[race.k] ?? cfg.priorSd.byKind.house;
  let sdF = clamp(Math.abs(z0) >= cfg.priorSd.minZ ? Math.abs(pubFinalM - cut) / Math.abs(z0) : kindSd, cfg.margin.minPriorSd, cfg.margin.maxPriorSd) * cfg.spreadFactor;
  if (!obs) flags.add("NO_OBSERVATION");
  // net share of all other ballots that the published final-round margin implies moves to side B (negative: to A)
  let rcvT0 = 0;
  if (isRcv && pubM != null && es.t > 0) {
    const top = (s: "a" | "b") => Math.max(0, ...cands.filter((c) => c.side === s && !c.pooledLine).map((c) => c.fcVotes));
    const a0 = top("a"), b0 = top("b"), rest = es.t - a0 - b0;
    if (rest > 0) rcvT0 = clamp(((pubM / 100) * es.t - (b0 - a0)) / rest, -1, 1);
    // the published chance already includes the uncertainty of the transfer, so the first-choice margin takes what
    // is left of the spread: together they reproduce the published chance before any vote
    const vT = ((100 * cfg.rcv.sdTransfer * Math.max(0, rest)) / es.t) ** 2;
    sdF = Math.sqrt(Math.max(sdF * sdF - vT, 0.25 * sdF * sdF));
  }

  const realF = (race.c ?? []).filter(([n, p]) => !isPooledLine(n) && partyCanon(p) !== null).length;
  const realO = cands.filter((c) => !c.pooledLine && c.counted > 0).length;
  // Unopposed: one real candidate listed, by the forecast and by the provider alike. (Until 2.5.0 a race counted as
  // unopposed while only one of its candidates had votes, so a two-candidate race was "unopposed" for the first
  // minutes of its count. Nothing was called on it then; now an unopposed winner is recorded as a call, so the
  // test is on who is listed, never on who has votes yet.)
  const realListed = cands.filter((c) => !c.pooledLine).length;
  const uncontested = realF <= 1 && realO <= 1 && realListed === 1 ? cands.findIndex((c) => !c.pooledLine) : null;
  if (uncontested != null && uncontested >= 0) flags.add("UNCONTESTED");

  // units: counties when the provider's county detail reconciles with its own total, else the race total
  const K = cands.length; const units: Unit[] = []; let mode: "county" | "topline" = "topline";
  const pState = priors?.[race.st] ?? null;
  const prin = principals(race);
  const dvr = prin.mode === "candidate" ? prin.a.party === "D" && prin.b.party === "R" : prin.aParty === "D";
  const unitOf = (id: string, name: string | null, base: readonly [number, number, number, number] | null, votes: Float64Array, pr: number | null, byMethod: NonNullable<RaceObservation["units"]>[number]["byMethod"] | undefined): Unit => {
    const E = base ? base[3] : 0, C = votes.reduce((s, v) => s + v, 0);
    const bA = base && E ? base[0] / E : 0, bB = base && E ? base[1] / E : 0, bO = base && E ? base[2] / E : 0;
    const A = sideSum(cands, votes, "a"), B = sideSum(cands, votes, "b");
    let strata: Stratum[] | null = null;
    if (byMethod && pState && dvr && !isM) {
      const ss: Stratum[] = [];
      for (const p of pState.methods) {
        const mv = byMethod[p.method]; const v = new Float64Array(K);
        if (mv) cands.forEach((c, i) => { v[i] = mv[c.id] ?? 0; });
        const Cm = v.reduce((s, x) => s + x, 0);
        ss.push({ method: p.method, C: Cm, votes: v, y: Cm > 0 ? (100 * (sideSum(cands, v, "b") - sideSum(cands, v, "a"))) / Cm : null, prior: p });
      }
      const labelled = ss.reduce((s, x) => s + x.C, 0);
      if (Math.abs(labelled - C) <= Math.max(1, 0.005 * C)) strata = ss; else notes.push(`${id}: method labels cover ${labelled} of ${C} counted votes, so the unit is modeled as method UNKNOWN`);
    }
    return { id, name, E, bA, bB, bO, bm: E ? clamp(100 * (bB - bA) + mShift, -100, 100) : 0, C, votes, pr, y: C > 0 ? (100 * (B - A)) / C : null, oObs: C > 0 ? 1 - (A + B) / C : null, evid: null, done: null, strata };
  };
  if (baseline && obs?.units?.length) {
    const sumU = obs.units.reduce((s, u) => s + Object.values(u.votes).reduce((t: number, v) => t + (v ?? 0), 0), 0);
    if (Math.abs(sumU - countedTotal) <= Math.max(10, 0.005 * countedTotal)) {
      mode = "county";
      const byId = new Map(obs.units.map((u) => [u.unitId, u]));
      for (const [fid, row] of Object.entries(baseline)) {
        const u = byId.get(fid); const v = new Float64Array(K);
        if (u) cands.forEach((c, i) => { v[i] = u.votes[c.id] ?? 0; });
        units.push(unitOf(fid, u?.name ?? null, row, v, u?.providerPctReporting ?? null, u?.byMethod));
      }
      for (const u of obs.units) if (!(u.unitId in baseline)) { const v = new Float64Array(K); cands.forEach((c, i) => { v[i] = u.votes[c.id] ?? 0; }); units.push(unitOf(u.unitId, u.name, null, v, u.providerPctReporting, undefined)); flags.add("UNIT_NO_BASELINE"); }
    } else { flags.add("UNIT_TOPLINE_MISMATCH"); notes.push(`county detail sums to ${sumU} but the race total is ${countedTotal}; the race total is used`); }
  }
  if (mode === "topline") {
    const v = Float64Array.from(cands.map((c) => c.counted));
    const ebase = es.t ? ([es.a, es.b, es.o, es.t] as const) : null;
    const tb = obs?.units?.length === 1 ? obs.units[0].byMethod : undefined;
    units.push(unitOf("TOPLINE", null, ebase, v, obs?.providerPctReporting ?? null, tb));
  }
  if (units.some((u) => !u.strata)) { flags.add("METHOD_UNKNOWN"); if (!priors) flags.add("METHOD_PRIORS_OFF"); }
  const Etot = units.reduce((s, u) => s + u.E, 0);
  // a total well below what the same race showed earlier: the provider is correcting something (or has broken
  // something). Indiana's 3rd district lost 27,000 votes and showed the wrong leader for seventeen hours on November 4.
  if (obs?.peakTotal && countedTotal < 0.98 * obs.peakTotal) { flags.add("COUNT_DECREASED"); notes.push(`the count (${countedTotal.toLocaleString("en-US")}) is below what this race showed earlier (${obs.peakTotal.toLocaleString("en-US")}): a correction is in progress. No model call is made on this race while it lasts.`); }
  if (Etot > 0 && countedTotal > 1.5 * Etot) { flags.add("COUNT_EXCEEDS_FORECAST"); notes.push(`counted votes (${countedTotal}) are ${(countedTotal / Etot).toFixed(1)} times the forecast's expected total: check the provider's figures`); }

  // Turnout evidence, then the statewide posterior (normal-normal).
  const T = cfg.turnout; let P = 1 / T.sdState ** 2, H = 0, weak = false;
  let turnoutEv: RacePrep["turnoutEv"] = null;
  if (mode === "county") {
    flags.add("COUNTY_MODEL");
    // County by county, the provider's percent is no evidence at all: on November 3, 2026 it was the counted votes
    // divided by a fixed expected total (in most states this site's own county forecast, to the vote), so it says
    // nothing the count does not, and it stopped at 85 to 99 when a county was finished. What does say a county is
    // finished is time: a county holding a plausible share of its expected vote whose count has not moved for hours.
    // `done` is the chance given to that, rising with the quiet time; it is zero where the count is known to run for
    // days (cfg.turnout.quiet.slowStates) and whenever the source does not say when a county last changed.
    const Q = T.quiet, tMs = obs ? Date.parse(obs.receivedAt) : NaN, slow = Q.slowStates.includes(race.st);
    const sinceOf = new Map((obs?.units ?? []).map((u) => [u.unitId, u.quietSince ?? null]));
    for (const u of units) {
      if (!(u.C > 0) || !(u.E > 0)) continue;
      const qs = sinceOf.get(u.id), m = qs && Number.isFinite(tMs) ? (tMs - Date.parse(qs)) / 60_000 : 0;
      // after fullMin the chance keeps rising, slowly, to maxLong at longMin, and the late-ballot allowance shrinks with it:
      // a count that has been still all night is finished, and a race must be able to end
      const lg = clamp((m - Q.fullMin) / (Q.longMin - Q.fullMin), 0, 1);
      const dt = slow || u.C / u.E < Q.minShare ? 0 : Q.max * clamp((m - Q.fromMin) / (Q.fullMin - Q.fromMin), 0, 1) + (Q.maxLong - Q.max) * lg;
      u.late = Q.sdLate + (Q.sdLateLong - Q.sdLate) * lg;
      u.doneT = dt; u.done = dt; if (!slow && u.C / u.E >= Q.minShare) u.doneT = Math.max(dt, Q.base);
      if (dt > 0) { const e = clamp(Math.log(u.C / u.E), -T.clampLog, T.clampLog), w = dt / (T.sdUnit ** 2 + Q.sdLate ** 2); P += w; H += e * w; }
    }
    turnoutEv = { W: P - 1 / T.sdState ** 2, H };
  } else for (const u of units) {
    if (!(u.C > 0) || !(u.E > 0)) continue;
    // A race read from its total (2.5.0): the same clock as a county, read more slowly. A total that has not moved
    // for hours is a count that has stopped; on November 3, 2026 a House total outside the slow states that had been
    // still for 8 to 12 hours was within 3% of final 96% of the time, and 100% after three days. In the slow states
    // nothing is concluded before three days of silence. Never where the provider already says 100%, and never
    // without a time of last change (a single live read has none).
    let dt = 0; const QT = T.quietTotal;
    if (mode === "topline" && units.length === 1 && obs?.quietSince && !flags.has("COUNT_DECREASED") && !(u.pr != null && u.pr >= 99.5) && u.C / u.E >= QT.minShare) {
      const m = (Date.parse(obs.receivedAt) - Date.parse(obs.quietSince)) / 60_000;
      if (Number.isFinite(m)) dt = T.quiet.slowStates.includes(race.st) ? QT.slowMax * clamp((m - QT.slowFromMin) / (QT.slowFullMin - QT.slowFromMin), 0, 1)
        : QT.max * clamp((m - QT.fromMin) / (QT.fullMin - QT.fromMin), 0, 1) + (QT.maxLong - QT.max) * clamp((m - QT.fullMin) / (QT.longMin - QT.fullMin), 0, 1);
      if (dt > 0) { u.done = dt; u.doneT = dt; u.late = QT.sdLate; u.rem = T.sdRemainder; const e2 = clamp(Math.log(u.C / u.E), -T.clampLog, T.clampLog), w2 = dt / (T.sdUnit ** 2 + QT.sdLate ** 2); P += w2; H += e2 * w2; }
    }
    let e: number | null = null, q = 0;
    if (u.pr != null && u.pr >= 99.5) { e = Math.log(u.C / u.E) + T.lateMean; q = T.sdComplete ** 2; }
    else if (u.pr != null && u.pr >= T.minPctForEvidence) { e = Math.log(u.C / (u.pr / 100) / u.E); q = T.sdPrecinct ** 2 + (T.kPrecinct * (1 - u.pr / 100)) ** 2; }
    else weak = true;
    if (e == null) continue;
    e = clamp(e, -T.clampLog, T.clampLog); u.evid = { e, q };
    const w = (1 - dt) / (T.sdUnit ** 2 + q); P += w; H += e * w;
  }
  if (weak) flags.add("TURNOUT_WEAK_EVIDENCE");
  const prep: RacePrep = { race, rule, obs, cands, units, mode, forecastAvailable, expM, pubFinalM, rcvT0, pB0, sdF, cut, thr, countedTotal, flags, notes, uncontested: uncontested != null && uncontested >= 0 ? uncontested : null, cfg, turnoutPost: { M: H / P, P }, turnoutEv };
  placeCounties(prep);
  return prep;
}

const Phi = (x: number) => 0.5 * erfc(-x / Math.SQRT2);
function erfc(x: number): number { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
/**
 * County mode, second step: where a county's count sits against its state. A finished county holds about the
 * state's share of its forecast vote (log ratio near the statewide shift, sd sdUnit); an unfinished one holds some
 * fraction of that. Bayes' rule turns the quiet-time chance (doneT, with a small base rate for a county that has
 * only just moved) into the chance used in the draws. A county far below its state's level is not finished however
 * quiet it is; one at the level is probably finished even if it moved a minute ago. Run again whenever the
 * statewide shift is re-estimated.
 */
export function placeCounties(p: RacePrep): void {
  if (p.mode !== "county") return;
  const T = p.cfg.turnout, M = p.turnoutPost.M;
  // How tightly a state's finished counties sit around its level is read from the state itself: where the quiet
  // counties all hold within a few percent of the same share of their forecast (Florida: every county near 89%), a
  // county at that level is finished and one still open cannot have much left; where they scatter, the prior stands.
  // The prior (sdUnit) counts as `spreadPrior` counties, and the result is never below `spreadFloor`.
  let W = T.quiet.spreadPrior, SS = T.quiet.spreadPrior * T.sdUnit ** 2;
  for (const u of p.units) if (u.doneT != null && u.done != null && u.C > 0 && u.E > 0 && u.doneT > T.quiet.base) { const w = u.doneT, d = Math.log(u.C / u.E) - M; W += w; SS += w * d * d; }
  const sdU = p.mode === "county" ? Math.max(T.quiet.spreadFloor, Math.min(T.sdUnit, Math.sqrt(SS / W))) : T.sdUnit; p.turnoutSdUnit = sdU;
  const s = Math.sqrt(sdU ** 2 + 1 / p.turnoutPost.P);
  for (const u of p.units) {
    if (u.done == null || u.doneT == null || !(u.C > 0) || !(u.E > 0)) continue;
    if (!(u.doneT > 0)) { u.done = 0; continue; }
    const x = Math.log(u.C / u.E), fD = Math.exp(-0.5 * ((x - M) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)), fO = Math.exp(x - M + (s * s) / 2) * Phi((M - s * s - x) / s);
    u.done = Math.min(T.quiet.maxLong, (u.doneT * fD) / (u.doneT * fD + (1 - u.doneT) * fO + 1e-300));
  }
}

/**
 * Turnout is partly national: when the forecast's turnout is too high in the states whose counties have finished, it
 * is probably too high in the states still counting. Each county-mode race's statewide shift is re-centred on what
 * the OTHER states' finished counties say (leave-one-state-out, so a state never counts itself twice), with the
 * national share of the turnout variance from cfg.turnout.rhoNational. Only county-mode races are re-centred. A race
 * modeled from its total (every House race) is left exactly as it was: giving those races the shared level was tried
 * on the recorded night and produced new House calls on margins of 2 to 5 points, one of which the model itself
 * later doubted. Before any county has finished anywhere this changes nothing.
 */
export function shareNationalTurnout(preps: RacePrep[]): void {
  if (!preps.length) return; const T = preps[0].cfg.turnout, vN = T.rhoNational * T.sdState ** 2, vS = (1 - T.rhoNational) * T.sdState ** 2;
  // one reading per state: the race with the most evidence (a state's Senate and governor's races share their counties)
  const byState = new Map<string, { W: number; H: number }>();
  for (const p of preps) if (p.turnoutEv && p.turnoutEv.W > 0) { const o = byState.get(p.race.st); if (!o || p.turnoutEv.W > o.W) byState.set(p.race.st, p.turnoutEv); }
  if (!byState.size) return;
  let PN = 1 / vN, HN = 0; const part = new Map<string, { w: number; h: number }>();
  for (const [st, e] of byState) { const v = vS + 1 / e.W, w = 1 / v, h = (e.H / e.W) / v; part.set(st, { w, h }); PN += w; HN += h; }
  for (const p of preps) {
    if (p.mode !== "county") continue;
    const own = part.get(p.race.st), pn = PN - (own?.w ?? 0), hn = HN - (own?.h ?? 0);
    const m0 = hn / pn, v0 = 1 / pn + vS;                         // the prior for this state's shift, from the other states
    const evW = p.turnoutPost.P - 1 / T.sdState ** 2, evH = p.turnoutPost.M * p.turnoutPost.P;   // the race's own evidence, as prepareRace pooled it
    const P = 1 / v0 + evW; p.turnoutPost = { M: (m0 / v0 + evH) / P, P };
    placeCounties(p);
  }
}

/** The unit's final total at a given state shift: its own shift drawn (z) or at its mean (z null), never below what is
 *  counted plus, while the unit is still open, a remainder (drawn from zh, or at its mean). A county with a chance of
 *  being finished (`done`, county mode) is finished in a draw when ud is below that chance: counted plus a few late
 *  ballots. At the mean (ud null) the two cases are averaged. */
function unitT(u: Unit, cfg: EngineConfig, ls: number, z: number | null, zh: number | null = null, ud: number | null = null, sdU: number | null = null): number {
  const T = cfg.turnout; let mean = 0, v = (sdU ?? T.sdUnit) ** 2;
  if (u.evid) { const k = T.sdUnit ** 2 / (T.sdUnit ** 2 + u.evid.q); mean = (u.evid.e - ls) * k; v = T.sdUnit ** 2 * u.evid.q / (T.sdUnit ** 2 + u.evid.q); }
  const lg = clamp(ls + mean + (z == null ? 0 : Math.sqrt(v) * z), -T.clampLog, T.clampLog);
  const hn = zh == null ? Math.sqrt(2 / Math.PI) : Math.abs(zh);
  const open = u.C > 0 && !(u.done == null && u.pr != null && u.pr >= 99.5);
  const openT = Math.max(u.C * (1 + (open ? (u.rem ?? (u.done == null ? T.sdRemainder : T.quiet.sdRemainder)) * hn : 0)), u.E * Math.exp(lg));
  if (u.done == null || !(u.done > 0)) return openT;
  const doneT = u.C * (1 + (u.late ?? T.quiet.sdLate) * hn);
  return ud == null ? u.done * doneT + (1 - u.done) * openT : ud < u.done ? doneT : openT;
}

/**
 * The posterior of (swing, order bias) given the counted margins: a two-parameter Gaussian linear model.
 * `prior` is the prior on the swing; default is the forecast's own spread, centred on the forecast.
 */
export function fitRace(p: RacePrep, prior?: SwingPrior): Fit {
  const M = p.cfg.margin;
  const Et = p.units.reduce((s, u) => s + u.E, 0) || 1; const sumW2 = p.units.reduce((s, u) => s + (u.E / Et) ** 2, 0);
  const v0 = prior?.v0 ?? Math.max(1, p.sdF ** 2 - p.units.reduce((s, u) => s + (u.E / Et) ** 2 * unitSd(p, u) ** 2, 0)); const m0 = prior?.m0 ?? 0;
  const vb = prior?.vb ?? M.sdOrderRace ** 2, b0 = prior?.b0 ?? 0;
  let l00 = 0, l01 = 0, l11 = 1 / vb, h0 = 0, h1 = b0 / vb;
  let oNum = 0, oDen = p.cfg.others.shrinkVotes;
  for (const u of p.units) {
    if (!(u.C > 0) || !(u.E > 0) || u.y == null) continue;
    const Th = unitT(u, p.cfg, p.turnoutPost.M, null), f = u.C / Th, sU = unitSd(p, u);
    if (u.oObs != null) { oNum += u.C * (u.oObs - u.bO); oDen += u.C; }
    if (u.strata) {
      for (const s of u.strata) { if (!(s.C > 0) || s.y == null) continue; const r = sU ** 2 + s.prior.offset.sd ** 2 + sampVar(sideSum(p.cands, s.votes, "a"), sideSum(p.cands, s.votes, "b"), s.C); const z = s.y - u.bm - s.prior.offset.mean; l00 += 1 / r; h0 += z / r; }
      continue;
    }
    const a = 1 - f; let r = sU ** 2 + a * a * M.sdOrderUnit ** 2 + sampVar(sideSum(p.cands, u.votes, "a"), sideSum(p.cands, u.votes, "b"), u.C); const z = u.y - u.bm;
    // county mode: one county far outside what the prior and its own noise allow is a wrong row, a mismatched forecast or a
    // place apart (a first batch of 4,500 votes in one South Dakota county once moved the state 60 points); it keeps only
    // the weight of a county that far out
    if (p.mode === "county") { const d = Math.abs(z - m0 - a * b0), lim = M.unitOutlierZ * Math.sqrt(v0 + r + a * a * vb); if (d > lim) r += (d - lim) ** 2; }
    l00 += 1 / r; l01 += a / r; l11 += (a * a) / r; h0 += z / r; h1 += (a * z) / r;
  }
  // likelihood-only swing (flat prior on the swing, the order prior kept): what this race says about the swing by itself
  const detL = l00 * l11 - l01 * l01; const lik = detL > 1e-12 ? { mu: (l11 * h0 - l01 * h1) / detL, v: l11 / detL } : { mu: 0, v: Infinity };
  const a00 = l00 + 1 / v0, bb = h0 + m0 / v0, det = a00 * l11 - l01 * l01;
  const cov: [[number, number], [number, number]] = [[l11 / det, -l01 / det], [-l01 / det, a00 / det]];
  return { mean: [cov[0][0] * bb + cov[0][1] * h1, cov[1][0] * bb + cov[1][1] * h1], cov, prior: { m0, v0, b0, vb }, lik, sumW2, dO: oNum / oDen };
}

/** The race as one observation of the national swing: counted margin minus forecast margin, and the share of the
 *  expected vote still out (which scales how much reporting-order bias the counted margin can carry). */
export function raceAggregate(p: RacePrep): { z: number; a: number; samp: number } | null {
  if (!(p.countedTotal > 0) || !p.forecastAvailable) return null;
  const A = p.cands.reduce((s, c) => s + (c.side === "a" ? c.counted : 0), 0), B = p.cands.reduce((s, c) => s + (c.side === "b" ? c.counted : 0), 0);
  const Th = p.units.reduce((s, u) => s + (u.E > 0 ? unitT(u, p.cfg, p.turnoutPost.M, null) : u.C), 0);
  return { z: (100 * (B - A)) / p.countedTotal - p.expM, a: Math.max(0, 1 - p.countedTotal / Math.max(Th, p.countedTotal)), samp: sampVar(A, B, p.countedTotal) };
}

export type SimOut = { forecast: RaceForecast; winner: Int16Array; finals: Float64Array[]; /** per draw, for a runoff (-2): the candidate projected to hold the seat; -1 otherwise */ heir: Int16Array };

export function simulateRace(p: RacePrep, fit: Fit, o: { draws?: number; seed: string; zMu?: Float64Array | null; zBeta?: Float64Array | null; zTurn?: Float64Array | null; computedAt: string; snapshotId: string; mode?: DataMode }): SimOut {
  const cfg = p.cfg, N = o.draws ?? cfg.draws, K = p.cands.length, rng = new Rng(`${o.seed}|${p.race.id}`);
  const M = cfg.margin;
  const finals = p.cands.map(() => new Float64Array(N)); const winner = new Int16Array(N).fill(-1);
  const total = new Float64Array(N), outT = new Float64Array(N), margB = new Float64Array(N);
  const keepUnits = p.units.length <= 400; const uT = keepUnits ? p.units.map(() => new Float64Array(N)) : [];
  const sOut = p.units.map((u) => (keepUnits && u.strata ? u.strata.map(() => new Float64Array(N)) : null));
  const outright = new Int32Array(K), fcLead = new Int32Array(K);
  // in a draw that ends in a runoff: the leading candidate of the side with more first-round votes
  const heir = new Int16Array(N).fill(-1);
  const topOf = (s: "a" | "b", fin: ArrayLike<number>) => { let b = -1; for (let k = 0; k < K; k++) if (p.cands[k].side === s && !p.cands[k].pooledLine && (b < 0 || fin[k] > fin[b])) b = k; return b; };
  // weights to share a side's outstanding votes among its candidates
  const weights = (s: "a" | "b" | "o") => {
    const idx = p.cands.map((c, i) => (c.side === s && !(s !== "o" && c.pooledLine) ? i : -1)).filter((i) => i >= 0);
    let w = idx.map((i) => p.cands[i].counted); if (!(w.reduce((x, y) => x + y, 0) > 0)) w = idx.map((i) => p.cands[i].fcVotes);
    if (!(w.reduce((x, y) => x + y, 0) > 0)) w = idx.map(() => 1);
    const t = w.reduce((x, y) => x + y, 0); return idx.map((i, j) => [i, t > 0 ? w[j] / t : 0] as const);
  };
  const W = { a: weights("a"), b: weights("b"), o: weights("o") };
  const hasO = W.o.length > 0;
  if (!W.a.length) W.a = hasO ? W.o : W.b; if (!W.b.length) W.b = hasO ? W.o : W.a;
  const isM = p.race.k === "measure";
  const [[c00, c01], [, c11]] = fit.cov; const s0 = Math.sqrt(Math.max(0, c00)), cs = Math.sqrt(Math.max(0, c11 - (c00 > 0 ? (c01 * c01) / c00 : 0)));
  const TS = cfg.turnout;
  // the last ballots of a count (provisional, late mail) differ from the rest by more than the middle of it does
  let sdOut = 0;
  if (p.mode === "county" && M.sdOutstanding > 0) {
    const Th = p.units.reduce((t, u) => t + (u.E > 0 ? unitT(u, cfg, p.turnoutPost.M, null) : u.C), 0), o = Th > 0 ? clamp(1 - p.countedTotal / Th, 0, 1) : 1;
    sdOut = M.sdOutstandingLate + (M.sdOutstanding - M.sdOutstandingLate) * clamp(o / M.outstandingLateBelow, 0, 1);
  }

  for (let i = 0; i < N; i++) {
    // the turnout surprise is partly national: the shared score carries that part, so national vote totals keep an honest range
    const zt = rng.normal(), zl = o.zTurn ? Math.sqrt(TS.rhoNational) * o.zTurn[i] + Math.sqrt(1 - TS.rhoNational) * zt : zt;
    const ls = clamp(p.turnoutPost.M + zl / Math.sqrt(p.turnoutPost.P), -TS.clampLog, TS.clampLog);
    const zm = o.zMu ? o.zMu[i] : rng.normal();
    const mu = fit.mean[0] + s0 * zm;
    const beta = fit.mean[1] + (c00 > 0 ? (c01 / c00) * (mu - fit.mean[0]) : 0) + cs * (o.zBeta ? o.zBeta[i] : rng.normal());
    const dO = fit.dO + (cfg.others.sdShift / 100) * rng.normal();
    // county mode: the ballots still out, wherever they are, may differ from what their counties' forecasts and the swing so far imply, by one amount common to the race
    const dOut = sdOut > 0 ? sdOut * rng.normal() : 0;
    // split: ordinary uncounted ballots in counties still open (sdOutstanding) v the late ballots of counties taken as finished (sdOutstandingLate)
    const split = p.mode === "county" && M.outstandingSplit && M.sdOutstanding > 0, dOpen = split ? M.sdOutstanding * rng.normal() : dOut, dLate = split ? M.sdOutstandingLate * rng.normal() : dOut;
    const fin = new Float64Array(K);
    let tot = 0, out = 0;
    for (let g = 0; g < p.units.length; g++) {
      const u = p.units[g];
      for (let k = 0; k < K; k++) fin[k] += u.votes[k];
      if (!(u.E > 0)) { tot += u.C; if (keepUnits) uT[g][i] = u.C; continue; }
      const ud = u.done != null && u.done > 0 ? rng.next() : null, fin_ = ud != null && ud < (u.done as number);
      const Tg = unitT(u, cfg, ls, rng.normal(), rng.normal(), ud, p.turnoutSdUnit ?? null);
      // unit noise (and unit order bias), drawn conditionally on the unit's own counted margin
      const sU = unitSd(p, u); let eta = sU * rng.normal(), bu = 0;
      if (!u.strata && u.y != null && u.C > 0) {
        const f0 = u.C / unitT(u, cfg, p.turnoutPost.M, null), a = 1 - f0;
        const sv = sampVar(sideSum(p.cands, u.votes, "a"), sideSum(p.cands, u.votes, "b"), u.C), r = sU ** 2 + a * a * M.sdOrderUnit ** 2 + sv;
        const bu0 = M.sdOrderUnit * rng.normal(), e0 = Math.sqrt(sv) * rng.normal(), res = u.y - u.bm - mu - a * beta, sStar = eta + a * bu0 + e0;
        eta = eta + ((sU ** 2) / r) * (res - sStar); bu = bu0 + ((a * M.sdOrderUnit ** 2) / r) * (res - sStar);
      }
      // no candidate outside the two sides (Louisiana's all-party fields): nobody to give an "others" share to
      const Mg = u.bm + mu + eta; const oOut = isM || !hasO ? 0 : clamp(u.bO + dO, 0, 0.9);
      const allot = (n: number, margin: number) => {
        if (!(n > 0)) return; const sh = sharesFromMargin(margin, oOut);
        for (const [k, w] of W.a) fin[k] += n * sh.a * w; for (const [k, w] of W.b) fin[k] += n * sh.b * w; for (const [k, w] of W.o) fin[k] += n * sh.o * w;
      };
      let N_g = 0;
      if (u.strata) {
        // method strata: outstanding by method from the method's expected share of the unit's ballots; offsets centred so the unit's total margin is unchanged
        const pis = u.strata.map((s) => Math.max(0, s.prior.share.mean + s.prior.share.sd * rng.normal())); const ps = pis.reduce((x, y) => x + y, 0) || 1;
        const ds = u.strata.map((s) => s.prior.offset.mean + s.prior.offset.sd * rng.normal()); const dbar = ds.reduce((x, d, j) => x + (pis[j] / ps) * d, 0);
        u.strata.forEach((s, j) => { const n = Math.max(0, (pis[j] / ps) * Tg - s.C); N_g += n; if (sOut[g]) sOut[g]![j][i] = n; allot(n, clamp(Mg + ds[j] - dbar, -100, 100)); });
      } else {
        N_g = Tg - u.C; const f = u.C / Tg;
        allot(N_g, clamp(Mg - f * (beta + bu) + (fin_ ? dLate : dOpen), -100, 100));
      }
      tot += u.C + N_g; out += N_g; if (keepUnits) uT[g][i] = u.C + N_g;
    }
    for (let k = 0; k < K; k++) finals[k][i] = fin[k];
    total[i] = tot; outT[i] = out;
    const A = sideSum(p.cands, fin, "a"), B = sideSum(p.cands, fin, "b"); margB[i] = tot > 0 ? (100 * (B - A)) / tot : 0;
    // the outcome of this draw, by the race's rule
    let lead = -1; for (let k = 0; k < K; k++) if (!p.cands[k].pooledLine && (lead < 0 || fin[k] > fin[lead])) lead = k;
    if (lead >= 0) fcLead[lead]++;
    if (isM) { const yes = A, no = B, ys = yes + no > 0 ? yes / (yes + no) : 0; const pass = p.thr > 0.5 ? ys >= p.thr : ys > 0.5; winner[i] = (pass ? W.a : W.b)[0]?.[0] ?? -1; }
    else if (p.rule === "ranked_choice") {
      // the final round: each side's leading candidate, plus a net transfer of every other ballot (exhausted ballots
      // are the part that moves to neither). A first-choice majority wins in every case, as the rule requires.
      const ia = topOf("a", fin), ib = topOf("b", fin), a0 = ia >= 0 ? fin[ia] : 0, b0 = ib >= 0 ? fin[ib] : 0, rest = Math.max(0, tot - a0 - b0);
      const t = clamp(p.rcvT0 + cfg.rcv.sdTransfer * rng.normal(), -1, 1);
      const fm = tot > 0 ? (100 * (b0 - a0 + t * rest)) / tot : 0; margB[i] = fm; winner[i] = fm > 0 ? ib : ia;
      if (lead >= 0 && tot > 0 && fin[lead] / tot > 0.5) outright[lead]++;
    }
    else if (p.rule === "majority_runoff") {
      if (lead >= 0 && tot > 0 && fin[lead] / tot > 0.5) { winner[i] = lead; outright[lead]++; }
      else { winner[i] = -2; heir[i] = B > A ? topOf("b", fin) : topOf("a", fin); }
    }
    else winner[i] = lead;
  }
  if (p.uncontested != null) { winner.fill(p.uncontested); }

  // ---- summarise ----
  const counts = new Int32Array(K); let runoff = 0; for (const w of winner) { if (w >= 0) counts[w]++; else if (w === -2) runoff++; }
  const shareOf = (k: number) => { const s = new Float64Array(N); for (let i = 0; i < N; i++) s[i] = total[i] > 0 ? (100 * finals[k][i]) / total[i] : 0; return s; };
  const winP = (k: number): number | null => !p.forecastAvailable && p.uncontested == null ? null : p.rule === "majority_runoff" ? null : counts[k] / N;
  const candidates: CandidateForecast[] = p.cands.map((c, k) => {
    const cf: CandidateForecast = { candidateId: c.id, name: c.name, partyRaw: c.partyRaw, side: c.side, reportedVotes: c.unknown ? null : c.counted, projectedVotes: dist(finals[k]), projectedShare: dist(shareOf(k)), winProbability: winP(k) };
    if (p.rule === "ranked_choice") { cf.firstChoiceLeadProbability = fcLead[k] / N; cf.outrightProbability = outright[k] / N; }
    if (p.rule === "majority_runoff") { cf.outrightProbability = outright[k] / N; cf.firstChoiceLeadProbability = fcLead[k] / N; }
    return cf;
  });
  const order = p.cands.map((_, k) => k).filter((k) => !p.cands[k].pooledLine).sort((x, y) => candidates[y].projectedVotes.mean - candidates[x].projectedVotes.mean);
  let topTwo: RaceForecast["projectedTopTwo"] = null;
  if (order.length >= 2) {
    const [x, y] = order, mv = new Float64Array(N), mp = new Float64Array(N);
    for (let i = 0; i < N; i++) { mv[i] = finals[x][i] - finals[y][i]; mp[i] = total[i] > 0 ? (100 * mv[i]) / total[i] : 0; }
    topTwo = { leaderId: p.cands[x].id, runnerUpId: p.cands[y].id, marginPp: dist(mp), marginVotes: dist(mv) };
  }
  let probB = 0; for (let i = 0; i < N; i++) if (margB[i] > p.cut) probB++; probB /= N;
  const repA = sideSum(p.cands, Float64Array.from(p.cands.map((c) => c.counted)), "a"), repB = sideSum(p.cands, Float64Array.from(p.cands.map((c) => c.counted)), "b");
  // the outstanding inventory: one row per unit, or one per method stratum where the provider labels methods
  const byUnit: OutstandingUnit[] = keepUnits ? p.units.flatMap((u, g): OutstandingUnit[] => {
    if (u.strata && sOut[g]) return u.strata.map((s, j) => { const fin = new Float64Array(N); for (let i = 0; i < N; i++) fin[i] = s.C + sOut[g]![j][i];
      return { unitId: u.id, name: u.name, method: s.method, methodSource: "PROVIDER_CONFIRMED", counted: s.C, expectedFinal: dist(fin), outstanding: dist(sOut[g]![j]), providerPctReporting: u.pr }; });
    const outs = new Float64Array(N); for (let i = 0; i < N; i++) outs[i] = uT[g][i] - u.C;
    return [{ unitId: u.id, name: u.name, method: "UNKNOWN", methodSource: "UNKNOWN", counted: u.C, expectedFinal: dist(uT[g]), outstanding: dist(outs), providerPctReporting: u.pr }];
  }) : [];
  // display: the leading probability, capped below certainty unless settled logically
  const ranked = candidates.map((c, k) => [k, p.rule === "majority_runoff" ? c.firstChoiceLeadProbability ?? 0 : c.winProbability ?? -1] as const).sort((a, b) => b[1] - a[1]);
  const lk = ranked[0]?.[1] != null && ranked[0][1] >= 0 ? ranked[0][0] : -1; const raw = lk >= 0 ? ranked[0][1] : null;
  const settled = p.uncontested != null ? { basis: "UNCONTESTED" as const, winnerId: p.cands[p.uncontested].id } : null;
  const capped = raw != null && !settled && raw > cfg.probCeil;
  const provWin = p.cands.find((c) => c.providerWinner);
  const flags = [...p.flags];
  const dataState = !p.obs ? "MISSING" : o.mode === "SIMULATED" ? "SIMULATED" : flags.includes("METHOD_UNKNOWN") ? "LIMITED" : "READY";
  const notes = [...p.notes];
  if (p.rule === "ranked_choice") notes.push(`ranked choice: the projected margin is the simulated final round; other candidates' ballots transfer around a net ${(100 * p.rcvT0).toFixed(0)}% to side B (the published forecast's implied split), give or take ${(100 * cfg.rcv.sdTransfer).toFixed(0)} points`);
  if (runoff) notes.push(`a runoff (no candidate above 50%) in ${((100 * runoff) / N).toFixed(1)}% of draws`);
  const forecast: RaceForecast = {
    raceId: p.race.id, rule: p.rule, computedAt: o.computedAt, snapshotId: o.snapshotId, modelVersion: MODEL_VERSION, dataState, forecastAvailable: p.forecastAvailable, calibration: "UNCALIBRATED",
    settled, call: provWin ? { origin: "provider", source: "civicAPI", winnerId: provWin.id, name: provWin.name } : null,
    candidates,
    principalMargin: p.forecastAvailable ? { reported: p.countedTotal > 0 ? (100 * (repB - repA)) / p.countedTotal : null, projected: dist(margB), probB, prior: { margin: p.pubFinalM, probB: p.pB0 } } : null,
    projectedTopTwo: topTwo,
    turnout: { counted: p.countedTotal, expectedFinal: p.units.some((u) => u.E > 0) ? dist(total) : null, outstanding: p.units.some((u) => u.E > 0) ? dist(outT) : null, byUnit,
      // (slowCount is set whether or not the source knows how long the count has been still: the call rule reads it for a race with no forecast)
      ...(cfg.turnout.quiet.slowStates.includes(p.race.st) ? { slowCount: true } : {}),
      ...(p.obs?.quietSince && Number.isFinite(Date.parse(p.obs.receivedAt) - Date.parse(p.obs.quietSince)) ? { quietMin: Math.max(0, (Date.parse(p.obs.receivedAt) - Date.parse(p.obs.quietSince)) / 60_000), slowCount: cfg.turnout.quiet.slowStates.includes(p.race.st) } : {}) },
    display: { leaderId: lk >= 0 ? p.cands[lk].id : null, probability: raw == null ? null : capped ? cfg.probCeil : raw, capped },
    draws: N, mcStdErr: raw == null ? null : Math.sqrt(Math.max(raw * (1 - raw), 1 / N) / N), flags: flags as QualityFlag[], notes,
  };
  return { forecast, winner, finals, heir };
}

/** One race on its own: its forecast's own prior, independent draws. The national engine uses the pieces instead. */
export function forecastRace(race: XRace, obs: RaceObservation | null, baseline: UnitBaseline | null, o: { seed: string; computedAt: string; snapshotId: string; cfg?: EngineConfig; priors?: MethodPriorTable | null; draws?: number; mode?: DataMode }): RaceForecast {
  const p = prepareRace(race, obs, baseline, o.cfg ?? DEFAULT_CONFIG, o.priors ?? null);
  return simulateRace(p, fitRace(p), o).forecast;
}
