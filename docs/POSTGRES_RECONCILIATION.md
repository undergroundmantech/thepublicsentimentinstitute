# PostgreSQL reconciliation: OnPoint election archive (DRAFT)

Status: sections 1–6 are **design only** (the relational schema below is not implemented). What is implemented and tested is narrower:

- **Implemented:** the recorder's existing object store, kept in one write-once table, `onpoint.recorder_objects`, in the dedicated database `oop`. The migration is [db/migrations/20261031_recorder_objects.sql](../db/migrations/20261031_recorder_objects.sql). The adapter is [postgresStore.ts](../app/lib/intelligence/postgresStore.ts), selected with `INTELLIGENCE_CAPTURE_STORE=postgres` (or `gh-recorder.ts --store postgres`).
  - The database refuses UPDATE (except `heads/` and `public/timeline/`), DELETE and TRUNCATE.
  - A CHECK constraint ties every body to its SHA-256, and the adapter re-checks it on read.
  - The adapter refuses a connection string that is not `oop`, is badly escaped, or is unencrypted off the local machine.
- **Tested:** against a disposable local PostgreSQL 17 only ([tests/intelligence/postgresStore.test.ts](../tests/intelligence/postgresStore.test.ts), plus one real civicAPI slot recorded, verified and restored).
- **Not done:** the migration has not been run on the shared server. That server offers no TLS, and the current credential is rejected.

- The draft DDL is in [db/staging/0001_onpoint_init.sql](../db/staging/0001_onpoint_init.sql).
- The supplied handoff, `OnPoint_Politics_Postgres_Schema_Handoff(1).zip`, was not in the workspace when this was written. The compatibility table in section 6 was therefore built from the code's own contracts. It must be re-run against the handoff schema once that file is available.

## 1. Placement

| Requirement | Design |
| --- | --- |
| Server | The existing CFPredictor PostgreSQL server |
| Database | The dedicated `oop` database, schema `onpoint`. It shares nothing with CFPredictor's `users` database: no schema, role, extension, grant or cross-database query. |
| Credentials | `onpoint_owner` runs migrations only. `onpoint_writer` is used by the recorder. `onpoint_reader` is used by the site. They are issued outside the repository and stored as deployment secrets, never in code. |
| Backups | Independent of CFPredictor's backups: nightly base backup plus WAL archiving for the `onpoint` database. Through the November 3–4 window, take an extra logical dump (`pg_dump -Fc onpoint`) every hour. |
| CFPredictor | Never altered. This migration is not run until server access and the migration are explicitly authorized. |

## 2. Four layers, mapped to the code

| Layer | Schema | Tables | Code source | Object key today |
| --- | --- | --- | --- | --- |
| RAW | `onpoint_raw` | `payload` | `capture.ts` `rawRef` | `raw/<sha256>.gz` |
| RAW | `onpoint_raw` | `observation`, `observation_candidate` | `ObservationRecord` (TPSI_CAPTURE/2) | `obs/<race>/<compactTime>_<contentId12>.json` |
| RAW | `onpoint_raw` | `capture_run` | `RunRecord` | `runs/<day>/<compactTime>_<runId>.json` |
| RAW | `onpoint_raw` | `feed_delta` | `recordFeedDelta` | `feed/<feed>/<compactTime>_<sha12>.json` |
| RAW | `onpoint_raw` | `race_head`, `feed_head` | head records | `heads/race/<race>.json`, `heads/feed/<feed>.json` |
| CALCULATED | `onpoint_calc` | `checkpoint` | `CheckpointManifest` (ONPOINT_CHECKPOINT/1) | `archive/<day>/checkpoints/<id>.json` |
| CALCULATED | `onpoint_calc` | `checkpoint_source` | `RaceCapture.raw` (`RawSnapshotRef`) | inside the manifest and calculated layer |
| CALCULATED | `onpoint_calc` | `calculation` | `CalcRecord` and `EngineOutputs` | `archive/<day>/calculated/<id>.jsonl` |
| PREDICTIVE FORECASTS | `onpoint_forecast` | `model_output`, `model_head` | `ModelOutputPoint` (`raceHistoryStore`) | `model/<race>/…`, `model-shadow/<race>/…`, `heads/model*/<race>.json` |
| PUBLISHED | `onpoint_pub` | `snapshot_race` | `SnapshotRecord` | `archive/<day>/snapshot/<id>.jsonl` |
| PUBLISHED | `onpoint_pub` | `snapshot_document` | `PublicSnapshotDocument` | `public/snapshots/<day>/<snapshotId>.json` |
| PUBLISHED | `onpoint_pub` | `publication_event`, `publication_race` | `PublicationEvent` | `archive/<day>/published/<id>.json` |
| PUBLISHED | `onpoint_pub` | `public_head` | `PublicHead` | `heads/public-snapshot.json` |
| PUBLISHED | `onpoint_pub` | `timeline_entry` | `TimelineEntry` | `public/timeline/civic-<civicId>.json` |
| Operations | `onpoint_ops` | `slot`, `health`, `worker_lease` | `SlotRecord`, `Health` (`ghRecorder.ts`) | `slots/<day>/<compactTime>.json`, `heads/gh-recorder.json` |

