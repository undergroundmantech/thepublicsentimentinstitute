// The election-night checkpoint archive. Each checkpoint keeps separate, linked layers:
//
//   RAW_OBSERVED              what civicAPI said: the recorder's observation records and gzipped responses, referenced
//                             by observation id, content id and response hash.
//   CALCULATED_PUBLIC_ENGINE  the public results engine (app/results/2026/live.ts) run on that raw snapshot, with model,
//   CALCULATED_SHADOW         version, engine hash, input hash, real calculation time and output hash. Shadow output never
//                             reaches any later layer.
//   SNAPSHOT                  what the public engine's output would display. PUBLICATION_READY when the canonical public
//                             pathway is on; otherwise PUBLIC_ENGINE_RECOMPUTED_NOT_VERIFIED_PUBLISHED, because the browser
//                             desk computes on its own fetch and nothing proves these values were shown.
//   PUBLISHED                 a separate event (publicSnapshot.ts), written only when a PUBLICATION_READY snapshot was
//                             made available through the canonical endpoint. Never inferred from a calculation.
//
// Nothing here is a new model. A value an engine does not produce is null with a reason. Every layer file is written
// once. The manifest is written after its layers, so a partial checkpoint is never read as complete.

import { FIRST_CLOSE, fmtM, liveOdds, project, sides, type CCand, type CDetail, type Exp, type XRace } from "@/app/results/2026/live";
import { canonicalJson, compactTime, intact, jsonBytes, parseJson, readRaw, sha256Hex, withChecksum, type RecordOutcome } from "./capture";
import type { ObjectStore } from "./captureStore";
import { trimDetail } from "./civic";
import type { HistoryCandidate } from "./raceHistory";
import { candidateId, partyCode, recordModelOutput, type ModelOutputInput } from "./raceHistoryStore";

export const CHECKPOINT_SCHEMA = "ONPOINT_CHECKPOINT/1" as const;
export const PUBLIC_ENGINE = "onpoint-results-live";
const CALC_HEAD = "heads/archive-calc.json";

const ENGINE_SHA = sha256Hex([project, liveOdds, sides].map((f) => f.toString()).join("\n"));

export interface ModelIdentity { name: string; version: string; configSha256: string }

/** The deployed commit names the version; the hash of the engine's own code tells two builds of one engine apart. */
export function publicEngineIdentity(env: Record<string, string | undefined> = process.env): ModelIdentity {
  return { name: PUBLIC_ENGINE, version: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || `local-${ENGINE_SHA.slice(0, 12)}`, configSha256: ENGINE_SHA };
}

export interface RawSnapshotRef {
  outcome: RecordOutcome;
  observationId: string;
  contentId: string;
  /** The observation record. Its rawRef names the stored response; UNCHANGED points at the earlier identical record. */
  observationKey: string;
  responseSha256: string;
}

export interface RaceCapture {
  race: XRace;
  civicId: number | null;
  observedAt: string | null;
  detail: CDetail | null;
  raw: RawSnapshotRef | null;
  /** Why no raw snapshot exists for this race at this checkpoint. */
  failure: string | null;
}

export interface FeedContest { civicId: number; type: string; province: string; district: string | null; name: string }

export interface CheckpointInput {
  runId: string;
  phase: string;
  startedAt: string;
  rawFinishedAt: string;
  runKey: string;
  captures: RaceCapture[];
  /** Contests in the feeds read that no OnPoint model covers. Recorded as UNAVAILABLE, never omitted. */
  untracked: FeedContest[];
  feeds: { feed: string; outcome: string }[];
  rawIssues: string[];
}

export interface CandidateOut { id: string; name: string; party: string | null; side: "A" | "B" | null; providerWinner: boolean }
type Sides = { a: number; b: number; o: number; t: number };

export interface EngineOutputs {
  candidates: CandidateOut[];
  reportedVotes: Record<string, number>;
  reportedTotal: number;
  /** The engine projects one total per side. A candidate gets it only when alone on that side. */
  estimatedFinalVotes: Record<string, number | null>;
  estimatedFinalTotal: number;
  sides: { reported: Sides; estimatedFinal: Sides };
  estimatedOutstandingVotes: number;
  completenessPct: number;
  /** Side B minus side A, in points, of the votes counted so far. */
  countedMarginPp: number | null;
  /** Side B minus side A, in points, of the projected final count. */
  expectedFinalMarginPp: number;
  forecastMarginPp: number;
  winProbability: Record<string, number | null>;
  sideProbability: { A: number; B: number };
  winProbabilityBasis: "TWO_SIDE";
  uncertainty: { sdPp: number; lowPp: number; highPp: number; level: 0.95; displayBandPp: number };
  adjustments: { geographicSwingPp: number | null; countiesReporting: number; countiesTotal: number; reportingOrder: null; votingMethod: null };
  confidence: null;
  /** Field path → why the engine gives no value there. */
  unavailable: Record<string, string>;
}

