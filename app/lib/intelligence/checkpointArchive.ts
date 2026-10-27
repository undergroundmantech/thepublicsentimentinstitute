// The election-night checkpoint archive. At each poll it keeps three layers, each stored on its own:
//
//   RAW         what civicAPI said (already stored by the recorder: observation records and gzipped raw bodies).
//               The checkpoint refers to them by observation id, content id and response hash.
//   CALCULATED  what OnPoint's engines computed from that raw snapshot, with the model, its version, a hash of the
//               engine, a hash of the inputs, the calculation time (the real clock, never backdated) and a hash of
//               the outputs. The public results engine (app/results/2026/live.ts) is designation PUBLISHED; anything
//               else is SHADOW and never feeds the published layer.
//   PUBLISHED   what the public results desk showed for that snapshot: derived from the PUBLISHED calculation only.
//
// Nothing here is a new model. The public engine is called exactly as the results desk calls it. A value an engine
// does not produce is null with a reason. A calculation that fails is recorded as FAILED; the raw layer is untouched.
// Every layer file is immutable (written once). A checkpoint exists only when its manifest exists, and the manifest is
// written last, so a partial checkpoint can never be read as complete.

import { FIRST_CLOSE, fmtM, liveOdds, project, sides, type CCand, type CDetail, type Exp, type XRace } from "@/app/results/2026/live";
import { canonicalJson, compactTime, intact, jsonBytes, parseJson, sha256Hex, withChecksum, type RecordOutcome } from "./capture";
import type { ObjectStore } from "./captureStore";
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
  schema: typeof CHECKPOINT_SCHEMA;
  checkpointId: string;
  raceId: string;
  civicId: number | null;
  designation: "PUBLISHED" | "SHADOW";
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

export interface PublishedRecord {
  layer: "PUBLISHED";
  schema: typeof CHECKPOINT_SCHEMA;
  checkpointId: string;
  raceId: string;
  basis: "PUBLIC_ENGINE_ON_ARCHIVED_SNAPSHOT";
  status: "OK" | "UNAVAILABLE";
  reason: string | null;
  model: ModelIdentity;
  calculatedOutputSha256: string | null;
  testData: boolean | null;
  /** The desk hides test returns before the first polls close unless opened with ?test=1. */
  visibility: "SHOWN" | "SHOWN_AS_TEST" | "HIDDEN_BEFORE_CLOSE" | null;
  displayed: {
    marginLabel: string; expectedFinalMarginPp: number; countedMarginPp: number | null; sideProbability: { A: number; B: number };
    winProbability: Record<string, number | null>; completenessPct: number; reportedTotal: number; estimatedFinalTotal: number;
    estimatedOutstandingVotes: number; intervalPp: { low: number; high: number }; displayBandPp: number;
  } | null;
  providerCalls: string[];
  onpointCall: null;
  onpointCallReason: string;
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
    raw: { status: "COMPLETE" | "PARTIAL"; runKey: string; issues: string[]; feeds: { feed: string; outcome: string }[] };
    calculated: LayerRef;
    published: LayerRef;
  };
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
  /** Also record each new published calculation as a Race History LIVE_PROJECTION point. */
  raceHistory?: boolean;
}

export const checkpointIdOf = (startedAt: string, runId: string) => `${compactTime(startedAt)}_${runId}`;
export const archiveKeys = (startedAt: string, runId: string) => {
  const id = checkpointIdOf(startedAt, runId), base = `archive/${startedAt.slice(0, 10)}`;
  return { id, manifest: `${base}/checkpoints/${id}.json`, calculated: `${base}/calculated/${id}.jsonl`, published: `${base}/published/${id}.jsonl` };
};

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

