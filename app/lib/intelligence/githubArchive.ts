// Mirror of the checkpoint archive into a private GitHub repository, used when the primary store is Blob. With
// INTELLIGENCE_CAPTURE_STORE=github the archive is already in the repository and the mirror is skipped.
//
// All pending checkpoints go into ONE commit (Git Data API: tree with inline contents → commit → fast-forward ref), so
// a checkpoint is either wholly in the repository or not at all, and the number of writes does not grow with races.
// The mirror head advances only after GitHub accepts the ref update; a failure leaves the checkpoints pending for the
// next run. The token is sent only to the GitHub API, never logged and never returned.

import { gunzipSync } from "node:zlib";
import { intact, jsonBytes, parseJson, sha256Hex, withChecksum, type ObservationRecord } from "./capture";
import type { ObjectStore } from "./captureStore";
import { listCheckpoints, publicationKeyOf, type CalcRecord, type CheckpointManifest, type PublicationEvent } from "./checkpointArchive";
import { githubTargetFrom, type Fetch, type GitHubTarget } from "./githubStore";

export { githubTargetFrom };
export type { Fetch, GitHubTarget };

const MIRROR_HEAD = "heads/archive-mirror.json";

class MirrorError extends Error { readonly code: string; constructor(code: string) { super(code); this.code = code; } }

