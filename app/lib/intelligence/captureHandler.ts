// The capture endpoint's logic, on standard Request and Response so it can be tested without a server.
//
// Threat model (see docs/ELECTION_NIGHT_INTELLIGENCE_PHASE2C.md for the full table)
//  - The route sits outside the portal's middleware matcher and is reachable from the internet. It therefore authenticates
//    itself, and a browser session is deliberately not accepted: a cookie belongs to a person, a cron job has none, and
//    accepting cookies on a state-changing route would need CSRF defences besides.
//  - GET is the scheduler. Vercel Cron sends `Authorization: Bearer $CRON_SECRET` and nothing else.
//  - POST is manual: force a poll or run a preflight. It needs a second, separate secret (INTELLIGENCE_CAPTURE_SECRET),
//    so a scheduler credential cannot force polls or run preflights, and the reverse.
//  - A missing or short secret disables the route (503) before any store or provider access: it fails closed.
//  - Comparison is constant-time. Failed attempts are throttled per client (best effort: each serverless instance keeps
//    its own count, so a firewall rule is the real control).
//  - A replayed request can only trigger another idempotent poll. Forced polls are spaced at least MIN_FORCE_SPACING_MS
//    apart; scheduled ticks are already rate-limited by the schedule itself.
//  - Input: no request body is read, any body over 1 KiB is refused, and only the documented query parameters pass.
//  - Provider responses are untrusted: size-capped, parsed defensively, malformed ones kept as evidence and reported.
//  - Secrets are never logged or returned. Errors name a code, never a stack, a URL or an upstream message.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { XRace } from "@/app/results/2026/live";
import { matchCivic } from "@/app/results/2026/live";
import { jsonBytes, parseJson, sha256Hex } from "./capture";
import { searchRows } from "./civic";
import { resolveStore, type ObjectStore, type StoreChoice } from "./captureStore";
import { CIVIC_BASE, defaultFetchText, readTick, runCronSlots, runTick, type FetchText, type RunnerConfig, type TickResult } from "./captureRunner";
import { loadTrackedRaces, runnerConfig } from "./captureConfig";
import type { ExpectedRace } from "./captureHealth";
import type { ArchiveDeps } from "./checkpointArchive";
import { githubTargetFrom, mirrorPending, type GitHubTarget, type MirrorResult } from "./githubArchive";
import { readCountyExpectations } from "@/app/portal/intelligence/inputs";

export const MIN_SECRET_LENGTH = 24;
export const MIN_FORCE_SPACING_MS = 10_000;
const MAX_BODY_BYTES = 1024;
const FAILURE_WINDOW_MS = 60_000;
const FAILURE_LIMIT = 10;
const MAX_TRACKED_CLIENTS = 1000;

/** Counts failed authentications per client, so guessing a secret is slow. Best effort per instance. */
export class FailureLimiter {
  private hits = new Map<string, number[]>();
  blocked(client: string, nowMs: number): boolean {
    const recent = (this.hits.get(client) ?? []).filter((t) => nowMs - t < FAILURE_WINDOW_MS);
    return recent.length >= FAILURE_LIMIT;
  }
  fail(client: string, nowMs: number): void {
    if (this.hits.size >= MAX_TRACKED_CLIENTS && !this.hits.has(client)) this.hits.delete(this.hits.keys().next().value as string);
    this.hits.set(client, [...(this.hits.get(client) ?? []).filter((t) => nowMs - t < FAILURE_WINDOW_MS), nowMs]);
  }
}

export interface HandlerDeps {
  env: Record<string, string | undefined>;
  store: () => StoreChoice;
  tracked: () => Promise<{ races: XRace[]; expected: ExpectedRace[]; missing: string[] }>;
  fetchText: FetchText;
  now: () => Date;
  limiter: FailureLimiter;
  config?: RunnerConfig;
  /** Present in production: lets one cron call run the second 30-second slot of its minute. */
  sleep?: (ms: number) => Promise<void>;
  /** Archive dependencies; used only when ONPOINT_ARCHIVE=1. */
  archive?: ArchiveDeps;
  /** GitHub mirror; defaults to ONPOINT_ARCHIVE_REPO / ONPOINT_ARCHIVE_TOKEN, and only when ONPOINT_ARCHIVE=1. */
  github?: GitHubTarget | null;
}

