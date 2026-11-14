// Serving engine states to the pages. Server only. Every page (national dashboard, Situation Monitor, race pages,
// Calls Desk) reads these same views, so they all show one engine's numbers for one moment.
//
// Sources: "live" (the recorder's live archive, or, without a recorder, the engine run on demand on a fresh civicAPI
// read), and recorded archives for replay: historical/<id> and simulated/<id>. Whether a mode may be served is decided
// here, on the server, by gate.ts: a client cannot ask its way into simulated data.
import fs from "node:fs";
import path from "node:path";
import { resolveStore, type ObjectStore } from "../intelligence/captureStore";
import type { XIndex } from "../../results/2026/live";
import { FIRST_CLOSE } from "../../results/2026/live";
import { fetchCivicRaces } from "./civicFetch";
import { engineApiEnabled, namespaceOf, servable } from "./gate";
import { preElectionFrom } from "./national";
import { evaluate, type StoredState } from "./pipeline";
import { latest, listSources, openArchive, racePoint, readState, sourceMeta, type Archive, type Namespace, type NationalPoint, type RacePoint } from "./recorder";
import { snapshotFromCivic } from "./snapshot";
import type { DataMode } from "./types";

type Env = Record<string, string | undefined>;
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), f), "utf8"));

export type ReplayWindow = { id: string; label: string; from: string; to: string };
export type SourceInfo = { id: string; ns: Namespace | "live-ondemand"; mode: DataMode; label: string; election: string; notes: string[]; times: string[]; gaps: { from: string; to: string; minutes: number }[];
  /** a static replay pack (public/replay): where its files are, and the spans of the night the dock offers */
  base?: string; frames?: number; windows?: ReplayWindow[]; modelVersion?: string;
  /** a static pack keeps a whole state every `keyEvery` frames and deltas between (frameDelta.ts); absent = every frame whole */
  keyEvery?: number };
/** The state a page receives: the stored state with the ledger trimmed to races that have something to report. */
export type View = Omit<StoredState, "ledger"> & { ledger: { config: StoredState["ledger"]["config"]; asOf: string | null; races: StoredState["ledger"]["races"]; events: StoredState["ledger"]["events"]; eventCount: number } ; source: string; live: boolean };

export function viewOf(s: StoredState, source: string, live: boolean): View {
  const races = Object.fromEntries(Object.entries(s.ledger.races).filter(([, r]) => r.status !== "MONITORING" || r.official || r.modelCall || r.alerts).map(([k, r]) => [k, { ...r, lastObsKey: null }]));
  return { ...s, source, live, ledger: { config: s.ledger.config, asOf: s.ledger.asOf, races, events: s.ledger.events.slice(-400), eventCount: s.ledger.events.length } };
}

const GAP_MIN = 30;
const archives = new Map<string, { a: Archive; at: number }>();
const states = new Map<string, StoredState>();
const raceHist = new Map<string, Map<string, RacePoint[]>>();

async function archive(store: ObjectStore, ns: Namespace, id: string, fresh: boolean): Promise<Archive> {
  const k = `${ns}/${id}`, c = archives.get(k);
  if (c && (!fresh || Date.now() - c.at < 30_000)) return c.a;
  const a = await openArchive(store, ns, id); archives.set(k, { a, at: Date.now() }); return a;
}
async function stateOf(store: ObjectStore, a: Archive, i: number): Promise<StoredState> {
  const key = a.manifests[i].layers.state.key; const c = states.get(key); if (c) return c;
  const s = await readState(store, a.manifests[i]); states.set(key, s); if (states.size > 24) states.delete(states.keys().next().value as string); return s;
}
const info = (id: string, ns: Namespace, a: Archive, meta: { label: string; election: string; notes: string[] } | null): SourceInfo => {
  const times = a.manifests.map((m) => m.t); const gaps: SourceInfo["gaps"] = [];
  for (let i = 1; i < times.length; i++) { const m = (a.timesMs[i] - a.timesMs[i - 1]) / 60_000; if (m > GAP_MIN) gaps.push({ from: times[i - 1], to: times[i], minutes: Math.round(m) }); }
  const mode = a.manifests[0]?.mode ?? (ns === "simulated" ? "SIMULATED" : ns === "historical" ? "HISTORICAL" : "LIVE");
  return { id: `${ns}/${id}`, ns, mode, label: meta?.label ?? (ns === "live" ? "Live: civicAPI" : id), election: meta?.election ?? "2026-11-03", notes: meta?.notes ?? [], times, gaps };
};

/** Every source this environment may serve. */
export async function sources(env: Env = process.env): Promise<{ sources: SourceInfo[]; problem: string | null }> {
  const { store, problem } = resolveStore(env); const out: SourceInfo[] = [];
  if (store) for (const ns of ["live", "historical", "simulated"] as Namespace[]) {
    const mode: DataMode = ns === "live" ? "LIVE" : ns === "historical" ? "HISTORICAL" : "SIMULATED";
    if (!servable(mode, env).ok) continue;
    for (const id of await listSources(store, ns)) { const a = await archive(store, ns, id, ns === "live"); if (a.manifests.length) out.push(info(id, ns, a, await sourceMeta(store, ns, id))); }
  }
  if (!out.some((s) => s.ns === "live") && engineApiEnabled(env)) out.unshift({ id: "live", ns: "live-ondemand", mode: "LIVE", label: "Live: civicAPI (computed on request; model calls need the recorder)", election: "2026-11-03", notes: [], times: [], gaps: [] });
  return { sources: out, problem: store ? null : problem };
}

