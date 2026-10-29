# Vote Arrival Intelligence v1: backtest plan

Status: **plan only**. No backtest has been run and no accuracy claim is made anywhere in the VAI documents.

The plan obeys three rules:
1. Every estimate uses only information available at its timestamp.
2. Final county results are **never** used as a fake historical reporting sequence.
3. Synthetic tests are kept apart from backtests and labelled as such.

## 1. Questions the backtest must answer

1. At each stage of the count, is VAI's projected final margin more accurate than E1 (the current live model) and the simpler alternatives?
2. Are VAI's intervals and win probabilities **calibrated**? For example, do 80% intervals contain the final result about 80% of the time?
3. Does the count-order scenario layer (§5 of the math design) improve calibration over the same model without it?
4. How large is the selection gap σ_g by state category and stage? This is the key unidentified hyperparameter.
5. Does VAI stay stable under feed anomalies (duplicates, downward revisions, missing counties, stale feeds)?

## 2. Data sufficiency verdict

| Source | Coverage | Usable as point-in-time data? |
|---|---|---|
| Wayback captures of PA `electionreturns.pa.gov` result files | 2024: 982 files over 16 distinct crawl hours, 3 days. 2022: 30 files over 5 hours. Only 1 of 6 sampled files looked like results. | **Yes, after parsing and validation.** The crawl time is when the archive *saw* the file, an upper bound on when it was public, so using a capture at its crawl time cannot leak later information. Coverage is sparse and needs a parser per file family. |
| Wayback captures of GA Clarity ENR | 2022: 129 result-candidate files over 20 hours, 4 days; 4 of 6 sampled looked like results. 2024: 36 over 5 hours; 6 of 6 looked like results. | **Yes**, same treatment. Clarity has method-labelled detail files in some counties, so it is the only realistic test of the method-aware variant. |
| GA SoS 2024 results site, NYT asset captures | 798 and 7 to 280 captures; none of the 6 samples looked like results | Unknown. Worth a deeper probe (JSON endpoints) before ruling them out. |
| AZ, FL, SC, IA, AK official sites; civicAPI; AP | No usable captures found | No |
| MEDSL 2022 precinct-by-method finals (`medsl-agg.json`, 44 contests); 2024 county finals | Finals only | **No.** Used for hyperparameter *dispersion* and synthetic tests only. |
| Licensed feeds (AP, Decision Desk, Edison) with timestamps | Not held | Would be sufficient. This is a cost and licensing decision (audit §7 question 8). |
| **2026 shadow log (Nov 3 onward)** | All races, every poll | **Yes. This is the primary evaluation**, scored after certification. |

**Verdict.**
- The historical data supports a **feasibility backtest** in two states (PA, GA), covering 2022 and 2024.
- That is enough to test the machinery, find failure modes and get a first, very uncertain estimate of σ_g for categories D (PA) and A (GA). It is **not** enough to certify calibration nationwide.
- Promotion to public display therefore depends on the 2026 shadow results (§8), with the PA/GA backtest as a necessary but not sufficient gate.

## 3. Constructing point-in-time snapshots

1. Enumerate captures with the Wayback CDX API (`timestamp-search.json` records the queries). Fetch the **raw** capture (`id_` URLs) and record `contentSha256`.
2. Parse into `HistoricalSnapshot` (data schema §9). Fields:
   - `availableAt` is the crawl time in UTC.
   - `sourceTime` is filled only if the content states it.
   - Any snapshot whose `sourceTime` is **later** than `availableAt` is rejected as corrupt.
3. Deduplicate by `contentSha256`, keeping the earliest `availableAt`.
4. Order strictly by `availableAt`. Where several counties' files have different crawl times, the state at time t is, for each county, the latest snapshot with `availableAt ≤ t`. Counties without one are treated as unreported **at t**, even if the real site already showed them. This is conservative and gives no look-ahead.
5. Store finals (`HistoricalFinal`) separately, in a file the estimator harness cannot open. Only the scorer reads it.

### Prior for 2022 and 2024

OnPoint did not publish forecasts for those cycles, so the backtest uses a clearly labelled **surrogate prior** built only from information available before polls closed:
- County baseline: previous-cycle county shares, shifted uniformly to match a pre-election polling average.
- Turnout: previous-cycle county totals, scaled by pre-election early-vote counts from `ev_history/ev_long_{2022,2024}.csv`.
- Statewide σ_F: the historical polling error for that office type.

Every surrogate input is frozen with a hash before scoring. The backtest therefore tests the **live machinery** (inventory, gap, shrinkage, scenarios), not OnPoint's forecast skill.

## 4. Methods compared

All six methods consume the same snapshot stream and the same surrogate prior.

| # | Method | Definition |
|---|---|---|
| M1 | Forecast only | Ignore returns and keep the prior until final |
| M2 | Reported lead | Projected margin = current reported margin; no remaining-vote model |
| M3 | Uniform swing | Reported counties' average swing, applied to non-reporting counties; reporting counties extrapolated by votes/expected |
| M4 | **E1 (current OnPoint live model)** | `project()` and `liveOdds()` from `app/results/2026/live.ts`, run unmodified. They are pure functions, so the harness imports them through a thin Node adapter. |
| M5 | VAI without count order | Math design §2–§4 and §6–§7 with a single scenario at the category-pooled σ_g |
| M6 | VAI with count-order scenarios | Full design, including the §5 mixture |