**Replay records** (`replays/<dataset>/<model>/<version>/<checkpoint>.jsonl`) are research output. They stay in the object store and are not given a table. If they ever need one, it belongs in a separate research schema that has no path into `onpoint_pub`.

## 3. Rules the schema enforces

- **Vote counts are `BIGINT`.** This covers `observation_candidate.votes`, `official_outstanding_ballots`, `calculation.reported_total` and `estimated_final_total`.
- **Every instant is `TIMESTAMPTZ`.** Instants are written in UTC. The ET schedule is converted at the scheduler, never at storage.
- **Records are kept whole.** Each row keeps the exact record the code wrote, in `record` / `outputs` / `displayed` (JSONB). The checksum (`checksum`, `output_sha256`, `values_sha256`) is kept beside it, so a row can be re-verified the same way `verifyArchive` checks objects today.
- **Raw payloads are stored compressed.** `onpoint_raw.payload.body_gz` is `BYTEA` holding the gzip bytes, set to `STORAGE EXTERNAL` so PostgreSQL does not compress them a second time. The JSONB columns use PostgreSQL's own TOAST compression; on PostgreSQL 14 or later, set `COMPRESSION lz4` once the server version is confirmed.
- **Provider IDs are separate from internal IDs.**
  - `race_id` is always the internal id, such as `sen-GA`.
  - The provider's id is `(provider, provider_race_id)`, which maps to `race_id` through `race_provider_id`.
  - The public timeline stays keyed by the provider id because the public route is (`civic-<civicId>`).
- **Two reporting figures, never combined.**
  - `provider_reporting_pct` is the provider's figure. Its basis is in `provider_reporting_basis`, which is `PROVIDER_UNSPECIFIED` today.
  - `model_completeness_pct` is the engine's estimate of the share of the final vote that has been counted.
  - They live in separate columns everywhere and are never merged.
- **SHADOW output cannot be published.**
  - Every published row (`snapshot_race`, `publication_race`) references `calculation(calculation_id, designation)`.
  - On those published rows, `designation` is pinned to `PUBLIC_ENGINE` by a CHECK.
  - A shadow calculation therefore cannot be inserted into the published layer, whether by mistake or by automation.
  - `model_output` rows with `source_class = 'SHADOW_MODEL'` have no foreign-key path into `onpoint_pub` at all.
- **Recomputed is not published.**
  - `snapshot_race.classification` keeps `PUBLIC_ENGINE_RECOMPUTED_NOT_VERIFIED_PUBLISHED` separate from `PUBLICATION_READY`.
  - A `publication_event` row exists only after the canonical head moved. This is the same rule as `publicSnapshot.ts`.
- **A reused source keeps its original time.**
  - When a source is unchanged, `checkpoint_source` points at the earlier `observation`.
  - That observation's `first_observed_at` is never rewritten. Only `race_head.last_confirmed_at` advances.
  - A reused calculation keeps its own `calculated_at`, and `reused_from` names the calculation it came from.