async function gh<T>(t: GitHubTarget, method: string, path: string, body?: unknown): Promise<T> {
  const res = await t.fetch(`${t.apiBase}/repos/${t.repo}${path}`, {
    method, headers: { authorization: `Bearer ${t.token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new MirrorError(`GITHUB_${res.status}`);
  return (await res.json()) as T;
}

/** "archive/2026-11-04/calculated/X.jsonl" → "2026/11-04/calculated/X.jsonl" */
export const repoPathOf = (key: string) => { const [, day, ...rest] = key.split("/"); return `${day.slice(0, 4)}/${day.slice(5)}/${rest.join("/")}`; };

export interface MirrorResult { status: "MIRRORED" | "NOTHING_PENDING" | "FAILED"; checkpoints: number; commit: string | null; code: string | null }

/** Files for one checkpoint: its manifest and layers as stored, plus the raw responses first recorded at it. */
async function filesFor(store: ObjectStore, manifestKey: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const mBuf = await store.get(manifestKey);
  const manifest = parseJson(mBuf) as CheckpointManifest | null;
  if (!mBuf || !manifest) throw new MirrorError("MANIFEST_UNREADABLE");
  files[repoPathOf(manifestKey)] = mBuf.toString("utf8");
  for (const ref of [manifest.layers.calculated, manifest.layers.snapshot]) {
    if (ref.status !== "WRITTEN") continue;
    const b = await store.get(ref.key);
    if (!b) throw new MirrorError("LAYER_MISSING");
    files[repoPathOf(ref.key)] = b.toString("utf8");
  }
  const pub = await store.get(publicationKeyOf(manifestKey));
  if (pub) files[repoPathOf(publicationKeyOf(manifestKey))] = pub.toString("utf8");
  const calc = files[repoPathOf(manifest.layers.calculated.key)] ?? "";
  const raws: string[] = [];
  for (const line of calc.split("\n").filter(Boolean)) {
    const c = JSON.parse(line) as CalcRecord;
    if (c.designation !== "PUBLIC_ENGINE" || c.raw?.outcome !== "NEW") continue;
    const obs = parseJson(await store.get(c.raw.observationKey)) as ObservationRecord | null;
    const body = obs ? await store.get(obs.rawRef) : null;
    const payload = body ? gunzipSync(body).toString("utf8") : null;
    raws.push(JSON.stringify({ raceId: c.raceId, observationId: c.raw.observationId, contentId: c.raw.contentId, rawSha256: obs?.rawSha256 ?? null, rawRef: obs?.rawRef ?? null, payload }));
  }
  if (raws.length) files[repoPathOf(manifestKey).replace("/checkpoints/", "/raw/").replace(/\.json$/, ".jsonl")] = raws.join("\n") + "\n";
  return files;
}

/** Commit every checkpoint not yet mirrored (up to `max`) in one commit. */
export async function mirrorPending(store: ObjectStore, t: GitHubTarget, opts: { now: () => Date; max?: number; fromDay?: string }): Promise<MirrorResult> {
  const head = parseJson(await store.get(MIRROR_HEAD)) as { lastKey: string; checksum: string } | null;
  const last = head && intact(head) ? head.lastKey : "";
  const fromDay = last ? last.split("/")[1] : opts.fromDay ?? "2026-11-03";
  const pending = (await listCheckpoints(store, fromDay, opts.now().toISOString().slice(0, 10))).filter((k) => k > last).slice(0, opts.max ?? 20);
  if (!pending.length) return { status: "NOTHING_PENDING", checkpoints: 0, commit: null, code: null };
  try {
    const files: Record<string, string> = {};
    for (const k of pending) Object.assign(files, await filesFor(store, k));
    const tree = Object.entries(files).map(([path, content]) => ({ path, mode: "100644", type: "blob", content }));
    let commit: string | null = null;
    for (let attempt = 0; attempt < 2 && !commit; attempt++) {
      const ref = await gh<{ object: { sha: string } }>(t, "GET", `/git/ref/heads/${t.branch}`);
      const parent = await gh<{ tree: { sha: string } }>(t, "GET", `/git/commits/${ref.object.sha}`);
      const newTree = await gh<{ sha: string }>(t, "POST", "/git/trees", { base_tree: parent.tree.sha, tree });
      const c = await gh<{ sha: string }>(t, "POST", "/git/commits", { message: `archive: ${pending.length} checkpoint(s) through ${pending[pending.length - 1].split("/").pop()}`, tree: newTree.sha, parents: [ref.object.sha] });
      try { await gh(t, "PATCH", `/git/refs/heads/${t.branch}`, { sha: c.sha, force: false }); commit = c.sha; }
      catch (e) { if (!(e instanceof MirrorError && e.code === "GITHUB_422") || attempt === 1) throw e; }
    }
    await store.put(MIRROR_HEAD, jsonBytes(withChecksum({ lastKey: pending[pending.length - 1], commit, at: opts.now().toISOString() })), "application/json");
    return { status: "MIRRORED", checkpoints: pending.length, commit, code: null };
  } catch (e) {
    return { status: "FAILED", checkpoints: 0, commit: null, code: e instanceof MirrorError ? e.code : (e as Error)?.name === "TimeoutError" ? "TIMEOUT" : "ERROR" };
  }
}

// ---- recovery ----------------------------------------------------------------------------------------------------------

/** Reads one file back from the mirror. */
export async function readMirrorFile(t: GitHubTarget, path: string): Promise<string | null> {
  const res = await t.fetch(`${t.apiBase}/repos/${t.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(t.branch)}`, {
    headers: { authorization: `Bearer ${t.token}`, accept: "application/vnd.github.raw", "x-github-api-version": "2022-11-28" }, signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new MirrorError(`GITHUB_${res.status}`);
  return res.text();
}

export interface VerifyResult { ok: boolean; complete: boolean; problems: string[] }

/** Checks a recovered checkpoint: manifest checksum, each layer's hash, and each raw payload's hash. */
export function verifyCheckpointFiles(files: { manifest: string; calculated: string | null; snapshot: string | null; publication?: string | null; raw?: string | null }): VerifyResult {
  const problems: string[] = [];
  let m: CheckpointManifest;
  try { m = JSON.parse(files.manifest) as CheckpointManifest; } catch { return { ok: false, complete: false, problems: ["manifest is not JSON"] }; }
  if (!intact(m)) problems.push("manifest checksum mismatch");
  for (const [name, ref, body] of [["calculated", m.layers.calculated, files.calculated], ["snapshot", m.layers.snapshot, files.snapshot]] as const) {
    if (ref.status !== "WRITTEN") continue;
    if (body === null) problems.push(`${name} layer missing`);
    else if (sha256Hex(Buffer.from(body, "utf8")) !== ref.sha256) problems.push(`${name} layer hash mismatch`);
  }
  if (files.publication) {
    let ev: PublicationEvent | null = null;
    try { ev = JSON.parse(files.publication) as PublicationEvent; } catch { /* reported below */ }
    if (!ev || !intact(ev) || ev.snapshotLayer.sha256 !== m.layers.snapshot.sha256) problems.push("publication event does not match this checkpoint");
  }
  for (const line of (files.raw ?? "").split("\n").filter(Boolean)) {
    const r = JSON.parse(line) as { raceId: string; rawSha256: string | null; payload: string | null };
    if (r.payload === null || r.rawSha256 === null) problems.push(`raw for ${r.raceId} not recovered`);
    else if (sha256Hex(r.payload) !== r.rawSha256) problems.push(`raw for ${r.raceId} hash mismatch`);
  }
  return { ok: problems.length === 0, complete: problems.length === 0 && m.complete, problems };
}