M2 has no probability. M1 and M2 give reference points; M4 is the incumbent.

## 5. Checkpoints

Two indexes, both computed **only by the scorer**:

1. **Reporting checkpoints.** The first snapshot at which the counted share of the eventual final total reaches 5%, 10%, 25%, 50%, 75% and 90%, plus "near complete" (≥ 98% or the last election-night snapshot).
   - The final total is used **only to label which snapshot is evaluated**. It is never passed to the estimator.
2. **Clock checkpoints.** Poll close + 30 min, +1 h, +2 h, +4 h, then 08:00 ET the next day and each following day until certification.

## 6. Metrics

| Metric | Applies to | Notes |
|---|---|---|
| Final-margin error: MAE, RMSE, bias | M1–M6 | Per checkpoint, by state and office |
| Interval coverage at 50%, 80% and 95% | M1, M3–M6 | E1's `band()` is treated as its stated interval |
| CRPS of the predictive margin distribution | M1, M3–M6 | |
| Brier score and log loss of the winner | M1, M3–M6 | Probabilities clipped to [0.001, 0.999] for log loss |
| Calibration curve (reliability diagram) | M1, M3–M6 | Pooled across races, by stage |
| Remaining-vote error: (R̂ − R)/R and coverage of R | M3–M6 | Tests the inventory model directly |
| False high confidence | M3–M6 | Share of race-checkpoints with P ≥ 0.95 for the eventual loser |
| Leader-flip stability | M3–M6 | Number of projected-leader changes per race, compared with the true number of reported-lead changes |
| Anomaly resilience | M4–M6 | Change in output after injecting duplicates, downward revisions, a missing county, a stale feed or an unmatched region (synthetic, §7) |
| Anchor check | M5, M6 | At zero reporting the prior must be reproduced (math §6) |

## 7. Synthetic stress tests (not a backtest)

These answer "does it break?", never "is it accurate?". Every output file and chart is marked **SYNTHETIC — not a backtest**.

1. **Method-order stress.** Using MEDSL 2022 precinct-by-method finals for a contest (for example GA governor), build alternative *hypothetical* release orders (mail first, Election Day first, mixed). Confirm that:
   - VAI's intervals widen in the scenarios where the gap is large;
   - they still cover the truth.
   - These sequences are hypothetical and must never be described as what happened.
2. **Feed anomalies.** Inject each anomaly into a real archive stream (PA 2024). Assert that:
   - outputs do not jump by more than a bound;
   - flags are raised;
   - nothing reports 100% complete.
3. **Coverage failure.** Rename 10% of region keys. Assert that the unmatched pseudo-county keeps topline totals intact and that coverage < 0.98 is flagged.

## 8. Statistical testing and promotion criteria

- **Uncertainty.** A block bootstrap that resamples **races within election-state clusters**, because checkpoints within a race are strongly correlated. Report 90% intervals for every metric difference between methods (M6 − M4, M6 − M5).
- **Sample-size honesty.** With two states and two cycles the backtest will have on the order of tens of races. Differences with intervals that include zero are reported as **inconclusive**.

### Promotion gates

VAI may move from shadow to an **operator-visible** panel only if all of the following hold:
1. The anchor check passes for 100% of races.
2. There are no anomaly-resilience failures.
3. On the PA/GA backtest, 80% interval coverage for M6 is between 70% and 90% at every reporting checkpoint.
4. On the same backtest, M6 shows no more false high-confidence than M4.

**Public display** additionally requires the 2026 shadow evaluation after certification to show:
1. 80% coverage within ±7 points of nominal across all races and checkpoints.
2. A Brier score no worse than M4 (bootstrap 90% interval upper bound ≤ 0).
3. Margin MAE no worse than M4 at 25%, 50% and 75%.

If M6 is not better than M5, the count-order layer is dropped from the public model and kept only for labels.

## 9. Leakage controls

1. The estimator harness runs in a separate process that is given only the snapshot stream up to t and the frozen prior. Finals live in a directory the harness never opens, and this is enforced by a path allow-list test.
2. Hyperparameters for an evaluated cycle are estimated only from earlier cycles (2022 uses ≤ 2020; 2024 uses ≤ 2022).
3. Nothing in VAI reads `availableAt` > t. A unit test feeds a stream with a planted future snapshot and asserts it is ignored.
4. Checkpoint labels from the final total stay in the scorer.
5. All inputs (snapshots, prior, hyperparameters) are hashed into the run manifest. A rerun with the same manifest must reproduce the outputs byte for byte (seeded RNG).

## 10. Outputs

- `data/vai/backtest/<run-id>/manifest.json`: hashes, versions, seeds.
- `data/vai/backtest/<run-id>/metrics.json`: every metric × method × checkpoint × cluster, with bootstrap intervals.
- `data/vai/backtest/<run-id>/synthetic/`: kept separate, with a `SYNTHETIC` banner field.
- `docs/VAI_V1_BACKTEST_RESULTS.md`: written only after a run, with a plain statement of what is and is not shown.

## 11. The 2026 shadow evaluation (first prospective test)

On Nov 3, VAI runs behind a flag (handoff T8) and writes one assessment per race per poll to the append-only log beside E1's output.
- Nothing is shown publicly.
- After certification, the scorer runs §6 on the full log, with the 2026 certified results as finals.
- This is the first evaluation with real OnPoint priors and all states, and it decides promotion.
