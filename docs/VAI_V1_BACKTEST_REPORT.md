# VAI v1 Phase B2: Backtest Report

Branch `vai/phase-b2-simulation-backtest`. Built on main `45df156c` and B1 `d6d21f31`.
Status: research only. Publication is always WITHHELD. Nothing here is production ready.

## 1. Headline

- **No empirical historical validation was completed.** The point-in-time data needed to score a model on a real past election night does not exist in this repository or in the sources reachable here (section 2).
- The T8 harness, the leakage guards, the scorer and the paired comparison tooling are implemented and tested. They were exercised on a **SYNTHETIC** replay only.
- The synthetic replay uses a generator from the same model family as the simulator. Results show whether the machinery behaves as designed. They do not show real-world accuracy.
- The v2 hyperparameter set is a **RESEARCH_CANDIDATE**. It is not fitted. The one change from v1 (the log-progress inventory likelihood) was chosen from a synthetic study.

## 2. Data provenance

| Item | Class | Content | Usable for scoring |
| --- | --- | --- | --- |
| PA 2024 president, observed feed | HISTORICAL_OBSERVED | 47 distinct counted totals, 2024-11-06 01:14Z to 07:37Z, counties and mode (mail, in person) | No. No point-in-time prior and no final truth |
| PA 2024 arrival summary | derived from the above | Margin path and mail share path | Dynamics only |
| Finals, by method (mode gap study) | FINAL_RETURNS | Method-level gaps between early and election-day shares | Bound on σ_g only. Not batch level |
| `synthetic-20261030` | SYNTHETIC | 10 races, 2 reps, 3 count orders, 8 checkpoints | Machinery and stress tests only |
| Oct 2026 forecast | not historical | Never used as a prior for 2022 or 2024 | No |

PA 2024 observed series:

- The first capture shows 4 counties and a Dem two-party margin of +41.9, with about 100% mail share.
- The maximum Dem lead is +42.1 at 01:47Z.
- The margin first goes negative at 03:05Z (54 counties).
- The last capture (07:37Z, 6,638,911 votes, 67 counties) is Dem -2.9. Mail share is 34.5% Dem and 17.2% Rep.

This is a real example of an early-biased count order. It was **not scored**.

**Blocker.** There is no archived PA 2024 final in the repository. The MEDSL county file needs a guestbook step that a human must accept. There is no PA 2020 county file for a prior. Without a point-in-time prior and a truth, a score would be invented. No such score was produced, and no historical validation is claimed.

## 3. Synthetic replay design

Artifacts are in `data/vai/backtest/synthetic-20261030/` (`manifest.json`, `metrics.json`, `integrity.json`, `rows.csv`). Seed 20261030. Run with `scripts/vai/backtest/run_synthetic.ts`, which calls `summarize.ts` and writes all four files.

- 10 races. TRAIN: sen-SC, sen-MA, sen-CO, gov-WY, gov-OK. HELD_OUT: gov-SD, gov-AR, gov-AZ, sen-ID, gov-OR.
- 2 replications per race. 3 count orders: NEUTRAL, EARLY_A, EARLY_B. EARLY_* use an early gap of 0.6 (log scale) and a first-batch share of 0.4.
- 8 checkpoints: NONE, INITIAL (.03), Q1 (.25), MID (.5), Q3 (.75), LATE (.9), NEAR_COMPLETE (.97), COMPLETE.
- 300 draws per simulation. 3,840 model simulations plus baselines (5,280 rows in total).
- Every cell has n = 30 truths (5 races × 2 reps × 3 orders) for one partition. **The effective sample size is the 5 races in each partition**, so bootstrap intervals are clustered by race and are wide.
- Integrity: 60 truth/order combinations checked for time stamps and no future information. Every `issues` list is empty. `ReplayStore.view(asOf)` and `assertNoFuture` guard every snapshot. Non-finite output rows: 0. Unsupported or failed: 0.

Models:

| Id | Description |
| --- | --- |
| A_PUBLISHED | The published forecast only |
| B | Published prior plus counted returns. No count order, no inventory uncertainty |
| C | B plus the inventory model |
| D | Full VAI with the ledger's count-order profile (v2 hyperparameters) |
| E | D plus a verified official outstanding statement (SYNTHETIC, 10% noise) |
| D_V1 | D with the v1 Tobit inventory likelihood |
| D_RHO50 | D with a shared selection gap, rhoGap = 0.5 |
| D_GAP50, D_GAP200 | D with σ_g scaled ×0.5 and ×2 |
| REPORTED_LEAD | Baseline: reported margin, treated as final |
| UNIFORM_SWING | Baseline: uniform swing from the prior using the counted share |

**Caveat.** The generator shares the model's family, including its gap structure. A model that does well here is not shown to do well on real counts. Models that do badly here point to real design issues.

## 4. Results

Metric: CRPS of the final margin (percentage points, lower is better). Mean over the 30 truths in a cell. Order `ALL`.

### 4.1 HELD_OUT, all orders

| Model | NONE | INITIAL | Q1 | MID | Q3 | LATE | NEAR | COMPLETE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A_PUBLISHED | 5.30 | 5.24 | 5.25 | 5.29 | 5.22 | 5.27 | 5.26 | 5.26 |
| REPORTED_LEAD | 16.53 | 23.86 | 12.91 | 8.61 | 4.56 | 1.78 | 0.51 | 0.00 |
| UNIFORM_SWING | 5.16 | 12.61 | 7.87 | 4.89 | 3.03 | 2.36 | 2.25 | 2.26 |
| B | 5.25 | 10.34 | 8.19 | 6.02 | 3.81 | 1.43 | 0.49 | 0.12 |
| C | 5.27 | 10.31 | 8.19 | 5.90 | 3.57 | 1.31 | 0.39 | 0.06 |
| D | 5.27 | 10.38 | 8.24 | 5.90 | 3.57 | 1.31 | 0.39 | 0.06 |
| E | 5.27 | 10.38 | 8.25 | 5.88 | 3.81 | 1.46 | 0.44 | 0.00 |
| D_V1 | 5.25 | 10.37 | 8.20 | 5.92 | 3.52 | 1.21 | 0.45 | 0.37 |
| D_RHO50 | 5.25 | 6.91 | 3.27 | 1.47 | 1.24 | 0.77 | 0.36 | 0.08 |
| D_GAP50 | 5.27 | 11.73 | 10.08 | 7.81 | 4.43 | 1.42 | 0.39 | 0.06 |
| D_GAP200 | 5.27 | 9.02 | 6.19 | 3.66 | 2.39 | 1.10 | 0.38 | 0.07 |

TRAIN shows the same pattern (full tables in `metrics.json`).

### 4.2 Paired comparisons (CRPS difference, 95% race-clustered bootstrap interval, HELD_OUT)

| Comparison | INITIAL | MID | Q3 | LATE | NEAR | COMPLETE |
| --- | --- | --- | --- | --- | --- | --- |
| D minus A_PUBLISHED | +5.14 [3.21, 7.07] worse | +0.61 [-1.84, 2.58] none | -1.65 [-4.23, 0.19] none | -3.95 [-6.44, -2.08] better | -4.87 [-7.31, -3.06] better | -5.20 [-7.73, -3.40] better |
| D minus UNIFORM_SWING | -2.22 [-2.78, -1.67] better | +1.01 [0.24, 1.61] worse | +0.54 [0.42, 0.66] worse | -1.05 [-1.16, -0.95] better | -1.87 [-1.93, -1.79] better | -2.20 [-2.23, -2.16] better |
| D minus REPORTED_LEAD | -13.48 [-20.18, -6.74] better | -2.70 [-4.78, -1.00] better | -0.99 [-1.65, -0.45] better | -0.47 [-0.67, -0.32] better | -0.12 [-0.17, -0.06] better | +0.06 [0.04, 0.08] worse |
| C minus B | -0.03 none | -0.12 [-0.25, -0.01] better | -0.24 [-0.29, -0.18] better | -0.12 none | -0.10 none | -0.06 none |
| D minus C | +0.08 none | 0.00 none | 0.00 none | +0.01 none | +0.00 worse | 0.00 none |
| E minus D | 0.00 none | -0.02 none | +0.24 [0.18, 0.29] worse | +0.14 [0.10, 0.17] worse | +0.05 [0.00, 0.08] worse | -0.06 [-0.08, -0.04] better |
| D minus D_V1 | +0.01 worse | -0.02 none | +0.05 worse | +0.11 worse | -0.07 none | -0.31 [-0.50, -0.19] better |

