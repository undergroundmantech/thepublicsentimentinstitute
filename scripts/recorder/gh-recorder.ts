// The GitHub Actions flight recorder's command line. Run from the repository root:
//
//   node --import ./scripts/intelligence/ts-resolve.mjs scripts/recorder/gh-recorder.ts capture --store <archive-dir>
//   node --import ./scripts/intelligence/ts-resolve.mjs scripts/recorder/gh-recorder.ts session --store <archive-dir> --until <ISO> [--max-minutes 350] [--git] [--branch <archive-branch>]
//   node --import ./scripts/intelligence/ts-resolve.mjs scripts/recorder/gh-recorder.ts verify  --store <dir> [--from YYYY-MM-DD] [--to YYYY-MM-DD]
//   node --import ./scripts/intelligence/ts-resolve.mjs scripts/recorder/gh-recorder.ts restore --store <dir> --at <ISO> [--race <raceId>]
//
// `session` stays up and records one slot at every slot boundary (RECORDER_SLOT_SECONDS: 30, 60, 120, 300 or 600;
// default 600) until --until or --max-minutes; with --git it commits and pushes the archive checkout after each slot.
//
// Environment (all optional): RECORDER_SITE_BASE (default https://onpointpolitics.us; "none" skips the published layer),
// RECORDER_SCOPE (forecast | priority | all; default forecast = Senate, Governor and House), RECORDER_SLOT_SECONDS, RECORDER_DEADLINE_MS,
// RECORDER_CONCURRENCY, and GitHub's own GITHUB_EVENT_NAME, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_SHA.
// With `--store postgres`, ONPOINT_DATABASE_URL is read (never logged). civicAPI and the production site are public. Exit 2 means the slot FAILED (its record is still written).

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { XIndex, XRace } from "@/app/results/2026/live";
import { defaultFetchText, type FetchText } from "@/app/lib/intelligence/captureRunner";
import { loadTrackedRaces, runnerConfig } from "@/app/lib/intelligence/captureConfig";
import { FsStore, resolveStore, type ObjectStore } from "@/app/lib/intelligence/captureStore";
import { publicEngineIdentity, stateAt } from "@/app/lib/intelligence/checkpointArchive";
import { defaultFetchPublished, readHealth, recorderWindows, restoreAt, runSlot, slotMsFrom, verifyArchive, type SlotContext, type SlotDeps } from "@/app/lib/intelligence/ghRecorder";
import { readCountyExpectations } from "@/app/portal/intelligence/inputs";

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i > 0 ? args[i + 1] ?? null : null; };
const env = process.env;
const storeDir = opt("store");
if (!storeDir || !["capture", "session", "verify", "restore"].includes(cmd)) {
  console.error("usage: gh-recorder.ts <capture|session|verify|restore> --store <dir> [...]");
  process.exit(64);
}
// `--store postgres` records into ONPOINT_DATABASE_URL (database oop, TLS required); anything else is a directory
const store: ObjectStore = (() => {
  if (storeDir !== "postgres") return new FsStore(storeDir);
  const r = resolveStore({ ...env, INTELLIGENCE_CAPTURE_STORE: "postgres" });
  if (!r.store) { console.error(`store: ${r.problem}`); process.exit(78); }
  return r.store;
})();

async function races(scope: string): Promise<XRace[]> {
  if (scope === "priority") return (await loadTrackedRaces()).races;
  const index = JSON.parse(await readFile(path.join(process.cwd(), "public", "results", "2026", "index.json"), "utf8")) as XIndex;
  const withFeed = index.races.filter((r) => (r.civ?.t?.length ?? 0) > 0);
  return scope === "all" ? withFeed : withFeed.filter((r) => r.k === "sen" || r.k === "gov" || r.k === "house");
}

const positive = (s: string | undefined, fallback: number, max: number) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback; };
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Commits and pushes the archive checkout one git operation at a time. Slots that finish while a push is running go
 *  into the next commit; a commit whose push failed is pushed with the next one. */
