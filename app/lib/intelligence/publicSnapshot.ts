// The canonical public snapshot pathway (ONPOINT_PUBLIC_SNAPSHOT=1; off by default, the browser desk stays live).
//
//   raw observation → CALCULATED_PUBLIC_ENGINE → SNAPSHOT (PUBLICATION_READY) → public document → head moved → PUBLISHED
//
// The document is written once. Moving heads/public-snapshot.json to it is what makes it available through
// /api/results/public-snapshot. The PUBLISHED event is written only after that move succeeds; if the event cannot be
// written the head is moved back, so nothing is served without its publication record. On the GitHub store all of
// this lands in the checkpoint's single commit. The record says which version was made available and when, not what
// any individual visitor rendered.

import { intact, jsonBytes, parseJson, sha256Hex, withChecksum } from "./capture";
import type { ObjectStore } from "./captureStore";
import { CHECKPOINT_SCHEMA, publicationKeyOf, readCheckpoint, type ModelIdentity, type PublicationEvent, type SnapshotRecord } from "./checkpointArchive";

export const PUBLIC_HEAD = "heads/public-snapshot.json";
export const PUBLIC_DELIVERY = "/api/results/public-snapshot";

export interface PublicRace {
  raceId: string;
  civicId: number | null;
  status: "OK" | "UNAVAILABLE";
  reason: string | null;
  calculationId: string;
  calculatedOutputSha256: string | null;
  model: ModelIdentity;
  observedAt: string | null;
  sourceUpdatedAt: string | null;
  testData: boolean | null;
  visibility: SnapshotRecord["visibility"];
  displayed: SnapshotRecord["displayed"];
  providerCalls: string[];
}

export interface PublicSnapshotDocument {
  type: "ONPOINT_PUBLIC_SNAPSHOT";
  schema: typeof CHECKPOINT_SCHEMA;
  snapshotId: string;
  publicationId: string;
  checkpointId: string;
  publishedAt: string;
  races: PublicRace[];
  checksum: string;
}

interface PublicHead { snapshotId: string | null; publicationId: string | null; documentKey: string | null; documentSha256: string | null; publishedAt: string | null; checkpointStartedAt?: string | null; checksum: string }

export type PublishResult =
  | { status: "PUBLISHED"; event: PublicationEvent; timeline: "UPDATED" | "SKIPPED" | "FAILED" }
  | { status: "NOT_PUBLISHED"; code: string };

const fail = (code: string): PublishResult => ({ status: "NOT_PUBLISHED", code });

async function readHead(store: ObjectStore): Promise<{ head: PublicHead; buf: Buffer } | null> {
  const buf = await store.get(PUBLIC_HEAD);
  const head = parseJson(buf) as PublicHead | null;
  return buf && head && intact(head) ? { head, buf } : null;
}

const toPublic = (s: SnapshotRecord): PublicRace => ({
  raceId: s.raceId, civicId: s.civicId, status: s.status, reason: s.reason, calculationId: s.calculationId, calculatedOutputSha256: s.calculatedOutputSha256, model: s.model,
  observedAt: s.observedAt, sourceUpdatedAt: s.sourceUpdatedAt, testData: s.testData, visibility: s.visibility,
  // the desk does not show test returns before the first polls close
  displayed: s.visibility === "HIDDEN_BEFORE_CLOSE" ? null : s.displayed, providerCalls: s.providerCalls,
});

