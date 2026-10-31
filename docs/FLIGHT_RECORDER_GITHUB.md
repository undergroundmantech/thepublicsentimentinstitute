# GitHub flight recorder (Gate D)

This recorder runs separately from the Vercel capture path (`/api/flightrecorder/capture`). It does not replace it. It records one complete snapshot for each 10-minute UTC slot and commits it to an archive branch or repository.

## Files

| Path | What it does |
|---|---|
| [.github/workflows/flight-recorder.yml](../.github/workflows/flight-recorder.yml) | Runs on the `*/10` cron and on `workflow_dispatch`. A concurrency group allows one run at a time. The archive push is retried up to 5 times. |
| [scripts/recorder/gh-recorder.ts](../scripts/recorder/gh-recorder.ts) | Command line with three commands: `capture`, `verify` and `restore`. |
| [app/lib/intelligence/ghRecorder.ts](../app/lib/intelligence/ghRecorder.ts) | Slot logic. It reuses `runTick`/`runCapture` and `archiveCheckpoint` unchanged. |
| [tests/intelligence/ghRecorder.test.ts](../tests/intelligence/ghRecorder.test.ts) | 10 tests that use synthetic data only. |

## What each slot stores

The RAW, CALCULATED and PUBLISHED layers are kept separate.

- **RAW_OBSERVED:** the civicAPI feeds and every tracked race's detail response. They are gzipped and named by sha256 (`raw/`, `observations/`, `feeds/`, `runs/`). An unchanged response points to the earlier copy instead of being stored again.
- **CALCULATED:** the public live engine's outputs and the recomputed snapshot (`archive/<day>/{checkpoints,calculated,snapshot}`). The manifest is written last and carries hashes. Each new calculation also gets a Race History point.
- **PUBLISHED:** what production actually served at that moment, gzipped and named by sha256 (`published/raw/`). This covers:
  - `/results/2026/index.json`
  - `/forecast/model.json`
  - `/api/results/public-snapshot`, which returns 404 while its flag is off. That 404 is recorded too.

  The in-browser live desk is computed on the client, so the CALCULATED snapshot is labelled *recomputed, not verified as published* until `ONPOINT_PUBLIC_SNAPSHOT` is enabled.
- **`slots/<day>/<time>.json`:** the slot record. It is protected by a checksum and contains:
  - the actual start and finish times, and `delaySeconds`;
  - the trigger, the GitHub run ID and attempt, and the code SHA;
  - the phase;
  - the status: `RECORDED`, `PARTIAL` or `FAILED`;
  - the provider errors;
  - the checkpoint integrity check;
  - every immutable file written, with its sha256;
  - `missedSlots`, the slots skipped since the previous record. Missed slots are never backfilled.
- **`heads/gh-recorder.json`:** health information: the last slot, the last recorded slot, consecutive failures and the missed-slot total.

## Rules

- **Idempotent.** If a slot already has a record, the run exits as `ALREADY_RECORDED` without making any provider request. If two writers reach the same slot, the first one wins, because the slot record is written with `putIfAbsent`.
- **Interrupted runs.** Git commits are all or nothing, so a job that is killed partway through leaves nothing behind. The next slot then lists it under `missedSlots`.
- **Outages.** A civicAPI outage produces a `FAILED` record, which is still committed, and the job fails so GitHub sends a notification. A production outage or a 5xx on one race produces `PARTIAL`. Invalid payloads are kept as evidence and flagged.
- **Credentials.** None are needed. civicAPI and the site are public, and `GITHUB_TOKEN` is used only to push.
- **Scope.** `RECORDER_SCOPE` controls which races are captured:
  - `forecast` (default): Senate, Governor and House, 506 races;
  - `priority`: the 15-state research set;
  - `all`: every race that has a civicAPI type.

## Commands

```bash
R="node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/intelligence/ts-resolve.mjs scripts/recorder/gh-recorder.ts"
$R capture --store <archive-dir>
$R verify  --store <archive-dir> [--from 2026-11-03 --to 2026-11-12]   # exit 1 on any problem
$R restore --store <archive-dir> --at 2026-11-04T02:15:00Z --race sen-GA
```

## Verified on 2026-10-31 (real civicAPI and production)

| Check | Result |
|---|---|
| Live slot, first run | 506 races, 4 feeds, a complete checkpoint and 3 published captures, in 28 s. About 9.0 MB of new files. |
| Same slot run again | `ALREADY_RECORDED`, no requests made. |
| `verify` | 0 problems. |
| `restore` | Returned the slot, the published index (1016 races) and the checkpoint. |
| No `node_modules`, only the workflow's sparse-checkout paths | `RECORDED`, 506/506, checkpoint complete. |
| Earlier run | civicAPI returned 503 for 3 races. One retry after 1.5 s was added. |

## Before enabling it (review items)

1. **The schedule only runs from the default branch.** Merging this workflow to `main` turns it on. GitHub's cron is best-effort: runs can start 5–20 minutes late and some may be dropped. `delaySeconds` and `missedSlots` record this, so treat this recorder as the redundant copy, not the primary one.
2. **Vercel risk.** Vercel deploys every pushed branch of a connected repository. A new orphan archive branch gets a `vercel.json` with `deploymentEnabled:false` and `ignoreCommand: exit 0`. **Even so, a separate repository that is not connected to Vercel is recommended.** It also keeps `git fetch` for developers from pulling the archive. To use one, set the repository variable `RECORDER_ARCHIVE_REPO` and the secret `RECORDER_ARCHIVE_TOKEN`, a fine-grained token with contents:write on that repository only.
3. **Growth.**
   - The first slot is about 9 MB. Later slots store only responses that changed.
   - On election night, when nearly everything changes, the estimate is up to about 9 MB per slot, roughly 54 MB per hour.
   - Over the full window this can reach several GB. A separate repository is the right home.
   - To reduce volume, use `RECORDER_SCOPE=priority`.
4. **Pushes made with `GITHUB_TOKEN` do not trigger other workflows**, so `build.yml` will not run for each archive commit.

## PostgreSQL (checklist only; nothing is connected)

Per the directive, nothing has been requested or provisioned. Adding a `"postgres"` store would need:

1. An `ObjectStore` adapter: `putIfAbsent` as `INSERT … ON CONFLICT DO NOTHING`, `put` as an upsert limited to `heads/`, `get`, and a prefix `list` ordered by key.
2. One table: `objects(key text primary key, body bytea, content_type text, sha256 char(64), created_at timestamptz)`.
3. A `resolveStore` branch on `INTELLIGENCE_CAPTURE_STORE=postgres` that fails closed when `DATABASE_URL` is missing.
4. Running the existing store tests against it.
5. Owner decisions:
   - which host;
   - credentials kept out of the repository;
   - retention;
   - backups;
   - read-only replicas for analysis.
