# Election-night analytics v1

**Branch:** `ui/election-night-analytics-v1`, from `ui/three-mode-foundation-v1`.

**Status: for review.** Not merged and not deployed. The R+3.5 scenario is off in all public output.

## Summary

| Item | State |
|---|---|
| R+3.5 opening scenario | Implemented as an isolated overlay on the live engine and tested; public flag `false` |
| One-decimal percentage formatter | `app/lib/fmtPct.ts`, tested; **not yet applied** to pages (pending) |
| Situation Monitor county zoom | **Pending:** diagnosis in progress, no code change yet |
| Progression charts (votes, win chance, margin) | Not rebuilt here; see [Progression charts](#progression-charts) |

## 1. R+3.5 opening adjustment

### What it is

A temporary directional adjustment to the election-night *starting point*. It is not a forecast that Republicans lead, and it never flips the favoured party by itself.

| Convention | Formula | Example |
|---|---|---|
| Democratic-positive (the brief) | `openingMargin = officialForecastMargin - 3.5` | D+10.5 (`+10.5`) opens at D+7.0 (`+7.0`) |
| Republican-positive (`live.ts`, the site) | `openingMargin = officialForecastMargin + 3.5` | D+10.5 (`-10.5`) opens at D+7.0 (`-7.0`) |

The official forecast is read, never written. `public/forecast/**` and Lester's model are untouched.

### Where it acts

`project(exp, live, r, top, expTot, prior = 0)` in `app/results/2026/live.ts`:
- `prior = 0` is the official estimate, with identical code paths and identical output. A test checks this against `origin/main`.
- With `prior = 3.5`, only the **forecast-carried part of the outstanding vote** is moved. Counted votes are never altered.
- The scenario is applied once, after the official allocation, so nothing is double counted.

Let:
- **U** be the outstanding votes still resting on the forecast:
  - an unreported county contributes all of its expected vote;
  - a reporting county contributes its remaining expected vote, times `1 - min(1, 2·counted/expected)`, the forecast weight the engine already uses;
  - with topline returns only: `remaining · (1 - w)`.
- **V** be the votes counted (vote counts, never precincts or `percent_reporting`).
- **T** be the expected total.

The scenario then moves this many votes from side A to side B:

$$ \Delta = \tfrac{\mu}{2}\,\rho\,U,\qquad \mu = \tfrac{3.5}{100},\qquad \rho = \frac{0.08\,T}{V + 0.08\,T} $$

Then $\Delta$ is clamped so that neither side's projected outstanding vote goes negative.

Properties, each covered by a test:

| Property | How |
|---|---|
| Exactly R+3.5 at zero votes | With no votes the projected margin is `expM + 3.5`. |
| Fades toward zero | $\rho$ and $U$ both fall as votes are counted. The shift is ≤ $3.5\,(1-f)$ and never increases with more votes. |
| Zero at verified completion | When nothing is outstanding, $U = 0$, so the shift is 0. A completed R+2 result stays R+2 and is not pulled toward the forecast or the scenario. |
| No invented coefficient | $\rho$ reuses the engine's own `0.08 T` shrinkage (the swing estimate's trust in returns). |
| Uncertainty kept separate | `liveOdds` uses the official spread unchanged. Before any votes, the chance is `Φ(z₀ + 3.5/sd_F)`, the forecast's own spread. After votes, it is `Φ(m_adj / sd)`, the same `sd` as the official estimate. The probability is never shifted by 3.5 points. |

Fade on a fixture race, D+10.5 official with a 20% Republican chance:

| Vote counted | Scenario margin | Shift | Republican chance |
|---|---|---|---|
| 0% | D+7.0 | 3.50 | 28.7% |
| 1% | D+7.5 | 3.02 | 27.8% |
| 5% | D+8.7 | 1.84 | 24.0% |
| 10% | D+9.4 | 1.12 | 21.1% |
| 25% | D+10.2 | 0.32 | 15.4% |
| 50% | D+10.5 | 0.00 | 6.8% (equal to official) |

These rows use returns that match the forecast. With real returns, the margin follows the count.

### Eligibility (`scenarioEligible`)

A race is eligible only if all of these hold. Any other race keeps the official estimate and reports why:
- it is a Senate, governor or House race;
- it has exactly one Democrat and one Republican;
- its main challenger is not an independent;
- the forecast has expected votes for both sides.

The excluded cases are multi-candidate races, independent-led races, top-two same-party contests, measures and legislatures.

### Gating

- `SCENARIO_PUBLIC = false` in `app/results/2026/scenario.ts`.
- `scenarioActive()` requires both `NEXT_PUBLIC_ONPOINT_RESEARCH=1` at build time and `?scenario=r35`. A public build can't turn it on.
- Every surface that shows it must carry the label "OnPoint Election-Night Scenario · R+3.5 opening adjustment".
- No public page renders the scenario on this branch.

### Open for review

