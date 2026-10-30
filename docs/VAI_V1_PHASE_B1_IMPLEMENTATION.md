# VAI v1 Phase B1: inventory and preference

Branch `vai/phase-b1-inventory-preference`, built on Phase A (`2d0860f6`, `vai/phase-a-foundations`) and `origin/main` `45df156c`. Not merged, not deployed, nothing public imports it. Lester's forecast code and outputs are untouched.

## 1. What this phase adds

| Task | File | Role |
| --- | --- | --- |
| T5 | `app/results/_vai/inventory.ts` | How many votes remain, per county and for the race (math §2) |
| T6 | `app/results/_vai/preference.ts` | How those votes split, per county, tied to the published forecast (math §3 to §5) |
| support | `rng.ts`, `normal.ts`, `hyper.ts` | Seeded xoshiro128**, accurate-tail normal functions, the hyperparameter set |
| build | `scripts/vai/build_hyper.ts`, `data/vai/hyper_v1.json`, `npm run vai:hyper` | The committed hyperparameter artefact |
| tests | `tests/vai/{inventory,preference,hyper}.test.ts`, `_support.ts` | 30 new tests |

Phase B2 (T7 race simulation, T8 backtest harness) is not started. Nothing here emits a probability for publication.

## 2. Integration with the current forecast

Phase A's frozen prior was built from forecast commit `182bceff`. `origin/main` moved to `45df156c` (the October 29 county-MRP rerun): `model.json`, `index.json` and 50 state county files changed. The change is material: across the 506 races present in both priors the published margin moved by 0.92 points on average, and by up to 7.5 points (`house-OK-01` +0.89 to −6.56 Rep margin, `house-WY-01` 35.1 to 27.8).

Handling, per the instruction to keep frozen priors and generate a new version when inputs change:

- `origin/main` was merged into the B1 branch (no conflicts, `1020c571`). The merge only reads forecast files.
- `data/vai/race_rules_2026.json` was regenerated from the merged inputs (`npm run vai:rules`).
- A new frozen prior `data/vai/prior_98e38292a879.json` was built (`npm run vai:prior`): 71 ANCHORED, 17 UNCONTESTED, 928 UNSUPPORTED, same counts as before. The Phase A prior `prior_e69d2976f3a0.json` is retained unchanged. Both are addressed by the hash of their inputs.
- Phase A's anchoring is preserved: the published histogram, its within-bin calibration and the reproduced mean, P(R), p10 and p90 are consumed as written.

Phase A tests skipped two checks after the merge until the artefacts were regenerated; with the new artefacts the VAI suite has 0 skipped.

## 3. Inventory (T5)

Model, per county *c* with expected total *E<sub>c</sub>*, counted votes *N<sub>c</sub>*:

$$\log T_c = \log E_c + \tau_s + \tau_{g(c)} + u_c,\qquad T_c \ge N_c$$

- *u<sub>c</sub>* integrates out. A partial count enters as a lower bound (a censored, Tobit-style likelihood), so the posterior of the shared shocks (τ<sub>s</sub>, τ<sub>g</sub>) is a closed-form unnormalised density on a lattice. It is sampled exactly up to the lattice step (σ/15): no importance weights, no rejection, no collapse. Each county's total is then a truncated normal given the shocks.
- Evidence that is not a vote count: an official statement of outstanding ballots sets *R<sub>c</sub>* = (1 − ρ)·O + L with ρ ~ Beta(1, 30) and *L* the eligible ballots not yet received (zero after the receipt deadline, positive before it in postmark-grace states). Statewide statements rescale only the counties still on the prior; a county-level statement is a floor.
- The completion ladder (schema §6): `CERTIFIED` leaves nothing; `ALL_KNOWN_BALLOTS_COUNTED` leaves a small provisional residual; `OFFICIAL_ELECTION_NIGHT_COMPLETE` leaves a larger residual; `PRECINCTS_ALL_IN` is not completion and is treated as partial (flagged). A completion claimed before a postmark-grace deadline is downgraded (flagged).
- A county whose count already exceeds the 99th percentile of its prior has its residual doubled (flagged).
- Precincts reporting is never an input. `unitsFromFrame` reads each county's vote total only, and a test builds frames that differ only in that field and gets identical draws. Votes outside every known county stay in the race total.
- Output: `InventoryPosterior` (per-county draws with *T<sub>c</sub>* ≥ *N<sub>c</sub>* in every draw, remaining and final totals as quantiles) and `toVaiInventory`, which fills the Phase A contract. Late-eligible volume stays `UNKNOWN` (the register stores a rule, not a volume); remaining and final totals are `ESTIMATED` intervals; the tier is `OFFICIAL_JURISDICTION_COUNT` only when a verified official statement was used.