export type Resolved = { ok: true; view: View; info: SourceInfo } | { ok: false; status: number; error: string };
const inflight = new Map<string, Promise<View>>();

/** The state of a source at time `at` (ISO; omitted = the latest). Nothing after `at` is read. */
export async function stateView(sourceId: string, at: string | null, env: Env = process.env): Promise<Resolved> {
  if (sourceId === "live") {
    const { store } = resolveStore(env);
    if (store) { const ids = await listSources(store, "live"); if (ids.length) { const r = await latest(store, "live", ids[0]); if (r) { const a = await archive(store, "live", ids[0], true); return { ok: true, view: viewOf(r.state, `live/${ids[0]}`, true), info: info(ids[0], "live", a, await sourceMeta(store, "live", ids[0])) }; } } }
    if (!engineApiEnabled(env)) return { ok: false, status: 404, error: "The live engine is switched off (ONPOINT_ENGINE_API)." };
    const t = new Date().toISOString(); const { raws, failed } = await fetchCivicRaces();
    if (!raws.length) return { ok: false, status: 502, error: "civicAPI unreachable" };
    const index = read("public/results/2026/index.json") as XIndex;
    const snapshot = snapshotFromCivic(index, raws, { receivedAt: t, mode: "LIVE", source: "civicAPI race search", blankTest: Date.now() < FIRST_CLOSE });
    // one computation per snapshot, however many requests arrive while it runs
    let job = inflight.get(snapshot.snapshotId);
    if (!job) {
      job = Promise.resolve().then(() => viewOf(evaluate({ index, pre: preElectionFrom(read("public/forecast/archive/final-2026-11-03/model.json")), snapshot, ledger: null, t, stale: failed.length > 0 }), "live", true));
      inflight.set(snapshot.snapshotId, job); if (inflight.size > 4) inflight.delete(inflight.keys().next().value as string);
    }
    const v = await job;
    return { ok: true, view: v, info: { id: "live", ns: "live-ondemand", mode: "LIVE", label: "Live: civicAPI", election: "2026-11-03", notes: ["Computed on request: the model-call ledger needs the recorder to carry from one update to the next."], times: [v.t], gaps: [] } };
  }
  const m = sourceId.match(/^(historical|simulated|live)\/([A-Za-z0-9._-]+)$/); if (!m) return { ok: false, status: 400, error: "unknown source" };
  const ns = m[1] as Namespace, id = m[2]; const mode: DataMode = ns === "live" ? "LIVE" : ns === "historical" ? "HISTORICAL" : "SIMULATED";
  const g = servable(mode, env); if (!g.ok) return { ok: false, status: g.status, error: g.reason };
  const { store, problem } = resolveStore(env); if (!store) return { ok: false, status: 503, error: problem ?? "no store" };
  const a = await archive(store, ns, id, ns === "live"); if (!a.manifests.length) return { ok: false, status: 404, error: "no such source" };
  if (namespaceOf(a.manifests[0].mode) !== ns) return { ok: false, status: 500, error: "archive namespace mismatch" };
  const tMs = at ? Date.parse(at) : Infinity; if (at && !Number.isFinite(tMs)) return { ok: false, status: 400, error: "bad time" };
  let i = -1; for (let j = 0; j < a.timesMs.length && a.timesMs[j] <= tMs; j++) i = j;
  const inf = info(id, ns, a, await sourceMeta(store, ns, id));
  if (i < 0) return { ok: false, status: 404, error: "before the first observation" };
  return { ok: true, view: viewOf(await stateOf(store, a, i), `${ns}/${id}`, false), info: inf };
}

/** History for charts, cut at `at` on the server: national points, or one race's points. */
export async function history(sourceId: string, at: string | null, raceId: string | null, env: Env = process.env): Promise<{ ok: true; points: NationalPoint[] | RacePoint[] } | { ok: false; status: number; error: string }> {
  if (sourceId === "live") {
    const { store } = resolveStore(env); const ids = store ? await listSources(store, "live") : [];
    if (!store || !ids.length) return { ok: true, points: [] };
    sourceId = `live/${ids[0]}`;
  }
  const m = sourceId.match(/^(historical|simulated|live)\/([A-Za-z0-9._-]+)$/); if (!m) return { ok: false, status: 400, error: "unknown source" };
  const ns = m[1] as Namespace, id = m[2]; const mode: DataMode = ns === "live" ? "LIVE" : ns === "historical" ? "HISTORICAL" : "SIMULATED";
  const g = servable(mode, env); if (!g.ok) return { ok: false, status: g.status, error: g.reason };
  const { store, problem } = resolveStore(env); if (!store) return { ok: false, status: 503, error: problem ?? "no store" };
  const a = await archive(store, ns, id, ns === "live"); const tMs = at ? Date.parse(at) : Infinity;
  const n = a.timesMs.filter((t) => t <= tMs).length;
  if (!raceId) return { ok: true, points: a.manifests.slice(0, n).map((x) => x.np) };
  const k = `${ns}/${id}`; let byRace = raceHist.get(k);
  if (!byRace || (byRace.get("__n")?.length ?? 0) !== a.manifests.length) {
    byRace = new Map(); for (let i = 0; i < a.manifests.length; i++) { const s = await stateOf(store, a, i); for (const rid of Object.keys(s.races)) { const p = racePoint(s, rid); if (p) { const arr = byRace.get(rid) ?? []; arr.push(p); byRace.set(rid, arr); } } }
    byRace.set("__n", new Array(a.manifests.length)); raceHist.set(k, byRace);
  }
  return { ok: true, points: (byRace.get(raceId) ?? []).filter((p) => Date.parse(p.t) <= tMs) };
}
