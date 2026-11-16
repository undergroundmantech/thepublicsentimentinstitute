// The national picture: Senate, House and governors recomputed from every race's draws on each snapshot, never the
// frozen pre-election numbers (those are carried alongside, labelled, for comparison only).
//
// One error structure, in margin points: a race's error from its forecast = national swing + state swing + its own.
// 1. Estimate. Races the provider shows as finished say what the national swing is. The swing estimated from the
//    OTHER races (leave-one-out, so no race counts itself twice) becomes each race's prior centre, and what is left
//    of the swing's uncertainty widens that prior. A race with no votes therefore moves when informative results
//    arrive elsewhere, and stays put when nothing new arrives.
// 2. Joint draws. Races share a national and a same-state normal score. Each race's loading on them is the share of
//    its remaining uncertainty that the national (or state) swing accounts for, computed from the same variances as
//    the estimate, so a nearly finished race moves on its own while uncounted races move together. Each race's own
//    probabilities come from these same draws, so race pages and national totals agree.
// 3. Tallies per draw: seats by party with seats not up; calls from the provider are settled outcomes; independents
//    count for a party only where the config says how they caucus; a runoff or an unknown caucus is "unresolved".
import type { XIndex, XRace } from "../../results/2026/live";
import { nameKey, partyCanon, principals } from "../../results/2026/candidates";
import { DEFAULT_CONFIG, MODEL_VERSION, type EngineConfig } from "./config";
import type { MethodPriorTable } from "./methodPriors";
import { dist, seatDist } from "./normal";
import { fitRace, prepareRace, raceAggregate, shareNationalTurnout, simulateRace, type UnitBaseline } from "./raceModel";
import { Rng } from "./rng";
import type { ChamberForecast, ElectionSnapshot, NationalForecast, RaceForecast } from "./types";

export type PreElection = {
  senNotUpD: number; senNotUpR: number; govNotUpD: number; govNotUpR: number;
  senate: { pD: number | null; seatsD: number | null }; house: { pD: number | null; seatsD: number | null }; governors: { pD: number | null; seatsD: number | null };
  /** generic-ballot poll average, R minus D points */
  genericBallot: number | null;
};
export type NationalInput = {
  index: XIndex; snapshot: ElectionSnapshot; pre: PreElection;
  seed: string; computedAt: string; draws?: number; cfg?: EngineConfig;
  baselines?: Record<string, UnitBaseline>; priors?: MethodPriorTable | null;
  /**
   * On Point's own calls so far: race id -> the called candidate's id (the ledger's model calls up to the previous
   * update). A called race is a settled outcome in the seat counts, as a network treats its own calls. When given,
   * the provider's winner flags are not used at all.
   */
  calls?: Record<string, string>;
};
/** What the seat tallies need to be recounted after this update's own calls are made (pipeline.ts): not stored. */
export type SeatTallyInfo = Record<string, { key: "sen" | "house" | "gov"; bucket: Record<string, 0 | 1 | 2>; /** counted as called for this party already, or null */ called: 0 | 1 | 2 | null; /** counted as leading for this party, or null */ leading: 0 | 1 | 2 | null }>;
/** Polls have closed for a race: the provider's listed closing time has passed, or votes are already reported. */
export const pollsClosed = (obs: { pollsCloseAt?: string | null; test?: boolean; candidates: { votes: number | null }[] } | null | undefined, at: string): boolean =>
  !!obs && !obs.test && ((obs.pollsCloseAt ? Date.parse(at) >= Date.parse(obs.pollsCloseAt) : false) || obs.candidates.some((c) => (c.votes ?? 0) > 0));

type PartyBucket = 0 | 1 | 2;   // D, R, unresolved / other

/** Senate control for one outcome: 0 Democrats, 1 Republicans, 2 unresolved. A party controls with a majority, or
 *  with half the seats when the Vice President is of its party. Seats of unknown caucus are counted for neither, so
 *  a result they could decide is unresolved. */