/** The public results engine, called as the results desk calls it. Pure; uses only this snapshot. */
export function computePublicEngine(race: XRace, detail: CDetail, exp: Record<string, Exp> | null): EngineOutputs {
  const P = project(exp, detail.regions ?? null, race, detail.c ?? null, race.tot);
  const odds = liveOdds(race, P);
  const sideOf = (c: CCand): "A" | "B" | null => { const s = sides(race, [[c[0], c[1], 1, 0, 0, null]]); return s.a ? "A" : s.b ? "B" : null; };
  const cands: CandidateOut[] = detail.c.map((c) => ({ id: candidateId(c[0]) || "candidate", name: c[0], party: partyCode(c[1]), side: sideOf(c), providerWinner: !!c[4] }));
  const per = (s: "A" | "B" | null) => cands.filter((c) => c.side === s).length;
  const unavailable: Record<string, string> = {
    "adjustments.reportingOrder": "the public engine applies no reporting-order adjustment",
    "adjustments.votingMethod": "the public engine applies no voting-method adjustment",
    confidence: "the public engine publishes no confidence rating; its uncertainty is the interval",
  };
  const estimatedFinalVotes: Record<string, number | null> = {}, winProbability: Record<string, number | null> = {}, reportedVotes: Record<string, number> = {};
  detail.c.forEach((c, i) => {
    const o = cands[i];
    reportedVotes[o.id] = (reportedVotes[o.id] ?? 0) + c[2];
    const alone = per(o.side) === 1;
    const k = o.side === "A" ? "a" : o.side === "B" ? "b" : "o";
    estimatedFinalVotes[o.id] = alone ? P.fin[k] : null;
    if (!alone) unavailable[`estimatedFinalVotes.${o.id}`] = "the engine projects one total per side and this side has more than one candidate";
    winProbability[o.id] = alone && o.side === "A" ? odds.pA : alone && o.side === "B" ? odds.pB : null;
    if (winProbability[o.id] === null) unavailable[`winProbability.${o.id}`] = o.side ? "the engine prices sides, and this side has more than one candidate" : "the engine prices only the two margin sides; this candidate is not priced (not zero)";
  });
  if (!P.rep.t) unavailable.countedMarginPp = "no votes counted";
  if (P.swing === null) unavailable["adjustments.geographicSwingPp"] = "no county has reported against a forecast expectation";
  return {
    candidates: cands, reportedVotes, reportedTotal: P.rep.t, estimatedFinalVotes, estimatedFinalTotal: P.fin.t, sides: { reported: P.rep, estimatedFinal: P.fin },
    estimatedOutstandingVotes: Math.max(0, P.fin.t - P.rep.t), completenessPct: P.pctIn,
    countedMarginPp: P.rep.t ? (100 * (P.rep.b - P.rep.a)) / P.rep.t : null, expectedFinalMarginPp: P.m, forecastMarginPp: P.expM,
    winProbability, sideProbability: { A: odds.pA, B: odds.pB }, winProbabilityBasis: "TWO_SIDE",
    uncertainty: { sdPp: odds.sd, lowPp: odds.lo, highPp: odds.hi, level: 0.95, displayBandPp: P.band },
    adjustments: { geographicSwingPp: P.swing, countiesReporting: P.countiesIn, countiesTotal: P.counties, reportingOrder: null, votingMethod: null },
    confidence: null, unavailable,
  };
}

export type CalcStatus = "OK" | "FAILED" | "UNAVAILABLE";

export interface CalcRecord {
  layer: "CALCULATED";
  classification: "CALCULATED_PUBLIC_ENGINE" | "CALCULATED_SHADOW";
  schema: typeof CHECKPOINT_SCHEMA;
  /** checkpoint/race/designation/model@version: unique and stable. */
  calculationId: string;
  checkpointId: string;
  raceId: string;
  civicId: number | null;
  designation: "PUBLIC_ENGINE" | "SHADOW";
  raw: RawSnapshotRef | null;
  observedAt: string | null;
  /** When the calculation actually ran. A reused calculation keeps its own original time. */
  calculatedAt: string | null;
  model: ModelIdentity;
  inputSha256: string | null;
  status: CalcStatus;
  reason: string | null;
  /** Set when the inputs and model were identical to an earlier checkpoint, so its outputs were carried over unrecomputed. */
  reusedFrom: string | null;
  outputs: unknown;
  outputSha256: string | null;
  contest?: FeedContest;
}

