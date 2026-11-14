// The engine's flight recorder. Server only. It writes through the site's existing ObjectStore (Postgres, GitHub,
// Blob, or a directory), so durability is whatever store the operator configured; this code never assumes a disk.
//
// For each new observation it stores four immutable layers and a manifest that ties them together:
//   raw/        what the provider (or the replay source) handed over, byte for byte as received
//   snapshot/   the canonical observation the engine actually read
//   state/      everything the engine computed from it: national forecast, every race, the model-call ledger
//   published/  the summary a public page would show from that state
//   manifest/   time, mode, model version, the key and SHA-256 of each layer, and the SHA-256 of the previous
//               manifest, so a missing or altered frame breaks the chain visibly
// A poll that finds nothing new writes only a small beat/ object: proof the slot ran. Objects are write-once
// (putIfAbsent); running the same frame twice changes nothing. Namespaces keep the modes apart, and simulated data is
// refused everywhere but its own.
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type { ObjectStore } from "../intelligence/captureStore";
import { MODEL_VERSION } from "./config";
import { namespaceOf } from "./gate";
import { evaluate, type EvaluateInput, type StoredState } from "./pipeline";
import { canonicalJson } from "./rng";
import type { DataMode, ElectionSnapshot } from "./types";

export type Namespace = "live" | "historical" | "simulated";
export type LayerRef = { key: string; sha256: string; bytes: number };
export type Manifest = {
  v: 1; ns: Namespace; mode: DataMode; t: string; receivedAt: string; sourceAsOf: string | null; modelVersion: string; snapshotId: string; stateId: string;
  synthetic: boolean; usesFutureObservation: boolean;
  layers: { raw: LayerRef | null; snapshot: LayerRef; state: LayerRef; published: LayerRef };
  prev: string | null;            // sha256 of the previous manifest's bytes
  failures: string[];
  /** the national chart point for this frame, so a history needs only the manifests */
  np: NationalPoint;
};
export class RecorderError extends Error { readonly code: string; constructor(code: string, m: string) { super(m); this.code = code; } }

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const stamp = (iso: string) => { const d = new Date(iso); if (Number.isNaN(d.getTime())) throw new RecorderError("BAD_TIME", `"${iso}" is not a time`); return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); };
const root = (ns: Namespace, source: string) => `engine/v1/${ns}/${source}`;
const safeId = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 60) || "default";
const gz = (v: unknown) => gzipSync(Buffer.from(canonicalJson(v), "utf8"), { level: 6 });
export const readGz = <T>(b: Buffer): T => JSON.parse(gunzipSync(b).toString("utf8")) as T;

/** Simulated data may be written only to the simulated namespace; authentic namespaces refuse anything synthetic. */
export function checkNamespace(ns: Namespace, snap: ElectionSnapshot): void {
  const want = namespaceOf(snap.provenance.mode);
  if (ns !== want) throw new RecorderError("WRONG_NAMESPACE", `${snap.provenance.mode} data cannot be written to the ${ns} archive`);
  if (ns !== "simulated" && (snap.provenance.synthetic || snap.provenance.usesFutureObservation)) throw new RecorderError("SYNTHETIC_REFUSED", `synthetic or interpolated observations cannot be written to the ${ns} archive`);
}

/** What a public page would show from a state: display values only (capped probabilities, called and projected seats). */
export function publishedView(s: StoredState) {
  const ch = (c: StoredState["national"]["senate"]) => ({ called: c.called, leading: c.leading, notUp: c.notUp, projected: { D: c.seats.D, R: c.seats.R, other: c.seats.other }, control: c.display, pD: c.pD, pR: c.pR, pUnresolved: c.pUnresolved });
  const called = Object.values(s.ledger.races);
  return { t: s.t, mode: s.mode, modelVersion: s.modelVersion, snapshotId: s.snapshotId, calibration: s.national.calibration, senate: ch(s.national.senate), house: ch(s.national.house), governors: ch(s.national.governors), houseVote: s.national.houseVote,
    calls: { official: called.filter((x) => x.official).length, model: called.filter((x) => x.modelCall).length, firstQualified: called.filter((x) => x.status === "FIRST_QUALIFIED").length } };
}

export type RecordResult = { status: "RECORDED" | "UNCHANGED" | "EXISTS"; manifestKey: string | null; state: StoredState };

/**
 * Evaluate one frame and store it. `source` names the stream within the namespace (e.g. "civicapi", a replay id).
 * The previous state is read from the store, so a serverless function with no memory continues the same ledger.
 */
