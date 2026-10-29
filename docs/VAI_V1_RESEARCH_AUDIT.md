# Vote Arrival Intelligence v1: research audit

Milestone 3, phase 1 (research and design only). Prepared 2026-10-29. Branch `research/vote-arrival-intelligence-v1`, cut from `ui/election-night-race-v1` at `342e6178`.

Nothing in this phase changes a published forecast, the live model, the race pages, the national dashboard, civicAPI handling, or the protected `feature/election-night-intelligence-v1` branch.

Companion documents:
- [VAI_V1_DATA_SCHEMA.md](VAI_V1_DATA_SCHEMA.md): the data contracts.
- [VAI_V1_MATHEMATICAL_DESIGN.md](VAI_V1_MATHEMATICAL_DESIGN.md): the estimator.
- [VAI_V1_BACKTEST_PLAN.md](VAI_V1_BACKTEST_PLAN.md): how it must be tested.
- [VAI_V1_SONNET_IMPLEMENTATION_HANDOFF.md](VAI_V1_SONNET_IMPLEMENTATION_HANDOFF.md): bounded engineering tasks.

## 1. Starting point and preservation

| Item | State on 2026-10-29 (after `git fetch --all --prune`) |
|---|---|
| Research branch base | `ui/election-night-race-v1` = `origin/ui/election-night-race-v1` = `342e6178` (race pages, Milestone 2) |
| Production base incorporated in that branch | `30ecde03` |
| `origin/main` now | `182bceff`. Two commits by Lester landed after `30ecde03`: `55c7398f` (Oct 29 morning poll sweep) and `182bceff` (Oct 29 full rerun: held polls, D+13 anchor, state swing rates, measured poll blend, 2026 primary electorate). About 759 files changed, mostly `public/forecast/**`, `public/watchdog/**` and `scripts/forecast/model/**`. |
| Effect on this branch | **Not merged**, on purpose: this branch only adds research documents, a builder script and derived data. Any data cited here from `public/results/2026/index.json` is the 2026-10-28 `asOf` copy on this branch. Re-run the checks after the next merge of `main`. |
| Protected intelligence branch | `origin/feature/election-night-intelligence-v1` = `0559aad3`, untouched. Files were read through `git show` into a scratch folder outside the repository; nothing was checked out, merged or pushed. |
| Uncommitted developer work | `app/api/flightrecorder/[raceId]/route.ts` (local modification) is preserved, unstaged and byte-identical to the copy saved before this work. `chatGPTfiles/` and `scripts/intelligence/` are untouched and unstaged. |
| Research package | `chatGPTfiles/OnPoint_Vote_Arrival_Intelligence_Research_Handoff_2026-10-29.zip`, extracted to `~/research/vai/` (outside the application tree). |

## 2. Research package: how each item was used

| Item | Treatment |
|---|---|
| `Count Order 2026.html` | Parsed from its own script constants (`CATS`, `SPEED`, `NCSL`, `S`) by `scripts/vai/build_count_order.py`, with every text field kept verbatim and the sha256 recorded. The result is `data/vai/count_order_2026.json`. |
| `OUTSTANDING_VOTE_DEEP_RESEARCH_V0_2.md` | Taken as the design baseline. The mathematical design keeps its core choices (a forecast-anchored hierarchical county estimator, method adjustments only with verified data, and an append-only ingestion log) and makes them concrete (§4 below). |
| `RESEARCH_HANDOFF_V0_1.md`, `RESEARCH_REPORT_2026_10_25.md`, matrices, seed JSON, top-50 inventory | Read for scope. Their claims were not re-collected; where they overlap the ledger, the evidence register (§5) supersedes them. |
| `historical_method_results_schema.csv` | Folded into the historical snapshot schema in the data-schema document. |
| Protected intel branch artefacts (`sequence_findings.json`, `timestamp-search.json`, `medsl-agg.json`, `observations.ts`, `outstanding.ts`, `shadow.ts`, `reportingOrder.ts`) | Read only. The 37 anchor-verified legal findings are imported **by reference** into the evidence register, and the timestamp search decides the backtest feasibility verdict. The modules are the intended building blocks (see §4.4). |

## 3. Existing-model audit

There are **two live estimators** in the repository. Neither is backtested.

