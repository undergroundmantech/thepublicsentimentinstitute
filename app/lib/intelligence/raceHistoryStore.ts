// Race history: the server side. Writes and reads the model-output ledger on the same ObjectStore as the flight recorder,
// maps the recorder's observations to history points, and reads the frozen pre-election forecast dataset.
//
// Key families (all on the flight recorder's store, see captureStore.ts)
//   model/<race>/<observedAt>_<id12>.json          a published model output (FROZEN_FORECAST or LIVE_PROJECTION)
//   model-shadow/<race>/<observedAt>_<id12>.json   a shadow model output. A different prefix so that no public read can reach it.
//   heads/model/<race>.json, heads/model-shadow/<race>.json   rebuildable pointers used to skip an unchanged re-publication
//   obs/<race>/...                                 reported votes, written by the recorder (capture.ts), read here, never written
//
// Rules
//  - Immutable and idempotent: a record's key is its race, observation time and content. Re-recording is a no-op.
//  - Material updates only: a model output whose figures equal the latest one is not stored again. The step-after line already
//    holds it, and the head keeps the time it was last confirmed.
//  - A past output is never recomputed or rewritten. A revision is a new record; whether it revises an earlier snapshot is derived
//    when reading (prepareHistory).
//  - Nothing here reads a provider. Reading history makes no network request.
//
// Server-only: uses node:crypto, node:zlib and node:fs.

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { canonicalJson, compactTime, foldObservations, intact, jsonBytes, parseJson, readObservationRecords, sha256Hex, slug, withChecksum, type ObservationView } from "./capture";
import { checkKey, type ObjectStore } from "./captureStore";
import { HISTORY_SCHEMA, invalidReason, lastName, prepareHistory, type DataStatus, type HistoryCandidate, type HistoryPoint, type MarginReference, type ModelOutputPoint, type PrepareOptions, type PreparedHistory, type Publication, type PublicationClass, type ResultPoint } from "./raceHistory";

const SAFE_RACE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
export class HistoryError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

// ---- model-output ledger -----------------------------------------------------------------------------------------------

export type ModelOutputInput = Omit<ModelOutputPoint, "schema" | "pointId" | "kind">;
interface StoredModelOutput extends ModelOutputPoint { type: "MODEL_OUTPUT_RECORD"; valuesSha256: string; recordedAt: string; checksum: string }
interface ModelHead { raceId: string; valuesSha256: string; key: string; observedAt: string; lastConfirmedAt: string; snapshot: string; checksum: string }

const prefixOf = (cls: ModelOutputInput["sourceClass"]) => (cls === "SHADOW_MODEL" ? "model-shadow" : "model");
const headKeyOf = (cls: ModelOutputInput["sourceClass"], raceId: string) => `heads/${prefixOf(cls)}/${checkKey(raceId)}.json`;

/** The figures alone. Two outputs with one valuesSha256 are not a material update of each other. */
export function modelValuesSha(m: ModelOutputInput): string {
  return sha256Hex(canonicalJson({
    c: m.sourceClass, s: m.status, mid: m.model.id, mv: m.model.version, cands: m.candidates, wp: m.winProbability, wb: m.winProbabilityBasis,
    m: m.margin, pv: m.projectedFinalVotes, r: m.reporting,
  }));
}

export type ModelRecordOutcome = "NEW" | "UNCHANGED" | "ALREADY_RECORDED";

/**
 * Store one published model output. The publisher passes what it published, as published, at the time it published it.
 * UNCHANGED: the latest stored output has the same figures; only its confirmation time is advanced.
 */