### 4.3 What the results say

Supported on this synthetic evidence:

- Once most votes are counted (LATE and later) D beats the published prior, reported-lead and uniform-swing baselines on CRPS.
- C (inventory model) improves on B at MID and Q3 in HELD_OUT and at Q3, LATE and COMPLETE in TRAIN.
- D is clearly better than D_V1 at COMPLETE (0.06 vs 0.37). That is the near-completion defect fixed in section 6.

Negative or unsupported findings:

- **Early in the count the full model is worse than doing nothing.** At INITIAL and Q1, D has a higher CRPS than the published prior (+5.14 and +2.99 HELD_OUT). Mid-count it is not distinguishable from the prior. Uniform swing beats D at MID and Q3.
- **Count order drives the failure.** HELD_OUT D CRPS by order: NEUTRAL INITIAL 1.57, MID 0.66, LATE 0.55. EARLY_A INITIAL 13.34, MID 7.78, LATE 1.28. EARLY_B INITIAL 16.24, MID 9.26, LATE 2.12. When the early count is biased the shipped σ_g does not allow for it.
- **The intervals are overconfident.** HELD_OUT D 80% coverage is 0.27 to 0.33 from INITIAL to LATE and 0.70 at NEAR_COMPLETE. 95% coverage is 0.33 to 0.50 before NEAR_COMPLETE. B is worse still at NEAR_COMPLETE (0.17 for 80%).
- **Margin bias** is positive in the early checkpoints (D HELD_OUT +1.58 at INITIAL, +0.72 at MID, +0.57 at LATE).
- **D and C are not distinguishable** except where D is worse in TRAIN at INITIAL (+0.60), Q1 (+0.26) and LATE. The count-order profile does not help here, since the profile used does not describe the generated early gap.
- **E (official outstanding statement) is worse than D at Q3, LATE and NEAR_COMPLETE** (+0.24, +0.14, +0.05) and its 80% coverage falls to 0.13 to 0.23. It is better only at COMPLETE. The cause is not established (section 8, U7). It could be the way a noisy statement is applied, or its interaction with the progress likelihood. It should not be used in a published number until it is understood.
- **Shared gap rhoGap is the largest effect seen.** D_RHO50 cuts CRPS from 10.38 to 6.91 at INITIAL, 8.24 to 3.27 at Q1, 5.90 to 1.47 at MID. D_GAP200 also improves. This is expected, since the generator contains a shared gap. It is **not** evidence that rhoGap = 0.5 or σ_g ×2 is right for real counts. It does show that D is the wrong shape when a shared, early gap exists. D_RHO50 withholds 37% of MID, 33% of Q3 and 20% of LATE runs on quality grounds, which is a cost.

## 5. Calibration and reliability

Win probability for the Dem candidate, 180 forecasts per model and partition, all orders and checkpoints pooled. Most mass is in the extreme bins.

- D HELD_OUT: bin [0, 0.1): n = 77, mean p 0.0015, observed frequency 0.013. Bin [0.9, 1.0]: n = 91, mean p 0.9968, observed 0.923.
- D TRAIN: bin [0, 0.1): n = 96, mean p 0.0003, observed 0.125. Bin [0.9, 1.0]: n = 74, mean p 0.9965, observed 0.946.
- Middle bins have 1 to 4 forecasts each. They cannot support a reliability claim.

Win probabilities near 0 and 1 are too confident. About 8% of forecasts above 0.9 and up to 12.5% of forecasts below 0.1 were wrong. This matches the under-coverage in section 4.3. The `PROBABILITY_NOISY` flag fired 339 times of 3,840, but not on every poor forecast. No probability from this system should be published. `publication` is always WITHHELD.

