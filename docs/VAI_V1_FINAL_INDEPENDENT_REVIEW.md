# VAI V1.0 Final Independent Review

Review date 2026-10-30. Reviewed branch `vai/phase-b2-simulation-backtest` at `eca21ea5`. This review is on branch `vai/final-independent-review`, which adds documentation only. No algorithm, data or production file was changed.

This review does not authorize production deployment or publication.

## 1. Executive findings

**Disposition: B, SHADOW RESEARCH ONLY.** VAI is retained as an isolated, offline research tool. All published projections stay unchanged. No VAI probability, margin or remaining-vote figure may be shown publicly.

1. **No real-world accuracy has been shown.** The only scored evidence is a synthetic replay (10 races, 5 per partition, generator from the model's own family). The Pennsylvania 2024 feed has no prior and no truth, so it was not scored.
2. **The implementation is internally coherent and well guarded.** Joint draws, non-negativity, reproducibility, isolation and the "no partisan mean from count order" rule check out in code. 119 VAI tests exercise them. Tests establish correctness of the code, not calibration of the model.
3. **Early-count forecasts fail when reporting is biased.** Cause: the gap between counted and uncounted voters is independent across counties and has a fixed mean of zero, so a statewide early skew cannot be represented. The model reads an early lead as a real state shift. Under neutral order the full model is well calibrated; under the biased orders its 80% interval covers 0% to 30%.
4. **Late-count remaining votes are overstated about 2.1 times at 90% counted and 3.2 times at 97%** in the replay (2.2 and 3.3 times in a targeted probe) when no per-county completion evidence is given. This is a model-structure limit (one shared progress component for every county). It is far larger than B2's report said.
5. **The official-outstanding result (model E) is a compensating-error effect, not a bug.** Official statements fix the remaining total but the margin error is dominated by the preference of the remaining votes. The statement is also treated as almost exact, which it was not in the replay.

## 2. Verified implementation state

Remote heads checked on 2026-10-30 with `git ls-remote`:

| Ref | Commit |
| --- | --- |
| `origin/main` | `70126102` (Oct 30 polling update) |
| `vai/phase-a-foundations` | `2d0860f6` |
| `vai/phase-b1-inventory-preference` | `d6d21f31` |
| `vai/phase-b2-simulation-backtest` | `eca21ea5` |

- The merge base of the research branch and `main` is `45df156c`. The research branch is **26 commits ahead of and 2 commits behind** `main` (the earlier "26 behind" figure had the direction reversed). The 2 commits are `a6d1f1a0` and `70126102`. Since `45df156c`, `main` changed only `app/_polling`, `app/forecast`, `app/components` and `public/*`. It did not change `app/results/_vai`, `data/vai`, `scripts/vai` or `tests/vai`.
- **Synchronization is not required for this audit** and was not done. It will be required before any future shadow run (section 3).
- Code read in full: `simulate.ts`, `inventory.ts`. Read where it matters: `preference.ts` (header, contrast builder, factorization, `runPreference`), the generator and harness in `scripts/vai/backtest/run_synthetic.ts`, the test names in `tests/vai/guardrails.test.ts` and the anchor test in `tests/vai/simulate.test.ts`. Evidence read: `metrics.json`, `rows.csv`, `manifest.json`, `integrity.json` for the synthetic replay.
- Test results (reported by B2, re-run at the end of B2): VAI 119 of 119, intelligence 237 of 237, `tsc` and targeted `eslint` clean. They were not re-run for this review because no code changed.
- **Isolation verified.**
  - Nothing outside `app/results/_vai`, `tests/vai` and `scripts/vai` imports VAI (searched `app`, `middleware.ts`, `next.config.ts`, `scripts`).
  - `tests/vai/guardrails.test.ts` enforces: no VAI module imported by a page, layout, route, component or middleware; no VAI artefact served from `public/`; no unseeded randomness or wall-clock reads; precincts reporting never used in arithmetic.
  - The only environment variable is `VAI_INPUT_ROOT`, read by builder scripts.
  - `hyper_v1.json` is byte-identical to B1.

## 3. Source commit and data provenance

| Data | Class | Use |
| --- | --- | --- |
| `prior_98e38292a879.json`, `prior_e69d2976f3a0.json` | Frozen from the 2026-10-29 forecast | The only priors. **Stale:** `main` published a 2026-10-30 forecast (`public/forecast/archive/2026-10-30.json`) |
| `count_order_2026.json`, `evidence_register_2026.json`, `race_rules_2026.json` | Documented rules and ledger | Count-order categories, receipt rules |
| `hyper_v1.json` | Initial, uncalibrated | Unchanged |
| `hyper_v2_research.json` | `RESEARCH_CANDIDATE`, one synthetic-only change (log progress) | Not fitted |
| `pa2024_president_observed.json` | HISTORICAL_OBSERVED, 47 distinct counted totals | Dynamics only. No prior, no truth |
| `mode_gap_finals.json` | Derived from finals | Bound only, not batch level |
| `synthetic-20261030/*` | SYNTHETIC | Machinery and stress tests |

The October 2026 forecast was not used as a prior for any historical race. The MEDSL guestbook step was not bypassed.

**Any future shadow run needs a new frozen prior from the then-current published forecast** (`build_prior.ts`), and must never overwrite an existing prior file.

## 4. Mathematical correctness review

### A. Published forecast anchoring: coherent, weakly tested

- With nothing counted, the preference model has no data term. The state shift is the published forecast's own distribution (`anchoredStateShifts`), so the forecast distribution is carried, not replaced.
- Evidence: in the synthetic replay at NONE, the 80% interval width of the full model is 15.65 (held-out) and 16.66 (train), against 15.54 and 16.50 for the published distribution. That is within about 1%. Median CRPS is 5.27 against 5.30.
- **Weakness.** The unit test (`simulate.test.ts`) checks one race, one probability, tolerance 0.06 at 2,000 draws (Monte Carlo standard error is about 0.01). It does not check the margin distribution. The replay evidence above is better than the test. A tighter multi-race test is a research improvement (R6).
- Frozen priors are versioned by id and are not overwritten. No Lester forecast file is touched.

### B. Remaining-vote inventory: sound mathematics, a structural limit, an unproven heuristic

What is sound (code read):
- `ln T_c = ln E_c + τ_s + τ_g(c) + u_c`. The shared shocks are drawn from an exact lattice posterior with no weights or rejection. Each unit total is drawn from a truncated distribution, so `T_c >= N_c` and `R_c >= 0` hold by construction. Seeds are deterministic.
- County dependence enters through the shared state and regional shocks. This is the right structure.
- The B1 Tobit likelihood treated N only as a lower bound, which made a county at 97% look open-ended. That was a real flaw. Replacing the censoring with a likelihood for the counted share, `p(N | T)`, is a legitimate statistical idea. The POWER form is derived in closed form. The LOG form is a Gaussian on `ln(T/N)` truncated at zero. Both integrate correctly in the code.

What is not established:
- **One progress component (m, s) is shared by every county.** The posterior over the 28 components is computed once for the state. A county that has finished and a county that is half counted are treated as draws from the same progress law.
- Prior weights over the components are uniform. That is a convenience, not a fitted prior (`SYNTHETIC_STUDY_ONLY`).
- **Targeted probe (run for this review, 46 counties, 300 draws, no new simulation of the harness).** Counties report on staggered schedules, as in the replay generator, with no per-county completion evidence:

| Share counted | Counties finished | Median remaining / true remaining, no evidence | With completion evidence on finished counties |
| --- | --- | --- | --- |
| 50% | 7 of 46 | 1.07 | 0.91 |
| 75% | 18 of 46 | 1.50 | 0.92 |
| 90% | 30 of 46 | 2.18 | 0.90 |
| 97% | 40 of 46 | 3.31 | 1.08 |

- With uniform county progress (all counties at the same fraction) the same code is close to correct (0.49 to 1.2 times), so the code is not buggy. The problem is the shared-component assumption plus the deliberate decision not to read precincts reporting as completion.
- The replay shows the same pattern in `rows.csv`: median remaining is 2.1 times the truth at LATE and 3.2 times at NEAR_COMPLETE, in every count order and in every race at NEAR_COMPLETE (2.2 to 4.9 times by race). At NEAR_COMPLETE that is about 7 points of total votes.
- **B2's report understates this.** Its near-completion study (60 counties) found +0.3% to +4.4% in its scenarios; none had staggered county completion. A correction note was added to the B2 report.
- Verdict: the progress likelihood is a legitimate improvement over B1's Tobit for homogeneous progress, but as implemented it is a heuristic whose key assumption fails in realistic counts. It has no real-data validation.
- Official outstanding constraint: the statewide statement rescales the drawn remaining votes of unfinished counties so their sum equals `(1 − β)·outstanding`, with β from Beta(1, 30). This keeps non-negativity and county shape, but it is not a posterior update (the shared shocks and progress posterior are not conditioned on it) and it carries only the rejection uncertainty (mean about 3%). See section 7, Finding 4.

### C. Remaining-vote preference: honors the specification

- Counted votes sit at `θ_c − (1 − π_c)·g_c`, remaining votes at `θ_c + π_c·g_c`, with `π_c = N_c / T_c` a vote share drawn from the inventory. The gap `g` has mean zero in every scenario.
- **The "no automatic partisan adjustment from count order" constraint is honored.** The ledger category, scenario weights and stage change only the standard deviation `σ_g` (`gapSigma`). The record field `effect: "VARIANCE_ONLY"` is a constant, not a computed value, but the code path agrees with it and a test covers it.
- Scenario mixture: the three scenarios are summed out of the likelihood and drawn from their posterior. Correct in structure.
- Multi-candidate: **not supported.** The margin is side B minus side A. Other candidates keep their forecast county share (`OTHER_CANDIDATES_AT_FORECAST_SHARE` fires on every run). In a race with a major independent (for example the Nebraska Senate race) this is a material limit.
- The gap is **independent across counties** (it enters each county's own variance, plus an optional shared term `rhoGap` that is off). Independent gaps average out statewide. This is the source of Finding 3 below.
- The state shift δ and a shared gap are not separately identified: counted votes cannot tell a state that is really more Democratic from a state that reports Democratic votes first. With mean-zero gaps and no shared term, the model attributes the whole early skew to δ.

### D. Monte Carlo simulation: sound

- One draw carries remaining votes by county, preference log-ratios and a scenario. Margin, total, remaining and outcome come from that same draw (`simulate.ts`). Quantiles are never assembled from marginals.
- Margin is in points of all votes; `pB`, `pA`, `pTie` sum to one; unsupported rules, missing rules and unanchored priors return an empty record with a reason and `WITHHELD`.
- Reproducible for a seed (tests and replay use fixed seeds).
- Precision: quantiles use `floor(p·J)` with no interpolation. At 300 draws (the replay) the 2.5% and 97.5% points are coarse. At production draw counts this is adequate. The Monte Carlo standard error of `pB` uses the effective sample size.

## 5. Numerical stability review

- Replay result: 3,840 simulations, 0 non-finite rows, 0 unsupported or failed, 84 low-ESS (2.2%, minimum ESS 0.0043), all withheld.
- Marginalised shift treatment gives ESS of about 0.97 to 0.99. The weighted treatment fell to ESS 0.41 to 0.52 and to a Gaussian fallback in 2 to 8 of 24 narrow cases. The marginalised default is the right choice.
- **The safeguards catch numerical degeneracy, not model failure.** None of the flags or the `quality` label detects early-order bias or late overstatement.
  - Quality in the replay: OK 1,789, DEGRADED 1,967, INSUFFICIENT 84.
  - D at INITIAL: 53 of 60 runs were labelled OK, while held-out CRPS was 10.38 against 5.2 for the prior.
  - **The label `OK` must never be read as "reliable".**

## 6. Backtest evidence and limitations

- Synthetic only: 10 races (5 train, 5 held out), 2 replications, 3 count orders, 8 checkpoints. The three orders of one replication share a final result, so a partition has **10 independent truths** (5 races × 2) even though a cell reports n = 30.
- The generator shares the model's family: same inventory shock structure, same preference structure, same hyperparameter scales. It also contains a shared early gap (0.6 on the log-odds scale) that the default model cannot represent.
- Held-out CRPS of the margin (points):

| Model | INITIAL | Q1 | MID | Q3 | LATE | NEAR | COMPLETE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Published prior | 5.24 | 5.25 | 5.29 | 5.22 | 5.27 | 5.26 | 5.26 |
| Uniform swing | 12.61 | 7.87 | 4.89 | 3.03 | 2.36 | 2.25 | 2.26 |
| D (full VAI) | 10.38 | 8.24 | 5.90 | 3.57 | 1.31 | 0.39 | 0.06 |

- From LATE on, D beats the baselines. Before that it is worse than the published prior (and worse than uniform swing at MID and Q3).
- Count order explains the whole early failure (held-out D CRPS at INITIAL, MID, LATE): NEUTRAL 1.57, 0.66, 0.55; EARLY_A 13.34, 7.78, 1.28; EARLY_B 16.24, 9.26, 2.12.
- The count-order ledger (D against C) shows no measurable benefit in held-out races, and D is worse than C in training at INITIAL, Q1 and LATE. The ledger's category does not describe the generator's early gap.
- The hyperparameter variants (`D_RHO50`, `D_GAP200`) win because the generator contains what they add. That is a sensitivity result, not calibration.
- **No empirical backtest exists.** There is no point-in-time prior and no final truth for the Pennsylvania 2024 series. No claim of historical validation is made or supported.

## 7. Calibration assessment

Calibration is **not established**. The audit questions:

**Finding 1 and 2: early-count degradation and under-coverage.**

| Held-out, order | Checkpoint | D 80% coverage | D CRPS | D 80% width |
| --- | --- | --- | --- | --- |
| NEUTRAL | MID, Q3, LATE | 0.9, 0.9, 0.7 | 0.66, 0.59, 0.55 | 3.3, 2.6, 1.9 |
| EARLY_A | MID, Q3, LATE | 0.0, 0.0, 0.2 | 7.78, 4.51, 1.28 | 3.7, 3.0, 2.0 |

- The pooled 0.27 to 0.33 coverage is a blend of a calibrated neutral case and a zero-coverage biased case. It is **not** a general Monte Carlo, hyperparameter or dependence problem.
- Cause (code and evidence agree): a shared early skew has nowhere to go. Per-county gaps are independent and mean zero; δ absorbs the skew; the margin interval is far narrower than the bias (width about 3, error about 8). Interval widths that are right under neutral order are too narrow by a factor of two to five under biased order.
- Not the cause: Monte Carlo approximation (ESS about 0.98, noise small against the error), inventory width (the error is in the preference margin; see Finding 4), the prior (at NONE the model matches the published distribution).
- Neutral-order coverage rests on 10 truths and is only a consistency check.
- Reliability of win probabilities: bins near 0 and 1 are wrong 1% to 12.5% of the time, and the middle bins have 1 to 4 forecasts. **No probability may be published.**

**Finding 3: `rhoGap`.**
- The implementation is mathematically sound. `K[gap] = ρσ_g²` with loading `−(1 − π)` and an independent remainder `(1 − ρ)σ_g²`, so `ρ = 0` reduces to the default exactly (tested). A shared gap is identifiable only through the counted-versus-remaining structure and the prior on `ρ`.
- Its synthetic benefit (INITIAL CRPS 10.38 to 6.91, MID 5.90 to 1.47) is expected because the generator has a shared gap of 0.6. It says the default is the wrong shape when such a gap exists. It does **not** justify `ρ = 0.5` and it is not adopted. Its cost is also real: 37% of MID runs and 33% of Q3 runs were withheld for low ESS.
- No point-in-time data exist to estimate ρ or σ_g. The finals bound (median `|log gap|` 0.58, against v1 σ_g 0.08 to 0.30) says the v1 values are likely too small, nothing more.

**Finding 4: official outstanding counts (model E).** From `rows.csv` (all 60 truths per checkpoint, no new run):

| Checkpoint | Median remaining / true, D | Median remaining / true, E | Margin `|error|` D / E | E remaining 80% width / true |
| --- | --- | --- | --- | --- |
| Q3 | 1.56 | 0.97 | 3.90 / 3.95 | 0.063 |
| LATE | 2.12 | 0.98 | 1.56 / 1.59 | 0.065 |
| NEAR_COMPLETE | 3.23 | 0.98 | 0.52 / 0.51 | 0.071 |

- The statement does what it should for volume. It does not improve the margin, because margin error is dominated by the preference of the remaining votes (Finding 3), not by how many votes remain.
- Margin intervals tighten (LATE held-out width 1.17 against 1.99) while the margin median stays the same, so coverage falls (neutral Q3 0.9 to 0.4, LATE 0.7 to 0.3). In D, the overstated remaining volume was widening the margin interval and **compensating** for the overconfident preference model. E removes that accident.
- The statement is treated as almost exact. The synthetic statement had 10% lognormal error, which gives a nominal 80% width of about 0.26. The model's remaining width is 0.065, so its remaining-vote intervals cover 25% to 28% instead of 80%.
- Diagnosis: an **evidence-modeling problem** (no error term for the statement, only a rejection share) combined with an **unresolved structural problem** (preference). It is not an arithmetic bug. The 10% noise level is itself an arbitrary synthetic choice and real statement error is unknown, so this is partly an open empirical question.
- Do not disable official information. Model the statement's error and fix the preference structure first; then re-test.

**Finding 5: historical validation.** Confirmed missing (section 6). Nothing in this review uses an unavailable data set as a substitute.

## 8. Current-model comparison

The current projection is `project()` in `app/results/2026/live.ts`, reviewed and not changed.

| | Current `live.ts` | VAI |
| --- | --- | --- |
| Output | Deterministic final tally, margin and a band `max(0.6, 14·(1 − pctIn)^0.8)` | Joint draws; margin quantiles, remaining votes, probability |
| Completion | Per county from precincts reporting (`pr`), otherwise vote share against expectation; `final = counted / fraction` | Deliberately ignores precincts reporting; relies on a shared progress law or explicit completion evidence |
| Preference of remaining votes | Blend of the county's returns and the forecast, weight `min(1, 2·fraction)`, plus a reporting-county swing | Counted versus remaining gap, mean zero, variance by count order |
| Uncertainty | Heuristic band, no probability | Modeled; uncalibrated |
| Count order | None | Variance only |
| Forecast anchor | Expected county totals | Frozen prior and published distribution |

- VAI would eventually augment the band and, with calibration, supply a probability. `live.ts` already handles per-county completion through precincts reporting, which is exactly where VAI fails in Finding B. This is the most useful design hint from the comparison.
- VAI adds joint dependence, an explicit remaining-vote model and a count-order variance model. It has not shown any of them to be better on real counts. It does worse than the existing approach where completion is observable and VAI cannot see it.
- Interface compatibility: VAI's `VaiInventory` and `VaiReturnsFrame` contracts (Phase A types) are separate from `XRace` and `Proj`; an adapter would be needed. Shadow comparison is feasible once an archived night exists. **No head-to-head backtest was run and none is claimed.**

## 9. Publication safeguards

In place: `publication` is always `WITHHELD` with fixed reasons; `HYPERPARAMETERS_UNCALIBRATED` fires on every run; no VAI module is imported by public code; no VAI artefact is under `public/`; guardrail tests fail on a violation.

Missing before any public number: a calibration result on real data, a published-numbers policy that keys on a calibration status (not on the `quality` label), a statement of unsupported race types, and an independent review of the real-data backtest.

## 10. Operational readiness

**A safe offline research tool: yes. A deployed private service: no.**

Shadow operation is acceptable only if **all** of these hold:
- Explicit written authorization; default is not to run on election night.
- Offline scripts run by a person from a research branch or worktree. No server-side job, no scheduler, no endpoint.
- Output only to a non-public directory, outside `public/`, with no write access to forecast, results, recorder or call files.
- A new frozen prior from the then-current forecast; inputs hashed and versioned; run timestamp and seed recorded; diagnostics persisted with each record.
- A hard draw limit and a wall-clock limit per race. Runtime was 371 ms median (708 ms at the 95th percentile) at 300 draws, and grows with draws.
- Records never feed a call, a banner, a dashboard or an editorial decision. `WITHHELD` is preserved.

Not present and required for any service: a live ingestion adapter, a kill switch, resource limits, run persistence, and an alert on failure. Because none of these exist, and none should be built now, there is no way to activate VAI accidentally through an environment flag. That is the intended state.

The more valuable election-night action is archival: keep the existing election-intelligence recorder capturing time-stamped county returns so that a real point-in-time backtest becomes possible afterwards. VAI itself need not run.

## 11. Final disposition

**B: SHADOW RESEARCH ONLY.**

- Why not A: no empirical validation, no calibration, three critical model failures (sections 4B, 7), no live harness, no kill switch.
- Why not C: the code is deterministic, tested and isolated; the deficiencies are well characterized and recorded; offline use cannot affect the site; and a private run would add the one thing missing (point-in-time data). Archiving as C would also be defensible. B is chosen because it is no riskier and keeps the option open, but it is **not** a recommendation to run VAI on November 3.
- Nothing in this disposition changes any published output.

## 12. Critical blockers

### Publication blockers (all prevent public numbers; P2, P3 and P8 also make any private output misleading if it is read at face value)

| Id | Severity | Issue | Evidence | Impact | Resolution | Required validation |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | Critical | No empirical validation | Sections 3, 6 | No accuracy claim possible | Human accepts the MEDSL guestbook or another archive supplies a dated prior and final truth | Pre-registered scored replay on held-out races |
| P2 | Critical | Shared early-count bias unmodeled | D NEUTRAL coverage 0.9; EARLY_A 0.0 | Early forecasts worse than the prior (CRPS 10.4 against 5.2) | Estimate a shared gap with a hierarchical prior from real batch data; keep mean zero unless data support otherwise | Coverage by order on real nights |
| P3 | Critical | Remaining votes overstated 2.1 to 3.3 times late | `rows.csv`; probe in section 4B | Remaining-vote and total intervals wrong late; 7 points of total at 97% | Per-county progress state (finished or in progress), or a progress covariate; keep precincts reporting out of completion, allow it as a flagged covariate | Remaining-vote coverage on real nights |
| P4 | Critical | Probabilities uncalibrated | Section 7 | No probability publishable | Calibrate on real data after P1 to P3 | Reliability, Brier, log loss |
| P5 | High | Official statement treated as near-exact | E width 0.065 against 0.26 | Overconfident when statements are used | Add a statement-error term; fit on archived statements | Coverage with and without statements |
| P6 | High | Hyperparameters unfitted | `HYPERPARAMETERS_UNCALIBRATED` on all runs | All scales provisional | Fit σ_g, ρ, σ_inventory on real data | Held-out race sets |
| P7 | High | Two-candidate margin only | `OTHER_CANDIDATES_AT_FORECAST_SHARE` always set | Wrong for races with a major third candidate; RCV, measures, chambers unsupported | Multi-candidate preference model, or withhold those races | Backtest on such races |
| P8 | Medium | `quality = OK` is not a reliability signal | 53 of 60 INITIAL runs OK | Misleading label | Replace with calibration-keyed status | Review |

### Operational blockers (prevent a service, not offline research)

| Id | Severity | Issue | Resolution |
| --- | --- | --- | --- |
| O1 | High | No live ingestion adapter or run harness | Build only if shadow service is later approved |
| O2 | High | No kill switch, resource limits, timeouts, run persistence | Required before any service |
| O3 | Medium | Frozen priors are from 2026-10-29; `main` is 26 commits ahead with a newer forecast | Rebuild a prior from the current forecast for each run; never overwrite |
| O4 | Medium | Branch not synchronized with `main` | Rebase only when needed; do not merge into VAI automatically |
| O5 | Low | Quantiles have no interpolation | Use at least 2,000 draws or interpolate |

## 13. Deferred research work

Valuable and not needed now: R1 per-county progress-state mixture; R2 hierarchical shared-gap estimation; R3 statement-error model; R4 multi-candidate preference; R5 interpolated quantiles and common random numbers across models; R6 a stronger zero-counted anchor test over all supported races; R7 a head-to-head against `project()` on one archived night; R8 acquisition of PA 2020 and 2024 county finals; R9 revisit whether the count-order ledger helps. None should start before the website milestone.

## 14. Research closure recommendation

Close VAI V1.0 research at `eca21ea5` with this review. Preserve the branch, the synthetic replay, the observed PA 2024 series, the studies and this register. Do not merge. Do not deploy. Keep the election-intelligence recorder capturing time-stamped returns on November 3 so P1 can be resolved later. Return the team to the website.

Corrections recorded by this review:
- B2 report section 6 stated remaining-vote overstatement of 2% to 10%. In the replay and in the probe above it is 2.1 to 3.3 times when counties finish at different times and no completion evidence is given.
- The synthetic replay's cell sizes (n = 30) are triplicates of 10 independent truths per partition.

## 15. Website handoff

Not started in this assignment. Starting facts from the current code (main worktree, not changed):

- **Current appearance:** two modes, dark (default) and light, switched by `html[data-theme="light"]` and `app/components/ThemeToggle.tsx`. Light mode is implemented as per-component overrides (over 120 selector matches in `app/components/home/home2.css`, `app/components/opp/StageHero.tsx`, `app/opp.css`, `app/watchdog/light.gen.css`, and others). There is no Themed Mode.
- **Existing references:** the `opp-ui` design-system skill, `docs/ONPOINT_SITEWIDE_UI_AUDIT.md`, `docs/ONPOINT_FABLE_DESIGN_BRIEF.md`, `docs/ONPOINT_IMPLEMENTATION.md`, and `app/opp.css`, `app/chrome.css`, `app/globals.css`.

**Priority 1: three-mode architecture.**
1. Define one token set (surface, ink, line, accent, party colors, chart and map ramps) per mode: Professional Dark, Professional Light, Themed.
2. Convert per-component `html[data-theme="light"]` overrides into token references so components carry no mode-specific selectors. The generated `light.gen.css` should be retired or regenerated from tokens.
3. Persist the choice (storage plus a pre-hydration script to prevent a flash) and respect the system preference as the initial value.
4. Make charts and maps read tokens (SVG fills, map ramps, tooltips); one component tree, no duplicate pages.

**Priority 2: full-site visual audit.** One representative route per template (home desk, forecast and race pages, polling averages, results and election-night pages, On Point Polling, watchdog, maps, search, static pages), desktop and mobile, three modes. Check contrast, overflow, navigation, charts, maps and the existing election-night components. Reuse `docs/ONPOINT_SITEWIDE_UI_AUDIT.md` as the baseline.

**Priority 3: fixes and polish.** Functional and responsive corrections with Sonnet; premium creative refinement with Fable only where a page needs it; final regression checks before November 3. Election-night and recorder code paths should be tested but not restyled structurally late in the week.

Guardrails: no change to forecast data, polling inputs, the recorder or call logic; no VAI import.