export async function recordModelOutput(store: ObjectStore, input: ModelOutputInput): Promise<{ outcome: ModelRecordOutcome; pointId: string | null; key: string }> {
  if (!SAFE_RACE.test(input.raceId)) throw new HistoryError("INVALID_RACE_ID", `race id "${input.raceId.slice(0, 40)}" is not a safe key`);
  if (!store.durable && process.env.VERCEL) throw new HistoryError("EPHEMERAL_STORE", "refusing to record race history on non-durable storage in a deployment");
  const probe: ModelOutputPoint = { ...input, schema: HISTORY_SCHEMA, kind: "MODEL_OUTPUT", pointId: "probe" };
  const t = Date.parse(input.observedAt);
  if (!Number.isFinite(t)) throw new HistoryError("INVALID_DATE", "observedAt is not a date");
  if (input.sourceClass === "LIVE_PROJECTION" && input.model.version === "UNVERSIONED") throw new HistoryError("UNVERSIONED_LIVE", "a live projection must carry a model version");
  const bad = invalidReason(probe);
  if (bad) throw new HistoryError("INVALID_OUTPUT", bad);

  const valuesSha256 = modelValuesSha(input);
  const pointId = sha256Hex(canonicalJson({ race: input.raceId, class: input.sourceClass, status: input.status, observedAt: input.observedAt, valuesSha256, snapshot: input.model.snapshot }));
  const key = `${prefixOf(input.sourceClass)}/${checkKey(input.raceId)}/${compactTime(input.observedAt)}_${pointId.slice(0, 12)}.json`;
  const headKey = headKeyOf(input.sourceClass, input.raceId);
  const head = parseJson(await store.get(headKey)) as ModelHead | null;
  const goodHead = head && intact(head) ? head : null;
  if (goodHead && Date.parse(goodHead.observedAt) <= t && goodHead.valuesSha256 === valuesSha256) {
    if (goodHead.key === key) return { outcome: "ALREADY_RECORDED", pointId, key };
    if (Date.parse(goodHead.lastConfirmedAt) < t) await store.put(headKey, jsonBytes(withChecksum<Omit<ModelHead, "checksum">>({ raceId: goodHead.raceId, valuesSha256: goodHead.valuesSha256, key: goodHead.key, observedAt: goodHead.observedAt, lastConfirmedAt: input.observedAt, snapshot: input.model.snapshot })), "application/json");
    return { outcome: "UNCHANGED", pointId: null, key: goodHead.key };
  }
  const record = withChecksum<Omit<StoredModelOutput, "checksum">>({ ...probe, pointId, type: "MODEL_OUTPUT_RECORD", valuesSha256, recordedAt: input.observedAt });
  const created = await store.putIfAbsent(key, jsonBytes(record), "application/json");
  if (!goodHead || Date.parse(goodHead.observedAt) <= t) {
    await store.put(headKey, jsonBytes(withChecksum<Omit<ModelHead, "checksum">>({ raceId: input.raceId, valuesSha256, key, observedAt: input.observedAt, lastConfirmedAt: input.observedAt, snapshot: input.model.snapshot })), "application/json");
  }
  return { outcome: created === "CREATED" ? "NEW" : "ALREADY_RECORDED", pointId, key };
}

export interface LoadedModelOutputs { points: ModelOutputPoint[]; corrupt: number }

export async function readModelOutputs(store: ObjectStore, raceId: string, opts: { shadow?: boolean } = {}): Promise<LoadedModelOutputs> {
  const keys = await store.list(`${opts.shadow ? "model-shadow" : "model"}/${checkKey(raceId)}/`);
  const out: LoadedModelOutputs = { points: [], corrupt: 0 };
  const read = async (key: string) => {
    const rec = parseJson(await store.get(key)) as StoredModelOutput | null;
    if (!rec || rec.type !== "MODEL_OUTPUT_RECORD" || rec.schema !== HISTORY_SCHEMA || !intact(rec)) { out.corrupt++; return; }
    // the prefix decides the stream: a record filed under model/ that says SHADOW_MODEL (or the reverse) is not trusted
    if ((rec.sourceClass === "SHADOW_MODEL") !== !!opts.shadow) { out.corrupt++; return; }
    const { type: _t, valuesSha256: _v, recordedAt: _r, checksum: _c, ...point } = rec;
    void _t; void _v; void _r; void _c;
    out.points.push(point);
  };
  for (let i = 0; i < keys.length; i += 8) await Promise.all(keys.slice(i, i + 8).map(read));
  return out;
}

// ---- recorder observations as history points -------------------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
export const candidateId = (name: string) => slug(name);