## 6. Near-completion behaviour

Defect in B1: the Tobit likelihood used N (counted) only as a censor on T (turnout), T >= N. A county at 97% counted then looked open-ended, which pulled shared turnout shocks up and left about 20% of the vote "outstanding". Fix: progress likelihoods (POWER, LOG), keeping R >= 0 and T >= N and no clamp.

Study `data/vai/experiments/near_completion_study.json` (SYNTHETIC, 100 reps, 60 counties, 400 draws, 625 s). Relative error of remaining votes in the 97%+ band:

| Scenario | B1 (Tobit) | POWER_LEARNED | LOG |
| --- | --- | --- | --- |
| NEAR_DONE | +21.0% (80% coverage 0.00) | +0.2% (0.52) | +1.8% (0.55) |
| HIGH_TURNOUT | +19.3% | -1.7% | -0.8% (0.69) |
| LATE | +16.1% | -1.4% (0.80) | +1.8% (0.53) |
| COMPLETE | +25.9% | +3.0% | +4.4% |
| SYNC_STATEWIDE | n/a | -10.1% (0.30 at 60 to 90%) | +0.3% (0.57) |

POWER_LEARNED is more accurate in four scenarios and fails in SYNC_STATEWIDE. LOG was adopted for robustness, not because it is best. Its known faults: it overstates remaining votes by 2 to 10% when counting is late or complete, and its 80% intervals under-cover (0.4 to 0.9). `NEAR_COMPLETION_UNVERIFIED` fired on 1,092 runs (28%). It fires when reported is at least 0.9 of expected and no completion evidence exists. These runs are DEGRADED, which is why 57 of 60 D runs at NEAR_COMPLETE and all at COMPLETE are DEGRADED.

**Correction (final independent review, `docs/VAI_V1_FINAL_INDEPENDENT_REVIEW.md`).** The "2 to 10%" figure applies only to the scenarios of this study, which have homogeneous county progress. In the replay, where counties finish at different times and no completion evidence is given, the median remaining-vote estimate is about 2.1 times the truth at 90% counted and 3.2 times at 97% (row-level data in `rows.csv`). With completion evidence on the finished counties a probe gave 0.9 to 1.1 times. Treat the inventory as unreliable late in the count unless per-county completion is known.

## 7. Effective sample size behaviour

Study `data/vai/experiments/ess_study.json` (SYNTHETIC, sen-SC, 24 truths × 4 seeds, 300 draws, 1,238 s).

- WEIGHTED scenario treatment: mean ESS 0.41 to 0.52 (minimum about 0.10). Falls back to Gaussian in 2 to 8 of 24 NARROW cases and all 24 WIDE cases.
- MARGINALISED treatment: ESS about 0.97 to 0.99, no fallback.
- CRPS and coverage are similar (NARROW Q1 0.657 vs 0.662, MID 0.467 vs 0.474). Seed standard deviation is lower (0.055 vs 0.071 at Q1).
- MARGINALISED is the default because it removes a failure without worsening scores.

In the replay: 84 of 3,840 simulations (2.2%) had `LOW_EFFECTIVE_SAMPLE_SIZE`. Minimum ESS 0.0043. Those runs are INSUFFICIENT, with the outcome null and `withheld` true. Quality over all runs: OK 1,789, DEGRADED 1,967, INSUFFICIENT 84.

## 8. Hyperparameter evaluation (not calibration)

| Model | Mean CRPS TRAIN | Mean CRPS HELD_OUT |
| --- | --- | --- |
| D | 4.7625 | 4.3913 |
| D_V1 | 4.7961 | 4.4110 |
| D_RHO50 | 2.7148 | 2.4183 |
| D_GAP50 | 5.3113 | 5.1494 |
| D_GAP200 | 4.1143 | 3.5090 |

This is a sensitivity study on synthetic data. The truth generator contains the structure that D_RHO50 and D_GAP200 add, so their win says only that D is sensitive to it. **None of these variants is adopted into hyper_v2.** `rhoGap` is unset. σ_g is as in v1. `hyper_v1.json` is byte-identical to B1.

