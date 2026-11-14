// Phase 5: scoring the engine against outcomes, from stored states only (nothing is recomputed, so the score is of
// what the engine actually said at each moment). Pure: archive frames and outcomes in, a report out.
//
// What it measures, for every frame:
//   race probabilities   Brier score, log loss and calibration (stated v observed), by share of the vote counted
//   race margins         error of the projected final top-two margin; how often the final margin falls inside the
//                        80% and 95% ranges (coverage should be near 80% and 95% if the ranges are honest)
//   confident misses     a candidate at or above the call threshold who lost
//   model calls          correct or not, how long after first qualifying, how long before the official call
//   threshold sweep      the model-call rule replayed over the same stored forecasts at other thresholds
//   national             projected seats against the final seats, frame by frame
// Every race is assigned to one of two halves by a hash of its id; tuning must use half A and report half B.
//
// It refuses to call anything "calibration" when the source is simulated or interpolated: such a run is labelled a
// PIPELINE TEST, its gate is NOT APPLICABLE, and its numbers say only that the machinery runs.
import { DEFAULT_CALL_CONFIG, emptyLedger, stepLedger, type CallConfig } from "./modelCalls";
import type { RaceRow, StoredState } from "./pipeline";
import { fnv64 } from "./rng";
import type { ElectionSnapshot, RaceForecast } from "./types";

/** The outcome of one race: the winner's candidate id, and the final top-two margin in points (winner minus runner-up). */
export type Outcome = { winnerId: string; marginPp: number; certified: boolean; source: string };
export type Outcomes = Record<string, Outcome>;
export type GateTargets = { coverage80: [number, number]; coverage95Min: number; maxEce: number; maxWrongModelCalls: number; minRaces: number };
export const DEFAULT_GATE: GateTargets = { coverage80: [0.72, 0.88], coverage95Min: 0.9, maxEce: 0.05, maxWrongModelCalls: 0, minRaces: 100 };

export const half = (raceId: string): "A" | "B" => (parseInt(fnv64(raceId).slice(-2), 16) % 2 === 0 ? "A" : "B");

/** Outcomes taken from the last frame of a source. Only for pipeline tests: never certified, never a basis for calibration. */
export function outcomesFromFinalState(s: StoredState, minPct = 99): Outcomes {
  const out: Outcomes = {};
  for (const r of Object.values(s.races)) {
    if ((r.providerPct ?? 0) < minPct || r.rule === "ranked_choice" || r.rule === "multi_seat") continue;
    const rep = r.c.filter((c) => c[3] != null).sort((a, b) => (b[3] as number) - (a[3] as number));
    const tot = rep.reduce((x, c) => x + (c[3] as number), 0); if (rep.length < 2 || !tot) continue;
    out[r.id] = { winnerId: rep[0][0], marginPp: (100 * ((rep[0][3] as number) - (rep[1][3] as number))) / tot, certified: false, source: `last frame of the source (${s.t})` };
  }
  return out;
}

/** Enough of a RaceForecast, rebuilt from a stored row, for the call rule (modelCalls.probe) to judge it again. */
export function forecastFromRow(r: RaceRow, draws: number): RaceForecast {
  const D = (m: number, lo = m, hi = m) => ({ mean: m, p50: m, i80: { lo, hi }, i95: { lo, hi } });
  return { raceId: r.id, rule: r.rule, computedAt: "", snapshotId: "", modelVersion: "", dataState: r.dataState, forecastAvailable: r.pm != null, calibration: "UNCALIBRATED", settled: r.settled, call: r.call,
    candidates: r.c.map((c) => ({ candidateId: c[0], name: c[1], partyRaw: c[2], side: "o", reportedVotes: c[3], projectedVotes: D(c[4]), projectedShare: D(c[5]), winProbability: c[6] })),
    principalMargin: null, projectedTopTwo: r.top2 ? { leaderId: r.top2.a, runnerUpId: r.top2.b, marginPp: { mean: r.top2.mean, p50: r.top2.mean, i80: { lo: r.top2.lo, hi: r.top2.hi }, i95: { lo: r.top2.lo95, hi: r.top2.hi95 } }, marginVotes: D(0) } : null,
    turnout: { counted: r.counted, expectedFinal: r.expectedFinal != null ? D(r.expectedFinal) : null, outstanding: r.outstanding != null ? D(r.outstanding, 0, r.outstandingHi ?? r.outstanding) : null, byUnit: [] },
    display: { leaderId: r.leaderId, probability: r.shown, capped: r.capped }, draws, mcStdErr: null, flags: r.flags, notes: [] };
}

type Agg = { n: number; brier: number; logloss: number; absErr: number; nMargin: number; in80: number; in95: number; confidentWrong: number };
const agg = (): Agg => ({ n: 0, brier: 0, logloss: 0, absErr: 0, nMargin: 0, in80: 0, in95: 0, confidentWrong: 0 });
const BINS: [number, number, string][] = [[0, 0.25, "under 25% counted"], [0.25, 0.5, "25-50%"], [0.5, 0.75, "50-75%"], [0.75, 0.95, "75-95%"], [0.95, 2, "95%+"]];

