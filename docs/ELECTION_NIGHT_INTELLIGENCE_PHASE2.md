# Election Night Intelligence, Phase 2: reporting order and partisan composition

Branch `feature/election-night-intelligence-v1`. Shadow layer only. No published projection, race call or `/play` code was changed, and `app/results/2026/live.ts` is untouched.

Research retrieval date: 2026-10-26. Baseline snapshot: 2026-10-25.

## Result in one paragraph

The reporting-order layer, the 15-state research dataset, the diagnostics panel and the replay guard are built and tested. Partisan vote-method adjustment is **not implemented**. The evidence it needs (candidate-by-method returns for every state, timestamped historical releases, and a validated backtest) does not exist in the repository or in any source reached. The calculation stays `UNAVAILABLE` and the panel says so.

## Scope

15 states, 39 races (listed in `data/intelligence/states/priority15-2026-10-26.json`). The dataset is keyed by state and race id, so a new state is a new block of records, not a code change.

## Data added

| File | What it is |
|---|---|
| `data/intelligence/research/priority15-reporting-2026-10-26.json` | 187 records: 15 POLL_CLOSE (12 VERIFIED, 3 UNKNOWN), 31 RELEASE_TIMING, 67 REPORTING_PRACTICE, 74 CANDIDATE_BY_METHOD (HISTORICAL). Passes `npm run intelligence:validate`: 187 accepted, 0 rejected. |
| `data/intelligence/sources/register-2026-10-26.json` | 20 retrieved sources with URL, publisher, page date, tier, retrieval time and sha256; 11 attempted sources that contributed nothing, with the reason. |
| `data/intelligence/historical/medsl-method-aggregates-2026-10-26.json` | Candidate-by-method aggregates for 44 contests (2022 and 2024), built from MEDSL precinct returns. |
| `data/intelligence/states/priority15-2026-10-26.json` | Per-state roll-up used by the overview panel. |
| `scripts/intelligence/build_priority15.py` | Builds the four files above. Its inputs (fetch log, extracted text, MEDSL aggregate) live outside the repository and must be re-fetched to rebuild; the committed outputs are the record. |

The seed zip in `chatGPTfiles/` is not committed. Seed watchpoints were not turned into numeric inputs.

## Evidence classes

| Class | Meaning | Used for |
|---|---|---|
| A | Actual candidate-by-method returns | The only class a composition calculation may read |
| B | Official method ballot counts | Context, and outstanding inventory when an official source gives it |
| C | Party registration | Shown as context; never vote share |
| D | Statistical estimate | Requires a stated method and uncertainty; none present |
| E | Unknown | Carries no number |

Registration is stored with `useAsVoteShare: false` for every state, and the importer rejects it where a vote share is expected.

## Reporting-order layer

Five timing kinds are separate record fields and are never derived from each other:

| Kind | Records | Notes |
|---|---|---|
| `LEGAL_PROCESSING_TIME` | 15 | Statute summaries (NCSL Table 16), one per state, secondary tier |
| `LEGAL_SCANNING_TIME` | 15 | Same source |
| `OFFICIAL_EXPECTED_RELEASE_TIME` | 1 | Arizona only: first results "after 8:00 p.m." (Arizona Secretary of State) |
| `HISTORICAL_OBSERVED_RELEASE_TIME` | 0 | No timestamped historical release data found |
| `ACTUAL_2026_RELEASE_TIME` | 0 | Only the live feed can supply this on election night |

A legal right to scan is not a release time, and a past release is not a 2026 schedule. A secondary-tier source caps confidence at MEDIUM.

## Verified poll close

Verified from statute text on 2026-10-26: AK (8 p.m., AS 15.15.080), AZ (7 p.m.), CO (7 p.m., via a statute mirror), FL (7 p.m. local, two time zones), IA (8 p.m.), KS (7 p.m. Central, 6 p.m. Mountain), ME (8 p.m.), NE (8 p.m. Central, 7 p.m. Mountain), NY (9 p.m., via a mirror), OH (7:30 p.m.), SC (7 p.m.), WI (8 p.m.).

Not verified, so UNKNOWN: **GA, PA, TX**. Every attempted source either returned 403, 404, a moved page or no statute text (see `notRetrieved` in the register).

## Per-state coverage

