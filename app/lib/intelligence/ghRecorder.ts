// The GitHub Actions flight recorder: one complete, idempotent snapshot per 10-minute UTC slot, committed to an
// archive branch (or repository) by .github/workflows/flight-recorder.yml. A redundant, independent recorder: it does not
// replace the Vercel capture path and it changes no official forecast value.
//
// Each slot writes into an ObjectStore rooted in a checkout of the archive:
//   RAW_OBSERVED   civicAPI feeds and race details, gzipped and named by sha256 (the existing capture layer)
//   CALCULATED     the public live engine over that raw data (the existing checkpoint archive)
//   PUBLISHED      what production actually served at that moment (forecast index, model file, public snapshot
//                  endpoint), gzipped and named by sha256, with HTTP status and cache headers
//   slots/<day>/<time>.json   the slot record: actual timings, run identity, every immutable file written with its
//                             sha256, the checkpoint's integrity check and the slots missed since the previous record
//   heads/gh-recorder.json    recorder health: last slot, consecutive failures, missed slots
// The layers stay separate. A slot that already has a record is never captured again.

import { gzipSync, gunzipSync } from "node:zlib";
import type { XRace } from "@/app/results/2026/live";
import { compactTime, intact, jsonBytes, parseJson, sha256Hex, withChecksum } from "./capture";
import { runTick, type FetchText, type RunError, type RunnerConfig } from "./captureRunner";
import { defaultWindows, planTick, type Window } from "./captureSchedule";
import type { ObjectStore } from "./captureStore";
import { archiveKeys, readCheckpoint, type ArchiveDeps, type LoadedCheckpoint } from "./checkpointArchive";

export const SLOT_SCHEMA = "ONPOINT_GH_SLOT/1" as const;
export const SLOT_MINUTES = 10;
export const HEALTH_KEY = "heads/gh-recorder.json";
const SLOT_MS = SLOT_MINUTES * 60_000;
const MAX_PUBLISHED_BYTES = 16 * 1024 * 1024;

/** The slot an instant falls in: the UTC ten-minute floor. */
export const slotOf = (d: Date) => new Date(Math.floor(d.getTime() / SLOT_MS) * SLOT_MS).toISOString();
export const slotKey = (slot: string) => `slots/${slot.slice(0, 10)}/${compactTime(slot)}.json`;

/** Slots strictly between two slots, oldest first. */
export function slotsBetween(fromSlot: string, toSlot: string, cap = 2_000): string[] {
  const out: string[] = [];
  for (let t = Date.parse(fromSlot) + SLOT_MS; t < Date.parse(toSlot) && out.length < cap; t += SLOT_MS) out.push(new Date(t).toISOString());
  return out;
}

/** The capture windows with every live window polled each slot and every tracked race read in full. */
export function recorderWindows(until?: string): Window[] {
  return defaultWindows(until).map((w) => (w.intervalMinutes === null ? w : { ...w, intervalMinutes: SLOT_MINUTES, details: "ALL" as const }));
}

// ---- published layer ---------------------------------------------------------------------------------------------------

export interface PublishedTarget { name: string; path: string; required: boolean }
/** What production serves. The public snapshot endpoint answers 404 while its flag is off; that answer is recorded too. */
export const PUBLISHED_TARGETS: PublishedTarget[] = [
  { name: "results-index", path: "/results/2026/index.json", required: true },
  { name: "forecast-model", path: "/forecast/model.json", required: true },
  { name: "public-snapshot", path: "/api/results/public-snapshot", required: false },
];
const KEPT_HEADERS = ["age", "etag", "last-modified", "cache-control", "x-vercel-cache", "date", "content-type"];

export interface PublishedResponse { status: number; body: Buffer; ms: number; headers: Record<string, string | null> }
export type FetchPublished = (url: string, opts: { timeoutMs: number }) => Promise<PublishedResponse>;

export const defaultFetchPublished: FetchPublished = async (url, { timeoutMs }) => {
  const t0 = Date.now();
  const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json", "user-agent": "OnPointPoliticsFlightRecorder/1.0" } });
  const body = Buffer.from(await res.arrayBuffer());
  if (body.byteLength > MAX_PUBLISHED_BYTES) throw Object.assign(new Error("published response too large"), { code: "RESPONSE_TOO_LARGE" });
  return { status: res.status, body, ms: Date.now() - t0, headers: Object.fromEntries(KEPT_HEADERS.map((h) => [h, res.headers.get(h)])) };
};

export interface PublishedCapture {
  name: string;
  url: string;
  required: boolean;
  fetchedAt: string;
  status: number | null;
  ms: number | null;
  bytes: number | null;
  sha256: string | null;
  /** The gzipped body, by its sha256. Null when nothing was received. */
  key: string | null;
  validJson: boolean;
  headers: Record<string, string | null>;
  error: string | null;
}