export interface Displayed {
  marginLabel: string; expectedFinalMarginPp: number; countedMarginPp: number | null; sideProbability: { A: number; B: number };
  winProbability: Record<string, number | null>; completenessPct: number; providerReportingPct: number | null; reportedTotal: number; estimatedFinalTotal: number;
  estimatedOutstandingVotes: number; intervalPp: { low: number; high: number }; displayBandPp: number; estimatedFinalSides: Sides;
  candidates: { id: string; name: string; party: string | null; side: "A" | "B" | null; votes: number; winProbability: number | null }[];
}

export interface SnapshotRecord {
  layer: "SNAPSHOT";
  classification: "PUBLICATION_READY" | "PUBLIC_ENGINE_RECOMPUTED_NOT_VERIFIED_PUBLISHED";
  schema: typeof CHECKPOINT_SCHEMA;
  checkpointId: string;
  raceId: string;
  civicId: number | null;
  status: "OK" | "UNAVAILABLE";
  reason: string | null;
  model: ModelIdentity;
  /** The public-engine calculation this was derived from, and the raw snapshot under it. */
  calculationId: string;
  raw: RawSnapshotRef | null;
  calculatedOutputSha256: string | null;
  observedAt: string | null;
  sourceUpdatedAt: string | null;
  testData: boolean | null;
  /** The desk hides test returns before the first polls close unless opened with ?test=1. */
  visibility: "SHOWN" | "SHOWN_AS_TEST" | "HIDDEN_BEFORE_CLOSE" | null;
  displayed: Displayed | null;
  providerCalls: string[];
  onpointCall: null;
  onpointCallReason: string;
}

/** Written only after a PUBLICATION_READY snapshot was made available through the canonical endpoint. */
export interface PublicationEvent {
  layer: "PUBLISHED";
  classification: "PUBLISHED";
  schema: typeof CHECKPOINT_SCHEMA;
  publicationId: string;
  snapshotId: string;
  checkpointId: string;
  /** When the canonical head was moved to this document. On the GitHub store it becomes visible with the run's commit. */
  publishedAt: string;
  delivery: string;
  document: { key: string; sha256: string };
  snapshotLayer: { key: string; sha256: string | null };
  previousPublicationId: string | null;
  /** Exactly what the document serves per race. */
  races: { raceId: string; civicId: number | null; calculationId: string; calculatedOutputSha256: string; model: ModelIdentity }[];
  checksum: string;
}

export interface LayerRef { key: string; status: "WRITTEN" | "FAILED"; sha256: string | null; bytes: number; lines: number }

export interface CheckpointManifest {
  type: "CHECKPOINT_MANIFEST";
  schema: typeof CHECKPOINT_SCHEMA;
  checkpointId: string;
  runId: string;
  phase: string;
  startedAt: string;
  rawFinishedAt: string;
  archivedAt: string;
  engine: ModelIdentity;
  shadowModel: ModelIdentity | null;
  layers: {
    raw: { classification: "RAW_OBSERVED"; status: "COMPLETE" | "PARTIAL"; runKey: string; issues: string[]; feeds: { feed: string; outcome: string }[] };
    calculated: LayerRef;
    snapshot: LayerRef;
  };
  /** CANONICAL: the snapshot is offered to the public pathway; a PUBLISHED event exists only if that succeeded. */
  publication: "CANONICAL" | "NONE_BROWSER_DESK";
  counts: { tracked: number; untracked: number; ok: number; reused: number; failed: number; unavailable: number; shadow: number };
  raceHistory: { recorded: number; failed: number } | null;
  complete: boolean;
  incompleteReasons: string[];
  checksum: string;
}

export interface ShadowCalculator { model: ModelIdentity; run: (c: RaceCapture & { detail: CDetail }) => unknown }

export interface ArchiveDeps {
  now: () => Date;
  expFor: (race: XRace) => Promise<Record<string, Exp> | null>;
  engine?: ModelIdentity;
  /** Test seam for the engine call. Production uses computePublicEngine. */
  compute?: (race: XRace, detail: CDetail, exp: Record<string, Exp> | null) => EngineOutputs;
  shadow?: ShadowCalculator | null;
  /** Also record each new public-engine calculation as a Race History LIVE_PROJECTION point. */
  raceHistory?: boolean;
  /** The canonical public pathway is on: snapshots are PUBLICATION_READY instead of recomputed-not-verified. */
  publicationReady?: boolean;
}

export const checkpointIdOf = (startedAt: string, runId: string) => `${compactTime(startedAt)}_${runId}`;
export const archiveKeys = (startedAt: string, runId: string) => {
  const id = checkpointIdOf(startedAt, runId), base = `archive/${startedAt.slice(0, 10)}`;
  return { id, manifest: `${base}/checkpoints/${id}.json`, calculated: `${base}/calculated/${id}.jsonl`, snapshot: `${base}/snapshot/${id}.jsonl`, publication: `${base}/published/${id}.json` };
};
export const publicationKeyOf = (manifestKey: string) => manifestKey.replace("/checkpoints/", "/published/");

