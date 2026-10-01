# Forecast model files, 25 September 2026

These are the pipeline files that produced the data in `public/forecast`. They are
included so the model changes are versioned alongside the numbers they generated.
**If the forecast pipeline lives in a separate repository, delete this folder** and
keep only the `public/forecast` data and the `app/polling` updates. Nothing in the
site imports from here; it is reference only.

| File | What changed |
|---|---|
| `senate_mode.py` | Recency tilt, systematic governor incumbency term with cycle centring, the UNH and Big Data Poll entries, partisan discount now matching on `(I)` |
| `poll_daily.py` | `AS_OF_DAILY` follows `AS_OF` instead of being frozen at 21 September, poll dedupe key normalised |
| `house_mode.py` | Maine ME-01 and ME-02 district polls, `K_PRIMARY_PARTY` raised |
| `house_dyn.py` | `POLL_GAP_CENTER` can be pinned so a single state re-run stays comparable to a full run |
| `polls_ne.csv` | Nebraska senate poll file, with the GBAO survey added |

`../build_app_forecast.py` builds `public/forecast` from a run. `../verify_desk.py`
checks the built data against the published pages; it currently reports one failure,
the Rhode Island crosstab rounding gap described in the changelog.

See `docs/FORECAST_CHANGELOG_2026-09-25.md` for the full account.

## 25 September 2026, Senate re-run

| File | What changed |
|---|---|
| `senate_mode.py` | Five Senate polls added to `EXTRA_POLLS`: Bowling Green State/YouGov and Trafalgar (Ohio), co/efficient (Alaska), Rasmussen (South Carolina), NBC News/Marist (Texas) |
| `dynamic_mode.py` | Added here for the first time. This is the driver that actually runs the 2,000 simulations; `senate_mode.py` alone produces the deterministic county forecast and nothing else |
| `../update_pages.py` | Writes the ranked-choice final round margin rather than the first choice one, and rebuilds the `rcv` block from the run instead of leaving whatever an older run wrote |
| `../build_app_forecast.py` | Incumbency read from what the seat note asserts rather than from any surname appearing in it; ranked-choice simulations recentred on the margin the page reports; first-choice margin read from the `rcv` block |

Re-run command, for the record:

```
OUT_DYN=<out> AS_OF=2026-09-25 APPROVAL_SRC=combined HIST_COMP_CENTER=0.0452 \
ELECTORATE=1 HISTORY=1 CANDIDATE=1 POLL_METHOD=daily \
python3 dynamic_mode.py IA MI OH TX GA NC SC AK KS NH ME FL SD ID MT VA MN MS LA AR KY \
  OR WY CO NM MA RI DE WV IL TN AL NJ OK NE
```

**Known trap:** `build_app_forecast.py` rebuilds the House from `HOUSE_SIM`, which defaults
to `/tmp/pvi/house_nogal`. That is an older House run than the published board, so a build
that does not pin the House will rewind 415 districts and flip ME-02. Re-run the House or
keep its section of `model.json` when only the Senate has moved.

## After every forecast build: sync the rest of the site

Only `/forecast` reads `public/forecast/model.json`. The home page swarm, the coverage
globes, the electoral map, the situation room and `/forecastratings` read hand-typed
tables that no forecast run ever touched. Run this after each build, from the repo root:

```
python3 scripts/forecast/sync_site_numbers.py
```

## 25 September, Gallup anchor

Every run from this date uses `M2_ANCHOR=gallup`. Build the site with
`HOUSE_SIM=<the current House run>` and with the House page data taken from the current
House page, never from an older extract; both were stale before this run.

## 28 September 2026, LOWESS polling level and new polls

| File | What changed |
|---|---|
| `lowess_trend.py` | New. Robust LOWESS matching the site's `app/polling/lib/lowessTrend.ts`, and the Election Day projection |
| `poll_daily.py` | `POLL_LEVEL`, default `lowess`: a race with 8 or more polls takes its level from the LOWESS projection and keeps the PSI decided total. `POLL_LEVEL=psi` restores the old average |
| `site_poll_sync.py` | New. 81 site polls in 17 races that the model was missing |
| `senate_mode.py` | Merges `SITE_SYNC` into `EXTRA_POLLS`; GBAO Michigan added |
| `texas/`, `iowa/`, `north_carolina/`, `south_carolina/`, `maine/`, `vermont/`, `georgia/`, `nevada/`, `arizona/`, `kansas/` | Poll files with the new and backfilled polls |