export async function recordFrame(store: ObjectStore, source: string, inp: Omit<EvaluateInput, "ledger"> & { raw?: Buffer | null; failures?: string[] }): Promise<RecordResult> {
  const snap = inp.snapshot, ns = namespaceOf(snap.provenance.mode), base = root(ns, safeId(source)), ts = stamp(inp.t);
  checkNamespace(ns, snap);
  const last = await latest(store, ns, source);
  if (last && Date.parse(inp.t) <= Date.parse(last.manifest.t)) {
    // an out-of-order or repeated frame never rewrites history
    if (inp.t === last.manifest.t && last.manifest.snapshotId === snap.snapshotId) return { status: "EXISTS", manifestKey: last.key, state: last.state };
    throw new RecorderError("OUT_OF_ORDER", `frame at ${inp.t} is not after the latest recorded frame (${last.manifest.t})`);
  }
  if (last && last.manifest.snapshotId === snap.snapshotId && last.manifest.modelVersion === MODEL_VERSION) {
    await store.putIfAbsent(`${base}/beat/${ts}.json`, Buffer.from(JSON.stringify({ t: inp.t, snapshotId: snap.snapshotId, unchanged: true, failures: inp.failures ?? [] })), "application/json");
    return { status: "UNCHANGED", manifestKey: last.key, state: last.state };
  }
  const state = evaluate({ ...inp, ledger: last?.state.ledger ?? null });
  const put = async (layer: string, id: string, body: Buffer): Promise<LayerRef> => { const key = `${base}/${layer}/${ts}-${safeId(id)}.json.gz`; await store.putIfAbsent(key, body, "application/gzip"); return { key, sha256: sha(body), bytes: body.length }; };
  const rawRef = inp.raw ? await put("raw", sha(inp.raw).slice(0, 16), inp.raw) : null;
  const layers = { raw: rawRef, snapshot: await put("snapshot", snap.snapshotId, gz(snap)), state: await put("state", state.stateId, gz(state)), published: await put("published", state.stateId, gz(publishedView(state))) };
  const manifest: Manifest = { v: 1, ns, mode: snap.provenance.mode, t: inp.t, receivedAt: snap.provenance.receivedAt, sourceAsOf: snap.provenance.sourceAsOf, modelVersion: MODEL_VERSION, snapshotId: snap.snapshotId, stateId: state.stateId,
    synthetic: snap.provenance.synthetic, usesFutureObservation: snap.provenance.usesFutureObservation, layers, prev: last ? sha(last.bytes) : null, failures: inp.failures ?? [], np: nationalPoint(state, last?.manifest.t ?? null) };
  const mKey = `${base}/manifest/${ts}.json`; const made = await store.putIfAbsent(mKey, Buffer.from(canonicalJson(manifest)), "application/json");
  if (made === "EXISTS") throw new RecorderError("SLOT_TAKEN", `a different frame is already recorded at ${inp.t}`);
  if (store.commit) await store.commit(`engine ${ns}/${source} ${ts}`);
  return { status: "RECORDED", manifestKey: mKey, state };
}