const jsonl = (xs: unknown[]) => Buffer.from(xs.map((x) => JSON.stringify(x)).join("\n") + (xs.length ? "\n" : ""), "utf8");
const errName = (e: unknown) => ((e as { code?: unknown })?.code as string) ?? ((e as Error)?.name || "Error");

interface CalcHead { races: Record<string, CalcRecord> }
async function readCalcHead(store: ObjectStore): Promise<CalcHead> {
  try {
    const h = parseJson(await store.get(CALC_HEAD)) as (CalcHead & { checksum: string }) | null;
    return h && intact(h) ? { races: h.races } : { races: {} };
  } catch { return { races: {} }; }
}

const forecastInputs = (r: XRace) => ({ id: r.id, k: r.k, c: r.c ?? null, tot: r.tot ?? null, m: r.m ?? null, pR: r.pR ?? null, yes: r.yes ?? null, pPass: r.pPass ?? null, thr: r.thr ?? null });
const inputShaOf = (detail: CDetail, exp: Record<string, Exp> | null, race: XRace) => sha256Hex(canonicalJson({ c: detail.c, regions: detail.regions ?? null, exp, forecast: forecastInputs(race) }));
export const calculationIdOf = (checkpointId: string, raceId: string, designation: string, m: ModelIdentity) => `${checkpointId}/${raceId}/${designation}/${m.name}@${m.version}`;

function snapshotOf(rec: CalcRecord, cap: RaceCapture | null, classification: SnapshotRecord["classification"]): SnapshotRecord {
  const base = {
    layer: "SNAPSHOT" as const, classification, schema: CHECKPOINT_SCHEMA, checkpointId: rec.checkpointId, raceId: rec.raceId, civicId: rec.civicId, model: rec.model, calculationId: rec.calculationId, raw: rec.raw,
    observedAt: rec.observedAt, sourceUpdatedAt: cap?.detail?.updated ?? null, onpointCall: null, onpointCallReason: "no OnPoint race-call engine feeds the public results desk; only the provider's own winner flags are shown",
  };
  if (rec.status !== "OK" || !cap?.detail) {
    return { ...base, status: "UNAVAILABLE", reason: rec.status === "FAILED" ? `the published calculation failed: ${rec.reason}` : rec.reason, calculatedOutputSha256: null, testData: cap?.detail?.test ?? null, visibility: null, displayed: null, providerCalls: [] };
  }
  const o = rec.outputs as EngineOutputs;
  const test = cap.detail.test;
  const seen = cap.observedAt ? Date.parse(cap.observedAt) : NaN;
  return {
    ...base, status: "OK", reason: null, calculatedOutputSha256: rec.outputSha256, testData: test,
    visibility: !test ? "SHOWN" : seen < FIRST_CLOSE ? "HIDDEN_BEFORE_CLOSE" : "SHOWN_AS_TEST",
    displayed: {
      marginLabel: fmtM(o.expectedFinalMarginPp, cap.race.k), expectedFinalMarginPp: o.expectedFinalMarginPp, countedMarginPp: o.countedMarginPp, sideProbability: o.sideProbability,
      winProbability: o.winProbability, completenessPct: o.completenessPct, providerReportingPct: Number.isFinite(cap.detail.pr) ? cap.detail.pr : null, reportedTotal: o.reportedTotal, estimatedFinalTotal: o.estimatedFinalTotal,
      estimatedOutstandingVotes: o.estimatedOutstandingVotes, intervalPp: { low: o.uncertainty.lowPp, high: o.uncertainty.highPp }, displayBandPp: o.uncertainty.displayBandPp, estimatedFinalSides: o.sides.estimatedFinal,
      candidates: o.candidates.map((c) => ({ id: c.id, name: c.name, party: c.party, side: c.side, votes: o.reportedVotes[c.id] ?? 0, winProbability: o.winProbability[c.id] ?? null })),
    },
    providerCalls: o.candidates.filter((c) => c.providerWinner).map((c) => c.id),
  };
}