/** Publish one archived checkpoint through the canonical pathway. Never throws. */
export async function publishCheckpoint(store: ObjectStore, manifestKey: string, now: () => Date): Promise<PublishResult> {
  let cp: Awaited<ReturnType<typeof readCheckpoint>>;
  let prev: Awaited<ReturnType<typeof readHead>>;
  try { cp = await readCheckpoint(store, manifestKey); prev = await readHead(store); } catch { return fail("CHECKPOINT_UNREADABLE"); }
  if (!cp) return fail("CHECKPOINT_UNREADABLE");
  if (cp.problems.length) return fail("CHECKPOINT_INTEGRITY");
  // a race missing from the raw layer is served as UNAVAILABLE in this version; it does not hold back the others
  if (cp.manifest.layers.calculated.status !== "WRITTEN" || cp.manifest.layers.snapshot.status !== "WRITTEN") return fail("CHECKPOINT_INCOMPLETE");
  if (cp.publication) return fail("ALREADY_PUBLISHED");
  if (!cp.snapshot.length || cp.snapshot.some((s) => s.classification !== "PUBLICATION_READY")) return fail("NOT_PUBLICATION_READY");
  // a run that finishes late must not replace newer published output; its checkpoint stays archived, unpublished
  const since = prev?.head.checkpointStartedAt;
  if (since && Date.parse(cp.manifest.startedAt) <= Date.parse(since)) return fail("OUT_OF_ORDER");

  const id = cp.manifest.checkpointId;
  const snapshotId = `snap_${id}`, publicationId = `pub_${id}`;
  const publishedAt = now().toISOString();
  const doc = withChecksum<Omit<PublicSnapshotDocument, "checksum">>({ type: "ONPOINT_PUBLIC_SNAPSHOT", schema: CHECKPOINT_SCHEMA, snapshotId, publicationId, checkpointId: id, publishedAt, races: cp.snapshot.map(toPublic) });
  const docBuf = jsonBytes(doc), documentKey = `public/snapshots/${cp.manifest.startedAt.slice(0, 10)}/${snapshotId}.json`, documentSha256 = sha256Hex(docBuf);
  try { await store.putIfAbsent(documentKey, docBuf, "application/json"); } catch { return fail("DOCUMENT_WRITE_FAILED"); }
  try { await store.put(PUBLIC_HEAD, jsonBytes(withChecksum({ snapshotId, publicationId, documentKey, documentSha256, publishedAt, checkpointStartedAt: cp.manifest.startedAt })), "application/json"); } catch { return fail("ACTIVATION_FAILED"); }

  const event = withChecksum<Omit<PublicationEvent, "checksum">>({
    layer: "PUBLISHED", classification: "PUBLISHED", schema: CHECKPOINT_SCHEMA, publicationId, snapshotId, checkpointId: id, publishedAt, delivery: PUBLIC_DELIVERY,
    document: { key: documentKey, sha256: documentSha256 }, snapshotLayer: { key: cp.manifest.layers.snapshot.key, sha256: cp.manifest.layers.snapshot.sha256 },
    previousPublicationId: prev?.head.publicationId ?? null,
    races: doc.races.flatMap((r) => (r.status === "OK" && r.displayed && r.calculatedOutputSha256 ? [{ raceId: r.raceId, civicId: r.civicId, calculationId: r.calculationId, calculatedOutputSha256: r.calculatedOutputSha256, model: r.model }] : [])),
  });
  try { await store.putIfAbsent(publicationKeyOf(manifestKey), jsonBytes(event), "application/json"); } catch {
    try {
      await store.put(PUBLIC_HEAD, prev?.buf ?? jsonBytes(withChecksum({ snapshotId: null, publicationId: null, documentKey: null, documentSha256: null, publishedAt: null })), "application/json");
      return fail("PUBLICATION_RECORD_FAILED");
    } catch { return fail("PUBLICATION_RECORD_FAILED_ROLLBACK_FAILED"); }
  }

  let timeline: "UPDATED" | "SKIPPED" | "FAILED" = "SKIPPED";
  // per-race timelines are rewritten on change; on GitHub that would cost a request per race per checkpoint
  if (store.kind !== "github") { try { await updateTimelines(store, doc); timeline = "UPDATED"; } catch { timeline = "FAILED"; } }
  return { status: "PUBLISHED", event, timeline };
}

/** The document the canonical endpoint serves, verified against the head that points at it. */
export async function readPublicSnapshot(store: ObjectStore): Promise<PublicSnapshotDocument | null> {
  const h = await readHead(store);
  if (!h?.head.documentKey) return null;
  const buf = await store.get(h.head.documentKey);
  if (!buf || sha256Hex(buf) !== h.head.documentSha256) return null;
  const doc = parseJson(buf) as PublicSnapshotDocument | null;
  return doc && intact(doc) && doc.publicationId === h.head.publicationId ? doc : null;
}

