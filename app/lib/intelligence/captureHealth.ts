// Recorder health: whether capture is working, and whether "working" means data is arriving. Pure over its inputs.
// A recorder that runs on schedule but sees nothing new is a different condition from one that has stopped, and the
// two are never reported as the same status.

import type { ObjectStore } from "./captureStore";
import { intact, parseJson, readRaceHead, type RaceHead } from "./capture";
import { readTick, type RunRecord, type TickHead } from "./captureRunner";
import { planTick, staleAfterMinutes, type Phase, type Window } from "./captureSchedule";

export type RecorderStatus = "NOT_CONFIGURED" | "STORAGE_ERROR" | "NEVER_RAN" | "SCHEDULER_SILENT" | "INTERRUPTED" | "RUNNING_NO_NEW_DATA" | "DEGRADED" | "HEALTHY" | "ENDED";

export interface ExpectedRace { raceId: string; state: string; expectedJurisdictions: number | null }

export interface HealthInputs {
  now: string;
  configured: boolean;
  problem: string | null;
  storage: { kind: string; durable: boolean; ok: boolean; error: string | null };
  tick: TickHead | null;
  /** Recent run records, oldest first. */
  runs: RunRecord[];
  heads: (RaceHead | null)[];
  expected: ExpectedRace[];
  windows: Window[];
}

export interface Alert { level: "CRITICAL" | "WARNING" | "INFO"; message: string }

export interface RaceHealth {
  raceId: string;
  state: string;
  observed: boolean;
  testStatus: string | null;
  observations: number;
  materialUpdates: number;
  withSourceTimestamp: number;
  lastSourceTimestamp: string | null;
  lastObservedAt: string | null;
  lastMaterialAt: string | null;
  jurisdictionsObserved: number;
  jurisdictionsExpected: number | null;
  jurisdictionsMissing: number | null;
  replay: "NO_DATA" | "TEST_ONLY" | "INSUFFICIENT" | "AVAILABLE";
}

export interface Health {
  status: RecorderStatus;
  phase: Phase | null;
  intervalMinutes: number | null;
  alerts: Alert[];
  lastAttemptAt: string | null;
  lastSuccessfulCaptureAt: string | null;
  lastSourceUpdateAt: string | null;
  lastMaterialUpdateAt: string | null;
  minutesSinceSuccess: number | null;
  observations: number;
  uniqueMaterialUpdates: number;
  /** Observed races, tracked races, and how many have source timestamps on every observation. */
  coverage: { tracked: number; observed: number; withEverySourceTimestamp: number; sourceTimestampShare: number | null };
  storage: HealthInputs["storage"];
  provider: { requests: number; ok: number; lastStatus: number | null; medianMs: number | null; consecutiveFailedRuns: number };
  recentErrors: { at: string; scope: string; code: string; message: string }[];
  races: RaceHealth[];
  missingJurisdictions: number;
  replay: { available: number; testOnly: number; noData: number; note: string };
}

const ms = (s: string | null) => (s ? Date.parse(s) : NaN);
const minutes = (a: string, b: string) => (Date.parse(a) - Date.parse(b)) / 60000;
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

/** How long, in the busy phases, with no material update anywhere before the recorder is called quiet. */
const QUIET_MINUTES: Partial<Record<Phase, number>> = { ELECTION_NIGHT: 20, OVERNIGHT: 60, COUNTING: 180 };