| Engine | Used by | Core |
|---|---|---|
| **E1: 2026 night estimator** | `/results/2026` race pages ([NightDesk.tsx](../app/results/2026/NightDesk.tsx)), [RaceLive.tsx](../app/results/2026/[id]/RaceLive.tsx), [RaceBrief.tsx](../app/results/monitor/RaceBrief.tsx) | `project()` and `liveOdds()` in [live.ts](../app/results/2026/live.ts) |
| **E2: legacy needle** | `/results/race/[id]` ([RaceDesk.tsx](../app/results/race/[id]/RaceDesk.tsx)) and [ResultsDesk.tsx](../app/results/ResultsDesk.tsx): archive and primary races | [needleModel.ts](../app/results/components/needleModel.ts) → `forecastRace(civicToForecastInput(...))` in `app/lib/electoralModel.ts`, plus [voteModeModel.ts](../app/results/_lib/voteModeModel.ts) |

VAI v1 targets E1, which serves the November 3 general. E2 stays as it is.

### 3.1 E1 behaviour, question by question

| Question | What the code does | Location | Assessment |
|---|---|---|---|
| Projected final votes | Σ over counties of reported votes plus estimated remaining. With no county file, topline reported plus `(T − reported) ×` a blend of reported and forecast shares. | [live.ts L128-L179](../app/results/2026/live.ts#L128-L179) | The structure matches the target: reported plus allocated remainder. |
| County expectations | `st/{ST}.json` gives `counties[raceId][fips] = [a, b, other, total]` from the forecast. The county sum reproduces the published margin to a median of 0.006 pt across the 366 races with county files. **7 races are off by more than 2 pt**: `gov-AK` by 15.0 pt; `bm-AK-ballot-measure-2`, `-3`; `bm-MO-proposition-a`, `amendment-3`, `-6`, `-7`. One more, `bm-MO-amendment-8`, is off by 1.7 pt. 449 races have no county file and use the topline path. | `public/results/2026/st/*.json`, `index.json` | **Zero-reporting anchor violated** for those 7 races. At 0% the displayed projected margin is the county-sum margin, not the published one. `liveOdds` still returns the published `pR` because it short-circuits on `rep.t = 0`, so margin and probability disagree. |
| Role of reporting % | County `pr` (civicAPI `percent_reporting`, believed to be precincts) is used as the county's **completion fraction**. Final county total = `t / pr` once `pr ≥ 5%`. Below 5% it is `max(expected, t)`. | [L150-L151](../app/results/2026/live.ts#L150-L151) | **Main defect.** Precinct share is not ballot share. Mail-heavy counties can show 100% precincts with large mail inventories outstanding, or low precincts with most votes counted. The 5% switch is a discontinuity: at 5% `pr`, a county's estimated total can jump from its forecast turnout to 20 times the votes reported. |
| Outstanding votes | `left = final − reported` per county. There is no inventory concept, no official outstanding statements, and no late-arriving or cure ballots. | [L152](../app/results/2026/live.ts#L152) | Inventory is a point estimate with no uncertainty. |
| Partial counties | The remaining vote in a reporting county uses `w·observed + (1−w)·(forecast ± swing)` with `w = min(1, 2·frac)`. At `frac ≥ 0.5`, the rest of the county is assumed to vote exactly like what has been counted there. | [L152-L156](../app/results/2026/live.ts#L152-L156) | **No reporting-order selection.** If the counted half is mail and the rest is Election Day vote, the projection carries the mail lean onto the Election Day vote. |
| Non-reporting counties | Forecast shifted by a vote-weighted average swing from reporting counties, shrunk by `sv / (sv + 0.08·expected total)`. The swing is uniform, a single number in margin points applied as ±swing/2 to each side. | [L145](../app/results/2026/live.ts#L145), [L159-L161](../app/results/2026/live.ts#L159-L161) | The shrinkage is ad hoc; vote weighting lets one large early county dominate; there is no regional structure and no swing-by-lean term; and geographic selection is ignored. |
| Uncertainty | `band(pctIn) = max(0.6, 14·(1−p)^0.8)` for display. `liveOdds` uses `sd = sdF·(1−f)^0.9 + 0.35` with `sdF = |expM − cut| / |Φ⁻¹(pB0)|`, bounded to [1.5, 20]. | [L187](../app/results/2026/live.ts#L187), [L234-L243](../app/results/2026/live.ts#L234-L243) | Both are heuristics with **no empirical calibration**. The spread falls deterministically with `pctIn`, which is itself a model output, whatever the composition of the outstanding vote. `sdF` is backed out of a probability, not taken from the forecast's own spread (`model.json` publishes `p10`/`p90` and a distribution histogram per race). |
| Live win probability | `Φ((m − cut)/sd)`, Gaussian on the two-side margin. | [L241](../app/results/2026/live.ts#L241) | It cannot represent runoffs, majority rules or RCV, and it has no fat tails. |
| Multi-candidate | `sides()` collapses candidates to A (D, Yes, or I when an independent is listed first), B (R or No) and O (everyone else). | [L107-L118](../app/results/2026/live.ts#L107-L118) | Strong third candidates are lumped into O. Not suitable for three-way races, top-four, or RCV (AK, ME Senate and ME-02 are RCV per the ledger). |
| Majority, runoff, thresholds | Measures use `thr` (for example 60%). Candidate races use margin > 0 only. | [L235](../app/results/2026/live.ts#L235) | A Georgia general requires 50%+1, so the needle can show a "win" in a runoff scenario. |
| Duplicate, missing and revised results | Each poll replaces state, keeping one `prev` for display. There is no dedup, no ordering by source time, and no check for downward revisions. Counties present in civicAPI but not in the expectation file are **silently dropped** from reported totals. If none match (FIPS or town keying), the projection stays at the forecast while returns pour in. | [useLive.ts L19-L46](../app/results/2026/useLive.ts#L19-L46), [live.ts L138-L143](../app/results/2026/live.ts#L138-L143) | High operational risk on New England town-level reporting or any change in region keys. This needs a coverage check: reported votes from matched regions should be close to the topline. |
| Test data | Before the first close, non-zero test returns are blanked unless `?test=1`. | [useLive.ts L35](../app/results/2026/useLive.ts#L35) | Correct and kept. |
| Chamber control (live) | `seatOf()` classifies seats as called, leading or awaiting, and `countSeats()` counts them. No live probabilities are multiplied. | [Chambers.tsx L24-L45](../app/results/monitor/Chambers.tsx#L24-L45) | Compliant: no independent-product fallacy. There is also no live chamber probability at all. |

### 3.2 Vote-mode placeholders (E2)

The placeholders the brief asked about **still exist**:
- `MODE_REMAINING_WEIGHT = { EARLY: 0.15, VBM: 0.3, "ELECTION DAY": 0.55 }` and `MODE_PCT_COUNTED = { 92, 64, 28 }`, at [voteModeModel.ts L37-L38](../app/results/_lib/voteModeModel.ts#L37-L38).
- They are labelled `VOTE_MODE_DATA_SOURCE = "modeled-placeholder"`.
- They are rendered by `RaceDesk.tsx` (`buildVoteModeRows`, line 527) on `/results/race/[id]`, which `next.config.ts` still serves.
- E1 does not use them.

These are illustrative, not measured. VAI must not read them, and the handoff recommends a follow-up so the legacy desk shows "No method breakdown available" instead of numbers.

### 3.3 Comparison with the v0.2 research memorandum

| Memo requirement | E1 today | Protected intel branch (`0559aad3`) |
|---|---|---|
| Forecast-anchored county estimator | Yes, loosely (anchor broken for 7 races) | `baseline.ts` freezes the forecast baseline |
| Inventory with uncertainty, kept apart from precinct % | No (precinct % used as completion) | `outstanding.ts`: inventory never derived from precincts; no invented spread (`UNQUANTIFIED`) |
| Reporting-selection uncertainty | No | No |
| Method adjustment only with verified data | Not applicable (no method model) | `composition.ts`: method shares are context, never inferred |
| Append-only, source-time-ordered log; revisions are new readings | No | `observations.ts`: yes |
| Separate reported lead, forecast, projection, provider call and certified result | Partly (Milestone 2 status pill) | Yes, in types |
| Backtest before calibrated probabilities | No | `shadow.ts` reports win probability as **UNAVAILABLE** until a backtest exists |

**Implication.** VAI v1 should not build a third ingestion stack. The handoff makes the intel branch's `observations.ts` and `outstanding.ts` contracts the input layer, and puts the new estimator beside `shadow.ts`.

## 4. Count-order data quality assessment

Source: `data/vai/count_order_2026.json`, built from ledger sha256 `002b2831…75dd`.

| Measure | Value |
|---|---|
| Jurisdictions | 50 states from the ledger, plus a DC stub marked `NOT_COVERED`. No DC contest is in `index.json`. |
| First-release classes | A 22, B 7, C 15, D 6 |
| Count speed | Done election night 30, night plus a tail 13, days to weeks 7 |
| Explicit ledger caveats | 12 (AL, CT, DE, FL, ID, MD, MS, NM, OH, SC, TX, WV), carried as `UNRESOLVED` register entries |
| Ledger citations | 169: 35 official, 55 secondary research, 79 news media. 143 were retrieved (HTTP 200) on 2026-10-29; 26 were not (18 returned 403, 4 returned 404, plus 2 × 202, 1 × 429 and 1 network error). |
| States whose polls close in two time zones, with one ledger hour | 13 (AK, FL, ID, IN, KS, KY, MI, NE, ND, OR, SD, TN, TX). These are flagged `splitTimezoneState`, and per-county close times must be resolved before use. |
| Poll-close field | The ledger's `c` is an Eastern hour. It is converted to UTC assuming EST (DST ended 2026-11-01). It is still `LEDGER_ONLY`, because no official close-time table was cross-checked. |

**Quality findings**
1. **Media-heavy sourcing.** 47% of citations are news articles. The sequences ("first batch = early + mail through cutoff") are mostly journalistic description and are kept as `ESTIMATED_2026_ORDER` priors.
2. **County-specific text inside statewide records.** For example, AZ's first batch cites Maricopa's 2024 share of final turnout. The dataset therefore has `countyExceptions[]` and `partialReporting`, which are empty until evidenced. A statewide class is never applied to every county by default.
3. **Partisan "shift" text is unverified for all 50 states**, and it is not a model input (`UNVERIFIED_NOT_A_MODEL_INPUT`).
4. **Category C states** (all methods folded into one count) are where reporting order carries the least information. Category D ("varies by county") needs county-level evidence before any sequence prior is meaningful.

## 5. Independent verification (evidence register)

Source: `data/vai/evidence_register_2026.json` (166 entries). Every verified entry carries a short verbatim quote, the source URL, its tier, its sha256 and the retrieval time.

| Status | Count | Meaning |
|---|---|---|
| `VERIFIED_PRIMARY_ANCHOR` | 37 | Statute or official-procedure findings from the intel branch, anchor-checked on 2026-10-26 (AK, AZ, CO, FL, GA, IA, KS, ME, NE, NY, OH, PA, SC, TX, WI). Imported, not re-run. |
| `VERIFIED_SECONDARY` | 112 | NCSL Table 11 civilian mail receipt rule for 50 states and DC; NCSL Table 16 processing start for 50 states and DC; plus curated claims |
| `VERIFIED_MEDIA_ONLY` | 3 | Kansas appeals-court report, USPS postmark change, Michigan preprocessing explainer |
| `UNRESOLVED` | 12 | The 12 ledger caveats |
| `PRIOR_NOT_VERIFIED` / `UNVERIFIED_NOT_A_MODEL_INPUT` | 1 / 1 | Ledger sequences and ledger partisan-shift text, as classes |

**Cross-check of receipt deadlines.**
- Each ledger record's civilian rule (first sentence of `late`) was classified as Election Day or earlier, or as a postmark grace period, and compared with NCSL Table 11. **All 50 states agree.**
- 16 jurisdictions accept post-Election Day arrivals: AK, CA, DC, IL, KS, MD, MA, MS, NV, NJ, NY, OR, TX, VA, WA, WV.
- The classifier was tightened twice during the build (to stop picking up overseas-ballot sentences and to handle injunction wording). The final comparison has no remaining false positives.

**Material 2026 legal claims checked**

| Claim | Status | Evidence |
|---|---|---|
| *Watson v. RNC* (decided 2026-06-29): federal law does not preempt post-Election Day receipt of postmarked ballots | Verified (secondary) | NCSL Table 11 note. **Research question:** confirm against the opinion text. |
| Ohio SB 293 (2025) ended the 4-day grace period, keeping the overseas carve-out | Verified (secondary) | NCSL T11 |
| Kansas 3-day grace period kept in force for Nov 3 by injunction | Verified (secondary + media) | NCSL T11 and HPPR (2026-10-07). The litigation is live, so re-check on Nov 2. |
| Mississippi HB 908 (2026) moves receipt earlier only if SCOTUS found preemption | Verified (secondary) | NCSL T11. The 5-business-day grace period stands because *Watson* found no preemption. |
| Utah HB 300 (2025): receipt by 8 p.m. on Election Day | Verified (secondary) | NCSL T11 |
| California: postmarked and received within 7 days; 2025 processing and cure bills | Verified (secondary) | Ballotpedia, NCSL T11 |
| Michigan: preprocessing up to 8 days before (jurisdictions of 5,000+ people) | Verified (secondary + media) | NCSL T16, ClickOnDetroit |
| North Carolina: receipt by 7:30 p.m. on Election Day | Verified (secondary) | NCSL T11. The ledger's `SL 2026-60` changes are **not** independently verified. |
| Pennsylvania: pre-canvass not before 7 a.m. on Election Day | Verified (secondary) | NCSL T16 (25 P.S. § 3146.8) |
| USPS postmark-timing change raises late-rejection risk | Media only | NBC Chicago, OPB. No quantity is assumed. |

### 5.1 The six evidence kinds are kept apart

| Kind | What the repository now holds | Used by the estimator as |
|---|---|---|
| 1. Legally permitted preprocessing | NCSL T16 (51 entries) plus intel anchors | Context only. Permission is not practice. |
| 2. Actual tabulation | Intel tabulation-window anchors (AZ, CO, IA, NE, SC) | Context only |
| 3. Public release timing | Intel release-restriction and reporting-requirement anchors (AZ, CO, FL, IA, ME, TX); FL's 30-minute rule | Expected-stage timing **prior**, never a schedule |
| 4. Historical observed sequences | None verified. Ledger `historicalPattern` is unverified. | Not used |
| 5. Estimated 2026 order | Ledger `releaseSequence` (50 states) | Scenario prior with explicit alternatives |
| 6. Live observed batches | None yet. They will come from the flight recorder or observation log on Nov 3. | The only source of batch-level evidence |

### 5.2 Verified and uncertain procedures in competitive states

States with at least one Senate, Governor or House race with 0.1 ≤ `pR` ≤ 0.9 in `index.json` (as of 2026-10-28). NCSL columns are secondary summaries of statute, quoted verbatim and truncated. The table was generated from the two datasets by `scripts/vai/state_table.py`.

| State | Competitive races | Ledger first release (prior) | Ledger speed | Civilian mail receipt (NCSL T11) | Processing may begin (NCSL T16) | Intel primary anchors | Open ledger caveat |
|---|---|---|---|---|---|---|---|
| FL | 16 | A: Early and mail first | Done election night | Must be received by 7 p.m. on Election Day. | Fla. Stat. §§ 101.68, 101.5612 Upon receipt. Upon the completion of the public testing of automatic tabulatin… | 3 | The mail deadline, speed and partisan pattern come from statute and past cycles, not a 20… |
| OH | 7 | A: Early and mail first | Done election night | Must be received by the close of polls on Election Day. | Ohio Rev. Code § 3509.06 Processing, including using automatic tabulating equipment to scan ballots, may begi… | 2 | The partisan pattern was not sourced this cycle. |
| TX | 7 | A: Early and mail first | Done election night | Must be received by 5 p.m. on the day after the election if postmarked on or before Election Day. | Tex. Elec. Code §§ 87.0241, 87.027, 87.041, 87.042 No more than 20 days before Election Day. In most jurisdic… | 6 | Whether all counties hold the first batch until El Paso closes at 9 PM ET was not confirm… |
| NC | 6 | A: Early and mail first | Done election night | Must be received by 7:30 p.m. on Election Day. | N.C. Gen. Stat. §§ 163-230.1, 163-234 At county board of elections meetings, beginning the fifth Tuesday befo… | — | — |
| IA | 5 | A: Early and mail first | Done election night | Must be received before the close of polls on Election Day. | Iowa Code § 53.23 The day before Election Day if directed by the commissioner to do so. On Election Day, at a… | 2 | — |
| AZ | 4 | B: Mail first, all mail state | Days to weeks | Must be received by 7 p.m. on Election Day. | Ariz. Rev. Stat. §§ 16-550, 16-551 Upon receipt. Scanning can begin immediately after processing. Upon receip… | 4 | — |
| CO | 4 | B: Mail first, all mail state | Night plus a tail | Must be received by 7 p.m. on Election Day. | Colo. Rev. Stat. § 1-7.5-107.5 Upon receipt. Fifteen days before Election Day. Upon receipt: Envelope is veri… | 2 | — |
| MI | 4 | A: Early and mail first | Night plus a tail | Must be received by the close of polls on Election Day. | Mich. Comp. Laws §§ 168.765a, 168.766 Signature verification conducted upon receipt. Jurisdictions with at le… | — | — |
| NY | 4 | A: Early and mail first | Done election night | Must be received within seven days of the election if postmarked by Election Day. | N.Y. Elec. Law § 9-209 Within four days of receipt. Ballots are scanned beginning the day before the first da… | 2 | — |
| SC | 4 | D: Election Day first or varies | Done election night | Must be received by the close of polls on Election Day. | S.C. Code Ann. § 7-15-420 7 a.m. two days before Election Day. 7 a.m. on Election Day. 7 a.m. on the second d… | 4 | County release order and certification timing were not confirmed. |
| WI | 4 | D: Election Day first or varies | Done election night | Must be received by 8 p.m. on Election Day. | Wis. Stat. §§ 6.88, 7.52 After the polls open on Election Day. After the polls open on Election Day. Upon rec… | 2 | — |
| AK | 3 | D: Election Day first or varies | Days to weeks | Must be received within 10 days if postmarked on or before Election Day. | Alaska Stat. §15.20.201 No less than seven days before Election Day. 8 p.m. on Election Day. No less than sev… | 2 | — |
| KS | 3 | A: Early and mail first | Done election night | Must be received by the third day after an election if postmarked by Election Day. Note: the curren… | Kan. Stat. Ann. § 25-1134 Prior to Election Day. Exact timing not specified. Ballots may be scanned prior to… | 2 | — |
| NE | 3 | A: Early and mail first | Night plus a tail | Must be received by the close of polls on Election Day. | Neb. Rev. Stat. §32-1027 Verification can begin the second Friday before Election Day. Twenty four hours befo… | 2 | — |
| OK | 3 | A: Early and mail first | Done election night | Must be received by 7 p.m. on Election Day. Absentee ballots that are hand-delivered to the county… | Okla. Stat. Ann. tit. 26, §§ 14-123, 14-125 10 a.m. on the Thursday before Election Day, or earlier with appr… | — | — |
| TN | 3 | A: Early and mail first | Done election night | Must be received by the close of polls on Election Day. | Tenn. Code Ann. §§ 2-6-202, 2-6-303, 2-6-304 Signature verification conducted upon receipt. On Election Day a… | — | — |
| VA | 3 | A: Early and mail first | Night plus a tail | Must be received before noon on the third day after the election if postmarked by Election Day. Beg… | Va. Code Ann. §§ 24.2-709.1, 24.2-712 Upon receipt. Ballots may be inserted into optical scanning equipment o… | — | — |
| GA | 2 | A: Early and mail first | Done election night | Must be received by the close of polls on Election Day. | Ga. Code Ann. § 21-2-386 Verification of driver's license or state identification number conducted upon recei… | 1 | — |
| ME | 2 | C: All methods in one count | Night plus a tail | Must be received by the close of polls on Election Day. | Me. Rev. Stat. Ann. tit. 21-A, §§ 759, 760-B Seven days before Election Day if notice of processing times is… | 1 | — |
| MN | 2 | C: All methods in one count | Done election night | must be received by 8 p.m. on Election Day. Hand-delivered ballots must be received by 5 p.m. on El… | Minn. Stat. § 203B.121 Verification upon receipt. After the close of business on the 19th day before the elec… | — | — |
| NJ | 2 | A: Early and mail first | Night plus a tail | Must be received within 144 hours (six days) of the close of the polls if postmarked on or before E… | N.J. Rev. Stat. §§ 19:63-17, 19:63-22 Signature verification conducted upon receipt. The inner envelopes may… | — | — |
| NV | 2 | A: Early and mail first | Days to weeks | Must be received by 5 p.m. on the fourth day following the election if postmarked by Election Day.… | Nev. Rev. Stat. §§ 293.269927, 293.269931, 293.29933 Signature verification conducted upon receipt. Fifteen d… | — | — |
| PA | 2 | D: Election Day first or varies | Night plus a tail | Must be received by 8 p.m. on Election Day. | 25 Pa. Stat. § 3146.8 7 a.m. on Election Day. At 7 a.m. on Election Day. 7 a.m. on Election Day: Envelope dec… | 2 | — |
| WA | 2 | B: Mail first, all mail state | Days to weeks | Must be received no later than the day before certification, which is 21 days after a general elect… | Wash. Rev. Code §§ 29A.40.110, 29A.84.730 Wash. Admin. Code 434-250-110 Upon receipt. Scanning can begin imme… | — | — |
| AL | 1 | D: Election Day first or varies | Done election night | Must be received by noon on Election Day. | Ala. Code § 17-11-10 7 a.m. on Election Day. After the polls close on Election Day. Beginning at 7 a.m. on El… | — | Election night completeness and provisional dates were not confirmed against a 2026 sourc… |
| AR | 1 | A: Early and mail first | Done election night | Must be received by 7:30 p.m. on Election Day. Hand-delivered ballots must be received at the count… | Ark. Code Ann. § 7-5-416 The Tuesday before Election Day. 8:30 a.m. on Election Day. No earlier than the Tues… | — | — |
| CA | 1 | B: Mail first, all mail state | Days to weeks | Must be received no later than seven days after Election Day. | Cal. Elec. Code § 15101 Beginning on the day that an election official mails out ballots, which is no later t… | — | — |
| IN | 1 | C: All methods in one count | Done election night | Must be received by 6 p.m. on Election Day. | Ind. Code §§ 3-11.5-4-6, 3-11.5-4-11, 3-11.5-4-12 Signature verification conducted upon receipt.. Ballots may… | — | — |
| KY | 1 | C: All methods in one count | Done election night | Must be received before the close of polls on Election Day. | Ky. Rev. Stat. § 117.087 May begin 14 days before Election Day and must start by 8 a.m. on Election Day. 8 a.… | — | — |
| LA | 1 | A: Early and mail first | Done election night | must be received by 4:30 p.m. on the day before the election. | La. Rev. Stat. Ann. §§ 18:1313,18:1313.1 Parishes may begin three days before Election Day with written appro… | — | — |
| MO | 1 | A: Early and mail first | Done election night | Must be received by the close of polls on Election Day. | Mo. Rev. Stat. §§ 115.299,115.300 Five days before Election Day. On Election Day. Five days before Election D… | — | — |
| MS | 1 | D: Election Day first or varies | Done election night | Must be received within five business days of the election if postmarked on or before Election Day. | Miss. Code Ann. § 23-15-639 On Election Day when polls open. After the polls close on Election Day. On Electi… | — | A 2025 bill for no excuse in person voting passed both chambers, but its signing was not… |
| MT | 1 | C: All methods in one count | Night plus a tail | Must be received by the close of polls on Election Day. | Mont. Code Ann. § 13-13-241 Signature verification conducted upon receipt. Three business days before Electio… | — | — |
| NM | 1 | A: Early and mail first | Done election night | Must be received by 7 p.m. on Election Day. | N.M. Stat. Ann. §§ 1-6-10, 1-6-14 Within one day of receiving an absentee voter’s ballot, the county clerk mu… | — | The partisan pattern and any method breakout were not sourced this cycle. |
| OR | 1 | B: Mail first, all mail state | Days to weeks | Must be received within seven days of the election if postmarked on or before Election Day. | Or. Rev. Stat. §§ 254.478, 260.705 Upon receipt. Ballots can be scanned immediately after processing. Upon re… | — | — |
| VT | 1 | C: All methods in one count | Done election night | Must be received by the close of polls on Election Day. Ballots hand-delivered to a drop box or the… | Vt. Stat. Ann. tit. 17, §§ 2546a, 2546b Envelope verification can begin 45 days before Election Day. If a tow… | — | — |

## 6. Data sufficiency

| Need | Available | Verdict |
|---|---|---|
| County forecast expectations | `public/results/2026/st/*.json` for 366 races. 449 races are topline-only. Two sides plus other; no per-candidate split beyond A and B. | Enough for two-sided races. Multi-candidate races need per-candidate county expectations (forecast pipeline change). |
| Forecast uncertainty per race | `model.json`: `est.margin`, `prob`, `p10`, `p90`, `dist` histogram. Engine runs 2,000 seeded joint simulations (`meta.sims`; `scripts/forecast/model/dynamic_mode.py`). | Marginals are sufficient. **Joint draws are not exported.** Exporting them is required for coherent chamber control (math §8) and needs Lester's approval. |
| Live returns | civicAPI topline and region `percent_reporting` through the proxy. No method field, no outstanding-ballot field, no batch id. Region `pr` semantics are undocumented. | Enough for the county model. Not enough for method-aware estimation. |
| Official outstanding-ballot statements | Intel handoff: outstanding-ballot sources were found for AZ only. | AZ only |
| Historical timestamped returns (2022, 2024) | Intel `timestamp-search.json` (24 probes): no capture states its own source time. Wayback **result-candidate files** exist for PA 2024 (982 files over 16 distinct crawl hours), PA 2022 (30 files, 5 hours), GA Clarity 2022 (129 files, 20 hours) and GA Clarity 2024 (36 files, 5 hours). In the 6-file content sample per system, results-like content appeared in 1 of 6 (PA), 4 of 6 (GA 2022) and 6 of 6 (GA 2024). The NYT and GA SoS 2024 captures sampled did not look like results. AZ, FL, SC, IA, AK, civicAPI and AP: none usable. | **Insufficient for calibration** across states. Enough for a **limited, legitimate feasibility backtest** in PA and GA: crawl time is an upper bound on publication time, so using a capture at its crawl time cannot leak the future (backtest plan §2). |
| Historical method splits (final) | `medsl-agg.json`: 44 contests (2022) with method-labelled precinct aggregates. `pres24_counties.json`: final 2024 county totals. | Usable for **hyperparameters** (county dispersion, method gaps) and for clearly labelled synthetic stress tests. **Never** as a reporting sequence. |
| Pre-Election Day turnout by method | `ev_history/ev_long_{2022,2024}.csv` (state-level snapshots of early votes cast); 2026 early-vote snapshot (`meta.earlyVote`: 47 states, 36.0M ballots, 2026-10-27) | Useful prior for the **inventory of pre-Election Day ballots** at state level. Not county-level. |

**Overall.** The design can be specified and unit-tested now. It **cannot be shown to beat E1** before Nov 3. The only honest path is to:
1. Ship nothing to production.
2. Run the estimator in **shadow mode** on Nov 3 beside E1, logging both.
3. Run the PA/GA archive backtest as a feasibility study.
4. Evaluate after certification.

## 7. Research questions escalated (unresolved)

1. civicAPI `region_results[].percent_reporting`: is it precincts, expected vote or ballots? Does civicAPI expose `last_updated` per region, a batch id, or method breakdowns? (This decides whether `pr` can be anything more than metadata.)
2. Confirm *Watson v. RNC* from the opinion, and the Kansas injunction status on Nov 2.
3. The 12 ledger caveats (register ids `*-ledger-caveat`).
4. North Carolina SL 2026-60 and California AB 5, AB 16 and AB 827: confirm enacted text and effective dates from official sources.
5. Per-county poll-close times in the 13 split-time-zone states (for example, whether Texas counties hold first releases until El Paso closes).
6. Which jurisdictions publish official outstanding-ballot counts on election night and after (beyond AZ), and at what cadence. Candidates: Maricopa and Pima, Clark (NV), California counties, King (WA), Philadelphia.
7. Why `gov-AK` and the AK/MO measures' county sums differ from published margins. This is a forecast-pipeline question for Lester.
8. Licensing for historical timestamped feeds (AP, Decision Desk, Edison) if a broader backtest is wanted.
9. Whether the forecast engine can export its 2,000 joint draws (or a seeded generator) as a frozen artefact per publication.