/** "Democratic" → "D". Codes the model already uses pass through; an unknown party keeps what the source said. */
export function partyCode(party: string | null | undefined): string | null {
  const p = (party ?? "").trim();
  if (!p) return null;
  if (/^democrat/i.test(p)) return "D";
  if (/^republican/i.test(p)) return "R";
  if (/^libertarian/i.test(p)) return "L";
  if (/^green/i.test(p)) return "G";
  if (/^independent/i.test(p)) return "I";
  return p;
}

/**
 * Match a feed candidate to the race roster: by full name, else by surname when one roster candidate has it, else by party when
 * D or R is held by exactly one roster candidate. Anything else is a candidate of its own.
 */
export function resolveCandidate(roster: HistoryCandidate[], name: string, party: string): HistoryCandidate {
  const n = norm(name), code = partyCode(party);
  const byName = roster.find((c) => norm(c.name) === n);
  if (byName) return byName;
  const sur = roster.filter((c) => norm(lastName(c.name)) === norm(lastName(name)));
  if (sur.length === 1) return sur[0];
  if (code === "D" || code === "R") {
    const same = roster.filter((c) => c.party === code);
    if (same.length === 1) return same[0];
  }
  return { id: candidateId(name) || "candidate", name, party: code, side: null };
}

const marginRefOf = (roster: HistoryCandidate[]): MarginReference | null => {
  const a = roster.find((c) => c.side === "A"), b = roster.find((c) => c.side === "B");
  return a && b ? { plus: b.id, minus: a.id } : null;
};

const statusOf = (s: ObservationView["testStatus"]): DataStatus => (s === "TEST" ? "TEST" : s === "LIVE" ? "LIVE" : "NOT_PROVIDED");

/** One point per material observation. A re-read of unchanged figures extends `confirmedThrough` instead of adding a point. */
export function resultPointsFrom(views: ObservationView[], roster: HistoryCandidate[]): ResultPoint[] {
  const ref = marginRefOf(roster);
  const out: ResultPoint[] = [];
  let current: ResultPoint | null = null;
  for (const v of views) {
    if (!v.material && current && statusOf(v.testStatus) === current.status) { current.confirmedThrough = v.lastObservedAt; continue; }
    const used: HistoryCandidate[] = [];
    const reportedVotes: Record<string, number> = {};
    for (const c of v.record.candidates) {
      const rc = resolveCandidate(roster, c.name, c.party);
      if (!used.some((u) => u.id === rc.id)) used.push(rc);
      reportedVotes[rc.id] = (reportedVotes[rc.id] ?? 0) + c.votes;
    }
    const total = Object.values(reportedVotes).reduce((a, b) => a + b, 0);
    const countedMargin = ref && total > 0 && ref.plus in reportedVotes && ref.minus in reportedVotes ? { pp: ((reportedVotes[ref.plus] - reportedVotes[ref.minus]) / total) * 100, reference: ref } : null;
    const p: ResultPoint = {
      schema: HISTORY_SCHEMA, kind: "RESULT_OBSERVATION", pointId: v.observationId, raceId: v.raceId, observedAt: v.firstObservedAt, sourceTimestamp: v.sourceTimestamp,
      sourceClass: "RESULT_FEED", status: statusOf(v.testStatus), candidates: used, revision: { status: v.revisionStatus, supersedes: v.correctsObservationId, note: null },
      reporting: { pct: v.reportingPct, definition: v.record.reportingPctBasis === "PROVIDER_UNSPECIFIED" ? "The provider's own reporting percentage. Its basis is not stated." : "Not provided." },
      provider: v.record.provider.name, reportedVotes, countedMargin, totalsDecreased: v.totalsDecreased, outOfOrder: v.outOfOrder,
      confirmedThrough: v.lastObservedAt !== v.firstObservedAt ? v.lastObservedAt : null, provenance: { origin: "capture:obs", ref: v.rawRef },
    };
    out.push(p); current = p;
  }
  return out;
}

// ---- frozen pre-election dataset -------------------------------------------------------------------------------------------

export const FROZEN_FILE = path.join(process.cwd(), "data/intelligence/history/frozen-forecasts.json.gz");
export const FROZEN_MODEL_ID = "onpoint-forecast";

