# OnPoint Politics: Election-Night Flight Recorder, Phase 2c readiness report

Status: implemented and validated locally. **Not activated.** No push, merge, deploy, cron change or paid service has been made. No live election-night test has occurred; the provider currently serves TEST data.

This is infrastructure only. No public forecast, result, call or probability changed, and the statistical model remains disabled (no partisan or method adjustments, no unvalidated probabilities, no automatic calls).

## 1. Existing infrastructure (audit)

| Item | Finding |
|---|---|
| Host | Vercel (`vercel.json`; `process.env.VERCEL` is used in `app/results/2026/evServer.ts`). |
| Crons | `/api/flightrecorder/capture` every minute, `/api/indexnow` every 6 hours. A sub-daily cron implies a Pro plan; **unverified, needs user confirmation**. |
| Durable storage | None. No database or blob dependency existed. |
| Public flight recorder | Writes to the local filesystem. On Vercel that is per-instance and ephemeral, so it is **not durable**. Left unchanged. Its `CRON_SECRET` check is open if the variable is unset (existing behaviour, not changed here). |
| Middleware | `middleware.ts` does not cover `/api/intelligence/*`, so the new route authenticates itself. |
| Portal auth | `/portal/*` is behind a signed cookie (`tpsi_portal`, HMAC-SHA256, expiry). Verified: unauthenticated request is a 307 to login; cookie request renders. |
| Provider | civicAPI: free, no key, no published rate limits or terms, `cache-control: max-age=15`, no `last_updated` or `test_data` in the search feed (only in the per-race detail), currently TEST data. |

## 2. Architecture

```
Vercel cron (GET, Bearer CRON_SECRET)  ->  /api/intelligence/capture  ->  handleCapture
Operator   (POST, Bearer INTELLIGENCE_CAPTURE_SECRET, ?mode=preflight|poll, ?force=1)       |
                                                                                             v
                         planTick (phase, adaptive interval, due?) -> runCapture (one pass, 40 s budget)
                                                                                             |
                civicAPI feeds + per-race detail -> raw (gz, sha256) -> normalized observation -> ObjectStore
```

Code (all under `app/lib/intelligence/` unless noted):

- `captureStore.ts`: `ObjectStore` with `FsStore` (atomic link-create), `MemoryStore` (tests), `BlobStore` (private Vercel Blob); `resolveStore(env)` refuses a non-durable store on Vercel.
- `capture.ts`: ledger. Writes are idempotent. Corrections and decreases are kept, never overwritten. Reads: `reconstructAt`, `reportingGaps`, `compareCheckpoints`, `loadCapturesForReplay`.
- `captureSchedule.ts`: phases and adaptive cadence. `captureRunner.ts`: one polling pass, heartbeat and failure events as separate run records. `captureHealth.ts`: health classification. `captureConfig.ts`, `captureHandler.ts`: configuration and the authenticated request handler.
- `replay.ts`: deterministic replay (`backtestFromCaptures`); no future leakage; BLOCKED without certified results, snapshots or source timestamps.
- `app/api/intelligence/capture/route.ts`: thin wrapper. `app/portal/intelligence/RecorderPanel.tsx`: health panel.

### Storage layers and layout

Two layers: **raw** (immutable, content-addressed) and **normalized** (immutable, with a reference to the raw object and its checksum). Mutable `heads/` objects are only an index.

| Key | Mutability | Content |
|---|---|---|
| `raw/<sha256>.gz` | immutable | Provider response bytes. |
| `obs/<race>/<ts>_<id12>.json` | immutable | One normalized observation (schema `TPSI_CAPTURE/2`). |
| `feed/<slug>/<ts>_<id12>.json` | immutable | Feed-level delta (rows changed/removed). |
| `runs/<date>/<ts>_<runId>.json` | immutable | Heartbeat, provider status, errors. Separate from results. |
| `preflight/…` | immutable | Preflight evidence. |
| `heads/race/<id>.json`, `heads/feed/<slug>.json`, `heads/tick.json`, `heads/preflight.json` | mutable | Hints for speed and health. |

Required fields (section 3) are present on every observation: observation id, election id, race id, state, reporting jurisdiction, provider, source publication timestamp (never inferred; `null` when the provider gives none), first-observed UTC, ingestion UTC, candidate totals, precincts reporting, reporting percent with its basis, official outstanding ballots (`null` unless a source supplies it), voting method if explicit, test/live status, correction/revision status, raw checksum, raw reference, schema version.

