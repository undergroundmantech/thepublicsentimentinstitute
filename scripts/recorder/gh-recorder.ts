// The GitHub Actions flight recorder's command line. Run from the repository root:
//
//   node --import ./scripts/intelligence/ts-resolve.mjs scripts/recorder/gh-recorder.ts capture --store <archive-dir>
//   node --import ./scripts/intelligence/ts-resolve.mjs scripts/recorder/gh-recorder.ts verify  --store <dir> [--from YYYY-MM-DD] [--to YYYY-MM-DD]
//   node --import ./scripts/intelligence/ts-resolve.mjs scripts/recorder/gh-recorder.ts restore --store <dir> --at <ISO> [--race <raceId>]
//
// Environment (all optional): RECORDER_SITE_BASE (default https://onpointpolitics.us; "none" skips the published layer),
// RECORDER_SCOPE (forecast | priority | all; default forecast = Senate, Governor and House), RECORDER_DEADLINE_MS,
// RECORDER_CONCURRENCY, and GitHub's own GITHUB_EVENT_NAME, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_SHA.
// No credentials are read: civicAPI and the production site are public. Exit 2 means the slot FAILED (its record is still written).

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { XIndex, XRace } from "@/app/results/2026/live";
import { defaultFetchText, type FetchText } from "@/app/lib/intelligence/captureRunner";
import { loadTrackedRaces, runnerConfig } from "@/app/lib/intelligence/captureConfig";
import { FsStore } from "@/app/lib/intelligence/captureStore";
import { publicEngineIdentity, stateAt } from "@/app/lib/intelligence/checkpointArchive";
import { defaultFetchPublished, readHealth, recorderWindows, restoreAt, runSlot, verifyArchive, type SlotContext } from "@/app/lib/intelligence/ghRecorder";
import { readCountyExpectations } from "@/app/portal/intelligence/inputs";

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i > 0 ? args[i + 1] ?? null : null; };
const env = process.env;
const storeDir = opt("store");
if (!storeDir || !["capture", "verify", "restore"].includes(cmd)) {
  console.error("usage: gh-recorder.ts <capture|verify|restore> --store <dir> [...]");
  process.exit(64);
}
const store = new FsStore(storeDir);

async function races(scope: string): Promise<XRace[]> {
  if (scope === "priority") return (await loadTrackedRaces()).races;
  const index = JSON.parse(await readFile(path.join(process.cwd(), "public", "results", "2026", "index.json"), "utf8")) as XIndex;
  const withFeed = index.races.filter((r) => (r.civ?.t?.length ?? 0) > 0);
  return scope === "all" ? withFeed : withFeed.filter((r) => r.k === "sen" || r.k === "gov" || r.k === "house");
}

const positive = (s: string | undefined, fallback: number, max: number) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback; };

/** civicAPI answers an occasional 503 under load; one retry after a pause, then the failure is recorded as it is. */
const fetchWithRetry: FetchText = async (url, o) => {
  try { const r = await defaultFetchText(url, o); if (r.status < 500) return r; } catch { /* retried below */ }
  await new Promise((ok) => setTimeout(ok, 1_500));
  return defaultFetchText(url, o);
};

if (cmd === "capture") {
  const scope = ["forecast", "priority", "all"].includes(env.RECORDER_SCOPE ?? "") ? env.RECORDER_SCOPE! : "forecast";
  const site = env.RECORDER_SITE_BASE === "none" ? null : env.RECORDER_SITE_BASE || "https://onpointpolitics.us";
  if (site && !/^https:\/\/[A-Za-z0-9.-]+(:\d+)?$/.test(site)) { console.error("RECORDER_SITE_BASE must be an https origin"); process.exit(64); }
  const tracked = await races(scope);
  const now = () => new Date();
  const context: SlotContext = {
    trigger: env.GITHUB_EVENT_NAME === "schedule" ? "SCHEDULE" : env.GITHUB_EVENT_NAME === "workflow_dispatch" || !env.GITHUB_EVENT_NAME ? "MANUAL" : "OTHER",
    githubRunId: env.GITHUB_RUN_ID ?? null, githubRunAttempt: env.GITHUB_RUN_ATTEMPT ?? null, codeSha: env.GITHUB_SHA?.slice(0, 12) ?? null,
  };
  const base = runnerConfig(env);
  const config = { ...base, windows: recorderWindows(env.INTELLIGENCE_CAPTURE_UNTIL), deadlineMs: positive(env.RECORDER_DEADLINE_MS, 360_000, 420_000), detailConcurrency: positive(env.RECORDER_CONCURRENCY, 4, 8) };
  const res = await runSlot({
    store, fetchText: fetchWithRetry, fetchPublished: defaultFetchPublished, now, races: tracked, config, siteBase: site, context,
    archive: { now, expFor: (r) => readCountyExpectations(r.st, r.id), raceHistory: true, engine: publicEngineIdentity({ VERCEL_GIT_COMMIT_SHA: env.GITHUB_SHA }) },
  });
  const r = res.record;
  console.log(JSON.stringify({
    outcome: res.outcome, slot: res.slot, key: res.key, scope, races: tracked.length,
    ...(r && { delaySeconds: r.delaySeconds, phase: r.phase, missedSlots: r.missedSlots.length, run: r.run && { ok: r.run.ok, races: r.run.races, feeds: r.run.feeds, errorCount: r.run.errorCount, deadlineHit: r.run.deadlineHit, firstErrors: r.run.errors.slice(0, 5) },
      checkpoint: r.checkpoint && { present: r.checkpoint.present, complete: r.checkpoint.complete, rawStatus: r.checkpoint.rawStatus, counts: r.checkpoint.counts, problems: r.checkpoint.problems },
      published: r.published.map((p) => ({ name: p.name, status: p.status, bytes: p.bytes, error: p.error })), files: r.files.length, bytes: r.files.reduce((s, f) => s + f.bytes, 0) }),
    health: await readHealth(store),
  }, null, 2));
  process.exit(res.outcome === "FAILED" ? 2 : 0);
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