type FrozenPt = [number, number | null, number | null, number | null, number | null, [string, string, number | null][]];
export interface FrozenSnapshotInfo {
  snapshot: string; commit: string; committedAt: string; modelUpdated: string | null; onMain: boolean;
  class: PublicationClass; publishedAt: string | null; deployment: { id: number; sha: string } | null; revertedBy: string | null; reason: string;
}
interface FrozenFile {
  schema: string;
  evidence: { source: string; fetchedAt: string; deployments: number; successful: number; first: string | null; last: string | null };
  snapshots: FrozenSnapshotInfo[];
  publications: { liveAt: string; deploymentId: number; deploymentSha: string; snapshotIndex: number }[];
  races: Record<string, { dem: string | null; gop: string | null; pts: FrozenPt[] }>;
}
let frozenCache: { file: string; data: FrozenFile } | null = null;

export function loadFrozenDataset(file = FROZEN_FILE): FrozenFile {
  if (frozenCache?.file === file) return frozenCache.data;
  const data = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as FrozenFile;
  if (data.schema !== "TPSI_FROZEN_FORECAST_HISTORY/2") throw new HistoryError("BAD_FROZEN_FILE", `unexpected schema ${String(data.schema)}`);
  frozenCache = { file, data };
  return data;
}

export const frozenRaceIds = (file?: string): string[] => Object.keys(loadFrozenDataset(file).races);

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Frozen forecast points for one race, exactly as published: GOP win probability, its two-side complement for the Democratic slot,
 * the published margin (GOP minus Dem) with the published p10–p90, and the published vote estimates. Third-party candidates carry
 * no probability because the model prices only the two sides.
 *
 * PUBLISHED (default): one point per production publication that changed this race's figures, at the time the deployment went
 * live. ALL (diagnostics only): every snapshot at its commit time, each carrying its publication class.
 */
export function frozenPointsFor(raceId: string, file?: string, include: "PUBLISHED" | "ALL" = "PUBLISHED"): ModelOutputPoint[] {
  const d = loadFrozenDataset(file);
  const race = d.races[raceId];
  if (!race) return [];
  const at = (si: number): FrozenPt | null => { let r: FrozenPt | null = null; for (const p of race.pts) { if (p[0] > si) break; r = p; } return r; };
  const events: { pt: FrozenPt; si: number; observedAt: string; publication: Publication; id: string }[] = [];
  if (include === "ALL") {
    for (const pt of race.pts) { const s = d.snapshots[pt[0]]; events.push({ pt, si: pt[0], observedAt: s.committedAt, id: s.commit, publication: { class: s.class, publishedAt: s.publishedAt, evidence: s.reason, revertedBy: s.revertedBy } }); }
  } else {
    let prev = "";
    for (const e of d.publications) {
      const pt = at(e.snapshotIndex);
      if (!pt) continue;
      const k = JSON.stringify(pt.slice(1));
      if (k === prev) continue;
      prev = k;
      const s = d.snapshots[e.snapshotIndex];
      events.push({ pt, si: e.snapshotIndex, observedAt: e.liveAt, id: `deploy:${e.deploymentId}`, publication: { class: "PUBLISHED", publishedAt: e.liveAt, evidence: `production deployment ${e.deploymentId} (${e.deploymentSha.slice(0, 8)}) went live`, revertedBy: s.revertedBy } });
    }
  }
  return events.map(({ pt, si, observedAt, publication, id: evId }) => {
    const [, margin, probGop, p10, p90, cands] = pt;
    const snap = d.snapshots[si];
    const dem = race.dem, gop = race.gop;
    const roster: HistoryCandidate[] = [];
    const add = (name: string, party: string | null) => {
      const id = candidateId(name);
      if (!roster.some((c) => c.id === id)) roster.push({ id, name, party: party || null, side: name === dem ? "A" : name === gop ? "B" : null });
    };
    if (dem) add(dem, cands.find((c) => c[0] === dem)?.[1] ?? null);
    if (gop) add(gop, cands.find((c) => c[0] === gop)?.[1] ?? null);
    for (const c of cands) add(c[0], c[1]);
    const demId = dem ? candidateId(dem) : null, gopId = gop ? candidateId(gop) : null;
    const priced = demId && gopId && probGop !== null;
    const votes: Record<string, number | null> = {};
    for (const c of cands) votes[candidateId(c[0])] = c[2];
    return {
      schema: HISTORY_SCHEMA, kind: "MODEL_OUTPUT", pointId: sha256Hex(`frozen|${raceId}|${evId}`), raceId, observedAt, sourceTimestamp: null,
      sourceClass: "FROZEN_FORECAST", status: "LIVE", candidates: roster, revision: { status: "ORIGINAL", supersedes: null, note: null }, reporting: null,
      model: { id: FROZEN_MODEL_ID, version: "UNVERSIONED", snapshot: snap.snapshot, asOf: snap.modelUpdated }, publication,
      winProbability: priced ? { [gopId]: probGop, [demId]: r6(1 - probGop) } : null, winProbabilityBasis: priced ? "TWO_SIDE" : null,
      margin: margin !== null && demId && gopId ? { pp: margin, reference: { plus: gopId, minus: demId }, low: p10, high: p90, intervalBasis: "p10 to p90 of the model's simulated margins" } : null,
      projectedFinalVotes: cands.length ? votes : null, provenance: { origin: "git:public/forecast/model.json", ref: snap.commit },
    } satisfies ModelOutputPoint;
  });
}