## 4. Idempotency, transactions and heads

| Store operation today | PostgreSQL equivalent |
| --- | --- |
| `putIfAbsent(key)` → `CREATED` / `EXISTS` | `INSERT … ON CONFLICT (natural key) DO NOTHING RETURNING 1`. No row returned means `EXISTS`. Natural keys: `payload.sha256`, `observation(race_id, content_id)`, `calculation_id`, `checkpoint_id`, `point_id`, `publication_id`, `(recorder, slot_at)`. |
| `put(head)` | `UPDATE … SET … WHERE <pk> AND checksum = $previous`. Zero rows updated means another writer moved the head; re-read it and decide again, never overwrite blindly. |
| `commit()` (GitHub store batches a run into one commit) | One transaction per checkpoint, in this order: raw (`payload`, `observation`, `race_head`), then `checkpoint` + `checkpoint_source` + `calculation`, then `snapshot_race`, then commit. Publication is a second transaction: `snapshot_document`, `publication_event`, `publication_race`, `public_head`, `timeline_entry`. A failed publication never rolls back the archive. |
| `discard()` | `ROLLBACK`. |

Retries: transient failures (connection reset, serialization failure `40001`, deadlock `40P01`) are retried three times with backoff (250 ms, 1 s, 4 s). Because every insert is idempotent, a retry after an unknown outcome is safe.

## 5. Primary recorder (election night)

### Window and cadence

| Period | Cadence | Clock |
| --- | --- | --- |
| Nov 3, 7:00 PM ET to Nov 4, 7:00 AM ET (2026-11-04 00:00Z to 12:00Z) | A checkpoint every 10 s; fall back to 30 s if a cycle overruns | Scheduled in `America/New_York`, stored in UTC |
| The following 7 days | Checkpoints at :05, :15, :25, :35, :45 and :55 past each hour | Scheduled in `America/New_York`, stored in UTC |

DST ends on Nov 1, 2026, so the whole window is in EST (UTC−5). The scheduler still computes slots through the IANA zone rather than a fixed offset.

### Three separate loops

1. **Poll.** Fetch the provider feeds and race details. Store new payloads and observations (RAW). It never calculates.
2. **Recalculate.** For each race whose head changed since its last calculation, run the public engine (and the shadow engine, if one is configured) and write `calculation`. Unchanged inputs are carried over through `reused_from`.
3. **Checkpoint.** On each slot, freeze the current heads into a `checkpoint` and its `checkpoint_source` rows, write `snapshot_race`, and offer the snapshot to publication. A checkpoint that reuses an unchanged source points at the original observation, so the source keeps its original timestamp and freshness.

### Interfaces (TypeScript, to be implemented)

```ts
interface Clock { now(): Date }
interface Scheduler { slots(from: Date, to: Date): Date[]; next(after: Date): Date; cadenceAt(t: Date): "10s" | "30s" | "hourly-5" }
interface Db { tx<T>(fn: (q: Queryable) => Promise<T>, opts?: { retries?: number }): Promise<T>; health(): Promise<{ ok: boolean; latencyMs: number }> }
interface WorkerLease { acquire(recorder: string, holder: string, ttlMs: number): Promise<boolean>; renew(...): Promise<boolean>; release(...): Promise<void> }
interface Poller { poll(slot: Date): Promise<{ runId: string; changedRaces: string[]; errors: RunError[] }> }
interface Recalculator { recalc(raceIds: string[], at: Date): Promise<{ computed: number; reused: number; failed: number }> }
interface Checkpointer { checkpoint(slot: Date, runId: string): Promise<{ checkpointId: string; complete: boolean; incompleteReasons: string[] }> }
interface Publisher { publish(checkpointId: string): Promise<PublishResult> }   // existing publicSnapshot.ts semantics
interface StatusReporter { slot(rec: SlotRecord): Promise<void>; health(): Promise<Health> }
interface Replayer { restoreAt(at: Date, raceId?: string): Promise<unknown>; replay(fromCheckpoint: string, toCheckpoint: string, model: ModelIdentity): AsyncIterable<ReplayRecord> }
```