## 4. Preference (T6)

For candidate *k* against the reference candidate (side A), county *c*:

$$\theta_c = \eta^0_c + \alpha + \delta_s + \zeta_{g(c)} + \gamma z_c + \varepsilon_c$$

The counted votes sit at θ − (1 − π)·g and the remaining votes at θ + π·g, where π<sub>c</sub> = N<sub>c</sub>/T<sub>c</sub> is a vote share drawn from the inventory and *g* is the gap between the counted and the remaining electorate.

- **No deterministic partisan adjustment.** *g* has mean zero in every scenario (μ<sub>g</sub> = 0, not a parameter). The count-order ledger sets only the spread σ<sub>g</sub> by stage and column (scenario LEDGER, MIXED, VARYING with weights 0.60 / 0.25 / 0.15, or 0.45 for the ledger when the register marks the state UNRESOLVED; category C merges ledger and mixed). Tests show the three scenarios agree on the mean and differ in width (AB > D > C at the first stage), and that swapping the two sides negates the margin.
- **Anchoring.** The state shift δ<sub>s</sub> is the published margin distribution carried through the county file's own margin-versus-shift curve (`anchoredStateShifts`). The curve is smoothed over the model's own county noise and corrected to second order for turnout, and the published draws are contracted about their mean so that anchor plus model noise has the published variance. Result: nothing counted reproduces the published forecast through the full inventory and preference pipeline (section 6).
- **Posterior.** The observed log-ratios are Gaussian given the latent structure, which is low rank (regions, lean slope, state shift, centring of ε), so each marginal likelihood and posterior comes from an m×m Woodbury system, and a posterior draw is Matheron's rule (prior draw corrected by the data). Published δ<sub>s</sub> draws are carried through importance weights over inventory draws; the scenarios are summed out analytically and drawn afterwards from their posterior. If the effective sample size falls below 10% of J, the draws are replaced by a Gaussian with their mean and sd (flag `STATE_SHIFT_DRAWS_REPLACED_BY_GAUSSIAN`).
- **Stage** comes from reported votes over the forecast's expected votes (cut-offs 0.25 and 0.70), never from precincts.
- K candidates: K − 1 log-ratio contrasts against candidate 0, a softmax for shares (minor-candidate shifts use a wide prior, `minorShiftSd`). The county file's three negative Democratic baselines in `sen-MT` are clamped to zero and reported, never edited.
- Reproducible: one seeded generator per module, labelled substreams, no `Math.random`, no clock.

## 5. Hyperparameters

All values are initial and uncalibrated (`data/vai/hyper_v1.json`, status `INITIAL_UNFITTED`). Each carries provenance: `SPEC_FIXED` (the specification gives the value), `INITIAL_UNFITTED` (the specification names the parameter and a wide starting value) or `ASSUMED_UNFITTED` (Phase B1 had to choose).

| Group | Parameter | Value | Status |
| --- | --- | --- | --- |
| inventory | σ<sub>τs</sub>, σ<sub>τg</sub>, σ<sub>u</sub> | 0.06, 0.05, 0.10 | INITIAL_UNFITTED |
| inventory | grace / slow-count multiplier on σ<sub>u</sub> | 1.5, 1.25 | ASSUMED_UNFITTED |
| inventory | exceed multiplier, exceed quantile | 2, 0.99 | SPEC_FIXED |
| inventory | rejection ρ ~ Beta(1, β) | β = 30 | INITIAL_UNFITTED |
| inventory | late-arrival mean share; provisional share (night, all known) | 0.01; 0.01, 0.002 | ASSUMED_UNFITTED |
| preference | σ<sub>ε</sub>, σ<sub>γ</sub>, σ<sub>region</sub>, κ<sub>revision</sub> | 0.10, 0.05, 0.05, 4 | INITIAL_UNFITTED |
| preference | σ<sub>g</sub> by stage × column | FIRST AB .30 C .10 D .25; MIXED .20 .08 .20; TAIL .15 .10 .15 | INITIAL_UNFITTED |
| preference | scenario weights | 0.60 / 0.25 / 0.15; 0.45 if unresolved | INITIAL_UNFITTED |
| preference | stage cut-offs | 0.25, 0.70 | ASSUMED_UNFITTED |
| preference | minor shift sd, pooled share, ESS floor, pseudo-count | 0.25, 0.005, 0.10, 0.5 | ASSUMED / SPEC_FIXED |

No value has been fitted to data. They must be replaced by backtest estimates (backtest plan §4) before any output is published.

## 6. Validation

Commands run on this branch:

| Check | Result |
| --- | --- |
| `npm run test:vai` | 82 pass, 0 fail, 0 skipped (52 Phase A, now run against both frozen priors, plus 30 new) |
| `npm run test:intelligence` | 237 pass, 0 fail |
| `npx tsc --noEmit` (excluding `.next/`) | clean |
| `npx eslint app/results/_vai tests/vai scripts/vai` | clean |

What the new tests establish:

- **Python parity.** The three-county example in `scripts/vai/toy_example.py`, run with σ<sub>τ</sub> = 0, σ<sub>γ</sub> = 0 and one region, matches an exact-posterior reference computed with numpy (margin mean 4.45 vs 4.41, sd 3.70 vs 3.69, P(D) 0.886 vs 0.882, ESS 0.991 vs 0.991, remaining votes in county A 307.7k vs 307.7k) within Monte Carlo error. The toy script itself omits the likelihood weight on each turnout draw; that weight is what moves county A's remaining votes from 302.8k to 307.7k, and the TypeScript model includes it.
- **Zero-reporting anchor.** For all 71 anchored races (J = 12 000), the mean margin of the full inventory plus preference pipeline is within 0.0164 points of the published mean (tolerance 0.05) and P(R) within 0.0063 (tolerance 0.005 plus 3.5 Monte Carlo standard errors, because P is a count of draws).
- **Reporting sequences.** With a pro-B lean in the counted votes, the projection moves toward B but not beyond the naive extrapolation, the interval narrows as more is counted, expected remaining votes fall, and a wider early-count gap σ<sub>g</sub> moves the projection less (0.05 > 0.3 > 0.8).
- **Inventory behaviour.** A partial count is not completion; more counted means less remaining; a county far above its expectation is flagged and widened; official statements, floors, receipt deadlines and the completion ladder behave as specified; finished counties raise the shared turnout shocks and their own region learns most.
- **Constraints.** Remaining votes are non-negative, total ≥ counted in every draw, county remainders add to the inventory's remainder, and K = 3 shares sum to one.
- **Reproducibility.** The same seed gives byte-identical draws; a different seed does not.
- **Guardrails.** Phase A's guardrail tests pass on the new modules (no precinct arithmetic, no unseeded randomness, no imports of the old public models, nothing public imports `_vai`).

Runtime at J = 20 000, half of every third county counted: GA (159 counties) 2.3 s, TX (254) 3.7 s, MI (83) 1.3 s, NC (100) 1.4 s.

## 7. Mathematical findings

1. **The lower-bound likelihood is informative, and probably too informative near completion.** Because a partial count is treated as the event T ≥ N, thirty counties each at 97% of their expected total pull τ upward and leave a median remainder of about 20% of expected votes, not 3%. This follows from the specified design, which treats the stopping point N as unrelated to T. In practice a county that reports close to its expectation is likely nearly done. The size of this bias is an empirical question for the backtest; it errs toward overstating remaining votes late in the night.
2. **Importance weights depend on π.** The preference likelihood depends on the turnout draw through π, so smaller π (more votes to come) gives a larger gap variance and a better explanation of a large observed deviation. This is correct Bayesian behaviour and is why the exact posterior differs from the toy script's unweighted turnout draws.
3. **Effective sample size is often low when the published distribution is narrow.** On the four races timed above the ESS fraction was 0.10 to 0.28 with the count at its baseline; TX was just above the 0.10 floor. The Gaussian fallback exists for this and is tested, but it means the published distribution's shape is not always retained once counts arrive.
4. **The second-order terms matter for the anchor.** Without the smoothing and turnout correction in `anchoredStateShifts`, the model's own noise moved the prior-predictive margin by a few hundredths of a point.

## 8. Limitations

- All hyperparameters are initial, uncalibrated settings. Nothing here has been backtested; no output may be published.
- Official statements and election-night completions do not update τ (conservative). Late-arrival volume is a wide placeholder because the register stores a rule, not a volume.
- Regions are not available in the forecast's county files, so default runs use one region; regional structure is implemented and tested, not yet fed real regions.
- The stage cut-offs and the σ<sub>g</sub> table are heuristics.
- The importance weights ignore the coupling between the observed log-ratio and the turnout draw other than through π; observed sampling variance is the binomial one at the observed counts.
- Candidates beyond two assume the K − 1 baselines are given and use a wide prior shift.
- Ranked-choice races, chambers and measures are not supported (Phase A marks them `UNSUPPORTED` or withheld).
- `sen-MT` has three counties with negative forecast baselines, clamped and reported.

## 9. Recommended next step

Phase B2: T7 race simulation (combine inventory, preference and the race rule to produce final-margin and win-probability draws with the labels and intervals the contract requires) together with the T8 backtest harness, so the hyperparameters in section 5 can be estimated and the bias in finding 1 measured on historical count sequences before any live use.
