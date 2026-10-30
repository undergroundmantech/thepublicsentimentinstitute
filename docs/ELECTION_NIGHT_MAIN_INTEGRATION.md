# Election Night: integrating `main` into the race-page branch

Reconciliation record for Milestone 2, Stage A. Written 2026-10-29.

## Source heads (verified with `git fetch origin --prune` before any code was touched)

| Ref | SHA | Role |
| --- | --- | --- |
| `origin/main` | `30ecde03` | Production. Two commits newer than the `45ca1198` head quoted in the brief. |
| `origin/ui/election-night-dashboard-v1` | `5849d80b` | National dashboard (Milestone 1), unchanged since the brief. |
| `origin/feature/election-night-intelligence-v1` | `0559aad3` | Protected. Not merged, rebased, modified or checked out. |
| merge base | `3d67d59a` | "Oct 27 evening poll sweep" |

`main` was 3 commits ahead of the dashboard branch; the dashboard branch was 4 ahead of `main`.

## Working branch

`ui/election-night-race-v1`, created from `5849d80b` (the dashboard head), then `origin/main` merged in with a
no-fast-forward merge commit `38eda28f`. Neither source branch was rewritten; nothing was force-pushed.

## Newer `main` commits incorporated

| SHA | Date | Subject |
| --- | --- | --- |
| `0177a07c` | 2026-10-28 | Campaign health: national tide from Gallup party ID shift |
| `45ca1198` | 2026-10-28 | Oct 28 morning poll sweep |
| `30ecde03` | 2026-10-29 | Polls 0.65, early vote correction with measured strength |

## Changed file families from `main` (751 files)

- `public/watchdog/warroom/**` (490), `public/forecast/scenarios/**` (72), `public/forecast/ev_cast/**` (46),
  `public/forecast/*.json` (15, including `model.json` now `meta.updated = 2026-10-28`),
  `public/forecast/archive/2026-10-28.json` (new) and `archive/index.json`
- `public/results/2026/**` (51: `index.json` now `asOf = 2026-10-28`, and the per-state expected-vote files)
- `public/play/r/**` (43)
- `app/_polling/senatepolling/*`, `app/_polling/governorpolling/*` (8 states each), generic ballot, Trump approval,
  right/wrong track
- `app/components/senateModel.ts`, `app/forecast/changelog/page.tsx`
- `app/watchdog/war-room/RaceRoom.tsx`, `app/watchdog/war-room/page.tsx`, `scripts/watchdog/build_warroom.py`
- `scripts/forecast/earlyvote/ev_adjust.py` and the `snapshots/2026-10-28/*` inputs

## Dashboard-branch files carried forward (unchanged by the merge)

`app/results/2026/{LiveProvider,NationalDesk,NightDesk,RacesHub}.tsx`, `nationalTally.ts`, `page.tsx`,
`results2026.css`, `app/results/CallBand.tsx`, `callStatus.{ts,css}`, `app/results/monitor/*`,
`app/results/2026-08-18/FloridaBoard.tsx`, `app/results/2026-08-25/OklahomaBoard.tsx`,
`scripts/test-national-tally.mjs`, `scripts/test-result-clarity.mjs`, and the audit docs and screenshots.

## Conflicts

None. The two branches touched disjoint file sets (`comm -12` of the two changed-file lists was empty), so git
performed a clean three-way merge with no manual resolution and no blanket "ours/theirs" choices.

## Verification after the merge

- `git diff --quiet origin/main HEAD -- app/_polling app/components/senateModel.ts app/forecast app/watchdog
  public/forecast public/results/2026 public/play public/watchdog scripts/forecast scripts/watchdog` is clean:
  every protected forecast, polling, model and published-data family is byte-identical to `origin/main`.
- `git diff --quiet 5849d80b HEAD -- app/results docs/ELECTION_NIGHT_DASHBOARD_V1.md scripts/test-national-tally.mjs
  scripts/test-result-clarity.mjs` is clean: the national dashboard is byte-identical to its source head.
- `public/forecast/model.json` reports `meta.updated = "2026-10-28"`, `daysOut = 6`; `public/forecast/archive/`
  contains `2026-10-25` through `2026-10-28`; `public/results/2026/index.json` reports `asOf = "2026-10-28"`.

Published forecast data preserved: **yes**. National dashboard preserved: **yes**.

## Pre-existing local state, left untouched

- `app/api/flightrecorder/[raceId]/route.ts` had an uncommitted modification before this work began. It imports
  `@/app/lib/intelligence/captureStore` and `@/app/results/_lib/publicTimeline`, which exist only on the protected
  intelligence branch, so it does not type-check on this branch and makes `next build` fail with two
  "Module not found" errors. It was not committed or edited. To produce the production build needed for screenshot
  evidence, the modification was saved to `~/research/racev1/preserve/` (patch + full copy), the committed version was
  checked out for the duration of the build, and the modification was re-applied immediately afterwards; the file
  was confirmed byte-identical to the developer's copy before and after each build.
- Untracked `chatGPTfiles/` and `scripts/intelligence/` were not added.

## Remaining integration risks

- `main` keeps moving (two poll sweeps a day). At close-out on 2026-10-30 `origin/main` was `45df156c`, four commits
  past `30ecde03` (`55c7398f`, `182bceff`, `e084eadc`, `45df156c`: Oct 29 poll sweep and model reruns). None of them
  touch `app/results/**` or the two election-night docs, so the branch still merges cleanly. Any later `main` should be
  merged into this branch the same way; the race page reads the forecast date from `index.json`, so a newer publication
  needs no code change.
- The uncommitted `flightrecorder` route above will fail `tsc` until the intelligence branch lands; it is excluded
  from this branch's commits.