1. **Fade rate.** The scenario inherits `0.08 T`, so the shift falls to about half between 5% and 10% of the expected vote counted (see the table). A slower or faster fade is a modelling decision, not a code one.
2. **Completion signal.** The fade depends on counted votes against the expected total. A race whose turnout far exceeds the forecast still fades correctly, because $U$ goes to 0. A race reporting "100%" while the expected total is still well above the count keeps a small shift until the engine stops treating those votes as outstanding.
3. **Exclusions.** Independent-led and multi-candidate races are excluded rather than given an invented rule.

## 2. Percentage formatter

`app/lib/fmtPct.ts` exports two functions. Each declares its input scale, and neither guesses it:

| Function | Input | Examples |
|---|---|---|
| `pctPoints(x)` | percentage points, 0–100 | civicAPI `pr` (reporting share), `100 * votes / total`, a Yes share |
| `pctFraction(x)` | a fraction, 0–1 | model probabilities `pR`, `pD`, `pPass`, `demControl`; `counting / n` |

Rules:
- **One decimal by default:** "52.3%".
- **Whole-number exception:** `{ headline: true }` gives "52%". It's reserved for a large display figure; none of the election-night pages use it yet.
- **Rounding:** half away from zero. A value that rounds to zero is "0.0%", never "-0.0%".
- **Missing values:** `null`, `undefined` and non-finite values give an em dash, or the caller's fallback.

**Bug to fix (pending).** The national desk (`pct`) and the monitor (`pctf`) guess the scale with `p > 1 ? p : p * 100`. That renders a fraction of exactly 1.0 (a certain race) as "1%", and a sub-one-point share as a fraction. Both should call `pctFraction`, because their inputs (`demControl`, `counting / n`) are always fractions.

**To apply (pending) on the election-night pages:** `app/results/2026/**` and `app/results/monitor/**`. These are the reporting shares ("% in"), win and control chances, and the reported-share labels in `nationalTally.ts`. Margins (`fmtM`, for example "D+10.5") are points, not percentages, and are unchanged. The rest of the site still uses local `toFixed` and `Math.round` formatting; migrating it is follow-up work.

## 3. Situation Monitor county zoom

**Pending.** Facts verified so far:
- `counties_ll.json` and the Florida state file cover all 67 counties, with no inverted rings.
- With Florida picked from the state selector (Senate view), every county draws, including at about 9.6× zoom.

Leading hypothesis, not yet confirmed: the county layer depends on a *selected* state (`sel`). Zooming into Florida with the wheel or trackpad, without clicking or selecting it, leaves `sel` null, so the county geometry is never fetched or drawn, and only state outlines show at county-level zoom. The proposed fix is to adopt the state under the view centre once zoom passes the state-label threshold (`k ≥ 4.5`), without moving the camera, and to release it on zoom-out if it was adopted this way. This must be confirmed in the browser before any code changes.

## Progression charts

**Decision: not rebuilt on this branch.** The charts already exist on `origin/feature/election-night-intelligence-v1` (`0559aad3`, development freeze, not in `main`):
- the actual cumulative votes, win probability and projected margin views;
- `RaceHistory.tsx`, `GET /api/race-history/[id]`, the immutable `TPSI_RACE_HISTORY/1` contract, the checkpoint archive and race-history store;
- 670 lines of `raceHistory` tests;
- `docs/RACE_HISTORY_CHARTS_DESIGN.md`.

Building a second implementation here would duplicate that work and fork its data contract. The brief asks to reuse it.

Blockers before any public chart can show live win probability or projected margin:
1. **The branch isn't merged.** The intelligence branch has 125 files and +39k lines, and needs its own review. It can't be pulled in silently.
2. **No live outputs are recorded.** The live engine (`project` / `liveOdds` in `app/results/2026/live.ts`) does not call `recordModelOutput()`. Without that, live probability and margin series can't exist; they must not be backfilled or recomputed afterwards.
3. **No durable production store.** The Vercel filesystem doesn't persist. The intelligence branch proposes a GitHub-backed store; that is a deployment decision.
4. **Recorder scope.** `getRecorderRaceIds` covers only the hand-registered primary races. November 3 Senate, governor and House ids need registering and mapping to `^(sen|gov|house)-ST(-D)?$`.
5. **Reporting definition.** civicAPI `percent_reporting` arrives with no definition. The history contract requires one per point, so the share counted must be stated as votes counted over expected votes.

Chamber summaries:
- **Expected seats is valid.** It is the sum of per-race win probabilities at the same timestamp, using step-after values from each race's last publication.
- **Control probability is not derivable from per-race marginals.** Races are correlated. Only the published chamber simulation (`demControl`) may be charted, and only at its own publication times.
- Neither is recorded today. Both need blocker 2 resolved first.

What this branch prepares for the charts:
- the shared percentage formatter;
- the scenario overlay, which keeps official and scenario values as separate fields (`official`, `adjusted`), so a recorder can store the official series and, if approved, a labelled research series without mixing them.

## Validation

- Unit tests: `node --test scripts/test-election-scenario.mjs scripts/test-fmt-pct.mjs scripts/test-theme-modes.mjs scripts/test-national-tally.mjs scripts/test-result-clarity.mjs`. 33 of 33 pass.
- ESLint on `live.ts`, `scenario.ts` and `fmtPct.ts` is clean.
- **Pending:** production build, browser check of the county fix, and formatter application.