/** The Race History point for a new published calculation. Only the two margin sides are priced. */
export function toLiveProjection(rec: CalcRecord, cap: RaceCapture, calcKey: string): ModelOutputInput | null {
  if (rec.status !== "OK" || !cap.detail || !rec.calculatedAt) return null;
  const o = rec.outputs as EngineOutputs;
  const a = o.candidates.filter((c) => c.side === "A"), b = o.candidates.filter((c) => c.side === "B");
  const candidates: HistoryCandidate[] = o.candidates.map(({ id, name, party, side }) => ({ id, name, party, side }));
  return {
    raceId: rec.raceId, observedAt: rec.calculatedAt, sourceTimestamp: cap.detail.updated ?? null, sourceClass: "LIVE_PROJECTION", status: cap.detail.test ? "TEST" : "LIVE",
    candidates, revision: { status: "ORIGINAL", supersedes: null, note: null },
    reporting: { pct: o.completenessPct, definition: "share of the projected final vote counted, as the public results engine estimates it" },
    model: { id: rec.model.name, version: rec.model.version, snapshot: rec.checkpointId, asOf: rec.observedAt },
    winProbability: o.winProbability, winProbabilityBasis: "TWO_SIDE",
    margin: a.length === 1 && b.length === 1 ? { pp: o.expectedFinalMarginPp, reference: { plus: b[0].id, minus: a[0].id }, low: o.uncertainty.lowPp, high: o.uncertainty.highPp, intervalBasis: "95% interval: projected margin ± 1.96 × the engine's live spread" } : null,
    projectedFinalVotes: o.estimatedFinalVotes,
    provenance: { origin: "onpoint-checkpoint-archive", ref: `${calcKey}#${rec.raceId}` },
  };
}

/**
 * Archive one checkpoint. Throws only when the manifest itself cannot be written; any earlier failure is recorded in
 * the manifest, which then says complete: false.
 */