Finals gap bounds (`mode_gap_finals.json`): median |log gap| 0.58, larger than v1 σ_g (0.08 to 0.30). These are method-level, not batch-level, so they are only a bound.

## 9. Runtime

Per simulation, 300 draws, one CPU (wall clock, from `rows.csv`):

| Model | Median | 95th percentile | Max |
| --- | --- | --- | --- |
| B | 23 ms | 43 ms | 131 ms |
| D | 371 ms | 708 ms | 1,093 ms |
| E | 300 ms | 652 ms | 1,202 ms |
| D_RHO50 | 368 ms | 704 ms | 1,077 ms |

The full replay (5,280 rows) took 1,155 s. Production draw counts (more than 300) and live polling intervals were not tested.

## 10. Unresolved issues register

| Id | Issue | Impact | Needed |
| --- | --- | --- | --- |
| U1 | No empirical backtest. No point-in-time prior and no final truth for PA 2024 | No validation claim possible | Human accepts MEDSL guestbook. Archive final county returns and a prior (e.g. 2020 county file or a dated poll or forecast) |
| U2 | σ_g, σ_region, rhoGap and inventory σ values unestimated. Provenance is v1 initial or SYNTHETIC_STUDY_ONLY | Under-coverage (0.27 to 0.33 for 80%) | Batch-level time-stamped data from at least several states and cycles |
| U3 | Early-biased count orders produce CRPS 8 to 16 (vs 1.6 NEUTRAL) in HELD_OUT early checkpoints | Early forecasts are unreliable. Worse than the prior at INITIAL and Q1 | Estimate a shared gap from real orders. Decide whether to adopt rhoGap. Consider a floor on interval width |
| U4 | LOG progress likelihood overstates remaining votes by 2 to 10% late and under-covers | Remaining-vote intervals too narrow | Real late-night data, or a mixed POWER and LOG likelihood |
| U5 | POWER_LEARNED fails when counting is statewide-synchronous (SYNC_STATEWIDE) | Reason LOG was chosen | Same as U4 |
| U6 | Win probabilities near 0 and 1 are overconfident (up to 12.5% wrong below 0.1) | No probability can be published | Calibration on real data, or a probability shrinkage rule |
| U7 | E (official outstanding statement) is worse than D at Q3 to NEAR_COMPLETE with 80% coverage 0.13 to 0.23 | Official statements may degrade forecasts | Debug how statement noise enters the progress likelihood |
| U8 | Count-order profile (D vs C) shows no benefit and sometimes a cost in this replay | Cannot justify the ledger's profile | Real ordering data and a profile that matches it |
| U9 | The generator shares the model's family | Synthetic results are flattering | A real backtest (U1) |
| U10 | Only 5 races per partition | Wide intervals. Race clustering limits inference | More races and a pre-registered split |
| U11 | RCV, ballot measures and chambers are UNSUPPORTED | Coverage limited to single-winner candidate races | Later phase |
| U12 | The comparison with the B1 `live.ts` path (E1) was not done | Unknown relative behaviour | Compare on the same replay |
| U13 | `NEAR_COMPLETION_UNVERIFIED` makes nearly every complete run DEGRADED | Quality label is blunt | A completion evidence source (certified counts) |
| U14 | Runtime was measured at 300 draws only | Unknown cost at production draw counts | Load test |
| U15 | The PA 2024 observed feed has 47 captures, not a full archive | Sparse. County coverage grows from 4 to 67 | A complete capture, if one exists |

## 11. Next phase

1. Resolve U1 first. A real, time-stamped replay with a dated prior and final truth for at least PA 2024 and one other state turns this harness into a real test.
2. Use that data to estimate σ_g and rhoGap at batch level. Then re-run sections 4 and 5 on a held-out partition fixed in advance.
3. Investigate E (U7) and the early-count under-coverage (U3) before any scenario weights are revisited.
4. No public UI until U3 and U6 are resolved and calibration is shown on real data.

## 12. Reproduction

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/intelligence/ts-resolve.mjs scripts/vai/backtest/run_synthetic.ts
npm run vai:hyper2
npm run test:vai
```