export type Frame = { state: StoredState; snapshot: ElectionSnapshot };
export type Report = {
  kind: "CALIBRATION" | "PIPELINE TEST - NOT CALIBRATION";
  blockers: string[]; source: string; frames: number; outcomes: number; outcomeSource: string; modelVersion: string;
  byHalf: Record<"A" | "B", { overall: Agg; byCounted: Record<string, Agg>; calibration: { bin: string; stated: number; observed: number; n: number }[]; ece: number }>;
  modelCalls: { total: number; withOutcome: number; wrong: { raceId: string; called: string; at: string }[]; minutesFirstToCall: number[]; minutesBeforeOfficial: number[] };
  sweep: { threshold: number; calls: number; wrong: number; medianMinutesBeforeEnd: number | null }[];
  national: { t: string; houseD: number; senD: number; govD: number }[];
  gate: { applicable: boolean; results: { test: string; value: string; pass: boolean }[] };
};

export function evaluateArchive(frames: Frame[], outcomes: Outcomes, o: { sourceLabel: string; blockers: string[]; pipelineTest: boolean; threshold?: number; sweep?: number[]; gate?: GateTargets; draws?: (r: RaceRow) => number }): Report {
  if (o.blockers.length && !o.pipelineTest) throw new Error(`This source cannot be used to score the model: ${o.blockers.join("; ")}. Run it as a pipeline test if you only want to check the machinery.`);
  if (!o.pipelineTest && Object.values(outcomes).some((x) => !x.certified)) throw new Error("Calibration needs certified outcomes; these include uncertified ones.");
  const thr = o.threshold ?? DEFAULT_CALL_CONFIG.threshold, gate = o.gate ?? DEFAULT_GATE;
  const H = { A: { overall: agg(), byCounted: Object.fromEntries(BINS.map((b) => [b[2], agg()])) as Record<string, Agg>, cal: Array.from({ length: 10 }, () => ({ s: 0, o: 0, n: 0 })) }, B: { overall: agg(), byCounted: Object.fromEntries(BINS.map((b) => [b[2], agg()])) as Record<string, Agg>, cal: Array.from({ length: 10 }, () => ({ s: 0, o: 0, n: 0 })) } };
  // `p` is the eventual winner's stated chance; `loserMax` the highest chance stated for anyone who lost
  const add = (a: Agg, p: number, won: boolean, margin: [number, number, number, number, number] | null, fin: number, loserMax = 0) => {
    a.n++; a.brier += (p - (won ? 1 : 0)) ** 2; const q = Math.min(1 - 1e-6, Math.max(1e-6, won ? p : 1 - p)); a.logloss -= Math.log(q);
    if ((p >= thr && !won) || loserMax >= thr) a.confidentWrong++;
    if (margin) { const [lo95, lo, m, hi, hi95] = margin; a.nMargin++; a.absErr += Math.abs(m - fin); if (fin >= lo && fin <= hi) a.in80++; if (fin >= lo95 && fin <= hi95) a.in95++; }
  };
  const national: Report["national"] = [];
  for (const f of frames) {
    const s = f.state;
    national.push({ t: s.t, houseD: s.national.house.seats.D.mean, senD: s.national.senate.seats.D.mean, govD: s.national.governors.seats.D.mean });
    for (const [id, out] of Object.entries(outcomes)) {
      const r = s.races[id]; if (!r || r.counted <= 0 || r.rule === "majority_runoff" || r.rule === "ranked_choice") continue;
      const w = r.c.find((c) => c[0] === out.winnerId); if (!w || w[6] == null) continue;
      const p = w[6] as number; const share = r.expectedFinal ? r.counted / r.expectedFinal : 0;
      let margin: [number, number, number, number, number] | null = null;
      if (r.top2) { const same = r.top2.a === out.winnerId; const sign = same ? 1 : r.top2.b === out.winnerId ? -1 : 0; if (sign === 1) margin = [r.top2.lo95, r.top2.lo, r.top2.mean, r.top2.hi, r.top2.hi95]; else if (sign === -1) margin = [-r.top2.hi95, -r.top2.hi, -r.top2.mean, -r.top2.lo, -r.top2.lo95]; }
      const h = H[half(id)]; const bin = BINS.find((b) => share >= b[0] && share < b[1])![2];
      const loserMax = Math.max(0, ...r.c.filter((c) => c[0] !== out.winnerId && c[6] != null).map((c) => c[6] as number));
      add(h.overall, p, true, margin, out.marginPp, loserMax); add(h.byCounted[bin], p, true, margin, out.marginPp, loserMax);
      // calibration over every candidate's stated probability, not only the winner's
      for (const c of r.c) { if (c[6] == null) continue; const pc = c[6] as number; const k = Math.min(9, Math.floor(pc * 10)); h.cal[k].s += pc; h.cal[k].o += c[0] === out.winnerId ? 1 : 0; h.cal[k].n++; }
    }
  }
  const fin = (h: (typeof H)["A"]) => {
    const cal = h.cal.map((c, i) => ({ bin: `${i * 10}-${i * 10 + 10}%`, stated: c.n ? c.s / c.n : NaN, observed: c.n ? c.o / c.n : NaN, n: c.n }));
    const N = cal.reduce((x, c) => x + c.n, 0); const ece = N ? cal.reduce((x, c) => x + (c.n ? (c.n / N) * Math.abs(c.stated - c.observed) : 0), 0) : NaN;
    const norm = (a: Agg): Agg => ({ ...a, brier: a.n ? a.brier / a.n : NaN, logloss: a.n ? a.logloss / a.n : NaN, absErr: a.nMargin ? a.absErr / a.nMargin : NaN, in80: a.nMargin ? a.in80 / a.nMargin : NaN, in95: a.nMargin ? a.in95 / a.nMargin : NaN });
    return { overall: norm(h.overall), byCounted: Object.fromEntries(Object.entries(h.byCounted).map(([k, a]) => [k, norm(a)])), calibration: cal, ece };
  };
  // model calls as recorded, and the rule replayed at other thresholds over the same stored forecasts
  const last = frames[frames.length - 1]?.state;
  const calls = last ? Object.values(last.ledger.races).filter((x) => x.modelCall) : [];
  const mc: Report["modelCalls"] = { total: calls.length, withOutcome: 0, wrong: [], minutesFirstToCall: [], minutesBeforeOfficial: [] };
  for (const c of calls) {
    const out = outcomes[c.raceId]; if (out) { mc.withOutcome++; if (out.winnerId !== c.modelCall!.candidateId) mc.wrong.push({ raceId: c.raceId, called: c.modelCall!.name, at: c.modelCall!.calledAt }); }
    if (c.firstQualifiedAt) mc.minutesFirstToCall.push((Date.parse(c.modelCall!.calledAt) - Date.parse(c.firstQualifiedAt)) / 60_000);
    if (c.official) mc.minutesBeforeOfficial.push((Date.parse(c.official.firstSeenAt) - Date.parse(c.modelCall!.calledAt)) / 60_000);
  }
  const draws = o.draws ?? ((r: RaceRow) => (/^(sen|house|gov)-/.test(r.id) ? 2000 : 1000));
  const sweep = (o.sweep ?? [0.99, 0.993, 0.995, 0.999]).map((threshold) => {
    const cfg: CallConfig = { ...DEFAULT_CALL_CONFIG, threshold }; let l = emptyLedger(frames[0]?.state.mode ?? "HISTORICAL", cfg);
    for (const f of frames) l = stepLedger(l, { snapshotId: f.state.snapshotId, at: f.state.t, forecasts: Object.fromEntries(Object.values(f.state.races).filter((r) => r.dataState !== "MISSING").map((r) => [r.id, forecastFromRow(r, draws(r))])), observations: f.snapshot.races });
    const cs = Object.values(l.races).filter((x) => x.modelCall); const end = last ? Date.parse(last.t) : 0;
    const before = cs.map((x) => (end - Date.parse(x.modelCall!.calledAt)) / 60_000).sort((a, b) => a - b);
    return { threshold, calls: cs.length, wrong: cs.filter((x) => outcomes[x.raceId] && outcomes[x.raceId].winnerId !== x.modelCall!.candidateId).length, medianMinutesBeforeEnd: before.length ? before[before.length >> 1] : null };
  });
  const A = fin(H.A), B = fin(H.B);
  const applicable = !o.pipelineTest && o.blockers.length === 0;
  const results = [
    { test: `held-out 80% range coverage in [${gate.coverage80.join(", ")}]`, value: B.overall.in80.toFixed(3), pass: B.overall.in80 >= gate.coverage80[0] && B.overall.in80 <= gate.coverage80[1] },
    { test: `held-out 95% range coverage >= ${gate.coverage95Min}`, value: B.overall.in95.toFixed(3), pass: B.overall.in95 >= gate.coverage95Min },
    { test: `held-out calibration error (ECE) <= ${gate.maxEce}`, value: B.ece.toFixed(3), pass: B.ece <= gate.maxEce },
    { test: `wrong model calls <= ${gate.maxWrongModelCalls}`, value: String(mc.wrong.length), pass: mc.wrong.length <= gate.maxWrongModelCalls },
    { test: `scored races >= ${gate.minRaces}`, value: String(Object.keys(outcomes).length), pass: Object.keys(outcomes).length >= gate.minRaces },
  ];
  return { kind: o.pipelineTest ? "PIPELINE TEST - NOT CALIBRATION" : "CALIBRATION", blockers: o.blockers, source: o.sourceLabel, frames: frames.length, outcomes: Object.keys(outcomes).length, outcomeSource: Object.values(outcomes)[0]?.source ?? "none", modelVersion: last?.modelVersion ?? "",
    byHalf: { A, B }, modelCalls: mc, sweep, national, gate: { applicable, results } };
}