const codeOf = (e: unknown) => { const c = (e as { code?: unknown; name?: unknown })?.code ?? (e as { name?: unknown })?.name; return typeof c === "string" ? c : "ERROR"; };

async function capturePublished(store: ObjectStore, fetchPublished: FetchPublished, base: string, t: PublishedTarget, now: () => Date): Promise<PublishedCapture> {
  const url = `${base.replace(/\/$/, "")}${t.path}`;
  const fetchedAt = now().toISOString();
  try {
    const r = await fetchPublished(url, { timeoutMs: 20_000 });
    const sha256 = sha256Hex(r.body);
    let validJson = false;
    try { JSON.parse(r.body.toString("utf8")); validJson = true; } catch { /* kept as evidence, flagged */ }
    const key = r.status === 200 ? `published/raw/${sha256}.gz` : null;
    if (key) await store.putIfAbsent(key, gzipSync(r.body), "application/gzip");
    const error = r.status !== 200 ? `HTTP_${r.status}` : validJson ? null : "MALFORMED_JSON";
    return { name: t.name, url, required: t.required, fetchedAt, status: r.status, ms: r.ms, bytes: r.body.byteLength, sha256, key, validJson, headers: r.headers, error };
  } catch (e) {
    return { name: t.name, url, required: t.required, fetchedAt, status: null, ms: null, bytes: null, sha256: null, key: null, validJson: false, headers: {}, error: codeOf(e) };
  }
}

// ---- a store that remembers what it wrote ------------------------------------------------------------------------------

export interface WrittenFile { key: string; sha256: string; bytes: number }

class TrackingStore implements ObjectStore {
  readonly kind;
  readonly durable;
  readonly created: WrittenFile[] = [];
  readonly heads = new Set<string>();
  private inner: ObjectStore;
  constructor(inner: ObjectStore) { this.inner = inner; this.kind = inner.kind; this.durable = inner.durable; }
  async putIfAbsent(key: string, body: Buffer, ct: string) {
    const r = await this.inner.putIfAbsent(key, body, ct);
    if (r === "CREATED") this.created.push({ key, sha256: sha256Hex(body), bytes: body.byteLength });
    return r;
  }
  async put(key: string, body: Buffer, ct: string) { await this.inner.put(key, body, ct); this.heads.add(key); }
  get(key: string) { return this.inner.get(key); }
  list(prefix: string) { return this.inner.list(prefix); }
}

// ---- one slot ----------------------------------------------------------------------------------------------------------

export type SlotStatus = "RECORDED" | "PARTIAL" | "FAILED";
export type SlotOutcome = SlotStatus | "ALREADY_RECORDED" | "WINDOW_ENDED";

export interface SlotContext {
  trigger: "SCHEDULE" | "MANUAL" | "OTHER";
  githubRunId: string | null;
  githubRunAttempt: string | null;
  codeSha: string | null;
}

export interface SlotDeps {
  store: ObjectStore;
  fetchText: FetchText;
  fetchPublished: FetchPublished;
  now: () => Date;
  races: XRace[];
  config: RunnerConfig;
  archive: ArchiveDeps;
  /** Production origin for the published layer; null skips it. */
  siteBase: string | null;
  context: SlotContext;
  newId?: () => string;
}

export interface CheckpointCheck { key: string; present: boolean; complete: boolean | null; rawStatus: string | null; counts: Record<string, number> | null; calculated: number; incompleteReasons: string[]; problems: string[] }

export interface SlotRecord {
  schema: typeof SLOT_SCHEMA;
  electionId: string;
  slot: string;
  startedAt: string;
  finishedAt: string;
  /** Seconds between the slot's start and the job's start. GitHub's scheduler is best-effort; this shows by how much. */
  delaySeconds: number;
  context: SlotContext;
  phase: string;
  status: SlotStatus;
  previousSlot: string | null;
  missedSlots: string[];
  run: { key: string | null; runId: string; ok: boolean; deadlineHit: boolean; feeds: { ok: number; error: number }; races: Record<string, number>; errorCount: number; errors: RunError[] } | null;
  checkpoint: CheckpointCheck | null;
  published: PublishedCapture[];
  files: WrittenFile[];
  heads: string[];
  checksum: string;
}

export interface Health {
  updatedAt: string;
  lastSlot: string;
  lastStatus: SlotStatus;
  lastRecordedSlot: string | null;
  consecutiveFailures: number;
  slotsWritten: number;
  missedTotal: number;
  recentMissed: string[];
  checksum: string;
}

export async function readHealth(store: ObjectStore): Promise<Health | null> {
  const h = parseJson(await store.get(HEALTH_KEY));
  return intact(h) ? (h as Health) : null;
}