const sharedLimiter = new FailureLimiter();
export const defaultArchiveDeps = (now: () => Date): ArchiveDeps => ({ now, expFor: (r) => readCountyExpectations(r.st, r.id), raceHistory: true });
export const defaultDeps = (): HandlerDeps => ({ env: process.env, store: () => resolveStore(process.env), tracked: loadTrackedRaces, fetchText: defaultFetchText, now: () => new Date(), limiter: sharedLimiter, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) });

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers } });

const digest = (s: string) => createHash("sha256").update(s).digest();
function bearerMatches(header: string | null, secret: string): boolean {
  const m = /^Bearer (.{1,512})$/.exec(header ?? "");
  const given = m ? m[1] : "";
  // equal-length digests, so the comparison time does not depend on how much of the secret matched
  return timingSafeEqual(digest(given), digest(secret)) && !!m;
}

const clientOf = (req: Request) => (req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown").slice(0, 64);

const ALLOWED_PARAMS = { GET: [] as string[], POST: ["mode", "force"] };

export async function handleCapture(req: Request, deps: HandlerDeps = defaultDeps()): Promise<Response> {
  const method = req.method;
  if (method !== "GET" && method !== "POST") return json(405, { error: "method_not_allowed" }, { allow: "GET, POST" });
  const secret = method === "GET" ? deps.env.CRON_SECRET : deps.env.INTELLIGENCE_CAPTURE_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return json(503, { error: "capture_disabled" });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });

  const nowMs = deps.now().getTime();
  const client = clientOf(req);
  if (deps.limiter.blocked(client, nowMs)) return json(429, { error: "too_many_attempts" }, { "retry-after": "60" });
  if (!bearerMatches(req.headers.get("authorization"), secret)) { deps.limiter.fail(client, nowMs); return json(401, { error: "unauthorized" }); }

  const url = new URL(req.url);
  for (const k of url.searchParams.keys()) if (!ALLOWED_PARAMS[method].includes(k)) return json(400, { error: "unknown_parameter" });
  const mode = url.searchParams.get("mode") ?? "poll";
  if (mode !== "poll" && mode !== "preflight") return json(400, { error: "invalid_mode" });
  const force = url.searchParams.get("force");
  if (force !== null && force !== "1") return json(400, { error: "invalid_force" });

  const choice = deps.store();
  if (!choice.store) return json(503, { error: "store_not_configured", detail: choice.problem });
  const store = choice.store;
  const config = deps.config ?? runnerConfig(deps.env);

  try {
    const tracked = await deps.tracked();
    if (mode === "preflight") return json(200, await preflight(store, deps, tracked, config));

    if (force === "1") {
      const tick = await readTick(store);
      if (tick?.lastPollAt && nowMs - Date.parse(tick.lastPollAt) < MIN_FORCE_SPACING_MS) return json(429, { error: "too_soon" }, { "retry-after": "10" });
    }
    const archiveOn = deps.env.ONPOINT_ARCHIVE === "1";
    const runnerDeps = { store, fetchText: deps.fetchText, now: deps.now, races: tracked.races, config, archive: archiveOn ? { ...(deps.archive ?? defaultArchiveDeps(deps.now)), publicationReady: deps.env.ONPOINT_PUBLIC_SNAPSHOT === "1" } : undefined };
    const tickOpts = { force: force === "1", trigger: method === "GET" ? "CRON" as const : "MANUAL" as const };
    const slots: TickResult[] = method === "GET" && deps.sleep ? await runCronSlots(runnerDeps, tickOpts, deps.sleep) : [await runTick(runnerDeps, tickOpts)];
    const out = slots[slots.length - 1];
    const target = archiveOn && store.kind !== "github" ? (deps.github !== undefined ? deps.github : githubTargetFrom(deps.env)) : null;
    let mirror: MirrorResult | null = null;
    if (target && slots.some((s) => s.run)) mirror = await mirrorPending(store, target, { now: deps.now });
    const run = out.run;
    const count = <T extends { outcome: string }>(xs: T[]) => xs.reduce<Record<string, number>>((m, x) => ({ ...m, [x.outcome]: (m[x.outcome] ?? 0) + 1 }), {});
    const lost = slots.some((s) => s.durability.status === "FAILED");
    return json((run && !run.ok) || lost ? 502 : 200, {
      phase: out.plan.phase, due: out.plan.due, reason: out.plan.reason, intervalMinutes: out.plan.intervalMinutes, trackedRaces: tracked.races.length, missingFromIndex: tracked.missing.length,
      durability: slots.map((s) => ({ status: s.durability.status, code: s.durability.code })), slots: slots.length, archive: archiveOn, mirror: mirror ? { status: mirror.status, checkpoints: mirror.checkpoints, code: mirror.code } : null,
      run: run ? { runId: run.runId, ok: run.ok, anyMaterial: run.anyMaterial, deadlineHit: run.deadlineHit, races: count(run.races), feeds: count(run.feeds), errors: run.errors.length, errorCodes: [...new Set(run.errors.map((e) => e.code))] } : null,
    });
  } catch (e) {
    // the code only: a store or runtime message can contain paths or URLs
    console.error("intelligence capture failed:", (e as { code?: string })?.code ?? (e as Error)?.name ?? "error");
    return json(500, { error: "storage_failure" });
  }
}