class GitPublisher {
  private pending: string[] = [];
  private chain: Promise<void> = Promise.resolve();
  private unpushed = false;
  pushes = 0;
  failures = 0;
  lastError: string | null = null;
  private dir: string;
  private branch: string;
  constructor(dir: string, branch: string) { this.dir = dir; this.branch = branch; }
  private git(...a: string[]) { return promisify(execFile)("git", a, { cwd: this.dir, maxBuffer: 64 << 20 }); }
  enqueue(slot: string, outcome: string) { this.pending.push(`${slot} ${outcome}`); this.chain = this.chain.then(() => this.flush()); }
  private async flush() {
    const slots = this.pending.splice(0);
    try {
      if (slots.length) {
        // staged object files are written beside their target and renamed or linked in; never commit them
        await this.git("add", "-A", "--", ".", ":(exclude)*.tmp");
        const staged = await this.git("diff", "--cached", "--quiet").then(() => false, () => true);
        if (staged) {
          const title = slots.length === 1 ? `slot ${slots[0]}` : `slots ${slots[0].split(" ")[0]} to ${slots[slots.length - 1].split(" ")[0]} (${slots.length})`;
          await this.git("commit", "-q", "-m", `${title} run ${env.GITHUB_RUN_ID ?? "local"}.${env.GITHUB_RUN_ATTEMPT ?? "0"}`, "-m", slots.join("\n"));
          this.unpushed = true;
        }
      }
      if (!this.unpushed) return;
      for (let i = 1; ; i++) {
        try { await this.git("push", "-q", "origin", `HEAD:${this.branch}`); this.pushes++; this.unpushed = false; return; } catch (e) {
          if (i >= 4) throw e;
          await sleep(i * 2_000);
          await this.git("fetch", "-q", "--depth=5", "origin", this.branch).then(() => this.git("rebase", "-q", "FETCH_HEAD")).catch(() => this.git("rebase", "--abort").catch(() => undefined));
        }
      }
    } catch (e) {
      this.failures++;
      this.lastError = String((e as { stderr?: string }).stderr || (e as Error).message).replace(/x-access-token:[^@]+@/g, "x-access-token:***@").slice(0, 300);
      console.log(JSON.stringify({ at: new Date().toISOString(), gitError: this.lastError }));
    }
  }
  /** Waits for queued pushes, then makes one last attempt at anything not yet pushed. */
  async drain() {
    this.chain = this.chain.then(() => this.flush());
    await this.chain;
    return { ok: !this.unpushed, pushes: this.pushes, failures: this.failures, lastError: this.lastError };
  }
}

/** civicAPI answers an occasional 503 under load; one retry after a pause, then the failure is recorded as it is. */
const fetchWithRetry: FetchText = async (url, o) => {
  try { const r = await defaultFetchText(url, o); if (r.status < 500) return r; } catch { /* retried below */ }
  await new Promise((ok) => setTimeout(ok, 1_500));
  return defaultFetchText(url, o);
};

