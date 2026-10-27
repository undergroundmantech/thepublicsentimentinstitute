// One poll of the provider, and the bookkeeping around it. Pure over its dependencies, so tests drive it with a fake
// provider, a fake clock and an in-memory store.
//
// A poll reads each whole-feed response once (the broad capture), matches the forecast's tracked races to civicAPI race
// ids from those same feeds, then reads each matched race's detail (county results, the source's own timestamp and its
// test flag). The feed is therefore never requested twice for the tracked races.

import { randomBytes } from "node:crypto";
import type { XRace } from "@/app/results/2026/live";
import { matchCivic } from "@/app/results/2026/live";
import { fromCivicDetail } from "./observations";
import { searchRows, trimDetail } from "./civic";
import {
  CaptureError, compactTime, intact, jsonBytes, parseJson, recordFeedDelta, recordObservation, sha256Hex, storeRaw, withChecksum,
  type CandidateLine, type CapturedObservation, type FeedRow, type RecordOutcome,
} from "./capture";
import { archiveCheckpoint, type ArchiveDeps, type RaceCapture } from "./checkpointArchive";
import type { ObjectStore } from "./captureStore";
import { planTick, type Phase, type TickPlan, type TickState, type Window } from "./captureSchedule";

export const CIVIC_BASE = "https://civicapi.org/api/v2";
export const PROVIDER = "civicAPI";
const MAX_BODY_BYTES = 8 * 1024 * 1024;

export interface FetchResult { status: number; text: string; ms: number; age: number | null }
export type FetchText = (url: string, opts: { timeoutMs: number }) => Promise<FetchResult>;

/** Plain fetch with a timeout and a body cap. The URL is the only thing sent; no credentials exist for this provider. */
export const defaultFetchText: FetchText = async (url, { timeoutMs }) => {
  const t0 = Date.now();
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json", "user-agent": "OnPointPoliticsEvidenceRecorder/1.0" } });
  const len = Number(res.headers.get("content-length"));
  if (Number.isFinite(len) && len > MAX_BODY_BYTES) throw new CaptureError("RESPONSE_TOO_LARGE", "the provider response exceeds the size limit");
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new CaptureError("RESPONSE_TOO_LARGE", "the provider response exceeds the size limit"); }
    chunks.push(value);
  }
  const age = Number(res.headers.get("age"));
  return { status: res.status, text: Buffer.concat(chunks).toString("utf8"), ms: Date.now() - t0, age: Number.isFinite(age) && res.headers.has("age") ? age : null };
};

export interface RunnerConfig {
  electionId: string;
  /** Whole-feed types captured in full. Tracked races' own types are added. */
  feedTypes: string[];
  windows: Window[];
  /** Stop starting requests after this long. Keep it under the function's maxDuration. */
  deadlineMs: number;
  detailConcurrency: number;
  electionDate: string;
}

export const DEFAULT_FEED_TYPES = ["US Senate", "Governor", "House of Representatives"];

export interface RunnerDeps {
  store: ObjectStore;
  fetchText: FetchText;
  now: () => Date;
  races: XRace[];
  config: RunnerConfig;
  /** Names a run. Tests supply a counter. */
  newId?: () => string;
  /** When set, each poll that reads every tracked race is archived as a checkpoint (raw, calculated, published). */
  archive?: ArchiveDeps;
}

export interface ProviderRequest { target: string; status: number | null; ms: number | null; bytes: number | null; age: number | null; error: string | null }
export interface RunError { scope: string; code: string; message: string }
export interface RaceOutcome { raceId: string; civicId: number | null; outcome: RecordOutcome | "ERROR" | "SKIPPED"; material: boolean; sourceTimestamp: string | null; testStatus: string | null }
export interface FeedOutcome { feed: string; outcome: "NEW" | "UNCHANGED" | "ALREADY_RECORDED" | "ERROR"; rows: number; changed: number; removed: number }