export function computeHealth(i: HealthInputs): Health {
  const heads = i.heads.filter((h): h is RaceHead => h !== null);
  const races: RaceHealth[] = i.expected.map((e, k) => {
    const h = i.heads[k];
    const observedCounties = h ? Math.max(0, h.jurisdictionCount - 1) : 0;
    return {
      raceId: e.raceId, state: e.state, observed: !!h, testStatus: h?.testStatus ?? null, observations: h?.events ?? 0, materialUpdates: h?.materialEvents ?? 0, withSourceTimestamp: h?.withSourceTimestamp ?? 0,
      lastSourceTimestamp: h?.sourceTimestamp ?? null, lastObservedAt: h?.firstObservedAt ?? null, lastMaterialAt: h?.lastMaterialAt ?? null,
      jurisdictionsObserved: observedCounties, jurisdictionsExpected: e.expectedJurisdictions,
      jurisdictionsMissing: h && e.expectedJurisdictions !== null ? Math.max(0, e.expectedJurisdictions - observedCounties) : null,
      replay: !h ? "NO_DATA" : h.testStatus === "TEST" ? "TEST_ONLY" : h.events < 2 || h.withSourceTimestamp < 2 ? "INSUFFICIENT" : "AVAILABLE",
    };
  });

  const lastRun = i.runs[i.runs.length - 1] ?? null;
  const plan = planTick(i.now, { lastPollAt: i.tick?.lastPollAt ?? null, quietPolls: i.tick?.quietPolls ?? 0 }, i.windows);
  const interval = i.tick?.intervalMinutes ?? plan.intervalMinutes;
  const phase = i.tick?.phase ?? plan.phase;
  const lastMaterial = heads.reduce<string | null>((m, h) => (h.lastMaterialAt && (m === null || ms(h.lastMaterialAt) > ms(m)) ? h.lastMaterialAt : m), null);
  const lastSource = heads.reduce<string | null>((m, h) => (h.sourceTimestamp && (m === null || ms(h.sourceTimestamp) > ms(m)) ? h.sourceTimestamp : m), null);
  const sinceSuccess = i.tick?.lastOkPollAt ? minutes(i.now, i.tick.lastOkPollAt) : null;
  const alerts: Alert[] = [];
  let status: RecorderStatus;

  if (!i.configured) { status = "NOT_CONFIGURED"; alerts.push({ level: "CRITICAL", message: `Capture is not configured: ${i.problem ?? "no store"}` }); }
  else if (!i.storage.ok) { status = "STORAGE_ERROR"; alerts.push({ level: "CRITICAL", message: `The capture store cannot be read: ${i.storage.error ?? "unknown error"}` }); }
  else if (!i.tick) { status = "NEVER_RAN"; alerts.push({ level: "WARNING", message: "The recorder has never run. Nothing has been captured." }); }
  else if (phase === "ENDED") status = "ENDED";
  else if (minutes(i.now, i.tick.at) > 3) { status = "SCHEDULER_SILENT"; alerts.push({ level: "CRITICAL", message: `The scheduler has not called the recorder for ${Math.round(minutes(i.now, i.tick.at))} minutes. Capture is interrupted.` }); }
  else if (sinceSuccess === null || sinceSuccess > staleAfterMinutes(interval)) { status = "INTERRUPTED"; alerts.push({ level: "CRITICAL", message: sinceSuccess === null ? "No poll has succeeded yet." : `No poll has succeeded for ${Math.round(sinceSuccess)} minutes. Capture is interrupted.` }); }
  else {
    const quietLimit = QUIET_MINUTES[phase];
    const sinceMaterial = lastMaterial ? minutes(i.now, lastMaterial) : null;
    if (quietLimit !== undefined && (sinceMaterial === null || sinceMaterial > quietLimit)) {
      status = "RUNNING_NO_NEW_DATA";
      alerts.push({ level: "WARNING", message: sinceMaterial === null ? "The recorder is polling successfully but has recorded no results yet." : `The recorder is polling successfully but no race has changed for ${Math.round(sinceMaterial)} minutes. That can mean the provider is stalled.` });
    } else if (lastRun && lastRun.errors.length) {
      status = "DEGRADED"; alerts.push({ level: "WARNING", message: `${lastRun.errors.length} error(s) in the last poll.` });
    } else status = "HEALTHY";
  }
  if (i.configured && !i.storage.durable) alerts.push({ level: "CRITICAL", message: `The ${i.storage.kind} store is not durable here. Records will be lost on restart or redeploy.` });
  if (i.tick && i.tick.consecutiveFailures >= 3) alerts.push({ level: "CRITICAL", message: `${i.tick.consecutiveFailures} polls in a row have failed.` });
  if (lastRun?.deadlineHit) alerts.push({ level: "WARNING", message: "The last poll ran out of time before reading every race." });
  const testOnly = heads.length > 0 && heads.every((h) => h.testStatus === "TEST");
  if (testOnly) alerts.push({ level: "INFO", message: "Every captured race is marked test data by the provider. This is not a live election-night capture." });

  const recentErrors = i.runs.flatMap((r) => r.errors.map((e) => ({ at: r.startedAt, ...e }))).slice(-15).reverse();
  const reqs = i.runs.slice(-5).flatMap((r) => r.provider);
  const observations = heads.reduce((n, h) => n + h.events, 0);
  const stamped = heads.reduce((n, h) => n + h.withSourceTimestamp, 0);
  const missing = races.reduce((n, r) => n + (r.jurisdictionsMissing ?? 0), 0);
  const replayAvail = races.filter((r) => r.replay === "AVAILABLE").length;
  return {
    status, phase, intervalMinutes: interval, alerts, lastAttemptAt: i.tick?.lastPollAt ?? null, lastSuccessfulCaptureAt: i.tick?.lastOkPollAt ?? null, lastSourceUpdateAt: lastSource, lastMaterialUpdateAt: lastMaterial,
    minutesSinceSuccess: sinceSuccess, observations, uniqueMaterialUpdates: heads.reduce((n, h) => n + h.materialEvents, 0),
    coverage: { tracked: i.expected.length, observed: heads.length, withEverySourceTimestamp: heads.filter((h) => h.events > 0 && h.withSourceTimestamp === h.events).length, sourceTimestampShare: observations ? stamped / observations : null },
    storage: i.storage,
    provider: { requests: reqs.length, ok: reqs.filter((r) => r.status === 200).length, lastStatus: lastRun?.provider[lastRun.provider.length - 1]?.status ?? null, medianMs: median(reqs.map((r) => r.ms).filter((x): x is number => x !== null)), consecutiveFailedRuns: i.tick?.consecutiveFailures ?? 0 },
    recentErrors, races, missingJurisdictions: missing,
    replay: { available: replayAvail, testOnly: races.filter((r) => r.replay === "TEST_ONLY").length, noData: races.filter((r) => r.replay === "NO_DATA").length, note: "A backtest also needs a certified result for the race; none is loaded." },
  };
}