export function senateControl(D: number, R: number, vp: "D" | "R", seats = 100): 0 | 1 | 2 {
  const half = seats / 2;
  return D >= half + 1 || (D === half && vp === "D") ? 0 : R >= half + 1 || (R === half && vp === "R") ? 1 : 2;
}
const CHAMBER_KINDS = new Set(["sen", "house", "gov"]);

export function nationalForecast(inp: NationalInput): { national: NationalForecast; races: Record<string, RaceForecast>; tallyInfo: SeatTallyInfo } {
  const cfg = inp.cfg ?? DEFAULT_CONFIG, N = inp.draws ?? cfg.draws, snap = inp.snapshot;
  const races = inp.index.races.filter((r) => CHAMBER_KINDS.has(r.k));
  const preps = races.map((r) => prepareRace(r, snap.races[r.id] ?? null, inp.baselines?.[r.id] ?? null, cfg, inp.priors ?? null));
  shareNationalTurnout(preps);

  // ---- 1. pooled national swing and national reporting-order bias, leave-one-out ----
  // Each counted race: z = counted margin - forecast margin = swing + (share still out) x order bias + its own noise.
  // Only races whose count the provider shows as finished (100% of precincts) inform the national swing. A partly
  // counted race cannot separate a swing from the order ballots are counted in, and with only precinct percentages
  // its "share still out" is itself unreliable: in the 2026 checkpoints, pooling partly counted races read the early
  // blue tilt of the count as a five-point national swing (House 289 seats, 80% range 271-306, at 9:58 PM; 260 by
  // morning). The order-bias term is kept so a finished race's last few late ballots are still treated honestly.
  const tn2 = cfg.national.sdNational ** 2;
  const ob2 = cfg.margin.sdOrderRace ** 2, obN2 = ob2 * cfg.national.orderNationalShare, obR2 = ob2 - obN2;
  const eligible = preps.map((p) => {
    if (!p.forecastAvailable || p.uncontested != null) return false;
    const pr = principals(p.race); return pr.mode === "candidate" ? pr.b.party === "R" && (pr.a.party === "D" || pr.a.party === "IND") : true;
  });
  const lam = preps.map((p) => cfg.national.loading[p.race.k] ?? 1);
  const tau2 = preps.map((p, i) => Math.max(1, p.sdF ** 2 - lam[i] * lam[i] * tn2));
  // Stage 1, the national swing: finished races only. 1-D normal update, leave-one-out.
  type Row = { a: number; z: number; r: number; l: number; samp: number } | null;
  const finished = (i: number) => (preps[i].obs?.providerPctReporting ?? 0) >= 99.5;
  const aggs = preps.map((p, i) => (eligible[i] ? raceAggregate(p) : null));
  const rows: Row[] = aggs.map((g, i) => (g && finished(i) ? { a: g.a, z: g.z, r: tau2[i] + g.a * g.a * ob2 + g.samp, l: lam[i], samp: g.samp } : null));
  let Pn = 1 / tn2, Hn = 0; for (const x of rows) if (x) { Pn += (x.l * x.l) / x.r; Hn += (x.l * x.z) / x.r; }
  const nuAll = { nu: Hn / Pn, vnu: 1 / Pn };
  const nuLoo = rows.map((x) => { if (!x) return nuAll; const P1 = Pn - (x.l * x.l) / x.r; return { nu: (Hn - (x.l * x.z) / x.r) / P1, vnu: 1 / P1 }; });
  // Early finishers are not a random sample of races (small, lopsided and same-region places finish first), so what
  // they say about the swing is discounted: the swing's variance keeps a share of its prior variance in proportion
  // to the races NOT yet finished. With every race finished the discount is gone.
  const nElig = eligible.filter(Boolean).length, fin = rows.filter(Boolean).length;
  const selVar = cfg.national.selectionShare * tn2 * (nElig ? 1 - fin / nElig : 1) * (fin ? 1 : 0);
  // The reporting-order bias is NOT estimated nationally: each race keeps a zero-centred prior, half of whose variance
  // is shared by every race in the draws. (Estimating a national order bias from partly counted races was tried in
  // the audit: it pulled early national totals toward the end state but made race-level scores worse on the 2026
  // checkpoints, so it waits for real timestamped history.)
  const all = { nu: nuAll.nu, vnu: Math.min(tn2, nuAll.vnu + selVar), bn: 0, vbn: obN2 };
  const informing = rows.filter(Boolean).length;
  const loo = preps.map((_, i) => ({ nu: nuLoo[i].nu, vnu: Math.min(tn2, nuLoo[i].vnu + selVar), bn: 0, vbn: obN2 }));
  const fits = preps.map((p, i) => (eligible[i] ? fitRace(p, { m0: lam[i] * loo[i].nu, v0: lam[i] * lam[i] * loo[i].vnu + tau2[i], b0: loo[i].bn, vb: loo[i].vbn + obR2 }) : fitRace(p)));
  const P = 1 / all.vnu, H = all.nu * P;

  // ---- 2. joint normal scores ----
  const rng = new Rng(`${inp.seed}|national`);
  const Zn = Float64Array.from({ length: N }, () => rng.normal());
  const Zb = Float64Array.from({ length: N }, () => rng.normal());   // the national part of the reporting-order bias
  const Zt = Float64Array.from({ length: N }, () => rng.normal());   // the national part of the turnout surprise
  const Zs = new Map<string, Float64Array>();
  for (const r of races) if (!Zs.has(r.st)) { const z = new Float64Array(N); for (let i = 0; i < N; i++) z[i] = rng.normal(); Zs.set(r.st, z); }

  // ---- 3. simulate every race and tally per draw ----
  const sen = [new Int16Array(N), new Int16Array(N), new Int16Array(N)], house = [new Int16Array(N), new Int16Array(N), new Int16Array(N)], gov = [new Int16Array(N), new Int16Array(N), new Int16Array(N)];
  const pv = [new Float64Array(N), new Float64Array(N), new Float64Array(N)];
  const called = { sen: [0, 0, 0], house: [0, 0, 0], gov: [0, 0, 0] }, leading = { sen: [0, 0, 0], house: [0, 0, 0], gov: [0, 0, 0] };
  const obsPV = [0, 0, 0]; let pvRacesWithVotes = 0, pvRaces = 0; const pvOut = new Float64Array(N);
  const out: Record<string, RaceForecast> = {}; const safeSeats: string[] = []; const tallyInfo: SeatTallyInfo = {};
  const bucketOf = (name: string, partyRaw: string | null, chamberKey: string): PartyBucket => { const p = partyCanon(partyRaw); if (p === "D") return 0; if (p === "R") return 1; const c = cfg.senate.caucus[nameKey(name)] ?? (chamberKey === "sen" && p === "IND" ? cfg.senate.independentsCaucus : null); return c === "D" ? 0 : c === "R" ? 1 : 2; };
  const pvBucket = (partyRaw: string | null): PartyBucket => { const p = partyCanon(partyRaw); return p === "D" ? 0 : p === "R" ? 1 : 2; };

  preps.forEach((p, i) => {
    const r = p.race, fit = fits[i];
    // How much of what is still unknown about this race's swing is the national swing, and how much its state's.
    // The race's posterior mean moves by (c00 / v0) for each point its prior centre moves, so the national swing's
    // remaining variance reaches the race scaled by that factor squared; the same for the state's. Before any vote
    // this is sdNational^2 / (race spread)^2: the same numbers the estimate uses, so the two cannot disagree.
    const c00 = Math.max(1e-9, fit.cov[0][0]), sens = Math.min(1, c00 / Math.max(1e-9, fit.prior.v0));
    const vS = eligible[i] ? Math.min(cfg.national.sdState ** 2, Math.max(0, tau2[i] - 1)) : 0;
    const a2 = eligible[i] ? Math.min(1, (sens * sens * lam[i] * lam[i] * loo[i].vnu) / c00) : 0, b2 = Math.min(1 - a2, (sens * sens * vS) / c00);
    const a = Math.sqrt(a2), b = Math.sqrt(b2), c = Math.sqrt(Math.max(0, 1 - a2 - b2));
    const zr = new Rng(`${inp.seed}|z|${r.id}`), zs = Zs.get(r.st)!, zMu = new Float64Array(N);
    for (let d = 0; d < N; d++) zMu[d] = a * Zn[d] + b * zs[d] + c * zr.normal();
    // the order bias still unknown for this race is partly the national one: share its normal score with every race
    const sb = eligible[i] ? Math.min(1, Math.max(0, loo[i].vbn / (loo[i].vbn + obR2))) : 0, zBeta = new Float64Array(N);
    for (let d = 0; d < N; d++) zBeta[d] = Math.sqrt(sb) * Zb[d] + Math.sqrt(1 - sb) * zr.normal();
    const sim = simulateRace(p, fit, { draws: N, seed: inp.seed, zMu, zBeta, zTurn: Zt, computedAt: inp.computedAt, snapshotId: snap.snapshotId, mode: snap.provenance.mode });
    out[r.id] = sim.forecast;
    const key = r.k === "sen" ? "sen" : r.k === "house" ? "house" : "gov";
    const tally = key === "sen" ? sen : key === "house" ? house : gov;
    // a called race is a settled outcome: On Point's own call when the pipeline passes the ledger's calls in, else (older
    // configurations only) the provider's winner flag. An unopposed candidate is settled by the race model itself.
    const own = inp.calls ? p.cands.findIndex((x) => x.id === inp.calls![r.id]) : -1;
    const prov = inp.calls ? own : cfg.useProviderCalls ? p.cands.findIndex((x) => x.providerWinner) : -1;
    const buckets = p.cands.map((x) => bucketOf(x.name, x.partyRaw, key));
    // a seat the index lists with no candidates but as certain for one party (pR 0 or 1, margin -100 or +100: a
    // top-two general between two Democrats, an unopposed seat). The forecast's certainty is the only basis there is.
    const safe: PartyBucket | null = !p.cands.length && (r.pR === 0 || r.pR === 1) && Math.abs(r.m ?? 0) >= 99.5 ? (r.pR === 0 ? 0 : 1) : null;
    if (safe != null) safeSeats.push(r.id);
    for (let d = 0; d < N; d++) { let wk = prov >= 0 ? prov : sim.winner[d]; if (wk === -2 && cfg.national.runoffToFirstRoundSide) wk = sim.heir[d]; tally[safe != null ? safe : wk >= 0 ? buckets[wk] : 2][d]++; }
    // what is reported, not modeled
    // (a seat certain for one party with no winner called yet, two Democrats in a top-two general, counts for that
    // party once its polls have closed: the seat is not in doubt, only the name)
    const info: SeatTallyInfo[string] = { key, bucket: Object.fromEntries(p.cands.map((x, k) => [x.id, buckets[k]])), called: null, leading: null };
    if (prov >= 0) { called[key][buckets[prov]]++; info.called = buckets[prov]; }
    else if (inp.calls && safe != null && pollsClosed(p.obs, inp.computedAt)) { called[key][safe]++; info.called = safe; }
    else if (p.countedTotal > 0) { let l = -1; p.cands.forEach((x, k) => { if (!x.pooledLine && (l < 0 || x.counted > p.cands[l].counted)) l = k; }); if (l >= 0) { leading[key][buckets[l]]++; info.leading = buckets[l]; } }
    tallyInfo[r.id] = info;
    if (r.k === "house") {
      pvRaces++; if (p.countedTotal > 0) pvRacesWithVotes++;
      p.cands.forEach((x, k) => { const bk = pvBucket(x.partyRaw); obsPV[bk] += x.counted; const f = sim.finals[k]; const t = pv[bk]; for (let d = 0; d < N; d++) { t[d] += f[d]; pvOut[d] += f[d] - x.counted; } });
    }
  });

  const notUp = { sen: [inp.pre.senNotUpD, inp.pre.senNotUpR], gov: [inp.pre.govNotUpD, inp.pre.govNotUpR] };
  const flags: string[] = [];
  const chamber = (key: "sen" | "house" | "gov", t: Int16Array[], label: string, controlRule: string, total: number, ctl: (D: number, R: number) => 0 | 1 | 2, pre: { pD: number | null; seatsD: number | null }): ChamberForecast => {
    const [nd, nr] = key === "house" ? [0, 0] : notUp[key];
    const D = new Float64Array(N), R = new Float64Array(N), O = new Float64Array(N); let pD = 0, pR = 0, pU = 0, bad = 0;
    for (let d = 0; d < N; d++) {
      D[d] = t[0][d] + nd; R[d] = t[1][d] + nr; O[d] = t[2][d];
      if (D[d] + R[d] + O[d] !== total) bad++;
      const c = ctl(D[d], R[d]); if (c === 0) pD++; else if (c === 1) pR++; else pU++;
    }
    if (bad) flags.push(`${label}: seats do not sum to ${total} in ${bad} draws (races in the index ${t[0][0] + t[1][0] + t[2][0]}, not up ${nd + nr})`);
    return { label, controlRule, pD: pD / N, pR: pR / N, pUnresolved: pU / N, seats: { D: seatDist(D), R: seatDist(R), other: seatDist(O) },
      called: { D: called[key][0], R: called[key][1], other: called[key][2] }, leading: { D: leading[key][0], R: leading[key][1], other: leading[key][2] },
      notUp: { D: nd, R: nr }, preElection: pre, racesModeled: preps.filter((p) => p.race.k === key).length,
      distD: (() => { const h = new Array(total + 1).fill(0); for (let d = 0; d < N; d++) h[Math.min(total, Math.max(0, D[d]))] += 1 / N; return h; })(),
      display: displayOf(pD / N, pR / N, ctl(called[key][0] + nd, total - called[key][0] - nd) === 0 && ctl(called[key][0] + nd, 0) === 0 ? "D" : ctl(total - called[key][1] - nr, called[key][1] + nr) === 1 && ctl(0, called[key][1] + nr) === 1 ? "R" : null) };
  };
  // A control probability is shown below certainty unless calls (and seats not up) alone decide control.
  const displayOf = (pD: number, pR: number, decidedBy: "D" | "R" | null) => {
    const lead = pD >= pR ? "D" as const : "R" as const, raw = Math.max(pD, pR);
    if (decidedBy) return { leader: decidedBy, probability: 1, capped: false, basis: inp.calls ? "Decided by On Point's calls and seats not up" : "Decided by provider calls and seats not up" };
    return { leader: lead, probability: Math.min(raw, cfg.probCeil), capped: raw > cfg.probCeil, basis: "Model estimate; not a call" };
  };
  const vp = cfg.senate.vpParty, S = cfg.senate.seats, half = S / 2;
  const senate = chamber("sen", sen, "Senate", `A party controls with ${half + 1} seats, or with ${half} when the Vice President (${vp}) is of that party. ${cfg.senate.independentsCaucus ? `Independent winners are counted with the ${cfg.senate.independentsCaucus === "D" ? "Democratic" : "Republican"} caucus: an assumption, not a commitment any of them has made.` : "Independents count for a party only where their caucus is configured; otherwise a result they decide is unresolved."}`, S,
    (D, R) => senateControl(D, R, vp, S), inp.pre.senate);
  const hs = chamber("house", house, "House", `A party controls with ${cfg.house.majority} of ${cfg.house.seats} seats. Vacancies are not modeled.`, cfg.house.seats,
    (D, R) => (D >= cfg.house.majority ? 0 : R >= cfg.house.majority ? 1 : 2), inp.pre.house);
  const gv = chamber("gov", gov, "Governors", `Not a chamber: the probability that a party holds a majority of governorships (${cfg.governors.majority} or more of ${cfg.governors.offices}). Neither at 25-25 or with independents holding the balance.`, cfg.governors.offices,
    (D, R) => (D >= cfg.governors.majority ? 0 : R >= cfg.governors.majority ? 1 : 2), inp.pre.governors);

  const pvM = new Float64Array(N), pvT = new Float64Array(N), pvSD = new Float64Array(N), pvSR = new Float64Array(N);
  for (let d = 0; d < N; d++) { const t = pv[0][d] + pv[1][d] + pv[2][d]; pvT[d] = t; pvM[d] = t > 0 ? (100 * (pv[1][d] - pv[0][d])) / t : 0; pvSD[d] = t > 0 ? (100 * pv[0][d]) / t : 0; pvSR[d] = t > 0 ? (100 * pv[1][d]) / t : 0; }
  const oT = obsPV[0] + obsPV[1] + obsPV[2];
  const national: NationalForecast = {
    snapshotId: snap.snapshotId, computedAt: inp.computedAt, modelVersion: MODEL_VERSION, mode: snap.provenance.mode, calibration: "UNCALIBRATED", draws: N, seed: inp.seed,
    nationalSwing: { mean: H / P, sd: Math.sqrt(1 / P), racesInforming: informing, orderBias: { mean: all.bn, sd: Math.sqrt(all.vbn) } },
    senate, house: hs, governors: gv,
    houseVote: {
      label: "U.S. House popular vote",
      inclusion: `The ${pvRaces} House general elections in the forecast index; no Senate, governor or presidential votes. Observed: votes the provider has reported, grouped by each candidate's own party label, so independents, minor parties and write-ins are "other", and a race with two Democrats (a California top-two) adds both to the Democratic total. Projected: each race's simulated final count, including the forecast's expected vote where nothing is reported yet. Seats the index lists with no candidates add no votes. Margins are Republican minus Democratic over all votes; the two-party margin is shown separately with its own denominator.`,
      observed: { D: obsPV[0], R: obsPV[1], other: obsPV[2], total: oT, marginPp: oT > 0 ? (100 * (obsPV[1] - obsPV[0])) / oT : null, twoPartyMarginPp: obsPV[0] + obsPV[1] > 0 ? (100 * (obsPV[1] - obsPV[0])) / (obsPV[0] + obsPV[1]) : null, racesWithVotes: pvRacesWithVotes, racesIncluded: pvRaces },
      projected: { D: dist(pv[0]), R: dist(pv[1]), other: dist(pv[2]), marginPp: dist(pvM), shareD: dist(pvSD), shareR: dist(pvSR), total: dist(pvT), outstanding: dist(pvOut) },
      benchmark: { label: "Pre-election generic-ballot poll average (a survey, not counted votes)", marginPp: inp.pre.genericBallot },
    },
    flags: safeSeats.length ? [...flags, `${safeSeats.length} seats listed with no candidates are counted for the party the forecast holds certain: ${safeSeats.join(", ")}`] : flags,
  };
  return { national, races: out, tallyInfo };
}

/** The frozen pre-election comparison from public/forecast/model.json (server side reads it; this only shapes it). */
export function preElectionFrom(model: { meta: { senNotUpD: number; senNotUpR: number; govNotUpD: number; govNotUpR: number; genericBallot?: { avg: number } }; chambers: Record<"senate" | "house" | "governor", { demControl: number; demSeats: number }> }): PreElection {
  const c = model.chambers;
  return { senNotUpD: model.meta.senNotUpD, senNotUpR: model.meta.senNotUpR, govNotUpD: model.meta.govNotUpD, govNotUpR: model.meta.govNotUpR,
    senate: { pD: c.senate.demControl, seatsD: c.senate.demSeats }, house: { pD: c.house.demControl, seatsD: c.house.demSeats }, governors: { pD: c.governor.demControl, seatsD: c.governor.demSeats },
    genericBallot: model.meta.genericBallot?.avg ?? null };
}
export type { XRace };