export interface RunRecord {
  type: "RUN";
  schemaVersion: "TPSI_CAPTURE/2";
  runId: string;
  trigger: "CRON" | "MANUAL";
  phase: Phase;
  intervalMinutes: number | null;
  startedAt: string;
  finishedAt: string;
  deployment: { environment: string | null; region: string | null; commit: string | null };
  provider: ProviderRequest[];
  feeds: FeedOutcome[];
  races: RaceOutcome[];
  errors: RunError[];
  deadlineHit: boolean;
  /** Whether any provider request succeeded and nothing failed to store. */
  ok: boolean;
  /** Whether anything new and material was recorded. */
  anyMaterial: boolean;
  checksum: string;
}

const sanitize = (e: unknown): { code: string; message: string } => {
  if (e instanceof CaptureError) return { code: e.code, message: e.message };
  const code = (e as { code?: unknown })?.code;
  const name = (e as { name?: unknown })?.name;
  return { code: typeof code === "string" ? code : typeof name === "string" ? name : "ERROR", message: "request or write failed" };
};

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const feedUrl = (type: string, date: string) => `${CIVIC_BASE}/race/search?startDate=${date}&endDate=${date}&limit=20000&type=${encodeURIComponent(type)}`;

/** Query strings are not stored. */
const endpointOf = (url: string) => url.split("?")[0];