/** GET /api/results/public-snapshot. CDN-cached, so visitors never reach the store. */
export async function servePublicSnapshot(env: Record<string, string | undefined>, store: () => ObjectStore | null): Promise<Response> {
  const reply = (status: number, body: unknown, cache: string) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-content-type-options": "nosniff", "cache-control": cache } });
  if (env.ONPOINT_PUBLIC_SNAPSHOT !== "1") return reply(404, { error: "not_enabled" }, "no-store");
  let doc: PublicSnapshotDocument | null = null;
  try { const s = store(); doc = s ? await readPublicSnapshot(s) : null; } catch { doc = null; }
  if (!doc) return reply(503, { error: "no_publication" }, "public, s-maxage=5");
  return reply(200, doc, "public, max-age=0, s-maxage=15, stale-while-revalidate=30");
}

// ---- per-race published timeline (RaceDesk compatibility) ---------------------------------------------------------------
// A derived index, rebuildable from the immutable publication documents: one entry per change in published output, at
// most one per minute (a later publication in the same minute replaces the entry, as the legacy recorder did).

export interface TimelineEntry {
  publicationId: string;
  publishedAt: string;
  calculationId: string;
  modelVersion: string;
  outputSha256: string;
  observedAt: string | null;
  sourceUpdatedAt: string | null;
  testData: boolean | null;
  providerReportingPct: number | null;
  providerCalled: boolean;
  candidates: { name: string; votes: number; winProbability: number | null }[];
  countedMarginPp: number | null;
  expectedFinalMarginPp: number;
  projectedSharePct: { A: number; B: number } | null;
  estimatedOutstandingVotes: number;
}
interface TimelineIndex { civicId: number; raceId: string; entries: TimelineEntry[]; checksum: string }

export const timelineKey = (civicId: number) => `public/timeline/civic-${civicId}.json`;

async function updateTimelines(store: ObjectStore, doc: PublicSnapshotDocument): Promise<void> {
  for (const r of doc.races) {
    if (r.civicId === null || r.status !== "OK" || !r.displayed || !r.calculatedOutputSha256) continue;
    const key = timelineKey(r.civicId);
    const cur = parseJson(await store.get(key)) as TimelineIndex | null;
    if (cur && !intact(cur)) throw new Error("TIMELINE_CORRUPT");
    const entries = cur?.entries ?? [];
    const last = entries[entries.length - 1];
    if (last?.outputSha256 === r.calculatedOutputSha256) continue;
    const d = r.displayed, fin = d.estimatedFinalSides;
    const e: TimelineEntry = {
      publicationId: doc.publicationId, publishedAt: doc.publishedAt, calculationId: r.calculationId, modelVersion: r.model.version, outputSha256: r.calculatedOutputSha256,
      observedAt: r.observedAt, sourceUpdatedAt: r.sourceUpdatedAt, testData: r.testData, providerReportingPct: d.providerReportingPct, providerCalled: r.providerCalls.length > 0,
      candidates: d.candidates.map((c) => ({ name: c.name, votes: c.votes, winProbability: c.winProbability })),
      countedMarginPp: d.countedMarginPp, expectedFinalMarginPp: d.expectedFinalMarginPp,
      projectedSharePct: fin.t ? { A: (100 * fin.a) / fin.t, B: (100 * fin.b) / fin.t } : null, estimatedOutstandingVotes: d.estimatedOutstandingVotes,
    };
    if (last && last.publishedAt.slice(0, 16) === doc.publishedAt.slice(0, 16)) entries[entries.length - 1] = e; else entries.push(e);
    await store.put(key, jsonBytes(withChecksum({ civicId: r.civicId, raceId: r.raceId, entries })), "application/json");
  }
}

export async function readTimeline(store: ObjectStore, civicId: number): Promise<TimelineEntry[]> {
  const t = parseJson(await store.get(timelineKey(civicId))) as TimelineIndex | null;
  if (!t) return [];
  if (!intact(t)) throw new Error("TIMELINE_CORRUPT");
  return t.entries;
}