Caveat: head counters (observation counts on `heads/*`) can be off by one under concurrent duplicate delivery. They are hints. Authoritative counts come from the immutable records.

## 3. Storage recommendation

**Private Vercel Blob** (`@vercel/blob` 2.8.2): the simplest reliable option on this host. It needs no database, is durable, and the immutable-object layout maps to it directly.

- Object volume, rough upper bound: a run record per poll, feed deltas only when a feed changes, observations only when a race's values change, raw objects only for new checksums. At 1 poll per minute over the 11.5 h election-night window that is about 690 polls; even at a pessimistic 60 objects per poll the figure is about 41,000 objects, tens of MB. Expected real volume is much lower.
- **Cost is not verified.** Blob is billed by storage, operations and transfer. Please check current Vercel Blob pricing and your plan's included quota before approving. No paid service was enabled.
- **Integration risk:** the Blob adapter is covered by unit tests against the interface and the "already exists" detection is a regex that has **not been exercised against the real service** (no token was available). The preview-deployment preflight (section 8, item 8) is the proof.
- Alternatives considered: Postgres or KV (new schema and service, no benefit for append-only evidence); an external S3 bucket (more setup); local disk (not durable on Vercel, rejected).

## 4. Scheduler recommendation

Keep it simple: one Vercel cron firing every minute, with the schedule decided in code (`planTick`). Quiet periods cost almost nothing because a not-due tick returns without upstream requests.

| Phase | Window (UTC) | Interval | Detail requests |
|---|---|---|---|
| PRE_ELECTION | until 2026-11-03 12:00 | 60 min | sample (3) |
| POLLS_OPEN | to 22:30 | 10 min | all |
| ELECTION_NIGHT | to 2026-11-04 10:00 | 1 min | all |
| OVERNIGHT | to 2026-11-05 00:00 | 2 min | all |
| COUNTING | to 2026-11-10 | 5 min | all |
| CANVASS | to `INTELLIGENCE_CAPTURE_UNTIL` (default 2026-11-25) | 15 min | all |
| ENDED | after | none | none |

Six consecutive polls with no new data double the interval (max 30 min) outside ELECTION_NIGHT and PRE_ELECTION. Tolerance 15 s. A poll is "stale" after `max(5, 3 x interval)` minutes. Restart and recovery: state is derived from the store (`heads/tick.json` plus run records), so a cold start or a missed tick simply runs the next due poll. There is no overlap-sensitive in-memory state; duplicate invocations are safe because writes are idempotent. A manual trigger exists (`POST`). Each poll fetches each feed once; per-race detail requests are deduplicated within a poll.

**Proposed `vercel.json` change (NOT applied):**

```json
{ "path": "/api/intelligence/capture", "schedule": "* * * * *" }
```

(added to the existing `crons` array). `maxDuration` is set to 60 in the route; confirm that your plan permits it.

## 5. Security and threat model

| Threat | Control | Tested |
|---|---|---|
| Unauthenticated trigger | Bearer secret, constant-time compare; 401 with a generic body; no upstream request or write on failure | yes |
| Missing or weak secret | Fails closed: secret unset or under 24 chars returns 503 `capture_disabled` | yes |
| Secret reuse | Two dedicated secrets: `CRON_SECRET` (GET, scheduler only) and `INTELLIGENCE_CAPTURE_SECRET` (POST, manual); not interchangeable | yes |
| Spoofed cron header, cookie, Basic auth | Not accepted | yes |
| Brute force | 10 failed attempts per 60 s per client then 429, even for a correct secret while throttled | yes |
| Request flooding / forcing | Force spacing at least 10 s (429); scheduler cannot force; GET accepts no query params | yes |
| Oversized or malformed input | Content-Length over 1024 returns 413; query allowlist; unknown params, bad `mode`, bad `force` return 400; other methods 405 | yes |
| Replay of a captured request | Bearer secrets are static; replay is harmless because a poll is idempotent and spaced (due check plus force spacing). Rotate secrets if exposed. | yes (idempotence, spacing) |
| Hostile or malformed provider response | Size limits, schema checks, parse failures recorded as run errors; no upstream text echoed to clients | yes |
| Information leak | `Cache-Control: no-store`; errors generic; secrets never in responses (tested), code or logs | yes |
| Storage failure | 500 `storage_failure`, no internal detail; no partial overwrite | yes |
| Portal exposure | Panel is inside the existing signed-cookie portal | smoke tested |