export async function archiveCheckpoint(store: ObjectStore, input: CheckpointInput, deps: ArchiveDeps): Promise<CheckpointManifest> {
  const keys = archiveKeys(input.startedAt, input.runId);
  const engine = deps.engine ?? publicEngineIdentity();
  const compute = deps.compute ?? computePublicEngine;
  const head = await readCalcHead(store);
  const nextHead: Record<string, CalcRecord> = { ...head.races };
  const calc: CalcRecord[] = [], snap: SnapshotRecord[] = [];
  const snapClass = deps.publicationReady ? "PUBLICATION_READY" as const : "PUBLIC_ENGINE_RECOMPUTED_NOT_VERIFIED_PUBLISHED" as const;
  const counts = { tracked: input.captures.length, untracked: input.untracked.length, ok: 0, reused: 0, failed: 0, unavailable: 0, shadow: 0 };
  const fresh: { rec: CalcRecord; cap: RaceCapture }[] = [];

  for (const cap of [...input.captures].sort((x, y) => x.race.id.localeCompare(y.race.id))) {
    const base = { layer: "CALCULATED" as const, classification: "CALCULATED_PUBLIC_ENGINE" as const, schema: CHECKPOINT_SCHEMA, calculationId: calculationIdOf(keys.id, cap.race.id, "PUBLIC_ENGINE", engine), checkpointId: keys.id, raceId: cap.race.id, civicId: cap.civicId, designation: "PUBLIC_ENGINE" as const, raw: cap.raw, observedAt: cap.observedAt, model: engine, reusedFrom: null };
    let rec: CalcRecord;
    if (!cap.detail || !cap.raw) {
      rec = { ...base, calculatedAt: null, inputSha256: null, status: "UNAVAILABLE", reason: `no raw snapshot at this checkpoint: ${cap.failure ?? "not captured"}`, outputs: null, outputSha256: null };
    } else {
      let exp: Record<string, Exp> | null = null, expNote: string | null = null;
      try { exp = await deps.expFor(cap.race); } catch { expNote = "county expectations could not be read"; }
      if (!exp && !expNote) expNote = "no county expectations for this race";
      const inputSha256 = inputShaOf(cap.detail, exp, cap.race);
      const prev = head.races[cap.race.id];
      if (prev && prev.status === "OK" && prev.inputSha256 === inputSha256 && prev.model.version === engine.version && prev.model.configSha256 === engine.configSha256) {
        rec = { ...prev, ...base, calculatedAt: prev.calculatedAt, reusedFrom: prev.reusedFrom ?? prev.checkpointId };
        counts.reused++;
      } else {
        try {
          const outputs = compute(cap.race, cap.detail, exp);
          rec = { ...base, calculatedAt: deps.now().toISOString(), inputSha256, status: "OK", reason: expNote ? `${expNote}; the engine used the statewide forecast, as the public desk does` : null, outputs, outputSha256: sha256Hex(canonicalJson(outputs)) };
          fresh.push({ rec, cap });
        } catch (e) {
          rec = { ...base, calculatedAt: deps.now().toISOString(), inputSha256, status: "FAILED", reason: `the public engine threw ${errName(e)}`, outputs: null, outputSha256: null };
        }
      }
      if (rec.status === "OK") nextHead[cap.race.id] = { ...rec, raw: null };
    }
    counts[rec.status === "OK" ? "ok" : rec.status === "FAILED" ? "failed" : "unavailable"]++;
    calc.push(rec);
    snap.push(snapshotOf(rec, cap, snapClass));

    if (deps.shadow && cap.detail && cap.raw) {
      const s = deps.shadow;
      const detail = cap.detail;
      const sb = { ...base, classification: "CALCULATED_SHADOW" as const, calculationId: calculationIdOf(keys.id, cap.race.id, "SHADOW", s.model), designation: "SHADOW" as const, model: s.model, inputSha256: sha256Hex(canonicalJson({ c: detail.c, regions: detail.regions ?? null, forecast: forecastInputs(cap.race) })) };
      try {
        const outputs = s.run({ ...cap, detail });
        calc.push({ ...sb, calculatedAt: deps.now().toISOString(), status: "OK", reason: null, outputs, outputSha256: sha256Hex(canonicalJson(outputs ?? null)) });
      } catch (e) {
        calc.push({ ...sb, calculatedAt: deps.now().toISOString(), status: "FAILED", reason: `the shadow model threw ${errName(e)}`, outputs: null, outputSha256: null });
      }
      counts.shadow++;
    }
  }
  for (const c of input.untracked) {
    calc.push({ layer: "CALCULATED", classification: "CALCULATED_PUBLIC_ENGINE", schema: CHECKPOINT_SCHEMA, calculationId: calculationIdOf(keys.id, `civic-${c.civicId}`, "PUBLIC_ENGINE", engine), checkpointId: keys.id, raceId: `civic-${c.civicId}`, civicId: c.civicId, designation: "PUBLIC_ENGINE", raw: null, observedAt: null, calculatedAt: null, model: engine, inputSha256: null, status: "UNAVAILABLE", reason: "no OnPoint model covers this contest; its returns are kept in the raw feed", reusedFrom: null, outputs: null, outputSha256: null, contest: c });
  }

  const incomplete: string[] = input.rawIssues.map((x) => `raw: ${x}`);
  const write = async (key: string, buf: Buffer, lines: number): Promise<LayerRef> => {
    try { await store.putIfAbsent(key, buf, "application/x-ndjson"); return { key, status: "WRITTEN", sha256: sha256Hex(buf), bytes: buf.length, lines }; }
    catch (e) { incomplete.push(`${key.split("/")[2]} layer not stored (${errName(e)})`); return { key, status: "FAILED", sha256: null, bytes: 0, lines }; }
  };
  const calculated = await write(keys.calculated, jsonl(calc), calc.length);
  const snapshotRef = await write(keys.snapshot, jsonl(snap), snap.length);

  let raceHistory: CheckpointManifest["raceHistory"] = null;
  if (deps.raceHistory && calculated.status === "WRITTEN") {
    raceHistory = { recorded: 0, failed: 0 };
    for (const { rec, cap } of fresh) {
      const point = toLiveProjection(rec, cap, keys.calculated);
      if (!point) continue;
      try { await recordModelOutput(store, point); raceHistory.recorded++; } catch { raceHistory.failed++; }
    }
  }
  if (calculated.status === "WRITTEN") { try { await store.put(CALC_HEAD, jsonBytes(withChecksum({ races: nextHead })), "application/json"); } catch { /* only reuse is lost; the next checkpoint recalculates */ } }

  const manifest = withChecksum<Omit<CheckpointManifest, "checksum">>({
    type: "CHECKPOINT_MANIFEST", schema: CHECKPOINT_SCHEMA, checkpointId: keys.id, runId: input.runId, phase: input.phase, startedAt: input.startedAt, rawFinishedAt: input.rawFinishedAt,
    archivedAt: deps.now().toISOString(), engine, shadowModel: deps.shadow?.model ?? null,
    layers: { raw: { classification: "RAW_OBSERVED", status: input.rawIssues.length ? "PARTIAL" : "COMPLETE", runKey: input.runKey, issues: input.rawIssues, feeds: input.feeds }, calculated, snapshot: snapshotRef },
    publication: deps.publicationReady ? "CANONICAL" : "NONE_BROWSER_DESK",
    counts, raceHistory, complete: incomplete.length === 0, incompleteReasons: incomplete,
  });
  await store.putIfAbsent(keys.manifest, jsonBytes(manifest), "application/json");
  return manifest;
}

// ---- reading back ------------------------------------------------------------------------------------------------------