### Recovery and replay

- **Missed slots.** These are recorded in `slot.missed_slots`, never back-filled with invented values.
- **Worker failure.** A crashed worker's lease lapses after its TTL (30 s), and a standby takes over.
- **Database down.** The poll loop writes to the existing object store (`INTELLIGENCE_CAPTURE_STORE=fs`, or the GitHub archive) so no raw data is lost. A loader then imports those objects through the same idempotent inserts. The object store's checksums let the import be verified.
- **Replay.** `restoreAt(t)` returns, for each race, the latest checkpoint at or before `t`, without interpolation. This matches `ghRecorder.restoreAt`.

### Storage estimate

See section 7. These figures were measured from a real capture run, not assumed.

## 6. Schema-to-TypeScript compatibility

This compares the code contracts with the draft DDL. It does **not** cover the handoff schema, because that file has not been supplied.

| TypeScript field | Column | Status |
| --- | --- | --- |
| `ObservationRecord.raceId` (internal) | `observation.race_id` | Compatible |
| `ObservationRecord.provider.name` and the civic id | `provider`, `provider_race_id` | Compatible. The provider id is stored separately. |
| `candidates[].votes` (number) | `observation_candidate.votes BIGINT` | Compatible. JS numbers are exact up to 2^53. |
| `reportingPct` + `reportingPctBasis` | `provider_reporting_pct`, `provider_reporting_basis` | Compatible |
| `sourceTimestamp: string \| null` | `source_timestamp TIMESTAMPTZ NULL` | Compatible. ISO strings parse directly. |
| `firstObservedAt`, `ingestedAt` | `TIMESTAMPTZ NOT NULL` | Compatible |
| `rawRef` / `rawSha256` | `raw_sha256 → payload.sha256` | Compatible. The key is derived from the sha. |
| `EngineOutputs.completenessPct` | `calculation.model_completeness_pct` | Compatible. It is the model's estimate, kept separate from the provider figure. |
| `Displayed.providerReportingPct` | `snapshot_race.provider_reporting_pct` | Compatible |
| `CalcRecord.designation` | `calculation.designation` + composite FK | Compatible. SHADOW is blocked from `onpoint_pub`. |
| `CalcRecord.reusedFrom` | `calculation.reused_from` (self FK) | Compatible |
| `SnapshotRecord.classification` | CHECK on both values | Compatible |
| `PublicationEvent.previousPublicationId` | Self FK | Compatible |
| `ModelOutputPoint.sourceClass` | CHECK on all three values | Compatible |
| `RunRecord.trigger` (`CRON` / `MANUAL`) | CHECK also allows `PRIMARY` | Extension for the primary recorder |
| `CheckpointManifest.counts`, `layers` | Inside `checkpoint.record` (JSONB) | Kept whole, not normalized |
| `ObjectStore.list(prefix)` | Indexed range queries on `(race_id, time)` | Needs a store adapter; not written |

**Gap.** There is no `PgStore` implementation of `ObjectStore` yet. The narrowest path is an adapter that maps each key prefix to the tables above and keeps `putIfAbsent` / head semantics. It is not written, because the migration and server access are not authorized.

## 7. GitHub recorder coverage and the storage estimate

See [FLIGHT_RECORDER_GITHUB.md](FLIGHT_RECORDER_GITHUB.md) for the recorder itself.

### Coverage: 506 vs 1,016 races (measured 2026-10-31 14:30Z)

Each scope was run for one slot of `gh-recorder.ts capture` into an empty `/tmp` store. Settings: `RECORDER_SITE_BASE=none`, live civicAPI, a pre-election feed.

| | `RECORDER_SCOPE=forecast` (default) | `RECORDER_SCOPE=all` |
| --- | --- | --- |
| Races tracked | 506 (Senate, Governor, House) | 902 of the index's 1,016. The other 114 have no civicAPI feed type in the index. |
| Recorded | 506 NEW | 856 NEW; 46 SKIPPED as `NO_MATCH` (e.g. `psc-AL-place-1`, `court-AL-place-7`, `ag-SC`) |
| Feeds | 4 OK | 45 OK |
| Untracked feed contests (recorded as UNAVAILABLE) | 6 | 9,285 |
| Slot status | RECORDED, checkpoint complete | **PARTIAL** on every slot while the 46 races have no match |
| Wall time | 17.3 s | 39.3 s |
| New bytes, first slot | 11.2 MB | 36.0 MB |