Residual: the rate limiter is per instance (in memory), so on serverless it is best effort; the secret strength is the real control. Client IP comes from forwarding headers and can be spoofed to dodge the throttle, which does not weaken authentication.

## 6. Provider limitations

- No published rate limits or terms; **confirm with the provider** before sustained 1-minute polling of about four feeds plus per-race detail.
- 15 s cache, so polling more often than every 15 s is pointless.
- The search feed has no source timestamp or test flag. Both come only from the per-race detail, so observations built from the feed alone carry `sourceTimestamp: null` and the test status from detail where fetched. The replay engine treats a missing source timestamp as a block rather than inferring one.
- Currently serving TEST data (`test_data: true`). The recorder stores the flag; it cannot make test data live.
- The feed named "US House" returned an empty body (22 bytes); "House of Representatives" is the populated feed (436 races, 285 KB). Both are captured.

## 7. Tests completed

`npm run test:intelligence`: **171 tests, all passing** (168 plus 3 new Texas time-zone checks). TypeScript and ESLint clean.

Recorder preflight categories (section 11): authentication (all unauthorized paths), persistence (write, read back, refuse overwrite, original intact, list), restart and recovery, duplicate delivery, out-of-order delivery, corrections and decreases preserved, provider outage, storage failure, replay determinism, timestamp handling, and a synthetic election-night simulation (many polls over a night with updates, a correction and outages).

### Controlled real-feed capture (TEST data, local filesystem store, 2026-10-26)

Run through the real route in a local dev server against the real civicAPI, filesystem store in a temp directory (not committed). This was **not** a live election-night test.

- Preflight: all checks passed (write, read back, refuses overwrite, original intact, list, head overwrite, durable, provider, tracked races, secrets).
- 4 feeds captured: Senate 36 rows, House of Representatives 436, Governor 38, US House 0.
- 3 normalized observations (`gov-GA`, `gov-KS`, `gov-NE`), status TEST, source timestamp 2026-10-25T23:27:15Z, with raw checksums and refs. Only 3 of the 39 tracked races appear because PRE_ELECTION fetches a sample of detail pages; the rest are expected from POLLS_OPEN, when all are fetched.
- A repeat poll was UNCHANGED (idempotent, no duplicates). A third forced poll within 10 s returned 429. The scheduler path returned `due: false`.
- Cold-start `GET` without secrets: 503; wrong secret: 401; `PUT`: 405.

## 8. Pre-activation package

1. **Mechanism:** one Vercel cron every minute to `/api/intelligence/capture` (proposed above).
2. **Storage:** private Vercel Blob store connected to the project.
3. **Cost:** to be confirmed by you (section 3). Unverified here.
4. **Environment variables / secrets:**

| Name | Value |
|---|---|
| `INTELLIGENCE_CAPTURE_STORE` | `blob` |
| `BLOB_READ_WRITE_TOKEN` | created when the Blob store is connected |
| `CRON_SECRET` | random, at least 24 characters (Vercel sends it as the cron bearer token) |
| `INTELLIGENCE_CAPTURE_SECRET` | different random value, at least 24 characters |
| `INTELLIGENCE_CAPTURE_UNTIL` | optional, default 2026-11-25 |
| `INTELLIGENCE_CAPTURE_FEEDS` | optional feed override |
| `INTELLIGENCE_CAPTURE_DIR`, `INTELLIGENCE_CAPTURE_DISK_IS_PERSISTENT` | local development only; never set on Vercel |

5. **Security validation:** section 5. Repeat the unauthorized-request checks against the preview URL.
6. **Cadence:** section 4.
7. **Failure and recovery:** an outage is recorded as a run error with the provider status; the next tick retries. A storage failure returns 500 and writes nothing partial. The portal panel distinguishes working, running-with-no-new-data, and interrupted, using run records (`pollingGaps`) rather than lack of new observations.
8. **Durable write/read evidence:** run `POST /api/intelligence/capture?mode=preflight` with the manual secret on a **preview deployment** connected to the Blob store. All checks must pass, including `durable`. Expected result is stored under `preflight/`. Not yet done, since no Blob token exists.
9. **Rollback:** remove the cron entry (and redeploy), or unset `CRON_SECRET` and `INTELLIGENCE_CAPTURE_SECRET` (route returns 503 and does nothing). Captured objects are immutable evidence and need no rollback.
10. **Exact deployment changes:** `vercel.json` cron entry (section 4); the environment variables above; `package.json` / `package-lock.json` (`@vercel/blob`); `next.config.ts` (file tracing for the capture route and portal page); new files listed in the commit.

