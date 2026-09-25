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
