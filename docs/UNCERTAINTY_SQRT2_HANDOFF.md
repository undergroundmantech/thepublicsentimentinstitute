# √2 Senate and House uncertainty: request for the authoritative runs

For Lester. Nothing here changes your model, your scripts or anything under `public/forecast`.

## What we decided

We want Senate and House forecast uncertainty widened so the **variance of the forecast-error distribution doubles**:
standard deviation × `UNCERTAINTY_SCALE = 1.4142135623730951` (√2). Governors stay as they are. Point estimates
(expected margins, polling averages, the generic ballot, every deterministic input) must not move.

This is an analyst-selected policy, not an empirically fitted value.

## What we can already compute without you

`scripts/calibration/uncertainty.mjs` reads your committed `public/forecast/model.json` and writes
`public/forecast/calibrated/{baseline,sqrt2,comparison}.json` with your source commit, the file's sha256 and the
calibration version. At scale 1.0 it reproduces your published numbers exactly (tested). Nothing on the site reads it.

| Metric | How we get it | Status |
|---|---|---|
| Senate race win probability, 80% margin range | Your published 40-bin margin histogram widened √2 around its centre | Approximation (binning, tails, no joint draws) |
| House race win probability | `Φ(Φ⁻¹(p)/√2)` | Approximation, marginal only |
| Chamber control | `Φ(Φ⁻¹(p)/√2)` | Approximation, ignores correlation |
| Expected seats | Sum of the adjusted race probabilities | Exact *given those approximated marginals* only |
| Seat histogram, median, seat SD, 80% seat range, correlations | — | Not computed; only your runs can produce them |

From `731ed515`: Senate D control 88.4% → 80.1%; House D control 97.5% → 91.8% (approximate figures; we haven't published them).

## What we need from you

Four runs in your own environment, same inputs, same seeds, same polling and respondent-file versions:

1. Senate baseline, 2. Senate √2, 3. House baseline, 4. House √2.

**Scale every mean-zero stochastic error once, at the point where a race uses it**, for Senate and House races only:

- `dynamic_mode.py`:
  - national environment (`NAT["env"]` × `CORR_NAT_F`), the regional shock (`SIG_REG`) and the common state shock (`RHO_SCALE`);
  - each race's own state draw (t(5)), the On Point shared polling error (`OP_CORR_SIG`), the candidate error (`cq.PROFILES[...]["sigma"]`) and the county shock (`sig_cty`);
  - demographic vote and turnout shocks, irregular-voter shocks, turnout (national, state, county), enthusiasm (national, state), behaviour shocks (`KAPPA_NAT`, `KAPPA_ST`) and third-party shocks.
- `FLH/house_dyn.py`: the same shared national pieces, `SIG_STATE_H`, `SIG_DIST`, turnout and the rest of its own draws.
- Apply the pilot re-centering pass under the same scale, so simulated means stay on your projected shares. Report any mean movement that remains.

Things to avoid:

- **Shared draws.** Don't multiply the shared `NAT[...]` arrays themselves. Governor races read them too, and they must stay unscaled. Scaling at the point of use keeps the Senate–governor correlation unchanged; please confirm it in the output.
- **Double-counting.** Don't scale anything twice: for example, the own-draw SD is already derived from the national share via `spread_k`.
- **Seat-count variance.** Don't expect it to double exactly. The doubling applies to input error variance; please report what you measure.
- **`stamp_published_odds()`** in `build_app_forecast.py` overwrites the chamber control odds, seat range and median with the `odds` blocks in `onpoint-{senate,house}-forecast-data.json`. For the √2 run, those page files must come from the √2 simulations too, or the build will silently restore the baseline odds.

If you implement this differently (for example, scaling the sigma constants), please list exactly which components you scaled and the variance you measured for each.

## What to send back

No respondent data, credentials or personal information. Please send only aggregate output:

- For Senate and House, baseline and √2: control probability, mean and median seats, seat SD, the 10th and 90th percentile seats, and the full seat histogram.
- Race-level win probabilities and the 10th/90th percentile margins.
- Measured national and regional error SDs, with correlations between races and between offices.
- Number of simulations, the seed, and the Monte Carlo standard error of control (√(p(1−p)/N)).
- Any 2018 and 2022 out-of-sample calibration you can run (Brier, log loss, 80% interval coverage), labelled out-of-sample or in-sample.
- The commit SHA of the inputs used.

We will check your outputs against our approximation and publish only after approval.