export async function runCapture(deps: RunnerDeps, plan: TickPlan, trigger: RunRecord["trigger"]): Promise<RunRecord> {
  const { store, config } = deps;
  const startedAt = deps.now().toISOString();
  const t0 = Date.parse(startedAt);
  const runId = (deps.newId ?? (() => randomBytes(4).toString("hex")))();
  const provider: ProviderRequest[] = [], feeds: FeedOutcome[] = [], races: RaceOutcome[] = [], errors: RunError[] = [];
  let deadlineHit = false, storageFailed = false, anyMaterial = false;
  const overBudget = () => { if (deps.now().getTime() - t0 > config.deadlineMs) { deadlineHit = true; return true; } return false; };

  const request = async (target: string, url: string, timeoutMs: number): Promise<FetchResult | null> => {
    try {
      const r = await deps.fetchText(url, { timeoutMs });
      provider.push({ target, status: r.status, ms: r.ms, bytes: Buffer.byteLength(r.text, "utf8"), age: r.age, error: r.status === 200 ? null : `HTTP ${r.status}` });
      if (r.status !== 200) { errors.push({ scope: target, code: `HTTP_${r.status}`, message: `provider answered ${r.status}` }); return null; }
      return r;
    } catch (e) {
      const s = sanitize(e);
      provider.push({ target, status: null, ms: null, bytes: null, age: null, error: s.code });
      errors.push({ scope: target, code: s.code, message: s.message });
      return null;
    }
  };

  // 1. whole feeds, once each
  const types = uniq([...config.feedTypes, ...deps.races.flatMap((r) => r.civ.t ?? [])]);
  const civ: ReturnType<typeof searchRows> = [];
  await pool(types, 3, async (type) => {
    if (overBudget()) { feeds.push({ feed: type, outcome: "ERROR", rows: 0, changed: 0, removed: 0 }); errors.push({ scope: `feed:${type}`, code: "DEADLINE", message: "run budget exhausted before this feed" }); return; }
    const url = feedUrl(type, config.electionDate);
    const res = await request(`feed:${type}`, url, 15_000);
    if (!res) { feeds.push({ feed: type, outcome: "ERROR", rows: 0, changed: 0, removed: 0 }); return; }
    const observedAt = deps.now().toISOString();
    let json: unknown;
    try { json = JSON.parse(res.text); } catch {
      errors.push({ scope: `feed:${type}`, code: "MALFORMED_JSON", message: "the feed was not valid JSON; kept as raw evidence only" });
      try { await storeRaw(store, res.text); } catch { storageFailed = true; }
      feeds.push({ feed: type, outcome: "ERROR", rows: 0, changed: 0, removed: 0 });
      return;
    }
    const rows = searchRows(json);
    if (!Array.isArray((json as { races?: unknown })?.races)) { errors.push({ scope: `feed:${type}`, code: "UNEXPECTED_SHAPE", message: "the feed has no races array" }); feeds.push({ feed: type, outcome: "ERROR", rows: 0, changed: 0, removed: 0 }); return; }
    civ.push(...rows);
    try {
      const out = await recordFeedDelta(store, { feed: type, provider: { name: PROVIDER, endpoint: endpointOf(url) }, observedAt, ingestedAt: deps.now().toISOString(), rows: rows as unknown as FeedRow[], rawText: res.text, runId });
      feeds.push({ feed: type, outcome: out.outcome, rows: out.rowCount, changed: out.changed, removed: out.removed });
      if (out.outcome === "NEW") anyMaterial = true;
    } catch (e) {
      storageFailed = true;
      const s = sanitize(e);
      errors.push({ scope: `feed:${type}`, code: "STORAGE_WRITE_FAILED", message: s.message });
      feeds.push({ feed: type, outcome: "ERROR", rows: rows.length, changed: 0, removed: 0 });
    }
  });

  // 2. tracked race details
  const captures: RaceCapture[] = [];
  const matchedIds = new Set<number>();
  const missed = (race: XRace, civicId: number | null, failure: string) => captures.push({ race, civicId, observedAt: null, detail: null, raw: null, failure });
  if (plan.details !== "NONE") {
    const matched = matchCivic(deps.races, civ);
    for (const h of Object.values(matched)) if (h) matchedIds.add(h.id);
    const targets = (plan.details === "SAMPLE" ? deps.races.slice(0, 3) : deps.races);
    await pool(targets, config.detailConcurrency, async (race) => {
      const hit = matched[race.id];
      if (!hit) { missed(race, null, "NO_MATCH"); races.push({ raceId: race.id, civicId: null, outcome: "SKIPPED", material: false, sourceTimestamp: null, testStatus: null }); errors.push({ scope: `race:${race.id}`, code: "NO_MATCH", message: "no civicAPI race matches this forecast race in the feeds read" }); return; }
      if (overBudget()) { missed(race, hit.id, "DEADLINE"); races.push({ raceId: race.id, civicId: hit.id, outcome: "SKIPPED", material: false, sourceTimestamp: null, testStatus: null }); errors.push({ scope: `race:${race.id}`, code: "DEADLINE", message: "run budget exhausted before this race" }); return; }
      const url = `${CIVIC_BASE}/race/${hit.id}`;
      const res = await request(`race:${race.id}`, url, 8_000);
      if (!res) { missed(race, hit.id, "PROVIDER_ERROR"); races.push({ raceId: race.id, civicId: hit.id, outcome: "ERROR", material: false, sourceTimestamp: null, testStatus: null }); return; }
      const observedAt = deps.now().toISOString();
      try {
        const detail = trimDetail(JSON.parse(res.text), hit.id);
        const batch = fromCivicDetail(race, detail, observedAt, endpointOf(url));
        const observations: CapturedObservation[] = batch.map(({ observation }) => { const { retrievedAt: _omit, ...rest } = observation; void _omit; return rest; });
        const candidates: CandidateLine[] = detail.c.map(([name, party, votes, percent, winner]) => ({ name, party, votes, percent, winner: !!winner }));
        const sourceTimestamp = observations[0]?.sourceTimestamp ?? null;
        const r = await recordObservation(store, {
          electionId: config.electionId, raceId: race.id, state: race.st, provider: { name: PROVIDER, endpoint: endpointOf(url) }, testStatus: detail.test ? "TEST" : "LIVE", sourceTimestamp,
          observedAt, ingestedAt: deps.now().toISOString(), candidates, observations, reportingPct: Number.isFinite(detail.pr) ? detail.pr : null, rawText: res.text, payloadForm: "CIVICAPI_RACE_JSON", runId,
        });
        if (r.outcome === "NEW" && r.material) anyMaterial = true;
        captures.push({ race, civicId: hit.id, observedAt, detail, raw: { outcome: r.outcome, observationId: r.observationId, contentId: r.contentId, observationKey: r.key, responseSha256: sha256Hex(res.text) }, failure: null });
        races.push({ raceId: race.id, civicId: hit.id, outcome: r.outcome, material: r.material, sourceTimestamp, testStatus: detail.test ? "TEST" : "LIVE" });
      } catch (e) {
        const s = sanitize(e);
        const malformed = e instanceof SyntaxError || (e instanceof Error && /payload is not an object/.test(e.message));
        if (malformed) { try { await storeRaw(store, res.text); } catch { storageFailed = true; } }
        else storageFailed = true;
        missed(race, hit.id, malformed ? "MALFORMED_PAYLOAD" : "STORAGE_WRITE_FAILED");
        errors.push({ scope: `race:${race.id}`, code: malformed ? "MALFORMED_PAYLOAD" : e instanceof CaptureError ? s.code : "STORAGE_WRITE_FAILED", message: malformed ? "the race payload was malformed; kept as raw evidence only" : s.message });
        races.push({ raceId: race.id, civicId: hit.id, outcome: "ERROR", material: false, sourceTimestamp: null, testStatus: null });
      }
    });
  }

  // 3. checkpoint archive: calculations and published state for this snapshot. A failure here never touches the raw layer.
  const runKey = `runs/${startedAt.slice(0, 10)}/${compactTime(startedAt)}_${runId}.json`;
  if (deps.archive && plan.details === "ALL") {
    const rawIssues = [
      ...feeds.filter((f) => f.outcome === "ERROR").map((f) => `feed ${f.feed} not captured`),
      ...captures.filter((c) => !c.raw).map((c) => `${c.race.id}: ${c.failure}`),
      ...(deadlineHit ? ["run budget exhausted"] : []),
    ].sort();
    const untracked = civ.filter((c) => !matchedIds.has(c.id)).map((c) => ({ civicId: c.id, type: c.type, province: c.province, district: c.district, name: c.name }));
    try {
      await archiveCheckpoint(store, { runId, phase: plan.phase, startedAt, rawFinishedAt: deps.now().toISOString(), runKey, captures, untracked, feeds: feeds.map(({ feed, outcome }) => ({ feed, outcome })), rawIssues }, deps.archive);
    } catch (e) {
      storageFailed = true;
      errors.push({ scope: "archive", code: "ARCHIVE_WRITE_FAILED", message: sanitize(e).message });
    }
  }

  const anyProviderOk = provider.some((p) => p.status === 200);
  const finishedAt = deps.now().toISOString();
  const record = withChecksum<Omit<RunRecord, "checksum">>({
    type: "RUN", schemaVersion: "TPSI_CAPTURE/2", runId, trigger, phase: plan.phase, intervalMinutes: plan.intervalMinutes, startedAt, finishedAt,
    deployment: { environment: process.env.VERCEL_ENV ?? null, region: process.env.VERCEL_REGION ?? null, commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null },
    provider, feeds, races: races.sort((a, b) => a.raceId.localeCompare(b.raceId)), errors, deadlineHit, ok: anyProviderOk && !storageFailed, anyMaterial,
  });
  await store.putIfAbsent(runKey, jsonBytes(record), "application/json");
  return record;
}