/** The latest slot record before `slot`, from the health head or, failing that, the last two days of records. */
async function previousSlot(store: ObjectStore, slot: string, health: Health | null): Promise<string | null> {
  if (health && health.lastSlot < slot) return health.lastSlot;
  const day = slot.slice(0, 10);
  const yesterday = new Date(Date.parse(day) - 86_400_000).toISOString().slice(0, 10);
  const keys = [...(await store.list(`slots/${yesterday}/`)), ...(await store.list(`slots/${day}/`))].filter((k) => k < slotKey(slot));
  const last = keys.length ? (parseJson(await store.get(keys[keys.length - 1])) as SlotRecord | null) : null;
  return last?.slot ?? null;
}

export async function checkCheckpoint(store: ObjectStore, key: string): Promise<CheckpointCheck> {
  let cp: LoadedCheckpoint | null = null;
  try { cp = await readCheckpoint(store, key); } catch { /* reported as absent */ }
  if (!cp) return { key, present: false, complete: null, rawStatus: null, counts: null, calculated: 0, incompleteReasons: [], problems: ["checkpoint manifest missing or unreadable"] };
  const m = cp.manifest;
  return { key, present: true, complete: m.complete, rawStatus: m.layers.raw.status, counts: { ...m.counts }, calculated: cp.calculated.length, incompleteReasons: m.incompleteReasons.slice(0, 50), problems: cp.problems };
}

export async function runSlot(deps: SlotDeps): Promise<{ outcome: SlotOutcome; slot: string; key: string; record: SlotRecord | null }> {
  const started = deps.now();
  const startedAt = started.toISOString();
  const slot = slotOf(started);
  const key = slotKey(slot);
  if (await deps.store.get(key)) return { outcome: "ALREADY_RECORDED", slot, key, record: null };
  const plan = planTick(startedAt, { lastPollAt: null, quietPolls: 0 }, deps.config.windows);
  if (plan.intervalMinutes === null && deps.context.trigger === "SCHEDULE") return { outcome: "WINDOW_ENDED", slot, key, record: null };

  const store = new TrackingStore(deps.store);
  const health = await readHealth(deps.store);
  const prev = await previousSlot(deps.store, slot, health);
  const missedSlots = prev ? slotsBetween(prev, slot) : [];

  let run: SlotRecord["run"] = null, checkpoint: CheckpointCheck | null = null, ok = false;
  try {
    const t = await runTick({ store, fetchText: deps.fetchText, now: deps.now, races: deps.races, config: deps.config, archive: deps.archive, newId: deps.newId }, { force: true, trigger: deps.context.trigger === "SCHEDULE" ? "CRON" : "MANUAL" });
    if (t.run) {
      const r = t.run;
      const races: Record<string, number> = {};
      for (const x of r.races) races[x.outcome] = (races[x.outcome] ?? 0) + 1;
      run = { key: t.tick.lastRunKey, runId: r.runId, ok: r.ok, deadlineHit: r.deadlineHit, feeds: { ok: r.feeds.filter((f) => f.outcome !== "ERROR").length, error: r.feeds.filter((f) => f.outcome === "ERROR").length }, races, errorCount: r.errors.length, errors: r.errors.slice(0, 50) };
      ok = r.ok;
      checkpoint = await checkCheckpoint(store, archiveKeys(r.startedAt, r.runId).manifest);
    }
  } catch (e) {
    run = { key: null, runId: "none", ok: false, deadlineHit: false, feeds: { ok: 0, error: 0 }, races: {}, errorCount: 1, errors: [{ scope: "run", code: codeOf(e), message: "the capture run failed" }] };
  }

  const published: PublishedCapture[] = [];
  if (deps.siteBase) for (const t of PUBLISHED_TARGETS) published.push(await capturePublished(store, deps.fetchPublished, deps.siteBase, t, deps.now));

  const degraded = (!!run && (run.errorCount > 0 || run.deadlineHit)) || !checkpoint || !checkpoint.present || checkpoint.complete === false || checkpoint.problems.length > 0 || published.some((p) => p.required && p.error);
  const status: SlotStatus = !ok ? "FAILED" : degraded ? "PARTIAL" : "RECORDED";
  const finishedAt = deps.now().toISOString();
  const record = withChecksum<Omit<SlotRecord, "checksum">>({
    schema: SLOT_SCHEMA, electionId: deps.config.electionId, slot, startedAt, finishedAt, delaySeconds: Math.round((started.getTime() - Date.parse(slot)) / 1000),
    context: deps.context, phase: plan.phase, status, previousSlot: prev, missedSlots, run, checkpoint, published,
    files: [...store.created].sort((a, b) => a.key.localeCompare(b.key)), heads: [...store.heads].sort(),
  });
  // a concurrent writer that got here first wins; this run's evidence files are content-addressed and stay valid
  if ((await deps.store.putIfAbsent(key, jsonBytes(record), "application/json")) === "EXISTS") return { outcome: "ALREADY_RECORDED", slot, key, record: null };

  const next = withChecksum<Omit<Health, "checksum">>({
    updatedAt: finishedAt, lastSlot: slot, lastStatus: status, lastRecordedSlot: status === "FAILED" ? health?.lastRecordedSlot ?? null : slot,
    consecutiveFailures: status === "FAILED" ? (health?.consecutiveFailures ?? 0) + 1 : 0, slotsWritten: (health?.slotsWritten ?? 0) + 1,
    missedTotal: (health?.missedTotal ?? 0) + missedSlots.length, recentMissed: [...(health?.recentMissed ?? []), ...missedSlots].slice(-200),
  });
  await deps.store.put(HEALTH_KEY, jsonBytes(next), "application/json");
  return { outcome: status, slot, key, record };
}

