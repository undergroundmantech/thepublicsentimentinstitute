# VAI v1, Phase B2: race simulation, replay harness and model corrections

Status: RESEARCH ONLY. Branch `vai/phase-b2-simulation-backtest`, built on Phase B1 (`d6d21f31`) and main `45df156c`.
Nothing here is served, called, published or wired to a page. Every simulation record is `WITHHELD`. No empirical validation on real counts exists; see `VAI_V1_BACKTEST_REPORT.md`.

## 1. What was added

| Component | File | Notes |
| --- | --- | --- |
| T7 race simulation | `app/results/_vai/simulate.ts` | `simulateRace()` returns a research record plus joint draws. |
| Progress likelihoods (T5 change) | `app/results/_vai/inventory.ts` | `POWER_PROGRESS` and `LOG_PROGRESS` alongside the B1 Tobit model. |
| Marginalised state shift, shared gap (T6 change) | `app/results/_vai/preference.ts` | `shiftMode: "MARGINALISED"`, optional `rhoGap`. |
| Hyperparameters v2 | `app/results/_vai/hyper.ts`, `data/vai/hyper_v2_research.json`, `scripts/vai/build_hyper_v2.ts`, `npm run vai:hyper2` | `vai-hyper-v2-research`. `hyper_v1.json` is untouched. |
| Replay harness | `scripts/vai/backtest/lib.ts` | Snapshot classes, replay store, scorer, integrity checks, scores, cluster bootstrap. |
| Synthetic replay | `scripts/vai/backtest/run_synthetic.ts`, `summarize.ts` | Ablations A to E, baselines, checkpoints, train and held-out states. |
| Real series acquisition | `scripts/vai/backtest/fetch_pa2024.py`, `pa_summary.py` | Archived PA 2024 presidential county feed, capture times only. |
| Studies | `scripts/vai/exp/near_completion.ts`, `ess_study.ts`, `mode_gap_finals.py` | Artifacts in `data/vai/experiments/`. |
| Tests | `tests/vai/{simulate,b2_models,backtest,hyper_v2}.test.ts` | 119 VAI tests pass, none skipped (B1 had 82). |

## 2. T7: race-level simulation

`simulateRace(input)` chains inventory (T5), preference (T6) and the final margin for one race. Per draw it keeps one coherent set of remaining votes by county, one set of log-ratios and one count-order scenario. The margin, the final total and the outcome come from the same draw. Quantiles and probabilities are read from that joint sample; marginal quantiles are never combined.

Record fields: reported votes and source timestamp with coverage, official outstanding (label `OFFICIAL_STATEMENT`, else `UNKNOWN`), estimated remaining and final total (label `ESTIMATED`), margin mean, sd and quantiles (side B minus side A, points of all votes), outcome probabilities with a Monte Carlo standard error, model stage (`PRIOR_ONLY`, `EARLY`, `MIDDLE`, `LATE`, `NEAR_COMPLETE`), count-order profile with its evidence class and scenario posterior, hyperparameter id and status, prior id, shift mode, progress model, seed, draws, ESS fraction, inventory and preference flags, guardrail flags and the publication block.

Guardrails:

- `publication` is always `{ eligible: false, status: "WITHHELD" }` with reasons: `RESEARCH_ONLY_NOT_APPROVED`, `NO_POINT_IN_TIME_VALIDATION_ON_REAL_COUNTS`, `INDEPENDENT_VALIDATION_PENDING`, plus any triggered flag.
- Unsupported rules (RCV, measures, chamber composition) and unanchored priors return a reasoned empty record, never numbers (`UNSUPPORTED`, `NOT_ANCHORED`). Races with `liveUse: WITHHELD` stay withheld.
- `LOW_EFFECTIVE_SAMPLE_SIZE` makes quality `INSUFFICIENT` and removes the outcome probabilities.
- `NEAR_COMPLETION_UNVERIFIED` is raised when reported votes are at least 90% of the forecast's expected total with no completion evidence and no official statement. The model is not clamped; the output is degraded and flagged.
- `STALE_FEED`, `COUNTY_COVERAGE_LOW`, `NO_COUNT_ORDER_LEDGER_ENTRY`, `COUNTED_COUNTY_NOT_IN_FORECAST_FILE`, `PROBABILITY_NOISY` degrade quality. Other candidates are carried at forecast share and flagged `OTHER_CANDIDATES_AT_FORECAST_SHARE`.
- Count order changes spread only (`effect: "VARIANCE_ONLY"`, `observed: false`, `verified: false`). No partisan shift is applied from the ledger.
- Confidence does not rise with wall-clock time: the same counts at a later `asOf` give the same distribution (tested).

## 3. Numerical corrections