// ---- tick: the scheduler calls this every minute ------------------------------------------------------------------------

export interface TickHead extends TickState {
  at: string;
  phase: Phase;
  intervalMinutes: number | null;
  due: boolean;
  lastOkPollAt: string | null;
  consecutiveFailures: number;
  lastRunKey: string | null;
  checksum: string;
}
const TICK_KEY = "heads/tick.json";

export async function readTick(store: ObjectStore): Promise<TickHead | null> {
  const t = parseJson(await store.get(TICK_KEY));
  return intact(t) ? (t as TickHead) : null;
}

export interface TickResult { plan: TickPlan; run: RunRecord | null; tick: TickHead }

/** Decide whether this minute is due and, if so, poll. Always leaves a tick head, so a quiet minute is distinguishable from a dead scheduler. */
export async function runTick(deps: RunnerDeps, opts: { force?: boolean; trigger: RunRecord["trigger"] }): Promise<TickResult> {
  const now = deps.now().toISOString();
  const prev = await readTick(deps.store);
  const plan = planTick(now, { lastPollAt: prev?.lastPollAt ?? null, quietPolls: prev?.quietPolls ?? 0 }, deps.config.windows, { force: opts.force });
  if (!plan.due) {
    const tick = withChecksum<Omit<TickHead, "checksum">>({ at: now, phase: plan.phase, intervalMinutes: plan.intervalMinutes, due: false, lastPollAt: prev?.lastPollAt ?? null, quietPolls: prev?.quietPolls ?? 0, lastOkPollAt: prev?.lastOkPollAt ?? null, consecutiveFailures: prev?.consecutiveFailures ?? 0, lastRunKey: prev?.lastRunKey ?? null });
    await deps.store.put(TICK_KEY, jsonBytes(tick), "application/json");
    return { plan, run: null, tick };
  }
  const run = await runCapture(deps, plan, opts.trigger);
  const tick = withChecksum<Omit<TickHead, "checksum">>({
    at: now, phase: plan.phase, intervalMinutes: plan.intervalMinutes, due: true, lastPollAt: run.startedAt, quietPolls: run.anyMaterial ? 0 : (prev?.quietPolls ?? 0) + 1,
    lastOkPollAt: run.ok ? run.startedAt : prev?.lastOkPollAt ?? null, consecutiveFailures: run.ok ? 0 : (prev?.consecutiveFailures ?? 0) + 1, lastRunKey: `runs/${run.startedAt.slice(0, 10)}/${compactTime(run.startedAt)}_${run.runId}.json`,
  });
  await deps.store.put(TICK_KEY, jsonBytes(tick), "application/json");
  return { plan, run, tick };
}