## 9. Capture readiness and deployment blockers

Ready locally. **Blockers before production:**

1. Private Blob store not created, so persistence on Vercel is unproven (hard blocker).
2. Secrets not set.
3. Vercel plan unconfirmed for the every-minute cron and `maxDuration = 60`.
4. Provider terms and acceptable request rate not confirmed.
5. Blob adapter not yet exercised against the real service.
6. Your approval of the cron entry and cost.

Operational note: the existing public recorder (`/api/flightrecorder/capture`) writes to the local filesystem; on Vercel that data is not durable. It is unchanged and should not be relied on as evidence.

Update (2026-10-27): the legacy route now goes through `app/results/_lib/legacyCaptureGate.ts`. It fails closed on Vercel when `CRON_SECRET` is unset (503), compares the bearer in constant time, and stands down with no civicAPI request once `INTELLIGENCE_CAPTURE_STORE` is set, so the two recorders never poll the same races twice. Tested in `tests/intelligence/legacyCaptureGate.test.ts`.

## 10. Research (section 8, non-blocking)

| Topic | Result |
|---|---|
| D. Texas county time zones | **Done.** `data/intelligence/reference/tx-county-timezones-2026-10-26.json`, 254 counties, validated by `tests/intelligence/txtimezones.test.ts`. Source: eCFR 49 CFR 71.7(e) and 71.8: the boundary follows the east line of Hudspeth County, so **El Paso and Hudspeth are Mountain**; every other county, **including Culberson, is Central**. County membership is derived from the boundary text and geography, not from an official county list; confirm with a second source. 7 p.m. local on Nov 3 is 01:00Z (Central) and 02:00Z (Mountain). Informal local observance (for example in Culberson County) was not verified. |
| A. Official outstanding-ballot sources | **Not extended in this phase.** Existing package has one `OUTSTANDING_INVENTORY_SOURCE` record (AZ). The recorder stores `officialOutstandingBallots` only when a source gives it. |
| B. County reporting cadence | **Not completed.** Needs historical timestamped captures; the recorder now produces them from Nov 3. |
| C. Mixed ballot batches | **Not completed.** Recorded as an open question; the recorder keeps voting method only when explicit. |
| E. Certified totals (2024) | **Not completed.** No certified 2024 totals were added to the repo; none were fabricated. Replay reports BLOCKED without certified results. |

### 15-state research coverage (existing package `priority15-reporting-2026-10-26`, 227 records, 153 verified, 74 historical)

Every state has: poll close, legal processing and scanning time, reporting unit, late-ballot, UOCAVA and provisional rules, and at least one sequence finding. Differences:

| State | Extra coverage | Gaps |
|---|---|---|
| AK | Ranked-choice, 9 candidate-by-method (historical) | no outstanding source |
| AZ | Expected release time, outstanding inventory source, 25 by-method | most complete |
| CO | none | no by-method, no release time |
| FL | Expected release time | no by-method |
| GA | 8 by-method | no release time |
| IA | Method separation, 8 by-method | |
| KS | Canvass/certification | no by-method |
| ME | Ranked-choice, method separation | no by-method |
| NE | none | no by-method |
| NY | none | no by-method |
| OH | none | no by-method |
| PA | none | no by-method |
| SC | Method separation, canvass, 24 by-method | |
| TX | Method separation, 6 sequence findings, **county time-zone table (new)** | no by-method |
| WI | none | no by-method |

Outstanding-ballot sources exist for AZ only; certified 2024 totals for none in this repo.

## 11. Actions needed from you

1. Confirm the Vercel plan (the existing every-minute cron implies Pro) and that `maxDuration = 60` is allowed.
2. Create a private Vercel Blob store on the project (provides `BLOB_READ_WRITE_TOKEN`).
3. Set `INTELLIGENCE_CAPTURE_STORE=blob`, `CRON_SECRET` and `INTELLIGENCE_CAPTURE_SECRET` (long, random, different) in the Vercel environment.
4. Review Blob pricing and approve the cost.
5. Confirm civicAPI terms and an acceptable polling rate with the provider.
6. Approve the cron entry and a preview-deployment preflight run; after it passes, approve activation.