/** Write the frozen dataset into the store, as model outputs. Idempotent. For the day the store is the only source. */
export async function seedFrozenForecasts(store: ObjectStore, raceIds?: string[], file?: string): Promise<{ written: number; unchanged: number }> {
  let written = 0, unchanged = 0;
  for (const id of raceIds ?? frozenRaceIds(file)) {
    for (const p of frozenPointsFor(id, file)) {
      const { schema: _s, pointId: _p, kind: _k, ...input } = p;
      void _s; void _p; void _k;
      const r = await recordModelOutput(store, input);
      if (r.outcome === "NEW") written++; else unchanged++;
    }
  }
  return { written, unchanged };
}

// ---- the reader ---------------------------------------------------------------------------------------------------------------

export interface HistoryLoadOptions extends PrepareOptions {
  /** Add the repository's frozen dataset when the store holds no frozen forecast for the race. Default true. */
  frozenFallback?: boolean;
  frozenFile?: string;
  /** Preview diagnostics only: every frozen snapshot, published or not. A public surface drops unpublished ones regardless. */
  frozenInclude?: "PUBLISHED" | "ALL";
  /** Preview only: read the shadow stream too. Ignored on a public surface. */
  includeShadow?: boolean;
}

export interface LoadedHistory { prepared: PreparedHistory; corrupt: { model: number; observations: number } }

export async function loadRaceHistory(store: ObjectStore, raceId: string, opts: HistoryLoadOptions): Promise<LoadedHistory> {
  if (!SAFE_RACE.test(raceId)) throw new HistoryError("INVALID_RACE_ID", `race id "${raceId.slice(0, 40)}" is not a safe key`);
  const model = await readModelOutputs(store, raceId);
  const shadow = opts.surface === "PREVIEW" && opts.includeShadow ? await readModelOutputs(store, raceId, { shadow: true }) : { points: [], corrupt: 0 };
  const points: HistoryPoint[] = [...model.points, ...shadow.points];
  if (opts.frozenFallback !== false && !model.points.some((p) => p.sourceClass === "FROZEN_FORECAST")) {
    try { points.push(...frozenPointsFor(raceId, opts.frozenFile, opts.surface === "PREVIEW" ? opts.frozenInclude : "PUBLISHED")); } catch (e) { if (!(e instanceof Error) || (e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  }
  const roster: HistoryCandidate[] = [...points].filter((p): p is ModelOutputPoint => p.kind === "MODEL_OUTPUT").sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]?.candidates ?? [];
  const loaded = await readObservationRecords(store, raceId);
  points.push(...resultPointsFrom(foldObservations(loaded), roster));
  return { prepared: prepareHistory(raceId, points, opts), corrupt: { model: model.corrupt + shadow.corrupt, observations: loaded.corrupt } };
}