Why the counts differ:
- 1,016 is every race in the results index.
- 506 is the forecast scope. It is exactly the set the race-history API pattern (`sen|gov|house`) and the frozen forecast dataset cover.
- The non-forecast races have no OnPoint model output, so recording them adds raw and calculated layers but no forecast history.

**Recommendation.** Keep `forecast` scope for the GitHub recorder on election night.
- `all` fits the 10-minute cadence (39 s).
- However, it would mark every slot PARTIAL, which hides real failures behind the 46 known no-match races.
- It would also grow the archive repository about 3.2× faster: up to about 216 MB per hour if everything changes, against about 67 MB per hour for `forecast`.

Before `all` is used, the 46 no-match races need a mapping or an explicit "expected unavailable" list.

### Measured unit sizes (forecast scope, one slot)

| Item | Size |
| --- | --- |
| Raw provider response (gzip) | about 1.04 KB per race change (530,650 B / 509) |
| Observation record (JSON) | about 9.5 KB per race change (4,812,117 B / 506) |
| Model-output point (JSON) | about 1.6 KB per race change (827,214 B / 506) |
| Calculated + snapshot layers | about 2.58 MB per checkpoint for 506 races, written every checkpoint |

### Primary recorder storage estimate, 12-hour window (7 PM–7 AM ET), 506 races

These are JSON byte counts before PostgreSQL compression. TOAST compression of JSONB typically reduces repetitive records of this kind several-fold, but that has not been measured here.

| Cadence | Checkpoints | Calculated + snapshot (every checkpoint) | Source changes, if each race updates about once a minute | Total | Worst case: every race changes every checkpoint |
| --- | --- | --- | --- | --- | --- |
| 10 s | 4,320 | 11.1 GB | 4.4 GB | about 15.5 GB | about 37.8 GB |
| 30 s | 1,440 | 3.7 GB | 4.4 GB | about 8.1 GB | about 12.6 GB |
| Following 7 days, at :05/:15/…/:55 | 1,008 | 2.6 GB | small | about 2.6 GB | n/a |

- Source-change volume is set by how often the provider updates, not by the checkpoint cadence. That is why it is the same at 10 s and 30 s.
- The per-checkpoint calculated layer dominates at 10 s. In the draft schema, `checkpoint_source` (about 200 B per race per checkpoint, about 0.44 GB at 10 s) already records "unchanged, see earlier observation".
- If the calculated and snapshot rows did the same, storing a `reused_from` pointer instead of a full copy for unchanged races, the 10 s total would fall to roughly the source-change volume plus pointers, about 5 GB before compression.
- This is a recommendation for the PgStore adapter. It is not implemented.

### Measured in PostgreSQL 17 (one real forecast-scope slot, 506 races, 2026-10-31)

2,547 objects held 11 MB of bodies and took 5.0 MB on disk, including the table, TOAST and index.

| Family | Stored / raw |
| --- | --- |
| `obs/` | 0.16 |
| `archive/` (calculated + snapshot) | 0.26 |
| `heads/` | 0.41 |
| `model/` | 0.96 |
| `raw/` (already gzip) | 1.00 |

Applying these ratios to the table above gives these on-disk estimates, before WAL:

- 12 h at 10 s: about 4.4 GB.
- 12 h at 30 s: about 2.5 GB.
- The following 7 days: about 0.7 GB.
- Worst case at 10 s, with every race changing every checkpoint: about 11–13 GB.

Add about 1 GB for WAL at default settings. The allotment is about 9.77 GiB, so 30 s, or 10 s with typical change rates, fits; the 10 s worst case does not. These are pre-election payloads. Election-night observations carry county detail and will be larger, so check free space during the night.
