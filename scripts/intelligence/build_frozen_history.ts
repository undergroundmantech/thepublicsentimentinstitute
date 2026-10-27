// Frozen pre-election forecast history, rebuilt from the published artifact's own git history.
//
//   npm run intelligence:frozen-history
//
// Every commit that changed public/forecast/model.json published a forecast. This reads each of them as it was, keeps the
// figures the model itself printed (margin, GOP win probability, p10/p90, candidate vote estimates) and writes them, with
// the commit that published them, to data/intelligence/history/frozen-forecasts.json.gz.
//
// Nothing is recomputed: a past value is never re-derived with a newer model. A race is written at a snapshot only when its
// figures changed from the snapshot before it. A commit time is not a publication time: each snapshot is classified against the
// production deployment records (PUBLISHED / UNVERIFIED / INTERNAL / REVERTED), and only PUBLISHED ones reach a public chart, at
// the time the deployment went live. Commits whose file lacks the published shape are listed and skipped.
//
// Re-run after each forecast publication (with --fetch-deployments) to extend the history. Deterministic for a given git
// history and deployment record.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MODEL = "public/forecast/model.json";
const OUT = "data/intelligence/history/frozen-forecasts.json.gz";

interface RawCand { name?: string; party?: string; pct?: number; votes?: number }
interface RawRace { id?: string; dem?: string | null; gop?: string | null; cands?: RawCand[]; est?: { margin?: number; prob?: number; p10?: number; p90?: number } | null }
interface RawModel { meta?: { updated?: string; sims?: number }; races?: RawRace[] }

const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, encoding: "utf8" });

// Publication evidence: the GitHub Deployments that Vercel creates for every production deployment, saved to DEPLOYS
// (`--fetch-deployments` refreshes it with the gh CLI). A snapshot is PUBLISHED only when a production deployment that reported
// success served a model.json byte-identical to it (same git blob). Everything else is kept for diagnostics, never published.
const DEPLOYS = "data/intelligence/history/production-deployments.json";