// ---- run history ----------------------------------------------------------------------------------------------------------

/** Run records started between two instants, oldest first. Records that fail their checksum are skipped. */
/**
 * One cron invocation. Cron fires once a minute; when the phase polls faster than that (30 seconds on election night),
 * the later slots of the minute are run here, each on the normal schedule check, while the function's budget allows.
 */
export async function runCronSlots(deps: RunnerDeps, opts: { force?: boolean; trigger: RunRecord["trigger"] }, sleep: (ms: number) => Promise<void>, budgetMs = 50_000): Promise<TickResult[]> {
  const t0 = deps.now().getTime();
  const out = [await runTick(deps, opts)];
  for (;;) {
    const last = out[out.length - 1];
    const iv = last.plan.intervalMinutes;
    if (!last.run || iv === null || iv >= 1) break;
    const next = Date.parse(last.run.startedAt) + iv * 60_000;
    if (next - t0 >= 60_000) break;
    const remaining = budgetMs - (Math.max(next, deps.now().getTime()) - t0);
    if (remaining < 15_000) break;
    const wait = next - deps.now().getTime();
    if (wait > 0) await sleep(wait);
    out.push(await runTick({ ...deps, config: { ...deps.config, deadlineMs: Math.min(deps.config.deadlineMs, remaining - 5_000) } }, { trigger: opts.trigger }));
  }
  return out;
}

export async function readRuns(store: ObjectStore, fromIso: string, toIso: string): Promise<RunRecord[]> {
  const out: RunRecord[] = [];
  for (let d = Date.parse(fromIso.slice(0, 10)); d <= Date.parse(toIso); d += 86_400_000) {
    for (const key of await store.list(`runs/${new Date(d).toISOString().slice(0, 10)}/`)) {
      const r = parseJson(await store.get(key)) as RunRecord | null;
      if (r && r.type === "RUN" && intact(r) && r.startedAt >= fromIso && r.startedAt <= toIso) out.push(r);
    }
  }
  return out.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export interface PollingGap { from: string; to: string; minutes: number }

/**
 * Stretches with no successful poll longer than `minMinutes`. This is the evidence of when the recorder could not see the
 * provider. It is different from a stretch with no new observation, which only means nothing changed.
 */
export function pollingGaps(runs: RunRecord[], minMinutes: number): PollingGap[] {
  const ok = runs.filter((r) => r.ok);
  const out: PollingGap[] = [];
  for (let i = 1; i < ok.length; i++) {
    const m = (Date.parse(ok[i].startedAt) - Date.parse(ok[i - 1].startedAt)) / 60000;
    if (m > minMinutes) out.push({ from: ok[i - 1].startedAt, to: ok[i].startedAt, minutes: Math.round(m * 10) / 10 });
  }
  return out;
}