// ---- preflight ----------------------------------------------------------------------------------------------------------

interface Check { name: string; ok: boolean; detail: string }

/** Proves the store can write, read back, refuse an overwrite and list, and that the provider answers. Writes only under preflight/. */
async function preflight(store: ObjectStore, deps: HandlerDeps, tracked: { races: XRace[]; missing: string[] }, config: RunnerConfig) {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  const id = randomBytes(4).toString("hex");
  const at = deps.now().toISOString();
  const key = `preflight/${at.replace(/[-:]/g, "")}_${id}.json`;
  const body = { kind: "PREFLIGHT", at, id, nonce: randomBytes(8).toString("hex") };
  try {
    add("create", (await store.putIfAbsent(key, jsonBytes(body), "application/json")) === "CREATED", key);
    const back = parseJson(await store.get(key)) as typeof body | null;
    add("read back", !!back && sha256Hex(JSON.stringify(back)) === sha256Hex(JSON.stringify(body)), "contents equal what was written");
    add("refuses overwrite", (await store.putIfAbsent(key, jsonBytes({ ...body, nonce: "changed" }), "application/json")) === "EXISTS", "a second create of the same key is refused");
    const again = parseJson(await store.get(key)) as typeof body | null;
    add("original intact", again?.nonce === body.nonce, "the refused write left the original unchanged");
    add("list", (await store.list("preflight/")).includes(key), "the object appears in a prefix listing");
    await store.put("heads/preflight.json", jsonBytes({ at, id }), "application/json");
    add("overwrite head", (parseJson(await store.get("heads/preflight.json")) as { id?: string } | null)?.id === id, "a head can be replaced and read back");
    if (store.commit) { const c = await store.commit(`preflight ${id}`); add("commit", !!c.commit, `${c.files} files in one commit, ${c.calls} GitHub requests`); }
  } catch (e) {
    add("store", false, `store operation failed (${(e as { code?: string })?.code ?? (e as Error)?.name ?? "error"})`);
  }
  add("durable", store.durable, `${store.kind} store${store.durable ? "" : " is not durable in this environment"}`);

  let providerDetail = "not reached";
  let providerOk = false;
  let matched = 0;
  try {
    const type = config.feedTypes[0];
    const r = await deps.fetchText(`${CIVIC_BASE}/race/search?startDate=${config.electionDate}&endDate=${config.electionDate}&limit=20000&type=${encodeURIComponent(type)}`, { timeoutMs: 15_000 });
    providerOk = r.status === 200;
    const rows = providerOk ? searchRows(parseJson(Buffer.from(r.text))) : [];
    providerDetail = `HTTP ${r.status}, ${rows.length} ${type} races in ${r.ms} ms`;
    matched = Object.keys(matchCivic(tracked.races, rows)).length;
  } catch { providerDetail = "request failed"; }
  add("provider", providerOk, providerDetail);
  add("tracked races", tracked.races.length > 0 && tracked.missing.length === 0, `${tracked.races.length} tracked, ${tracked.missing.length} named but missing from the index; ${matched} matched in the first feed`);
  const secrets = { cronSecret: (deps.env.CRON_SECRET?.length ?? 0) >= MIN_SECRET_LENGTH, manualSecret: (deps.env.INTELLIGENCE_CAPTURE_SECRET?.length ?? 0) >= MIN_SECRET_LENGTH };
  add("secrets", secrets.cronSecret && secrets.manualSecret, `scheduler secret ${secrets.cronSecret ? "set" : "missing or short"}, manual secret ${secrets.manualSecret ? "set" : "missing or short"}`);
  return { ok: checks.every((c) => c.ok), store: { kind: store.kind, durable: store.durable }, checks };
}