### 3.1 Near-completion bias (T5)

Root cause: the B1 inventory treated a county's counted votes N as a censoring point of its final total T (T >= N), independent of how close N is to T. A county at 97% counted therefore looked like one with an open-ended tail, and the shared turnout shocks were pulled up to explain counties sitting at their expectation. Result: about 20% of the final vote left outstanding at 97% counted.

Fix: a progress likelihood in which N is an observation of T. `POWER_PROGRESS` uses density alpha (N/T)^(alpha-1)/T. `LOG_PROGRESS` uses log(N/T) = -v with v ~ N(m, s^2) truncated at 0, which can represent counties that progress in step. The statewide component is learned from the cross-section over a grid with uniform prior weights. R >= 0 and T >= N hold in every draw; there is no clamp, no precinct share and no "expected turnout reached means finished" rule.

Controlled comparison (`data/vai/experiments/near_completion_study.json`, SYNTHETIC, 100 repetitions, 60 counties, 400 draws, 625 s). Error is the median remaining-vote error relative to truth; coverage is the 80% interval.

| Regime, 97%+ counted | B1 Tobit | POWER learned | LOG learned |
| --- | --- | --- | --- |
| NEAR_DONE (n=44) | +21.0%, cov 0.00 | +0.2%, cov 0.52 | +1.8%, cov 0.55 |
| NEAR_DONE_HIGH_TURNOUT (n=94) | +19.3%, cov 0.01 | -1.7%, cov 0.53 | -0.8%, cov 0.69 |
| LATE (n=15) | +16.1%, cov 0.00 | -1.4%, cov 0.80 | +1.8%, cov 0.53 |
| COMPLETE (n=65) | +25.9%, cov 0.00 | +3.0%, cov 0.00 | +4.4%, cov 0.00 |

Power-learned is the best in most regimes but fails where counties progress in lockstep (SYNC_STATEWIDE, 60 to 90% counted: -10.1%, cov 0.30). LOG is adopted for v2 because it is the only family without a regime that it fails by an order of magnitude. Known failure modes of the adopted model: it still over-states remaining votes by roughly 2% to 10% when the count is late or complete, and its 80% intervals under-cover (0.4 to 0.9 depending on regime). A COMPLETE count with no completion evidence still reports a positive remainder with coverage 0; that is why `NEAR_COMPLETION_UNVERIFIED` degrades the output instead of trusting the model. The truth generator shares the model's family, so these are properties of the algorithm, not of real counts.

### 3.2 Effective sample size (T6)

B1 reweighted published state-shift draws per county-count likelihood and fell back to a Gaussian when ESS dropped below 10%. The fallback discards the published shape. B2 adds `MARGINALISED`: the likelihood is integrated over the state shift on a quadrature grid built from the published draws, then a shift draw is sampled from its posterior, so the shape is kept and ESS stays near 1.

Study (`data/vai/experiments/ess_study.json`, SYNTHETIC, race `sen-SC`, 24 truths, 4 seeds, 300 draws, 1238 s):

- Narrow published prior: WEIGHTED has mean ESS fraction 0.41 to 0.52 (minimum 0.10) and falls back to a Gaussian in 2 to 8 of 24 cases; MARGINALISED has ESS 0.97 to 0.99 with no fallback. Coverage and CRPS are indistinguishable (CRPS 0.657 vs 0.662 at Q1, 0.467 vs 0.474 at mid), seed-to-seed sd of the median falls (0.055 vs 0.071 at Q1).
- Wide published prior: WEIGHTED falls back to a Gaussian in every case, so the published shape is not used at all; MARGINALISED keeps it, at similar CRPS.

Adopted as the default for v2 only because it removes a failure without worsening scores. The extra complexity is not justified by an accuracy gain. When quality is still insufficient, output is withheld.

### 3.3 Shared early-versus-late gap (T6)

`rhoGap` makes a share of the selection-gap variance common to every county. With independent gaps (B1) a statewide early-versus-late difference averages out across counties, which overstates certainty when mail or election-day batches lean the same way everywhere. The implementation moves spread and not the centre, and `rhoGap = 0` equals the absent parameter draw for draw (tests). It is implemented and evaluated but not adopted: `rhoGap` is unset in v2 because no point-in-time data exists to estimate it. Statewide method gaps from finals (`mode_gap_finals.json`, DERIVED_FROM_FINALS, n=35 method-versus-election-day comparisons in GA, AZ, IA, AK, SC, NY) have median absolute log-ratio gap 0.58 (q25 0.44, q75 0.93, max 1.40), larger than the v1 `sigmaGap` of 0.08 to 0.30. These are end-of-count method totals, not release batches, so they bound the order of magnitude and do not estimate `sigmaGap` or `rhoGap`. The observed PA 2024 feed (section 5) points the same way: the reported margin moved from Dem +42 points to Rep +3 as mail ballots gave way to election-day votes.