export type PublicationClass = "PUBLISHED" | "UNVERIFIED" | "INTERNAL" | "REVERTED";
export interface FrozenSnapshot {
  snapshot: string; commit: string; committedAt: string; modelUpdated: string | null; sims: number | null; races: number;
  blob: string; onMain: boolean;
  /** Headline class. A published snapshot stays PUBLISHED even if later reverted; REVERTED is for unpublished ones. */
  class: PublicationClass;
  /** First time a successful production deployment served this exact file. */
  publishedAt: string | null;
  deployment: { id: number; sha: string } | null;
  revertedBy: string | null;
  reason: string;
}
/** A moment the production file changed: a successful deployment serving a different model.json than the one before it. */
export interface Publication { liveAt: string; deploymentId: number; deploymentSha: string; snapshotIndex: number }
export type FrozenPoint = [snapshotIndex: number, margin: number | null, probGop: number | null, p10: number | null, p90: number | null, cands: [string, string, number | null][]];
export interface FrozenRace { dem: string | null; gop: string | null; pts: FrozenPoint[] }
export interface FrozenHistoryFile {
  schema: "TPSI_FROZEN_FORECAST_HISTORY/2";
  source: string;
  marginSign: "GOP_MINUS_DEM_PP";
  probabilityOf: "GOP_WIN";
  note: string;
  evidence: { source: string; fetchedAt: string; deployments: number; successful: number; first: string | null; last: string | null; unresolved: number };
  snapshots: FrozenSnapshot[];
  publications: Publication[];
  /** Production files that match no readable snapshot (for example a file without the published shape). */
  unmatchedPublications: { liveAt: string; deploymentId: number; blob: string }[];
  skipped: { commit: string; reason: string }[];
  races: Record<string, FrozenRace>;
}
interface DeployRecord { id: number; sha: string; createdAt: string; state: string; live: string | null }

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** `<rev>:<path>` → blob id, or null when the commit or file is not there. One git process for the whole list. */
function blobs(revs: string[]): (string | null)[] {
  if (!revs.length) return [];
  const out = execFileSync("git", ["cat-file", "--batch-check=%(objectname) %(objecttype)"], { cwd: ROOT, input: revs.map((r) => `${r}:${MODEL}`).join("\n") + "\n", encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.trim().split("\n").map((l) => (l.endsWith(" blob") ? l.split(" ")[0] : null));
}
const isAncestor = (a: string, b: string) => { try { execFileSync("git", ["merge-base", "--is-ancestor", a, b], { cwd: ROOT }); return true; } catch { return false; } };

function fetchDeployments(): void {
  const remote = git("remote", "get-url", "origin").trim().match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!remote) throw new Error("origin is not a GitHub remote");
  const q = `query($endCursor:String){repository(owner:"${remote[1]}",name:"${remote[2]}"){deployments(environments:["Production"],first:100,after:$endCursor,orderBy:{field:CREATED_AT,direction:ASC}){pageInfo{hasNextPage endCursor} nodes{databaseId commitOid createdAt state statuses(first:20){nodes{state createdAt}}}}}}`;
  const jq = ".data.repository.deployments.nodes[] | {id:.databaseId, sha:.commitOid, createdAt, state, live:([.statuses.nodes[]|select(.state==\"SUCCESS\")|.createdAt]|min)}";
  const lines = execFileSync("gh", ["api", "graphql", "--paginate", "-f", `query=${q}`, "--jq", jq], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim().split("\n").filter(Boolean);
  const deployments = lines.map((l) => JSON.parse(l) as DeployRecord);
  writeFileSync(path.join(ROOT, DEPLOYS), JSON.stringify({ source: `GitHub Deployments API, environment Production, ${remote[1]}/${remote[2]} (created by Vercel)`, fetchedAt: new Date().toISOString(), deployments }, null, 1) + "\n");
  console.log(`fetched ${deployments.length} production deployment records`);
}

function main() {
  if (process.argv.includes("--fetch-deployments")) fetchDeployments();
  const ev = JSON.parse(readFileSync(path.join(ROOT, DEPLOYS), "utf8")) as { source: string; fetchedAt: string; deployments: DeployRecord[] };
  const fromGit = git("log", "--full-history", "--reverse", "--format=%H %cI", "HEAD", "origin/main", "--", MODEL).trim().split("\n").filter(Boolean).map((l) => { const [h, t] = l.split(" "); return { h, t: new Date(t).toISOString() }; });
  // a production file whose commit is not in either history (for example a rewritten branch) is still evidence: read it at the deployed commit
  const known = new Set(blobs(fromGit.map((c) => c.h)));
  const served = ev.deployments.filter((d) => d.live);
  const extra = new Map<string, { h: string; t: string }>();
  blobs(served.map((d) => d.sha)).forEach((b, i) => { if (b && !known.has(b) && !extra.has(b)) extra.set(b, { h: served[i].sha, t: new Date(git("show", "-s", "--format=%cI", served[i].sha).trim()).toISOString() }); });
  const log = [...fromGit, ...extra.values()].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const out: FrozenHistoryFile = {
    schema: "TPSI_FROZEN_FORECAST_HISTORY/2", source: `git log of ${MODEL}`, marginSign: "GOP_MINUS_DEM_PP", probabilityOf: "GOP_WIN",
    note: "Figures exactly as each model.json printed them. Races are listed at a snapshot only when their figures changed from the snapshot before it in this list; an empty point marks a race the snapshot did not carry. Only PUBLISHED snapshots, at their publication times, may appear on a public page.",
    evidence: { source: ev.source, fetchedAt: ev.fetchedAt, deployments: ev.deployments.length, successful: 0, first: null, last: null, unresolved: 0 },
    snapshots: [], publications: [], unmatchedPublications: [], skipped: [], races: {},
  };
  const last = new Map<string, string>();
  const commitBlobs = blobs(log.map((c) => c.h));
  const parentBlobs = blobs(log.map((c) => `${c.h}^`));
  for (const [li, { h, t }] of log.entries()) {
    let model: RawModel;
    try { model = JSON.parse(git("show", `${h}:${MODEL}`)) as RawModel; } catch { out.skipped.push({ commit: h, reason: "unreadable or not JSON" }); continue; }
    const races = (model.races ?? []).filter((r) => typeof r.id === "string" && r.est && num(r.est.margin) !== null);
    if (!races.length) { out.skipped.push({ commit: h, reason: "no races with an est.margin" }); continue; }
    const si = out.snapshots.length;
    out.snapshots.push({
      snapshot: h.slice(0, 8), commit: h, committedAt: t, modelUpdated: model.meta?.updated ?? null, sims: num(model.meta?.sims), races: races.length,
      blob: commitBlobs[li] ?? "", onMain: isAncestor(h, "origin/main"), class: "UNVERIFIED", publishedAt: null, deployment: null, revertedBy: null, reason: "",
    });
    const present = new Set<string>();
    for (const r of races) {
      const id = r.id as string;
      present.add(id);
      const cands: [string, string, number | null][] = (r.cands ?? []).filter((c) => typeof c.name === "string").map((c) => [c.name as string, c.party ?? "", num(c.votes)]);
      const pt: FrozenPoint = [si, num(r.est?.margin), num(r.est?.prob), num(r.est?.p10), num(r.est?.p90), cands];
      const key = JSON.stringify(pt.slice(1)) + `|${r.dem ?? ""}|${r.gop ?? ""}`;
      if (last.get(id) === key) continue;
      last.set(id, key);
      const row = (out.races[id] ??= { dem: r.dem ?? null, gop: r.gop ?? null, pts: [] });
      row.dem = r.dem ?? row.dem; row.gop = r.gop ?? row.gop;
      row.pts.push(pt);
    }
    for (const [id, k] of last) if (k !== "absent" && !present.has(id)) { last.set(id, "absent"); out.races[id].pts.push([si, null, null, null, null, []]); }
  }

  // publication evidence: successful production deployments, in the order they went live, mapped to the file each one served
  const ok = ev.deployments.filter((d) => d.live).sort((a, b) => Date.parse(a.live!) - Date.parse(b.live!));
  const depBlobs = blobs(ok.map((d) => d.sha));
  out.evidence.successful = ok.length;
  out.evidence.first = ok[0]?.live ?? null;
  out.evidence.last = ok.at(-1)?.live ?? null;
  out.evidence.unresolved = depBlobs.filter((b, i) => b === null && Date.parse(ok[i].live!) >= Date.parse(log[0]?.t ?? "")).length;
  const firstWithBlob = new Map<string, number>();
  out.snapshots.forEach((s, i) => { if (!firstWithBlob.has(s.blob)) firstWithBlob.set(s.blob, i); });
  let liveBlob: string | null = null;
  ok.forEach((d, i) => {
    const b = depBlobs[i];
    if (!b || b === liveBlob) return;
    liveBlob = b;
    const si = firstWithBlob.get(b);
    if (si === undefined) out.unmatchedPublications.push({ liveAt: d.live!, deploymentId: d.id, blob: b });
    else out.publications.push({ liveAt: d.live!, deploymentId: d.id, deploymentSha: d.sha, snapshotIndex: si });
  });
  const failedBlobs = new Set(blobs(ev.deployments.filter((d) => !d.live).map((d) => d.sha)).filter((b): b is string => !!b));

  out.snapshots.forEach((s, i) => {
    const pub = ok.findIndex((d, k) => depBlobs[k] === s.blob && Date.parse(d.live!) >= Date.parse(s.committedAt));
    // reverted: a later descendant commit put back the file this commit replaced
    const before = parentBlobs[log.findIndex((c) => c.h === s.commit)];
    const undo = before && before !== s.blob ? out.snapshots.slice(i + 1).find((l) => l.blob === before && isAncestor(s.commit, l.commit)) : undefined;
    s.revertedBy = undo?.commit ?? null;
    if (pub >= 0) {
      s.class = "PUBLISHED"; s.publishedAt = ok[pub].live; s.deployment = { id: ok[pub].id, sha: ok[pub].sha };
      s.reason = `served by production deployment ${ok[pub].id} (${ok[pub].sha.slice(0, 8)})${undo ? `; later reverted by ${undo.commit.slice(0, 8)}` : ""}`;
    } else if (Date.parse(s.committedAt) < Date.parse(out.evidence.first ?? "")) { s.class = "UNVERIFIED"; s.reason = "committed before the first deployment record"; }
    else if (undo) { s.class = "REVERTED"; s.reason = `reverted by ${undo.commit.slice(0, 8)} and never served by a successful production deployment`; }
    else if (!s.onMain) { s.class = "INTERNAL"; s.reason = "never on the production branch and never served by a production deployment"; }
    else { s.class = "UNVERIFIED"; s.reason = failedBlobs.has(s.blob) ? "a production deployment was attempted but never reported success" : "on the production branch, but no successful production deployment served this file"; }
  });

  mkdirSync(path.join(ROOT, path.dirname(OUT)), { recursive: true });
  const json = JSON.stringify(out);
  writeFileSync(path.join(ROOT, OUT), gzipSync(Buffer.from(json), { level: 9 }));
  const pts = Object.values(out.races).reduce((n, r) => n + r.pts.length, 0);
  const by = out.snapshots.reduce<Record<string, number>>((m, s) => ((m[s.class] = (m[s.class] ?? 0) + 1), m), {});
  console.log(`snapshots ${out.snapshots.length} (skipped ${out.skipped.length}), races ${Object.keys(out.races).length}, points ${pts}, ${(json.length / 1e6).toFixed(2)} MB json, ${(readFileSync(path.join(ROOT, OUT)).length / 1e6).toFixed(2)} MB gz`);
  console.log(`classes ${JSON.stringify(by)}; reverted ${out.snapshots.filter((s) => s.revertedBy).length}; publications ${out.publications.length}, unmatched ${out.unmatchedPublications.length}; deployments ${out.evidence.successful}/${out.evidence.deployments} successful, unresolved ${out.evidence.unresolved}`);
}

main();