const parseLines = <T,>(b: Buffer | null): T[] => (b ? b.toString("utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T) : []);

export interface LoadedCheckpoint { manifest: CheckpointManifest; calculated: CalcRecord[]; snapshot: SnapshotRecord[]; publication: PublicationEvent | null; problems: string[] }

/** Reads one checkpoint, checks every layer against the hashes in its manifest, and its publication event if any. */
export async function readCheckpoint(store: ObjectStore, manifestKey: string): Promise<LoadedCheckpoint | null> {
  const manifest = parseJson(await store.get(manifestKey)) as CheckpointManifest | null;
  if (!manifest) return null;
  const problems: string[] = [];
  if (!intact(manifest)) problems.push("manifest checksum mismatch");
  const layer = async (ref: LayerRef) => {
    if (ref.status !== "WRITTEN") return null;
    const b = await store.get(ref.key);
    if (!b) { problems.push(`${ref.key} missing`); return null; }
    if (sha256Hex(b) !== ref.sha256) problems.push(`${ref.key} hash mismatch`);
    return b;
  };
  const publication = parseJson(await store.get(publicationKeyOf(manifestKey))) as PublicationEvent | null;
  if (publication && (!intact(publication) || publication.snapshotLayer.sha256 !== manifest.layers.snapshot.sha256)) problems.push("publication event does not match this checkpoint");
  return { manifest, calculated: parseLines<CalcRecord>(await layer(manifest.layers.calculated)), snapshot: parseLines<SnapshotRecord>(await layer(manifest.layers.snapshot)), publication, problems };
}

export async function listCheckpoints(store: ObjectStore, fromDay: string, toDay: string): Promise<string[]> {
  const out: string[] = [];
  for (let d = Date.parse(`${fromDay}T00:00:00Z`); d <= Date.parse(`${toDay}T00:00:00Z`); d += 86_400_000) out.push(...(await store.list(`archive/${new Date(d).toISOString().slice(0, 10)}/checkpoints/`)));
  return out.sort();
}

export interface StateAt { checkpointId: string; archivedAt: string; raw: RawSnapshotRef | null; calculated: CalcRecord | null; shadow: CalcRecord | null; snapshot: SnapshotRecord | null; published: PublicationEvent | null; problems: string[] }

/**
 * What was known about a race at a moment: the latest checkpoint whose archive was finished by then. Nothing written
 * after `atIso` is returned, so a replay never sees the future.
 */
export async function stateAt(store: ObjectStore, raceId: string, atIso: string, fromDay = "2026-11-03"): Promise<StateAt | null> {
  const at = Date.parse(atIso);
  const keys = (await listCheckpoints(store, fromDay, atIso.slice(0, 10))).filter((k) => k.split("/").pop()!.slice(0, 20) <= compactTime(atIso)).reverse();
  for (const key of keys) {
    const cp = await readCheckpoint(store, key);
    if (!cp || Date.parse(cp.manifest.archivedAt) > at) continue;
    const calculated = cp.calculated.find((c) => c.raceId === raceId && c.designation === "PUBLIC_ENGINE") ?? null;
    return {
      checkpointId: cp.manifest.checkpointId, archivedAt: cp.manifest.archivedAt, raw: calculated?.raw ?? null, calculated,
      shadow: cp.calculated.find((c) => c.raceId === raceId && c.designation === "SHADOW") ?? null,
      snapshot: cp.snapshot.find((p) => p.raceId === raceId) ?? null,
      published: cp.publication && Date.parse(cp.publication.publishedAt) <= at ? cp.publication : null, problems: cp.problems,
    };
  }
  return null;
}

// ---- future-model replay -------------------------------------------------------------------------------------------
// A newer model is run against the archived raw snapshots and written to its own dataset under replays/, never under
// archive/. Each record links to the raw snapshot, the original calculation and the published state it is compared to.

export interface ReplayRecord {
  layer: "REPLAY";
  schema: typeof CHECKPOINT_SCHEMA;
  datasetId: string;
  calculationId: string;
  checkpointId: string;
  raceId: string;
  replayOf: { calculationId: string; model: ModelIdentity; outputSha256: string | null; publicationId: string | null; publishedOutputSha256: string | null };
  raw: RawSnapshotRef | null;
  observedAt: string | null;
  calculatedAt: string;
  model: ModelIdentity;
  inputSha256: string | null;
  status: CalcStatus;
  reason: string | null;
  outputs: unknown;
  outputSha256: string | null;
}

export interface ReplayOptions {
  datasetId: string;
  model: ModelIdentity;
  compute: (race: XRace, detail: CDetail, exp: Record<string, Exp> | null) => unknown;
  raceOf: (raceId: string) => XRace | null;
  expFor: (race: XRace) => Promise<Record<string, Exp> | null>;
  now: () => Date;
  fromDay?: string;
  toDay?: string;
  /** Replay only checkpoints whose archive was finished by this time. */
  asOf?: string;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const replayKey = (datasetId: string, m: ModelIdentity, checkpointId: string) => `replays/${datasetId}/${m.name}/${m.version}/${checkpointId}.jsonl`;

/** Writes once per checkpoint; an existing replay file is left as it is. */
export async function replayArchive(store: ObjectStore, o: ReplayOptions): Promise<{ written: string[]; existing: string[]; skipped: string[] }> {
  if (![o.datasetId, o.model.name, o.model.version].every((s) => SAFE_ID.test(s))) throw new Error("replay dataset id, model name and version must be simple identifiers");
  const out = { written: [] as string[], existing: [] as string[], skipped: [] as string[] };
  for (const mk of await listCheckpoints(store, o.fromDay ?? "2026-11-03", o.toDay ?? "2026-11-11")) {
    const cp = await readCheckpoint(store, mk);
    if (!cp || cp.problems.length || (o.asOf && Date.parse(cp.manifest.archivedAt) > Date.parse(o.asOf))) { out.skipped.push(mk); continue; }
    const recs: ReplayRecord[] = [];
    for (const c of cp.calculated) {
      if (c.designation !== "PUBLIC_ENGINE" || c.contest) continue;
      const pub = cp.publication?.races.find((p) => p.calculationId === c.calculationId) ?? null;
      const base = {
        layer: "REPLAY" as const, schema: CHECKPOINT_SCHEMA, datasetId: o.datasetId, calculationId: `${o.datasetId}/${calculationIdOf(c.checkpointId, c.raceId, "REPLAY", o.model)}`,
        checkpointId: c.checkpointId, raceId: c.raceId, replayOf: { calculationId: c.calculationId, model: c.model, outputSha256: c.outputSha256, publicationId: pub ? cp.publication!.publicationId : null, publishedOutputSha256: pub?.calculatedOutputSha256 ?? null },
        raw: c.raw, observedAt: c.observedAt, model: o.model,
      };
      const none = (reason: string): ReplayRecord => ({ ...base, calculatedAt: o.now().toISOString(), inputSha256: null, status: "UNAVAILABLE", reason, outputs: null, outputSha256: null });
      const race = o.raceOf(c.raceId);
      if (!c.raw || c.civicId === null) { recs.push(none("no raw snapshot at this checkpoint")); continue; }
      if (!race) { recs.push(none("the replay model has no definition for this race")); continue; }
      const obs = parseJson(await store.get(c.raw.observationKey)) as { rawRef: string; rawSha256: string } | null;
      const text = obs ? await readRaw(store, obs) : null;
      if (!text || sha256Hex(text) !== c.raw.responseSha256) { recs.push(none("the archived raw response is missing or does not match its hash")); continue; }
      const detail = trimDetail(JSON.parse(text), c.civicId);
      let exp: Record<string, Exp> | null = null;
      try { exp = await o.expFor(race); } catch { /* the model runs without county expectations, as the archive did */ }
      const inputSha256 = inputShaOf(detail, exp, race);
      try {
        const outputs = o.compute(race, detail, exp);
        recs.push({ ...base, calculatedAt: o.now().toISOString(), inputSha256, status: "OK", reason: null, outputs, outputSha256: sha256Hex(canonicalJson(outputs ?? null)) });
      } catch (e) {
        recs.push({ ...base, calculatedAt: o.now().toISOString(), inputSha256, status: "FAILED", reason: `the replay model threw ${errName(e)}`, outputs: null, outputSha256: null });
      }
    }
    const key = replayKey(o.datasetId, o.model, cp.manifest.checkpointId);
    if ((await store.putIfAbsent(key, jsonl(recs), "application/x-ndjson")) === "CREATED") out.written.push(key); else out.existing.push(key);
  }
  return out;
}

export interface PublishedRef { publicationId: string; publishedAt: string; calculationId: string; calculatedOutputSha256: string; modelVersion: string }
export interface ReplayComparison { checkpointId: string; raceId: string; raw: RawSnapshotRef | null; original: CalcRecord; snapshot: SnapshotRecord | null; published: PublishedRef | null; replay: ReplayRecord | null }

/** Per checkpoint: the original calculation, what was actually published (with its id), and the replayed model's result. */
export async function compareReplay(store: ObjectStore, datasetId: string, model: ModelIdentity, raceId: string, fromDay = "2026-11-03", toDay = "2026-11-11"): Promise<ReplayComparison[]> {
  const rows: ReplayComparison[] = [];
  for (const mk of await listCheckpoints(store, fromDay, toDay)) {
    const cp = await readCheckpoint(store, mk);
    const original = cp?.calculated.find((c) => c.raceId === raceId && c.designation === "PUBLIC_ENGINE");
    if (!cp || !original) continue;
    const replay = parseLines<ReplayRecord>(await store.get(replayKey(datasetId, model, cp.manifest.checkpointId))).find((r) => r.raceId === raceId) ?? null;
    const ev = cp.publication, pr = ev?.races.find((r) => r.raceId === raceId);
    const published = ev && pr ? { publicationId: ev.publicationId, publishedAt: ev.publishedAt, calculationId: pr.calculationId, calculatedOutputSha256: pr.calculatedOutputSha256, modelVersion: pr.model.version } : null;
    rows.push({ checkpointId: cp.manifest.checkpointId, raceId, raw: original.raw, original, snapshot: cp.snapshot.find((p) => p.calculationId === original.calculationId) ?? null, published, replay });
  }
  return rows;
}
