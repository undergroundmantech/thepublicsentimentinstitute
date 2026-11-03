# Published √2 forecast uncertainty (Senate + House)

Approved for production on Nov 3, 2026. Every Senate and House race's forecast error is multiplied by √2 ≈ 1.414.
Projected margins, ratings, polling averages and every governor race are unchanged.

## How it is applied

`scripts/calibration/apply-uncertainty.mjs` is a deterministic Node transform with no dependencies. It runs over Lester's published files in `public/forecast/`:

| File | What changes |
| --- | --- |
| `model.json` | Senate/House race `est.prob` = Φ(Φ⁻¹(p)/√2); `p10`/`p90` and `dist` are stretched ×√2 around the margin; race and chamber `trend`; Senate/House `chambers` (control, mean seats, median, 80% range, `hist`) |
| `whatif.json` | Senate `dev` ×√2; House win bits regenerated to match the widened district odds and chamber |
| `scenarios/sen-*.json`, `scenarios/index.json` | `pD` widened, `sd` ×√2, `p10`/`p90` stretched |

How the chambers are recomputed: a one-factor Gaussian copula with exact Poisson-binomial seat counts. The loading λ is fitted so that the baseline control odds come out exactly as published. The widened distribution then keeps λ and uses the widened race odds. The fitted values are recorded in `model.json` `meta.uncertainty.fit`.

Each transformed file carries a marker (`meta.uncertainty` or `uncertainty`). The transform skips any file that already has one, so it is idempotent.

## Automatic re-application

`package.json` runs the transform as `prebuild`. Locally and on Vercel, `npm run build` therefore widens any freshly published baseline before Next builds. On files that already carry the marker it writes nothing.

## Notes for model publishes

- Publish `model.json`, `whatif.json` and scenarios from the **baseline** model, as today. The prebuild applies √2.
- Do not rebuild `whatif.json` or scenarios from an already-widened `model.json`, because √2 would then apply twice. Rebuild them from the baseline, or run `build_app_forecast.py` first.
- After a publish, run `node scripts/calibration/apply-uncertainty.mjs` and commit the result so that the repository matches production.
- Tests: `node --test scripts/test-uncertainty.mjs`. These check the math, that governors and margins are untouched, and that the committed files can be reproduced from the baseline commit.
- To roll back, revert the transform commit, or remove the `prebuild` script and restore the baseline files.