| State | Races | Poll close | Candidate-by-method (class A) | Notes |
|---|---|---|---|---|
| AK | 1 | VERIFIED | 2022 Senate, by method, no total row | RCV tabulation applies; absentee counting starts 8 p.m. |
| AZ | 2 | VERIFIED | 2022 (ambiguous: total rows separate), 2024 Senate (early, Election Day, provisional) | Official first release "after 8 p.m." |
| CO | 3 | VERIFIED | none (total only) | |
| FL | 4 | VERIFIED | none (total only) | |
| GA | 1 | UNKNOWN | 2022 Senate (reconciled: advance, Election Day, absentee, provisional) | |
| IA | 2 | VERIFIED | 2022 and 2024 (absentee vs Election Day) | |
| KS | 3 | VERIFIED | none | |
| ME | 2 | VERIFIED | none | Military and overseas reported centrally |
| NE | 3 | VERIFIED | none | |
| NY | 4 | VERIFIED | not used: mode labels are inconsistent across counties | |
| OH | 4 | VERIFIED | none | |
| PA | 2 | UNKNOWN | none | |
| SC | 2 | VERIFIED | 2022 (ambiguous: overlapping provisional and failsafe), 2024 | |
| TX | 4 | UNKNOWN | none | |
| WI | 2 | VERIFIED | none | |

States with usable class A data: AK, AZ, GA, IA, SC (5 of 15). Coverage labels on each aggregate say whether the methods reconcile to a total (`RECONCILED`), have no total to check (`NO_TOTAL`), or overlap (`AMBIGUOUS`). Only `RECONCILED` aggregates are candidates for a composition input, and no calculation reads them yet.

**States needing more research:** all 15 for official expected release times and for outstanding-inventory sources; GA, PA and TX for poll close; the 10 states with no method-level returns for class A data; every state for historical observed release times.

## Outstanding vote

Outstanding is estimated final minus reported, carried with an interval; an official inventory supersedes the estimate. `Outstanding(method, jurisdiction)` returns `UNAVAILABLE` unless method-level evidence supports it. No official outstanding-ballot source was verified for any state, so the official figure is blank everywhere.

## Replay

**BLOCKED.** No source in the repository or reached during research holds returns with their original release timestamps. The Georgia runoff files carry scrape times, not release times, so they cannot back a replay. The replay module refuses synthetic data, a missing archive, a missing certified result, missing timestamps, future leakage and out-of-order data, and reports which of these applies. Synthetic tests exercise the guard only; they are not a backtest.

## Phase 1 discrepancy: Georgia, 100% versus 88.5%

Cause, in `app/results/2026/live.ts`, `project()`:

- Line 150: `frac = s.pr > 0 ? Math.min(1, s.pr / 100) : ...` takes the county's **precinct** percentage as the fraction of votes counted.
- Line 151: `final = frac >= 0.05 ? Math.max(s.t, s.t / frac) : ...`. At `pr = 100`, `frac = 1`, so `final = s.t`: expected final equals reported and the engine reports 100% in.

The shadow layer divides reported votes by the forecast's expected total, which gives 88.5% on the Senate test feed and 83.6% for the Governor race on the same feed (159 of 159 counties at 100% precincts, 3,906,130 reported against 4,671,833 expected, 765,703 model outstanding). Both numbers are correct for what they measure: precincts reporting is a count of places, and ballots added to places that already reported do not move it. The published percentage was not changed.

The state panel now shows, side by side: precincts reporting, published % in, estimated ballots counted, official outstanding (blank when no official source), model outstanding, and the gap in points, with the flag `PRECINCTS_COMPLETE_BALLOTS_INCOMPLETE` when they disagree.

## Diagnostics

`/portal/intelligence` (protected) gained a 15-state overview and a state panel on each race page: five timing facts, procedure and reporting practice, historical method evidence, partisan-composition status, outstanding by method, the precinct-versus-ballots diagnostic, source links and missing inputs. Every item is labelled VERIFIED, HISTORICAL, INFERRED or UNKNOWN.

## Components still disabled

- Partisan vote-method adjustment of any projection
- Method-specific outstanding estimates
- Reporting-order effects on the shadow margin
- Win probabilities
- Historical backtest

## Tests

`npm run test:intelligence`: 82 tests pass. New coverage: the five timing kinds are not inferred from each other, registration is rejected as vote share, method outstanding is unavailable without evidence, replay is blocked without timestamps, the precinct-versus-ballots diagnostic, and the Georgia runoff file cannot serve as a backtest source. `npx tsc --noEmit` is clean outside `.next/`. ESLint is clean on the intelligence directories.

## Approvals required

1. Commit `chatGPTfiles/` (the seed zip)? Currently left untracked.
2. Accept secondary-tier (NCSL, public-law mirror) sources for CO, NY and the legal-processing and legal-scanning rows, or require primary statute text.
3. Permission to run election-night capture of `ACTUAL_2026_RELEASE_TIME` through the flight recorder, which is the only way to start the timestamped archive a backtest needs.
4. Direction on GA, PA and TX poll close (needs a source reachable by the research tooling, or a human to supply it).
5. Whether to display the precinct-versus-ballots flag on the public results desk. It is portal-only now.
6. Merge to main and push. Neither has been done.