## 4. Hyperparameters v2

`vai-hyper-v2-research` = v1 plus `LOG_PROGRESS` (grid m in {0.02 ... 1.5} by s in {0.03, 0.1, 0.3, 0.8}, uniform weights). Status `RESEARCH_CANDIDATE`. Provenance: `inventory.progress` is `SYNTHETIC_STUDY_ONLY` (family chosen on synthetic regimes, grid and weights assumed); every other value keeps its v1 status (`INITIAL_UNFITTED`, `SPEC_FIXED` or `ASSUMED_UNFITTED`). Nothing is claimed as fitted or calibrated. `hyper_v1.json` is unchanged (tested byte for byte).

## 5. Data actually used

| Data | Class | Used for |
| --- | --- | --- |
| PA 2024 presidential county feed, 50 Internet Archive captures (47 distinct counted totals), 2024-11-06 01:14Z to 07:37Z; one capture failed to parse and is recorded | HISTORICAL_OBSERVED_CAPTURE_TIME | Observed arrival dynamics only. Not scored. |
| `ev_history`, `count_order_2026.json`, frozen priors, 2026 forecast county files | committed inputs | Priors and count-order profiles. |
| MEDSL method aggregates (final precinct returns by method) | DERIVED_FROM_FINALS | Order-of-magnitude bound on the method gap. |
| Generated counties, orders and counts | SYNTHETIC | Every replay and every ablation number. |

Capture time is the archive's crawl time: an observation time and an upper bound on when the numbers were public, not the state's publication time. No final or certified PA result is held. MEDSL's county file requires accepting a Dataverse guestbook and was not downloaded. No point-in-time prior for PA 2024 exists, and none was built from later data. The Oct 2026 forecast is never used as a point-in-time prior for 2022 or 2024.

## 6. Replay harness

- Snapshot classes: `HISTORICAL_OBSERVED`, `HISTORICAL_RECONSTRUCTED`, `SYNTHETIC`, `FINAL_RETURNS`. A synthetic snapshot cannot be labelled observed, and a replay mixing classes is flagged.
- `ReplayStore.view(asOf)` returns only snapshots with `availableAt <= asOf`, frozen, with no truth field. `Scorer` is the only holder of final truth. `assertNoFuture` refuses a view holding anything later.
- `checkTimestampIntegrity` catches duplicates, decreasing counts, bad timestamps, mixed classes and final returns inside a replay.
- Checkpoints: `NONE`, `INITIAL` (3%), `Q1` (25%), `MID` (50%), `Q3` (75%), `LATE` (90%), `NEAR_COMPLETE` (97%), `COMPLETE`, plus wall-clock re-evaluation at fixed `asOf`.
- Partition: train versus held-out by a hash of the state alone, independent of seed, race and order.
- Scores: remaining-vote error and coverage, margin error and bias, interval coverage, CRPS, Brier, log loss, reliability, ESS, failure and guardrail rates, runtime. Uncertainty by block bootstrap over race clusters, with sample sizes.
- Ablations on identical races, timestamps and truths: A published only; B published plus counted returns, no inventory and no count order; C adds inventory; D adds count order (full VAI); E adds a verified official outstanding figure (synthetic, labelled). Baselines: forecast only, reported lead, uniform swing.

## 7. Tests (invariants separate from accuracy)

Invariants: zero counts reproduce the frozen prior; remaining is non-negative and total is at least counted for every progress model; more counted means less outstanding; identical seeds give identical outputs; joint draws are coherent; timestamp integrity; no future data in a view; scorer-only truth; every record is withheld; hyperparameter provenance. Stress cases: verified official outstanding and a county-versus-statewide discrepancy, late mail windows, initial and near-complete, multiple candidates, unexpectedly high turnout, unexpected order, missing or revised county records, stale feed, low coverage, low ESS, external evidence failure. Accuracy numbers appear only in the report, never as test assertions.

## 8. Runtime

T7 with 600 draws takes about 0.2 to 0.8 s per race on a dev container. The near-completion study took 625 s and the ESS study 1238 s. Synthetic replay figures are in the report.

## 9. Commands

```
npm run test:vai
npm run vai:hyper2
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/intelligence/ts-resolve.mjs scripts/vai/backtest/run_synthetic.ts
python3 scripts/vai/backtest/fetch_pa2024.py
```

## 10. Not done in B2

No UI, no public output, no `public/` artefact, no change to Lester's forecast or the frozen priors, no merge, no deployment. RCV, measures and chamber composition remain unsupported.
