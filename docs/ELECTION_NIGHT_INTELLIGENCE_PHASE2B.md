# Election Night Intelligence, Phase 2b: sequence research, reconciliation, estimator tiers, evidence capture

Branch `feature/election-night-intelligence-v1`. Shadow layer only. Not merged, not pushed, not deployed. No public
projection, probability, race-call threshold, needle, public percentage, forecast baseline or `/play` code was changed.

Research retrieval date: 2026-10-26. This document supersedes the record counts and the GA/PA/TX poll-close status in
`ELECTION_NIGHT_INTELLIGENCE_PHASE2.md`.

**Passing tests do not make this election-night ready.** The tests show the software does what it claims on synthetic and
committed data. They say nothing about whether a method adjustment would be right, because none can be validated.

## Component classification

### Implemented and validated

| Component | Evidence |
|---|---|
| Poll close for all 15 states (GA, PA, TX added) | 15 VERIFIED records, each anchored to retrieved statute text. GA 7 p.m. ET = `2026-11-04T00:00:00Z`; PA 8 p.m. ET = `2026-11-04T01:00:00Z`; TX 19:00 local per county, no statewide instant, importer rejects one. Tests in `reportingorder.test.ts`. |
| Sequence findings, 37 records | Each has ballot category, fact kind, a limitation, a source URL and a verified text anchor. Secondary tiers are never HIGH. |
| Reproducible research build | `build_priority15.py` plus `--check`; manifest in `data/intelligence/build/` lists URLs, retrieval dates, sha256, parser versions, transform steps, schema versions and expected output counts. A test compares the manifest's output hashes with the committed files. |
| Estimator tier ladder | `outstanding.ts`: official count, verified method inventory, stated-range estimate, forecast point, unknown. Tests for each tier. |
| Capture ledger (flight recorder v2) | `capture.ts`: idempotent, atomic payload writes, per-line checksums, torn-tail repair, derived (never stored) correction and out-of-order flags. 17 tests including interruption, tamper and late-correction cases. |
| Replay reader | `backtestFromCaptures` in `replay.ts`. BLOCKED with no snapshots, no source timestamp or no certified result. Evaluates each step at first-observed time so a later correction cannot leak backwards. |
| Diagnostics panels | Poll close (including the Texas local rule), sequence coverage with undocumented categories, estimator tier ladder, reconciliation limits, capture status. Smoke-tested on a local dev server. |

### Implemented but not validated

| Component | Gap |
|---|---|
| Estimator tiers on real election-night data | Only synthetic and committed research inputs have run through it. No live official outstanding statement exists to test tier 1 against. |
| Capture route `app/api/intelligence/capture` | Unit-tested through the library; never run against civicAPI during a real count. Not scheduled. Fails closed without `CRON_SECRET`. |
| Older practice kinds mapped to ballot categories | `LATE_BALLOT_RULE`, `UOCAVA_RULE`, `PROVISIONAL_RULE`, `CANVASS_CERTIFICATION` now count toward their category. They come from a secondary source (NCSL) and are labelled so. |

### Research complete but not integrated

| Component | Notes |
|---|---|
| MEDSL method reconciliation (GA, IA, AK, SC, AZ; 44 contests) | 6 contests reconcile to a certified total within 0.5% with at least 99% of votes labelled: GA 2022 Senate, IA 2022 Senate and House 2, AK 2022 Senate, SC 2022 Senate and House 1. 38 do not: mostly no certified source retrieved (governor, all 2024), AZ label coverage 64% to 76% for 2022, and AZ 2022 House 8 differs from certified by 8.5% (+17,493 votes unmatched). Metrics per contest: totals by method, represented votes, difference from certified, unmatched votes, label completeness, county coverage, overlap. Registration stays context. Nothing reads these as an adjustment. |
| Historical timestamp search (2022 and 2024) | See below. |

### Missing evidence

