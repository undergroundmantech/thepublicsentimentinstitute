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
