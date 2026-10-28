# Election Intelligence: final development handoff (closeout, 2026-10-28)

**Status:** development frozen. Nothing in this chapter has been pushed, merged or deployed, and production behaviour is unchanged.

**Next workstream:** the site-wide UI audit (section G). After that, PostgreSQL integration (section C), coordinated by the project owner.

## Verified state (read-only check, 2026-10-28)

| Item | Value |
|---|---|
| Branch | `feature/election-night-intelligence-v1` |
| HEAD before this document | `0699a7d3` "Election archive: canonical public snapshot (flagged), publication semantics, GitHub primary store, 30s slot rule" |
| Working tree | clean |
| Relative to `origin/main` | 11 commits ahead, 13 behind. No remote branch contains HEAD (local only). |
| Tests | Re-verified 2026-10-28 at `ca57a785`: `npm run test:intelligence` 237/237 pass, `tsc --noEmit` 0 errors, targeted ESLint 0 errors / 0 warnings. |

The full commit list is `git log --oneline origin/main..HEAD`. The most recent commits:

- `0699a7d3` Election archive: canonical public snapshot (flagged), publication semantics, GitHub primary store, 30 s slot rule
- `2429ed3f` Checkpoint archive: explicit calculation ids and published→calculation→raw links
- `7914b058` Election-night checkpoint archive: raw/calculated/published layers, GitHub mirror, 30-second slots
- `ac24c4ee` Flight recorder readiness: legacy capture fails closed on Vercel, constant-time bearer check
- `edbfa253` Race history consolidation: retire "The trend" where published history exists
- `3b5ba464` Race history phase 2: published-only frozen history, public race-page integration
- `1e669125` Race history phase 1: contract, component, protected preview

## A. Implemented and tested (on the branch only)

| Area | Files | Detail |
|---|---|---|
| Recorder (raw observations) | `app/lib/intelligence/{capture,captureConfig,captureHandler,captureRunner,captureSchedule,captureHealth,observations,civic}.ts`, `app/api/intelligence/capture` | Immutable raw responses (gzip, SHA-256), normalized observations, run records, auth (cron + manual secrets, constant-time), preflight mode |
| Storage adapters | `captureStore.ts` (`ObjectStore`, fs / Blob / memory), `githubStore.ts` (atomic one-commit-per-poll) | Write-once `putIfAbsent`; heads are the only replaceable objects |
| Checkpoint archive | `checkpointArchive.ts`, `githubArchive.ts` | RAW → CALCULATED → SNAPSHOT layers, per-layer hashes, manifest written last |
| Publication records | `publicSnapshot.ts`, `published.ts` | Explicit PUBLISHED event only after the canonical head moves; rollback on failure |
| Replay and comparison | `replay.ts`, `checkpointArchive.ts` (`replayArchive`, `compareReplay`) | Writes under `replays/`, never `archive/` |
| Shadow / research | `shadow.ts`, `research.ts`, `pipeline.ts`, `outstanding.ts`, `reportingOrder.ts`, `baseline.ts`, `composition.ts`, `geography.ts` | Kept separate from public output |
| Legacy recorder gate | `app/results/_lib/legacyCaptureGate.ts` | Fails closed on Vercel without `CRON_SECRET`; stands down when the new store is set |
| Race History | `raceHistory.ts`, `raceHistoryStore.ts`, `raceHistoryDemo.ts`, `app/components/opp/{RaceHistory,RaceHistorySection}.tsx`, `raceHistory.css`, `app/api/race-history/[id]`, `app/portal/intelligence/history` | Published-only frozen history verified against production deployments; wired into `/forecast/[state]/[race]` |
| Frozen history data | `data/intelligence/history/{frozen-forecasts.json.gz,production-deployments.json}`, `scripts/intelligence/build_frozen_history.ts` | 67 snapshots: 65 published, 2 unverified |
| Tests | `tests/intelligence/*.test.ts` (19 files) | Run with `npm run test:intelligence` |

Design and readiness detail:

- [ELECTION_NIGHT_INTELLIGENCE_PHASE2C.md](ELECTION_NIGHT_INTELLIGENCE_PHASE2C.md) (recorder, archive, schedule, security, activation);
- [RACE_HISTORY_CHARTS_DESIGN.md](RACE_HISTORY_CHARTS_DESIGN.md);
- earlier phases: `ELECTION_NIGHT_INTELLIGENCE_PHASE1/2/2B.md`.

## B. Implemented but inactive

Every flag below is unset, and none of this code is deployed. Leave it all inactive until it is explicitly approved.

| Item | Activation switch | Current behaviour |
|---|---|---|
| New recorder `/api/intelligence/capture` | cron entry (not in `vercel.json`), `CRON_SECRET`, `INTELLIGENCE_CAPTURE_SECRET`, `INTELLIGENCE_CAPTURE_STORE` | Not scheduled. Returns 503 without secrets. |
| Checkpoint archive / GitHub mirror | `ONPOINT_ARCHIVE=1`, `ONPOINT_ARCHIVE_REPO`, `ONPOINT_ARCHIVE_TOKEN`, `ONPOINT_ARCHIVE_BRANCH` | Off |
| Canonical public snapshot `/api/results/public-snapshot` | `ONPOINT_PUBLIC_SNAPSHOT=1` | 404 |
| Published Live Timeline via `/api/flightrecorder/[raceId]` | `ONPOINT_PUBLIC_SNAPSHOT=1` with a Blob or fs store | Legacy recorder path |
| Live projections in Race History | a publisher calling `recordModelOutput()` with a durable store | Frozen pre-election history only. Refuses ephemeral stores on Vercel. |
| Shadow forecasting, replay, research | none (library/test only) | Never public |
| Race History public section | deployment of this branch | Not in production |

The legacy `/api/flightrecorder/capture` cron in production `vercel.json` is pre-existing and unchanged. Its filesystem data is not durable on Vercel and is not evidence.

## C. Awaiting PostgreSQL setup (deferred; nothing connected, created or migrated)

**Schema.** The proposed OnPoint PostgreSQL schema handoff package (architecture diagrams, raw, calculated, predictive, publication-history and replay tables) is maintained outside this repository and is under review by the server owner. It is a proposed contract, not an applied migration.

**Adapter interface to implement.** This is `ObjectStore` in `app/lib/intelligence/captureStore.ts`. Every layer writes through it, so a PostgreSQL adapter replaces no other code.

```ts
interface ObjectStore {
  kind: "fs" | "blob" | "memory" | "github";   // add "postgres"
  durable: boolean;                             // true
  putIfAbsent(key, body, contentType): Promise<"CREATED" | "EXISTS">;  // INSERT … ON CONFLICT DO NOTHING; never update
  put(key, body, contentType): Promise<void>;   // heads only (replaceable pointers)
  get(key): Promise<Buffer | null>;
  list(prefix): Promise<string[]>;              // ascending key order
  commit?(message): Promise<CommitResult>;      // optional: one transaction per poll, all-or-nothing
  discard?(): void;
  readDir?(dir): Promise<Map<string, Buffer>>;
}
```

- **Selection:** add a `"postgres"` branch to `resolveStore()`, failing closed when its settings are missing, as the GitHub and Blob branches already do.
- **Keep:** the existing fs, Blob, memory and GitHub adapters stay.

**Reconciliation step.** Map the approved tables to the key layouts the code already writes:

- `obs/`, `raw/`: RAW;
- `archive/<day>/calculated`: CALCULATED;
- `model/`: PREDICTIVE;
- `archive/<day>/published`, `public/snapshots/`: PUBLICATION;
- `replays/`: REPLAY;
- `model-shadow/`: SHADOW;
- `runs/`, `heads/`: operations.

Either the adapter stores objects by key in a generic table, or it writes typed tables. That choice is the main open decision.

**Environment variables.** The names below are proposed and not yet in the code. Never commit their values.

- `INTELLIGENCE_CAPTURE_STORE=postgres`
- `ONPOINT_DATABASE_URL`, as a connection string held only in Vercel or encrypted environment settings
- optionally `ONPOINT_DATABASE_SCHEMA`