/** A source's label and notes for the replay picker. Written once. */
export async function describeSource(store: ObjectStore, ns: Namespace, source: string, meta: { label: string; election: string; notes: string[] }) {
  await store.putIfAbsent(`${root(ns, safeId(source))}/meta.json`, Buffer.from(JSON.stringify(meta)), "application/json");
}
export async function sourceMeta(store: ObjectStore, ns: Namespace, source: string): Promise<{ label: string; election: string; notes: string[] } | null> {
  const b = await store.get(`${root(ns, safeId(source))}/meta.json`); return b ? JSON.parse(b.toString("utf8")) : null;
}
/** Source ids recorded in a namespace (those with at least one manifest). */
export async function listSources(store: ObjectStore, ns: Namespace): Promise<string[]> {
  const keys = await store.list(`engine/v1/${ns}/`); const ids = new Set<string>();
  for (const k of keys) { const m = k.match(/^engine\/v1\/[a-z]+\/([^/]+)\/manifest\//); if (m) ids.add(m[1]); }
  return [...ids].sort();
}
export const readState = (store: ObjectStore, m: Manifest) => readLayer<StoredState>(store, m.layers.state);

export async function listManifests(store: ObjectStore, ns: Namespace, source: string): Promise<string[]> { return (await store.list(`${root(ns, safeId(source))}/manifest/`)).sort(); }
async function readManifest(store: ObjectStore, key: string) { const bytes = await store.get(key); if (!bytes) throw new RecorderError("MISSING", `${key} is missing`); return { key, bytes, manifest: JSON.parse(bytes.toString("utf8")) as Manifest }; }
async function readLayer<T>(store: ObjectStore, ref: LayerRef): Promise<T> {
  const b = await store.get(ref.key); if (!b) throw new RecorderError("MISSING", `${ref.key} is missing`);
  if (sha(b) !== ref.sha256) throw new RecorderError("CHECKSUM", `${ref.key} does not match its recorded SHA-256`);
  return readGz<T>(b);
}
export async function latest(store: ObjectStore, ns: Namespace, source: string) {
  const keys = await listManifests(store, ns, source); if (!keys.length) return null;
  const m = await readManifest(store, keys[keys.length - 1]);
  return { ...m, state: await readLayer<StoredState>(store, m.manifest.layers.state) };
}

export type Archive = { ns: Namespace; source: string; manifests: Manifest[]; timesMs: number[] };
/** Every frame's manifest, in time order, with the hash chain checked. */
export async function openArchive(store: ObjectStore, ns: Namespace, source: string): Promise<Archive & { problems: string[] }> {
  const keys = await listManifests(store, ns, source); const manifests: Manifest[] = []; const problems: string[] = []; let prev: string | null = null;
  for (const k of keys) {
    const m = await readManifest(store, k);
    if (m.manifest.prev !== prev) problems.push(`${k}: the chain is broken (a frame before it is missing or was altered)`);
    if (m.manifest.ns !== ns) problems.push(`${k}: written for the ${m.manifest.ns} archive`);
    manifests.push(m.manifest); prev = sha(m.bytes);
  }
  return { ns, source, manifests, timesMs: manifests.map((m) => Date.parse(m.t)), problems };
}
/** The stored state in force at time tMs: the latest frame at or before it. Nothing later is read. */
export async function stateAt(store: ObjectStore, a: Archive, tMs: number): Promise<StoredState | null> {
  let i = -1; for (let j = 0; j < a.timesMs.length; j++) { if (a.timesMs[j] <= tMs) i = j; else break; }
  return i < 0 ? null : readLayer<StoredState>(store, a.manifests[i].layers.state);
}
export const snapshotOf = (store: ObjectStore, m: Manifest) => readLayer<ElectionSnapshot>(store, m.layers.snapshot);

/**
 * Proof the archive replays: every layer matches its checksum, and re-running the engine on each stored snapshot,
 * with the ledger carried forward from the start, reproduces each stored state id exactly.
 */
export async function verifyArchive(store: ObjectStore, a: Archive, ctx: Pick<EvaluateInput, "index" | "pre" | "callConfig" | "cfg" | "baselines" | "priors">): Promise<{ frames: number; ok: number; problems: string[] }> {
  const problems: string[] = []; let ok = 0; let ledger: StoredState["ledger"] | null = null;
  for (const m of a.manifests) {
    try {
      const snap = await snapshotOf(store, m); const stored = await readLayer<StoredState>(store, m.layers.state); await readLayer(store, m.layers.published);
      if (m.layers.raw) { const b = await store.get(m.layers.raw.key); if (!b || sha(b) !== m.layers.raw.sha256) throw new RecorderError("CHECKSUM", `${m.layers.raw.key} does not match its recorded SHA-256`); }
      if (m.modelVersion !== MODEL_VERSION) { problems.push(`${m.t}: recorded by ${m.modelVersion}; this is ${MODEL_VERSION}, so it is not recomputed`); ledger = stored.ledger; continue; }
      const again = evaluate({ ...ctx, snapshot: snap, ledger, t: m.t });
      if (again.stateId !== m.stateId) problems.push(`${m.t}: recomputing gives state ${again.stateId}, the archive has ${m.stateId}`); else ok++;
      ledger = again.ledger;
    } catch (e) { problems.push(`${m.t}: ${(e as Error).message}`); }
  }
  return { frames: a.manifests.length, ok, problems };
}

// ---- history for the charts ---------------------------------------------------------------------------------------
export type NationalPoint = {
  t: string; snapshotId: string;
  sen: { pD: number; pR: number; shown: number; leader: "D" | "R"; d: [number, number, number]; r: [number, number, number]; calledD: number; calledR: number };
  house: NationalPoint["sen"]; gov: NationalPoint["sen"];
  /** House popular vote, R minus D points: observed (null with no votes), projected mean and 80% range; votes counted */
  hpv: { obs: number | null; proj: [number, number, number]; counted: number; outstanding: number };
  calls: { official: number; model: number };
  /** minutes since the previous observation: charts mark long gaps instead of drawing through them */
  gapMin: number | null;
};
export type RacePoint = {
  t: string; counted: number; providerPct: number | null; probability: number | null; leaderId: string | null;
  /** projected top two (by candidate) and their margin, points: [80% low, mean, 80% high] */
  margin: [number, number, number] | null; top2: [string, string] | null;
  reportedMargin: number | null;
  /** REPORTED votes by candidate (null = not reported) */
  votes: Record<string, number | null>;
  /** MODELED, by candidate: win probability and projected share of the final vote */
  probs: Record<string, number | null>; shares: Record<string, number>;
  names: Record<string, [string, string | null]>;
  status: string | null; expectedFinal: number | null;
};

const cp = (c: StoredState["national"]["senate"]): NationalPoint["sen"] => ({ pD: c.pD, pR: c.pR, shown: c.display.probability, leader: c.display.leader, d: [c.seats.D.i80.lo, c.seats.D.mean, c.seats.D.i80.hi], r: [c.seats.R.i80.lo, c.seats.R.mean, c.seats.R.i80.hi], calledD: c.called.D, calledR: c.called.R });
export function nationalPoint(s: StoredState, prevT: string | null): NationalPoint {
  const h = s.national.houseVote; const l = Object.values(s.ledger.races);
  return { t: s.t, snapshotId: s.snapshotId, sen: cp(s.national.senate), house: cp(s.national.house), gov: cp(s.national.governors),
    hpv: { obs: h.observed.marginPp, proj: [h.projected.marginPp.i80.lo, h.projected.marginPp.mean, h.projected.marginPp.i80.hi], counted: h.observed.total, outstanding: h.projected.outstanding.mean },
    calls: { official: l.filter((x) => x.official).length, model: l.filter((x) => x.modelCall).length }, gapMin: prevT ? (Date.parse(s.t) - Date.parse(prevT)) / 60_000 : null };
}
export function racePoint(s: StoredState, raceId: string): RacePoint | null {
  const r = s.races[raceId]; if (!r) return null;
  return { t: s.t, counted: r.counted, providerPct: r.providerPct, probability: r.shown, leaderId: r.leaderId, margin: r.top2 ? [r.top2.lo, r.top2.mean, r.top2.hi] : null, top2: r.top2 ? [r.top2.a, r.top2.b] : null, reportedMargin: r.pm?.rep ?? null,
    votes: Object.fromEntries(r.c.map((c) => [c[0], c[3]])), probs: Object.fromEntries(r.c.map((c) => [c[0], c[6]])), shares: Object.fromEntries(r.c.map((c) => [c[0], c[5]])), names: Object.fromEntries(r.c.map((c) => [c[0], [c[1], c[2]]])),
    status: s.ledger.races[raceId]?.status ?? null, expectedFinal: r.expectedFinal };
}
/** The whole night for the national charts, up to and including time `untilMs` (everything when omitted). */
export async function nationalHistory(_store: ObjectStore, a: Archive, untilMs = Infinity): Promise<NationalPoint[]> {
  const out: NationalPoint[] = [];
  for (let i = 0; i < a.manifests.length && a.timesMs[i] <= untilMs; i++) out.push(a.manifests[i].np);
  return out;
}
export async function raceHistory(store: ObjectStore, a: Archive, raceId: string, untilMs = Infinity): Promise<RacePoint[]> {
  const out: RacePoint[] = [];
  for (let i = 0; i < a.manifests.length && a.timesMs[i] <= untilMs; i++) { const p = racePoint(await readLayer<StoredState>(store, a.manifests[i].layers.state), raceId); if (p) out.push(p); }
  return out;
}

// ---- health -------------------------------------------------------------------------------------------------------
/** Did the recorder run when it should have? A slot is covered by a recorded frame or a beat. Durable storage only counts. */
export async function recorderHealth(store: ObjectStore, ns: Namespace, source: string, o: { fromMs: number; toMs: number; everyMs: number }) {
  const base = root(ns, safeId(source));
  const ts = (k: string) => { const m = k.match(/(\d{8})T(\d{6})Z/); return m ? Date.parse(`${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6)}T${m[2].slice(0, 2)}:${m[2].slice(2, 4)}:${m[2].slice(4)}Z`) : NaN; };
  const frames = (await store.list(`${base}/manifest/`)).map(ts), beats = (await store.list(`${base}/beat/`)).map(ts);
  const all = [...frames, ...beats].filter(Number.isFinite).sort((x, y) => x - y);
  const missing: string[] = []; let covered = 0, expected = 0;
  for (let t = o.fromMs; t < o.toMs; t += o.everyMs) { expected++; if (all.some((x) => x >= t && x < t + o.everyMs)) covered++; else missing.push(new Date(t).toISOString()); }
  return { durable: store.durable, store: store.kind, frames: frames.length, beats: beats.length, expectedSlots: expected, coveredSlots: covered, missingSlots: missing, healthy: store.durable && expected > 0 && covered === expected, lastAt: all.length ? new Date(all[all.length - 1]).toISOString() : null };
}