- Candidate votes by method for 10 of 15 states (CO, FL, KS, ME, NE, NY, OH, PA, TX, WI).
- Certified totals for governor contests and all 2024 contests in the reconciliation set.
- Any official statement of outstanding ballots for any state (tier 1 inputs).
- EARLY_IN_PERSON sequence evidence for most states; the profile lists each undocumented category per state.
- A county time-zone table for Texas, so the Texas poll-close instant per county is unknown. None was invented.
- Source-timestamped historical returns for any contest (see below).
- Retrieval failures, recorded in the build manifest under `retrievalFailures` (13): AK_DOE, GA_SOS, GA_CODE_21_2_403, PA_VOTE, PA_25PS_3045, TX_41_031, TX_VOTETX, NY_BOE, WI_WEC, CO_LEG, ME_SOS, PA_3146_8, TX_EL_87. These were 403s, 404s, JavaScript shells or pages without the statute text. A failure is not evidence the rule does not exist.

### Disabled pending backtesting

- Partisan method adjustment: `NOT_APPLIED`, `appliedToProjection: false`. Every test asserts it.
- Method-level outstanding vote: `UNAVAILABLE`.
- Win probability from the shadow pipeline: unavailable.
- Reconciliation adjustments: `adjustmentEnabled: false` on every contest.

## Estimator hierarchy

1. `OFFICIAL_JURISDICTION_COUNT`: an official statement of ballots still to count. County statements are flagged as possibly partial.
2. `VERIFIED_METHOD_INVENTORY`: shown as present but never used, because returns carry no method label to net it against.
3. `HISTORICAL_ESTIMATE_WITH_RANGE`: a turnout expectation stating its own low and high. Not backtested.
4. `FORECAST_POINT_NO_RANGE`: the forecast's expected total, a point; no range is invented.
5. `UNKNOWN`: no figure.

Precincts reporting, votes counted, expected final turnout and official outstanding are separate fields; the estimator
takes no precinct input (tested). For district races a county statement not made for the race is ignored, and whole-county
returns for split counties stay excluded by the geography stage. The precinct-versus-ballots warning is portal-only.

## Evidence capture

Ledger per race at `INTELLIGENCE_CAPTURE_DIR` (default `data/intelligence-capture`, gitignored). A capture records first and
last observed times, source timestamp, race and state, candidate totals, the source's precinct indicator (metadata only),
diff from the previous observation, source identity, a LIVE/TEST/CORRECTED flag and a hash-addressed raw payload. The
existing public recorder (`app/results/_lib/flightRecorder.ts`) is unchanged.

## Historical timestamp search

`scripts/intelligence/research/probe_timestamp_sources.py` queried the Internet Archive CDX index only for the election-night
windows (2022-11-08 to 11-11, 2024-11-05 to 11-08) across 12 systems, and sampled up to six result-like files per system.
Output: `data/intelligence/historical/timestamp-search-2026-10-26.json`. Stored URLs have query strings removed.

| System | 2022 | 2024 |
|---|---|---|
| AZ results site, FL results | pages only, no data files | pages only, no data files |
| SC, IA, AK results systems | no captures | no captures |
| civicAPI | no captures | no captures |
| GA SoS results | no captures | data files sampled, none results-like |
| GA Clarity, PA electionreturns | results-like files, archive crawl time only | same |
| NYT static assets | sampled files not results-like | same |
| AP API | one capture, not results-like | none |

Archive crawl times are observation times of the archive, not source publication times, and no sampled results file stated
its own time. The Clarity and PA captures are leads (many contests and counties, irregular spacing), not a sequence. No
sequence was reconstructed, and no scrape from another period was used. The GA runoff files in the repository carry scrape
times from a different election and stay excluded. Replay therefore stays BLOCKED for 2022 and 2024.

## Preserved systems

No change to probabilities, race-call thresholds, the needle, public percentages, forecast baselines or `/play`. A test
asserts the shadow projection and the outstanding inventory are identical with and without the Phase 2 and 2b records.

## Commands

```
python3 scripts/intelligence/build_priority15.py --check
npm run intelligence:validate -- data/intelligence/research/priority15-reporting-2026-10-26.json
npm run test:intelligence
```

## Readiness for Nov 3

Not election-night ready as a model. Ready as a recorder and a diagnostics view, if the capture route is approved,
scheduled and pointed at a persistent directory. Poll-close facts and rule summaries are usable as context. There is no
validated basis for any method adjustment, no timestamped sequence for any state, and no verified official outstanding
figures, so the published engine remains the only projection and the shadow output stays diagnostic.