**Isolation requirements.**

- Use a dedicated OnPoint database, or a dedicated schema, on the shared server. It must have no access to CFPredictor user, account or subscription data.
- Use a restricted role:
  - `INSERT`/`SELECT` on immutable tables;
  - `UPDATE` only on head/pointer tables;
  - no `DELETE`, no DDL at runtime;
  - migrations run by a separate owner role.
- Require TLS. Use separate credentials for preview and production.

**Immutability rules (permanent).**

- Keep the chain PUBLISHED → CALCULATED / PREDICTIVE → RAW.
- Never overwrite 2026 outputs during replay.
- Keep recomputed public-engine outputs (`PUBLIC_ENGINE_RECOMPUTED_NOT_VERIFIED_PUBLISHED`) distinct from genuine publication records.
- Keep shadow separate from public.

**Data scope (permanent).**

- **RAW:** every available nationwide race and candidate; vote totals; geography; reporting; corrections; source timestamps; provenance.
- **CALCULATED:** deterministic values from one raw observation.
- **PREDICTIVE:** probabilities, projected margins, remaining and expected votes, and intervals where supported.
- **PUBLICATION HISTORY:** exact versioned outputs served through the canonical public pathway.
- **REPLAY:** separate datasets for future models on historical raw data.

## D. Remaining preflight requirements

1. Approved PostgreSQL schema.
2. Connection and permissions verification (restricted role; CFPredictor data unreachable).
3. Database migrations, run by the owner role.
4. Real storage write/read test: `POST /api/intelligence/capture?mode=preflight` on a preview deployment, with every check passing, including `durable`.
5. Nationwide civicAPI collection timing: one approved preflight. Real read duration is not yet measured.
6. Scheduler feasibility. Vercel cron fires once per minute with no guaranteed second, and one call runs both 30-second slots of its minute.
7. Approved collection schedule. Every checkpoint must account for raw data, calculations, predictive output and publication state. Unchanged checkpoints are still represented, and failures are recorded, never reconstructed.

   | Window (ET) | Cadence | Checkpoints |
   |---|---|---|
   | Nov 3, 7 PM → Nov 4, 7 AM (00:00Z–12:00Z) | every 30 s | 1,440 |
   | Nov 4, 7 AM → Nov 11, 7 AM | every 10 min | 1,008 |
   | **Total** | | **2,448** |

   The 30-second guarantee, nationwide read duration, storage throughput and production scheduler behaviour are **unproven**.
8. Canonical public-snapshot validation on a preview deployment before `ONPOINT_PUBLIC_SNAPSHOT=1`.
9. RaceDesk Live Timeline transition from the legacy recorder to the published per-race index.
10. Deployment and rollback verification, using the rollback steps in PHASE2C ("Recovery and rollback").
11. Approval of the Vercel plan, `maxDuration = 60`, the civicAPI polling rate and terms, and cost.

## E. Known limitations (recorded, not expanded)

- **Outages in Race History** are only drawn from declared outages; no reader for recorder `runs/` exists yet.
- **Race History coverage:** statewide down-ballot pages and `/results` race pages are not covered (their ids are not mapped).
- **Recorder detail:** untracked contests have whole-feed raw rows only, with no per-race detail.
- **GitHub store:** the 5,000/hour token limit and repository growth are unmeasured on a real night. The per-race timeline index is not kept on GitHub.
- **Research gaps:** outstanding-ballot sources exist for AZ only; no certified 2024 totals (replay reports BLOCKED); the Texas county time-zone membership needs a second source.
- **Lint:** the `prefer-const` and unused `officeWord` findings reported earlier in `app/forecast/[state]/[race]/page.tsx` no longer appear at HEAD.
- **Site header** overflows horizontally at a 1280 px viewport. This is logged in [SITE_UI_AUDIT.md](SITE_UI_AUDIT.md) and belongs to the UI audit.
- **Branch drift:** the branch is 13 commits behind `origin/main`, so expect a rebase or merge before any deployment.

## F. Resume instructions (after the UI audit and database setup)