// ---- verification and restore ------------------------------------------------------------------------------------------

export interface VerifyReport { slots: number; files: number; checkpoints: number; byStatus: Record<string, number>; missed: number; problems: string[] }

/** Re-reads every slot record in the day range and checks its checksum, every file it lists and its checkpoint. */
export async function verifyArchive(store: ObjectStore, fromDay: string, toDay: string): Promise<VerifyReport> {
  const rep: VerifyReport = { slots: 0, files: 0, checkpoints: 0, byStatus: {}, missed: 0, problems: [] };
  for (let d = Date.parse(`${fromDay}T00:00:00Z`); d <= Date.parse(`${toDay}T00:00:00Z`); d += 86_400_000) {
    for (const key of await store.list(`slots/${new Date(d).toISOString().slice(0, 10)}/`)) {
      const rec = parseJson(await store.get(key)) as SlotRecord | null;
      rep.slots++;
      if (!rec || !intact(rec)) { rep.problems.push(`${key}: slot record unreadable or checksum mismatch`); continue; }
      if (slotKey(rec.slot) !== key) rep.problems.push(`${key}: record names slot ${rec.slot}`);
      rep.byStatus[rec.status] = (rep.byStatus[rec.status] ?? 0) + 1;
      rep.missed += rec.missedSlots.length;
      for (const f of rec.files) {
        rep.files++;
        const b = await store.get(f.key);
        if (!b) rep.problems.push(`${key}: ${f.key} missing`);
        else if (sha256Hex(b) !== f.sha256) rep.problems.push(`${key}: ${f.key} hash mismatch`);
      }
      for (const p of rec.published) if (p.key) {
        const b = await store.get(p.key);
        if (!b) rep.problems.push(`${key}: ${p.key} missing`);
        else if (sha256Hex(gunzipSync(b)) !== p.sha256) rep.problems.push(`${key}: ${p.key} content does not match its recorded sha256`);
      }
      if (rec.checkpoint?.present) {
        rep.checkpoints++;
        const c = await checkCheckpoint(store, rec.checkpoint.key);
        if (!c.present || c.problems.length) rep.problems.push(`${key}: checkpoint ${rec.checkpoint.key}: ${c.problems.join("; ")}`);
      }
    }
  }
  const h = await store.get(HEALTH_KEY);
  if (h && !intact(parseJson(h))) rep.problems.push(`${HEALTH_KEY}: checksum mismatch`);
  return rep;
}

export interface Restored { record: SlotRecord; published: Record<string, unknown>; checkpoint: LoadedCheckpoint | null }

/** The latest usable slot at or before `atIso`: its record, the published payloads it captured, and its checkpoint. */
export async function restoreAt(store: ObjectStore, atIso: string, lookbackDays = 14): Promise<Restored | null> {
  const at = Date.parse(atIso);
  for (let d = Date.parse(atIso.slice(0, 10)); d >= at - lookbackDays * 86_400_000; d -= 86_400_000) {
    const keys = (await store.list(`slots/${new Date(d).toISOString().slice(0, 10)}/`)).reverse();
    for (const key of keys) {
      const rec = parseJson(await store.get(key)) as SlotRecord | null;
      if (!rec || !intact(rec) || Date.parse(rec.finishedAt) > at || rec.status === "FAILED") continue;
      const published: Record<string, unknown> = {};
      for (const p of rec.published) if (p.key && p.validJson) { const b = await store.get(p.key); if (b) published[p.name] = JSON.parse(gunzipSync(b).toString("utf8")); }
      return { record: rec, published, checkpoint: rec.checkpoint?.present ? await readCheckpoint(store, rec.checkpoint.key) : null };
    }
  }
  return null;
}