if (cmd === "capture" || cmd === "session") {
  const scope = ["forecast", "priority", "all"].includes(env.RECORDER_SCOPE ?? "") ? env.RECORDER_SCOPE! : "forecast";
  const site = env.RECORDER_SITE_BASE === "none" ? null : env.RECORDER_SITE_BASE || "https://onpointpolitics.us";
  if (site && !/^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(site)) { console.error("RECORDER_SITE_BASE must be an https origin"); process.exit(64); }
  const tracked = await races(scope);
  const now = () => new Date();
  const context: SlotContext = {
    trigger: env.GITHUB_EVENT_NAME === "schedule" ? "SCHEDULE" : env.GITHUB_EVENT_NAME === "workflow_dispatch" || !env.GITHUB_EVENT_NAME ? "MANUAL" : "OTHER",
    githubRunId: env.GITHUB_RUN_ID ?? null, githubRunAttempt: env.GITHUB_RUN_ATTEMPT ?? null, codeSha: env.GITHUB_SHA?.slice(0, 12) ?? null,
  };
  const slotMs = slotMsFrom(env.RECORDER_SLOT_SECONDS);
  const base = runnerConfig(env);
  // a slot's capture must finish inside the slot; a 10-minute slot keeps the original 6-minute budget
  const deadlineCap = Math.min(420_000, Math.max(20_000, slotMs - 5_000));
  const config = { ...base, windows: recorderWindows(env.INTELLIGENCE_CAPTURE_UNTIL, slotMs), deadlineMs: positive(env.RECORDER_DEADLINE_MS, Math.min(360_000, deadlineCap), deadlineCap), detailConcurrency: positive(env.RECORDER_CONCURRENCY, 4, 8) };
  const deps = (): SlotDeps => ({
    store, fetchText: fetchWithRetry, fetchPublished: defaultFetchPublished, now, races: tracked, config, siteBase: site, context, slotMs,
    archive: { now, expFor: (r) => readCountyExpectations(r.st, r.id), raceHistory: true, engine: publicEngineIdentity({ VERCEL_GIT_COMMIT_SHA: env.GITHUB_SHA }) },
  });
  const summary = (res: Awaited<ReturnType<typeof runSlot>>) => {
    const r = res.record;
    return {
      outcome: res.outcome, slot: res.slot, key: res.key, scope, races: tracked.length,
      ...(r && { delaySeconds: r.delaySeconds, phase: r.phase, missedSlots: r.missedSlots.length, run: r.run && { ok: r.run.ok, races: r.run.races, feeds: r.run.feeds, errorCount: r.run.errorCount, deadlineHit: r.run.deadlineHit, firstErrors: r.run.errors.slice(0, 5) },
        checkpoint: r.checkpoint && { present: r.checkpoint.present, complete: r.checkpoint.complete, rawStatus: r.checkpoint.rawStatus, counts: r.checkpoint.counts, problems: r.checkpoint.problems },
        published: r.published.map((p) => ({ name: p.name, status: p.status, bytes: p.bytes, error: p.error })), files: r.files.length, bytes: r.files.reduce((s, f) => s + f.bytes, 0) }),
    };
  };

  if (cmd === "capture") {
    const res = await runSlot(deps());
    console.log(JSON.stringify({ ...summary(res), health: await readHealth(store) }, null, 2));
    process.exit(res.outcome === "FAILED" ? 2 : 0);
  }

  // session: one slot at every boundary until --until or --max-minutes, committing and pushing each slot when --git is set
  const until = Date.parse(opt("until") ?? "");
  const maxMinutes = Number(opt("max-minutes") ?? 350);
  if (!Number.isFinite(until) || !(maxMinutes > 0)) { console.error("session needs --until <ISO> and a positive --max-minutes"); process.exit(64); }
  const stopAt = Math.min(until, Date.now() + maxMinutes * 60_000);
  const git = args.includes("--git") ? new GitPublisher(storeDir, opt("branch") ?? "recorder/archive-2026") : null;
  const tally: Record<string, number> = {};
  let running = false, skipped = 0;
  const tick = async () => {
    if (running) { skipped++; console.log(JSON.stringify({ at: new Date().toISOString(), skipped: "previous slot still capturing" })); return; }
    running = true;
    try {
      const res = await runSlot(deps());
      tally[res.outcome] = (tally[res.outcome] ?? 0) + 1;
      const s = summary(res);
      console.log(JSON.stringify({ at: new Date().toISOString(), outcome: s.outcome, slot: s.slot, races: s.races, missed: (s as { missedSlots?: number }).missedSlots, files: (s as { files?: number }).files, errors: (s as { run?: { errorCount: number } | null }).run?.errorCount }));
      if (git && res.record) git.enqueue(res.slot, res.outcome);
    } catch (e) {
      tally.ERROR = (tally.ERROR ?? 0) + 1;
      console.log(JSON.stringify({ at: new Date().toISOString(), error: (e as Error).message?.slice(0, 200) }));
    } finally { running = false; }
  };
  while (Date.now() < stopAt) {
    void tick();
    const next = Math.floor(Date.now() / slotMs) * slotMs + slotMs;
    // a quarter second into the slot, so the clock has certainly crossed the boundary
    await sleep(Math.max(0, next - Date.now()) + 250);
  }
  while (running) await sleep(500);
  const pushed = git ? await git.drain() : null;
  console.log(JSON.stringify({ done: new Date().toISOString(), slotSeconds: slotMs / 1000, tally, skipped, git: pushed, health: await readHealth(store) }, null, 2));
  process.exit(git && !pushed?.ok ? 1 : 0);
}

if (cmd === "verify") {
  const today = new Date().toISOString().slice(0, 10);
  const rep = await verifyArchive(store, opt("from") ?? "2026-10-25", opt("to") ?? today);
  console.log(JSON.stringify({ ...rep, problems: rep.problems.slice(0, 100), problemCount: rep.problems.length, health: await readHealth(store) }, null, 2));
  process.exit(rep.problems.length ? 1 : 0);
}

if (cmd === "restore") {
  const at = opt("at");
  if (!at || !Number.isFinite(Date.parse(at))) { console.error("--at <ISO time> is required"); process.exit(64); }
  const iso = new Date(at).toISOString();
  const got = await restoreAt(store, iso);
  if (!got) { console.log(JSON.stringify({ at: iso, found: false })); process.exit(1); }
  const race = opt("race");
  const ix = got.published["results-index"] as XIndex | undefined;
  console.log(JSON.stringify({
    at: iso, found: true, slot: got.record.slot, status: got.record.status, finishedAt: got.record.finishedAt,
    published: Object.fromEntries(Object.entries(got.published).map(([k, v]) => [k, k === "results-index" ? { asOf: ix?.asOf, races: ix?.races.length } : typeof v])),
    checkpoint: got.checkpoint && { id: got.checkpoint.manifest.checkpointId, complete: got.checkpoint.manifest.complete, calculated: got.checkpoint.calculated.length, problems: got.checkpoint.problems },
    ...(race && { race: { published: ix?.races.find((r) => r.id === race) ?? null, state: await stateAt(store, race, iso, "2026-10-25") } }),
  }, null, 2));
}