1. Check out `feature/election-night-intelligence-v1`, bring in `origin/main` (merge, preserving history; no squash), and resolve conflicts.
2. Run `npm ci`, then `npm run test:intelligence`. Expect all tests passing (237 at `0699a7d3`).
3. Obtain the approved schema. Implement the `"postgres"` `ObjectStore` adapter and the `resolveStore()` branch, using the adapter contract tests from the existing store tests against a local or disposable PostgreSQL instance.
4. Owner-run migrations. Set the environment variables on a **preview** deployment only. Run `?mode=preflight`.
5. Run one approved nationwide timing preflight. Then decide the cron.
6. Work through section D in order. Activate only with explicit approval, one flag at a time.

## Deferred TODO (after the UI audit; each item needs the owner's approval)

- [ ] Finalize the PostgreSQL schema with the server owner.
- [ ] Configure an isolated OnPoint PostgreSQL database or schema.
- [ ] Create restricted database credentials (no DELETE or DDL at runtime; no CFPredictor access).
- [ ] Implement the PostgreSQL storage adapter (`ObjectStore`, section C).
- [ ] Preserve linked RAW, CALCULATED, PREDICTIVE and PUBLISHED records.
- [ ] Validate immutable historical replay (no 2026 output overwritten).
- [ ] Verify nationwide collection at 30-second and 10-minute intervals (2,448 checkpoints).
- [ ] Complete Race History and RaceDesk Live Timeline integration.
- [ ] Validate actual publication-state integrity.
- [ ] Run real database preflight, backup, monitoring and recovery tests.
- [ ] Complete production deployment and rollback checks.

## Branch divergence (checked 2026-10-28)

**Divergence.** The branch and `origin/main` share the merge base `44d06d08`. The branch is 12 commits ahead and 13 behind. A `git merge-tree` preview shows **no conflicts**, and no file has changed on both sides.

**Shared files the branch modifies:**

- `.gitignore`;
- `next.config.ts` (file tracing);
- `package.json` and `package-lock.json`;
- `app/forecast/[state]/[race]/page.tsx` (Race History section; "The trend" retired where published history exists);
- `app/api/flightrecorder/[raceId]/route.ts` and `app/api/flightrecorder/capture/route.ts` (flagged pathway, legacy gate);
- `data/flightrecorder/README.md`.

All other branch changes are new files.

**UI audit strategy.**

- Branch the UI audit from updated `origin/main`, for example `ui/site-audit`. Do not merge the intelligence branch into it.
- The redesign must keep the integration points above. Race History needs to follow the new theme tokens: `raceHistory.css` is already tokenized for dark and light.
- Merge `origin/main` into this branch (no rebase or squash) when the intelligence work resumes.

## G. Transition: site-wide UI/UX audit (next workstream; not started)

- **Audit backlog:** [docs/SITE_UI_AUDIT.md](SITE_UI_AUDIT.md). It holds 2 entries, including the 1280 px header overflow.
- **Design system:**
  - skill `.github/skills/opp-ui/SKILL.md`;
  - `app/opp.css`, `app/globals.css` (tokens), `app/motion.css`, `app/tailwind.config.ts`;
  - `app/components/opp/` (shared components; `studio.css` is the chart language);
  - [ONPOINT_IMPLEMENTATION.md](ONPOINT_IMPLEMENTATION.md), [REBRAND_CHANGELOG_2026-09-28.md](REBRAND_CHANGELOG_2026-09-28.md), `changeorders/TPSI-Election-Desk-Design-System.md`.
- **Current theme mechanism:** this is the starting point for Professional Dark (default), Professional Light and Themed.
  - `app/lib/theme.ts` and `app/lib/useSiteTheme.ts`;
  - the `data-theme` attribute set in `app/layout.tsx`;
  - `:root[data-theme="light"]` overrides in `globals.css`, the map CSS (`app/maps/**`) and `raceHistory.css` (fully tokenized).
- **Audit surfaces:**
  - `app/page.tsx` (home);
  - `app/results/` (desk);
  - `app/forecast/`;
  - `app/polls/` and `app/_polling/`;
  - `app/maps/`;
  - `app/play/`.