function published(rec: CalcRecord, cap: RaceCapture | null): PublishedRecord {
  const base = { layer: "PUBLISHED" as const, schema: CHECKPOINT_SCHEMA, checkpointId: rec.checkpointId, raceId: rec.raceId, basis: "PUBLIC_ENGINE_ON_ARCHIVED_SNAPSHOT" as const, model: rec.model, onpointCall: null, onpointCallReason: "no OnPoint race-call engine feeds the public results desk; only the provider's own winner flags are shown" };
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
      winProbability: o.winProbability, completenessPct: o.completenessPct, reportedTotal: o.reportedTotal, estimatedFinalTotal: o.estimatedFinalTotal,
      estimatedOutstandingVotes: o.estimatedOutstandingVotes, intervalPp: { low: o.uncertainty.lowPp, high: o.uncertainty.highPp }, displayBandPp: o.uncertainty.displayBandPp,
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
  const calc: CalcRecord[] = [], pub: PublishedRecord[] = [];
  const counts = { tracked: input.captures.length, untracked: input.untracked.length, ok: 0, reused: 0, failed: 0, unavailable: 0, shadow: 0 };
  const fresh: { rec: CalcRecord; cap: RaceCapture }[] = [];

  for (const cap of [...input.captures].sort((x, y) => x.race.id.localeCompare(y.race.id))) {
    const base = { layer: "CALCULATED" as const, schema: CHECKPOINT_SCHEMA, checkpointId: keys.id, raceId: cap.race.id, civicId: cap.civicId, designation: "PUBLISHED" as const, raw: cap.raw, observedAt: cap.observedAt, model: engine, reusedFrom: null };
    let rec: CalcRecord;
    if (!cap.detail || !cap.raw) {
      rec = { ...base, calculatedAt: null, inputSha256: null, status: "UNAVAILABLE", reason: `no raw snapshot at this checkpoint: ${cap.failure ?? "not captured"}`, outputs: null, outputSha256: null };
    } else {
      let exp: Record<string, Exp> | null = null, expNote: string | null = null;
      try { exp = await deps.expFor(cap.race); } catch { expNote = "county expectations could not be read"; }
      if (!exp && !expNote) expNote = "no county expectations for this race";
      const inputSha256 = sha256Hex(canonicalJson({ c: cap.detail.c, regions: cap.detail.regions ?? null, exp, forecast: forecastInputs(cap.race) }));
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
    pub.push(published(rec, cap));

    if (deps.shadow && cap.detail && cap.raw) {
      const s = deps.shadow;
      const detail = cap.detail;
      const sb = { ...base, designation: "SHADOW" as const, model: s.model, inputSha256: sha256Hex(canonicalJson({ c: detail.c, regions: detail.regions ?? null, forecast: forecastInputs(cap.race) })) };
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
    calc.push({ layer: "CALCULATED", schema: CHECKPOINT_SCHEMA, checkpointId: keys.id, raceId: `civic-${c.civicId}`, civicId: c.civicId, designation: "PUBLISHED", raw: null, observedAt: null, calculatedAt: null, model: engine, inputSha256: null, status: "UNAVAILABLE", reason: "no OnPoint model covers this contest; its returns are kept in the raw feed", reusedFrom: null, outputs: null, outputSha256: null, contest: c });
  }

  const incomplete: string[] = input.rawIssues.map((x) => `raw: ${x}`);
  const write = async (key: string, buf: Buffer, lines: number): Promise<LayerRef> => {
    try { await store.putIfAbsent(key, buf, "application/x-ndjson"); return { key, status: "WRITTEN", sha256: sha256Hex(buf), bytes: buf.length, lines }; }
    catch (e) { incomplete.push(`${key.split("/")[2]} layer not stored (${errName(e)})`); return { key, status: "FAILED", sha256: null, bytes: 0, lines }; }
  };
  const calculated = await write(keys.calculated, jsonl(calc), calc.length);
  const publishedRef = await write(keys.published, jsonl(pub), pub.length);

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
    layers: { raw: { status: input.rawIssues.length ? "PARTIAL" : "COMPLETE", runKey: input.runKey, issues: input.rawIssues, feeds: input.feeds }, calculated, published: publishedRef },
    counts, raceHistory, complete: incomplete.length === 0, incompleteReasons: incomplete,
  });
  await store.putIfAbsent(keys.manifest, jsonBytes(manifest), "application/json");
  return manifest;
}

// ---- reading back ------------------------------------------------------------------------------------------------------

const parseLines = <T,>(b: Buffer | null): T[] => (b ? b.toString("utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T) : []);

export interface LoadedCheckpoint { manifest: CheckpointManifest; calculated: CalcRecord[]; published: PublishedRecord[]; problems: string[] }

/** Reads one checkpoint and checks every layer against the hashes in its manifest. */
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
  return { manifest, calculated: parseLines<CalcRecord>(await layer(manifest.layers.calculated)), published: parseLines<PublishedRecord>(await layer(manifest.layers.published)), problems };
}

export async function listCheckpoints(store: ObjectStore, fromDay: string, toDay: string): Promise<string[]> {
  const out: string[] = [];
  for (let d = Date.parse(`${fromDay}T00:00:00Z`); d <= Date.parse(`${toDay}T00:00:00Z`); d += 86_400_000) out.push(...(await store.list(`archive/${new Date(d).toISOString().slice(0, 10)}/checkpoints/`)));
  return out.sort();
}

export interface StateAt { checkpointId: string; archivedAt: string; raw: RawSnapshotRef | null; calculated: CalcRecord | null; shadow: CalcRecord | null; published: PublishedRecord | null; problems: string[] }

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
    const calculated = cp.calculated.find((c) => c.raceId === raceId && c.designation === "PUBLISHED") ?? null;
    return {
      checkpointId: cp.manifest.checkpointId, archivedAt: cp.manifest.archivedAt, raw: calculated?.raw ?? null, calculated,
      shadow: cp.calculated.find((c) => c.raceId === raceId && c.designation === "SHADOW") ?? null,
      published: cp.published.find((p) => p.raceId === raceId) ?? null, problems: cp.problems,
    };
  }
  return null;
}