Re-run command, for the record:

```
OUT_DYN=<out> N_SIMS=2000 AS_OF=2026-09-28 APPROVAL_SRC=combined HIST_COMP_CENTER=0.0452 \
ELECTORATE=1 HISTORY=1 CANDIDATE=1 POLL_METHOD=daily M2_ANCHOR=gallup POLL_LEVEL=lowess \
python3 dynamic_mode.py <races>
```

Run at most three lanes at once on an 8 GB machine; four lanes ran out of memory at Nebraska.

## 28 September 2026, governor depolarization

| File | What changed |
|---|---|
| `senate_mode.py` | `GOV_DEPOL`, on by default, with `GOV_BETA=0.6` and `GOV_LAMBDA=0.6`. For governor races only, the approval and census legs keep their county pattern, but their statewide level counts the national environment at beta and the state's lean against the nation at lambda. The incumbent personal vote is measured against the same baseline. `GOV_DEPOL=0` restores the old model |
| `dynamic_mode.py` | Governor races take `GOV_BETA` of the shared national vote shock and of the shared group vote shocks, and the rest becomes their own. Turnout shocks stay national |
| `depolarization/` | The backtest behind the two settings |

## 29 September 2026, third parties and TPSI respondents

| File | What changed |
|---|---|
| `senate_mode.py` | Third party level blends a ballot label prior, the state's past third party vote for the office and the polls that asked; respondent component version 2 hooks; `national_lv_d2` now reports the 2026 anchor |
| `respondent_v2.py` | New. Unified respondent loader with one filter for every consumer, citizen adult cells, pooled state swing effects, the VAP to likely voter audit |
| `voters.py`, `dynamic_mode.py` | 80 percent ranges on every estimated vote by group row |
| `tpsi_national.py`, `meridian_all.py` | Read respondents through the same loader |
| `respondent_v2/` | Methodology, validation and the worked example for Texas and Maine |

The respondent file itself is not included here. It stays with the model.

## 29 September 2026, voter behavior layer and new district polls

| File | What changed |
|---|---|
| `behavior.py` | New. Six turnout motivations from TPSI respondents, their weights, each voter type's party looseness, simulation shock loadings and the race audit |
| `ticket_split.py` | New. Split ticket voters for every state with both a Senate and a governor race |
| `dynamic_mode.py`, `house_dyn.py` | Motivation shocks in every simulation; Senate and governor races in one state share part of the state shock |
| `house_mode.py` | 36 district polls ending Aug 15 or later, 11 districts polled for the first time |
| `senate_mode.py` | Big Data Poll Ohio governor ballot |
| `behavior/` | Methodology and results |

## 30 September 2026, county citizenship and realistic limits

| File | What changed |
|---|---|
| `bounds.py` | New. County support envelope, county turnout limits, group bands from TPSI and statewide race group ranges from Pew validated vote |
| `respondent_v2.py`, `census/cvap_county_2020_2024.csv` | County citizen rates by race group from the Census CVAP 2020 to 2024 tabulation |
| `senate_mode.py`, `dynamic_mode.py`, `voters.py`, `crosstabs.py`, `house_dyn.py` | The limits applied in the projections, the voter types and both crosstab builders |
| `bounds/` | Methodology and results |

## 1 October 2026, national inputs

The run uses `NAT_ANCHOR=generic GB_MARGIN=12 GB_DECIDED=100 M2_ANCHOR=meridian APPROVAL_RV_NET=-24`. The D+12 generic ballot is the two party national anchor for the approval and census legs, and `APPROVAL_RV_NET` turns a registered voter net approval into the likely voter level through the TPSI registered to likely voter gap. Each race's summary carries the conversion under `approval_input`.