// ---- reading the inputs --------------------------------------------------------------------------------------------------

const dayBefore = (iso: string) => new Date(Date.parse(iso) - 86_400_000).toISOString().slice(0, 10);

export async function readHealthInputs(store: ObjectStore | null, problem: string | null, now: string, expected: ExpectedRace[], windows: Window[], recentRuns = 60): Promise<HealthInputs> {
  if (!store) return { now, configured: false, problem, storage: { kind: "none", durable: false, ok: false, error: null }, tick: null, runs: [], heads: expected.map(() => null), expected, windows };
  try {
    const tick = await readTick(store);
    const keys = [...(await store.list(`runs/${dayBefore(now)}/`)), ...(await store.list(`runs/${now.slice(0, 10)}/`))].slice(-recentRuns);
    const runs: RunRecord[] = [];
    for (const k of keys) { const r = parseJson(await store.get(k)) as RunRecord | null; if (r && r.type === "RUN" && intact(r)) runs.push(r); }
    const heads = await Promise.all(expected.map((e) => readRaceHead(store, e.raceId)));
    return { now, configured: true, problem: null, storage: { kind: store.kind, durable: store.durable, ok: true, error: null }, tick, runs, heads, expected, windows };
  } catch (e) {
    return { now, configured: true, problem: null, storage: { kind: store.kind, durable: store.durable, ok: false, error: (e as { code?: string })?.code ?? "read failed" }, tick: null, runs: [], heads: expected.map(() => null), expected, windows };
  }
}
