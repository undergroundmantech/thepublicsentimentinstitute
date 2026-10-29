# Vote Arrival Intelligence v1: implementation handoff (for Sonnet)

This handoff turns the design into **bounded engineering tasks**. Each task has exact paths, inputs, outputs, tests and a stop condition.

Read first:
- [VAI_V1_RESEARCH_AUDIT.md](VAI_V1_RESEARCH_AUDIT.md)
- [VAI_V1_DATA_SCHEMA.md](VAI_V1_DATA_SCHEMA.md)
- [VAI_V1_MATHEMATICAL_DESIGN.md](VAI_V1_MATHEMATICAL_DESIGN.md)
- [VAI_V1_BACKTEST_PLAN.md](VAI_V1_BACKTEST_PLAN.md)

## 0. Ground rules (apply to every task)

1. **Do not modify:**
   - `app/results/2026/live.ts`, `useLive.ts`, `NightDesk.tsx`, `RaceLive.tsx`, `RaceBrief.tsx`, `Chambers.tsx`;
   - anything in `public/forecast/**`, `public/results/**`, `scripts/forecast/**`;
   - the civicAPI proxies (`app/api/civic/**`);
   - the protected branch `feature/election-night-intelligence-v1` (`0559aad3`).

   VAI is **additive and isolated**.
2. **Never read** `app/results/_lib/voteModeModel.ts` (`MODE_REMAINING_WEIGHT`, `MODE_PCT_COUNTED` are placeholders) from VAI code. The T0 check enforces this.
3. **Never** use `precinctsReportingPct` / `pr` as a completion fraction or in a likelihood (math §0.5).
4. **No public UI changes.** Nothing VAI renders on public pages until the promotion gates in backtest plan §8 are met. Shadow output goes to logs and an operator-only route.
5. **One engine.** Reuse the intel branch contracts (`VoteObservation`, `LoggedObservation`, `appendObservations`, `latestReadings`, `estimateOutstanding`). Do not write a parallel ingestion stack.
6. **Tests** follow the repository convention: `node scripts/test-*.mjs`, compiling TS with `typescript.transpileModule` (see `scripts/test-national-tally.mjs`). No new framework.
7. Every number shown carries a provenance label (`VERIFIED | OFFICIAL_STATEMENT | ESTIMATED | PRIOR | UNKNOWN`).
8. Branch per task from `research/vote-arrival-intelligence-v1`, named `vai/T<n>-<slug>`. Do not merge to `main` or deploy without owner approval.

## 1. Dependency decision (owner, before T3)

The intel modules live only on `feature/election-night-intelligence-v1` (`0559aad3`), under `app/lib/intelligence/`:
- `types.ts`
- `observations.ts`:
  - `appendObservations(log, batch)`
  - `latestReadings(log, raceId, asOf, opts)`
  - `totalsFrom(readings, asOf, ignored)`
  - `fromCivicDetail(race, d, retrievedAt, sourceUrl)`
- `outstanding.ts`: `estimateOutstanding(input)`
- `shadow.ts`: `shadowProject(returns, inv, baseline)`
- `baseline.ts`
- `captureStore.ts`

The local uncommitted `app/api/flightrecorder/[raceId]/route.ts` already imports `captureStore` and `publicTimeline` from that branch.

| Option | Consequence |
|---|---|
| **A (recommended):** the owner merges the intel branch into an integration branch first, and VAI builds on it | One ingestion stack. T3 is small. |
| B: VAI vendors read-only copies of the types and pure functions into `app/results/_vai/intel/` | Duplication risk. Every copied file carries the source commit and a sync test that diffs it against `0559aad3`. |

**Sonnet must not choose. Stop and ask.**

## 2. File layout (new files only)

```
app/results/_vai/
  types.ts            VaiCountyState, VaiAssessment, PublicationStates, CompletionLevel (data schema §4–§7)
  rules.ts            race rule lookup (PLURALITY | MAJORITY_RUNOFF | MEASURE_THRESHOLD | RCV)
  countOrder.ts       loader and scenario builder from data/vai/count_order_2026.json
  prior.ts            frozen forecast prior: county baselines, published distribution, alpha offsets
  inventory.ts        math §2 (turnout posterior, censoring, official outstanding)
  preference.ts       math §3 (Gaussian conditioning, shrinkage, selection gap)
  simulate.ts         math §4, §5, §7 (draws, rules, outputs); seeded RNG
  integrity.ts        math §9 feed-quality flags; coverage and unmatched pseudo-county
  chamber.ts          math §8 (importance reweighting); UNAVAILABLE until draws are exported
  rng.ts              seeded PRNG (xoshiro128**) plus Box-Muller; no Math.random
scripts/vai/
  build_count_order.py   (exists) builds the count-order dataset and evidence register
  state_table.py         (exists) audit §5.2 table
  toy_example.py         (exists) math §12
  build_race_rules.py    T2
  build_prior.mjs        T4
  backtest/              T9 (python: capture fetch, parse, scorer)
scripts/test-vai-*.mjs   one test file per task
data/vai/
  count_order_2026.json, evidence_register_2026.json   (exist)
  race_rules_2026.json      T2
  hyper_v1.json             T6 (initial values from math §10, each labelled INITIAL_UNFITTED)
  prior_<forecastSha12>.json  T4
```

## 3. Tasks

Each task: scope → inputs → outputs → tests → stop condition.

### T0: Guardrail test (first; small)
- **Scope:** `scripts/test-vai-guardrails.mjs`.
- **Checks:**
  - No file under `app/results/_vai/` imports `voteModeModel`, `needleModel` or `electoralModel`.
  - No `_vai` file references `.pr` or `precinctsReportingPct` except in `types.ts` and `integrity.ts` (metadata passthrough).
  - No `Math.random`.
  - No import from `_vai` exists in any public page component.
- **Stop:** the test passes on an empty `_vai/` with one placeholder `types.ts`.

### T1: Types
- **Scope:** `app/results/_vai/types.ts`, copied verbatim from data schema §4–§7.
- **Tests:** `tsc --noEmit` clean, through `npx tsc -p tsconfig.json --noEmit` filtered to `_vai`.
- **Stop:** types compile; no runtime code.

### T2: Race rules
- **Scope:** `scripts/vai/build_race_rules.py` → `data/vai/race_rules_2026.json`, plus `rules.ts`.
- **Inputs:** `public/results/2026/index.json` (race ids, `k`, `st`, `thr`) and count-order `ballotMethods` / RCV notes.
- **Rules:**
  - GA statewide general → `MAJORITY_RUNOFF`.
  - AK all, and ME Senate and House → `RCV`.
  - Measures → `MEASURE_THRESHOLD` with `thr` (default 0.5). Measures whose denominator is all ballots cast (MN constitutional amendments; research others) → flag `DENOMINATOR_RULE_UNSUPPORTED`.
  - Everything else → `PLURALITY`.
  - Every non-default rule cites a register id or a statute URL.
- **Tests:** the rule count by type is printed; spot checks of GA, AK, ME and FL (60% threshold).
- **Stop:** JSON committed. No race left without a rule.

### T3: Observation adapter (after the §1 decision)
- **Scope:** an adapter from intel `LoggedObservation` / `latestReadings` to `VaiCountyState.reported`, plus `integrity.ts` flags (data schema §3.1).
- **Inputs:** an observation log (fixture JSON).
- **Tests** (`scripts/test-vai-integrity.mjs`):
  - Duplicate reading → ignored.
  - Out-of-order reading → state equals the latest by source time.
  - Downward revision → flagged, new value used.
  - Missing source time → ordered by `retrievedAt`, flagged.
  - Test data excluded.
  - Unmatched region → pseudo-county keeps topline equal to the sum.
  - Coverage < 0.98 → flagged.
- **Stop:** all fixtures pass. No inference code yet.

### T4: Frozen prior and anchor offsets
- **Scope:** `scripts/vai/build_prior.mjs` → `data/vai/prior_<sha12>.json`, plus `prior.ts`.
- **Inputs:** `public/results/2026/index.json`, `public/results/2026/st/*.json`, `public/forecast/model.json` (`races[].est.dist`, `p10`, `p90`, `prob`, `margin`).
- **Per race:**
  - county baselines η⁰;
  - the published distribution (histogram → inverse CDF);
  - expected totals;
  - α solved by root-find (math §6 step 3);
  - the hash of every input.
- **Tests** (`scripts/test-vai-anchor.mjs`): for **every** race in `index.json`, with zero reporting:
  - |median margin − m_pub| ≤ 0.05 pt;
  - |P − P_pub| ≤ 0.005 (20,000 draws, fixed seed).
  - List the races where α must absorb more than 0.5 pt. `gov-AK`, `bm-AK-ballot-measure-2`/`-3` and `bm-MO-*` are expected (audit §3.1).
- **Stop:** 100% of races pass, or failures are listed with cause. **Do not "fix" county files.** Report them to Lester.

### T5: Inventory model
- **Scope:** `inventory.ts`, math §2: lognormal prior, censoring at N_c, official outstanding (`estimateOutstanding` inventory when present), grace-state variance, the `TOTAL_EXCEEDS_EXPECTED` re-centring.
- **Tests** (`scripts/test-vai-inventory.mjs`):
  - T_c ≥ N_c in all draws.
  - Precinct % has no effect: the same inputs with `pr` 0, 50 and 100 give identical outputs.
  - An official outstanding statement narrows the interval.
  - Exceedance flags and re-centres.
  - `PRECINCTS_ALL_IN` never yields completion.
- **Stop:** tests pass.

### T6: Preference model and shrinkage
- **Scope:** `preference.ts`, math §3. Gaussian conditioning with the weighted sum-to-zero constraints, selection gap by scenario and stage, K-candidate log-ratios. Plus `hyper_v1.json` with INITIAL_UNFITTED values from math §10.
- **Tests** (`scripts/test-vai-preference.mjs`):
  1. **Toy parity:** reproduce `scripts/vai/toy_example.py` (D +4.3 median, 80% −0.4 to +9.0, P 0.878) within Monte Carlo tolerance (±0.3 pt, ±0.01).
  2. A single-county weight is never above 1/σ_ε² (large-county dominance test).
  3. μ_g = 0: flipping which candidate the batch favours gives a symmetric posterior shift.
  4. Count-order scenarios change interval widths only. Medians are identical when σ_g is equal.
- **Stop:** tests pass.

### T7: Simulation and outputs
- **Scope:** `simulate.ts`, math §4, §5, §7. Draws, scenario mixture, rules (T2), `requiredShareOfRemaining`, completion ladder, `VaiAssessment` assembly with labels and `inputsHash`.
- **Tests** (`scripts/test-vai-simulate.mjs`):
  - Conservation F_k ≥ V_k.
  - Sum of shares = 1.
  - GA fixture, count near complete at 49.6 / 48.9 / 1.5 → pRunoff > 0.5 and outright pWin < 0.5.
  - FL 60% measure fixture.
  - AK RCV → pWin null with the label.
  - MN amendment → `DENOMINATOR_RULE_UNSUPPORTED`.
  - Seeded determinism: same inputs → byte-identical JSON.
  - A provider call never alters `liveProjection`.
- **Stop:** tests pass; a single race assessment takes under 150 ms on Node for 20,000 draws, or the draw count is documented.

### T8: Shadow runner (feature flag; operator only)
- **Scope:**
  - Env flag `VAI_SHADOW=on` (server only; default off).
  - `app/api/vai/shadow/[raceId]/route.ts`, behind operator-only access. Reuse whatever access control `/portal/intelligence` uses on the intel branch; confirm the mechanism before relying on it.
  - The runner is called by the existing capture cadence (intel `captureRunner`), not by public page loads.
  - It writes assessments to the append-only log (intel `captureStore`, new record type `vai-assessment`).
- **No public component imports `_vai`** (the T0 check).
- **Tests:** flag off → 404, no computation. Flag on, without auth → 401. A replayed fixture night yields one assessment per tick.
- **Stop:** works locally with a recorded fixture. **Do not deploy** without owner approval.

### T9: Backtest harness (PA and GA archives)
- **Scope:** `scripts/vai/backtest/`, per backtest plan §3–§10.
  - Capture fetcher (CDX plus `id_`).
  - Parsers for PA `electionreturns` JSON and GA Clarity (`summary.json`, `detail.xml`).
  - `HistoricalSnapshot` writer.
  - Surrogate prior builder.
  - A Node adapter to run M4 (`live.ts` `project`/`liveOdds`, unmodified) and M5/M6.
  - Scorer.
- **Tests:** a leakage test (planted future snapshot ignored; finals path not readable by the harness); manifest reproducibility.
- **Stop:** `metrics.json` for at least one state-cycle, with an honest `docs/VAI_V1_BACKTEST_RESULTS.md`. **No tuning to the evaluated cycle.**

### T10: Chamber layer (blocked on Lester)
- **Scope:** `chamber.ts`, math §8.
- **Prerequisite:** Lester exports the J × R joint draw matrix from `scripts/forecast/model/` (suggested `public/forecast/draws/<date>.bin` or a private artefact, with sha256). **Do not edit `scripts/forecast/**` without him.**
- Until it exists, `chamber.ts` returns `{ status: "UNAVAILABLE", reason: "joint forecast draws not exported" }`.
- **Never** multiply race probabilities.
- **Tests:**
  - Zero-reporting chamber histogram equals `model.json` `chambers.*.hist` within Monte Carlo error.
  - ESS fallback triggers below J/10.
  - Correlation is preserved: conditioning one state moves a correlated state in the direction implied by the forecast covariance.

## 4. Mapping to the shadow-deployment sequence (brief §13; step names paraphrased)

| Brief step | Task(s) |
|---|---|
| 1. Freeze inputs (count order, register, forecast) | T4, plus the Nov 2 re-freeze (data schema §10) |
| 2. Types and contracts | T1, T2 |
| 3. Ingestion with integrity | T3 |
| 4. Anchor proven at zero reporting | T4 |
| 5. Inventory | T5 |
| 6. Preference and selection | T6 |
| 7. Simulation, rules, outputs | T7 |
| 8. Shadow mode behind a flag, operator only | T8 |
| 9. Backtest and Nov 3 shadow evaluation | T9 and backtest plan §11 |
| 10. Promotion decision | Backtest plan §8 gates; owner sign-off |

## 5. Proposed placement (later; no redesign now)

Only after the promotion gates are met. These are placements in **existing** zones, for the owner to approve:
- **Race page** (`app/results/2026/[id]/RaceLive.tsx`): under the existing projection block, a "What remains" row showing:
  - Counted (VERIFIED);
  - Officially outstanding (OFFICIAL_STATEMENT, where available);
  - Estimated remaining with an interval (ESTIMATED);
  - Can still arrive by <deadline> (PRIOR).

  Each value carries its label chip. The projection itself would switch from E1 to VAI only at that point.
- **National desk** (`NightDesk.tsx`, the `#nd-history` region): no change in v1. Chamber probabilities appear only after T10 and its gates.
- **Copy rules:**
  - "Projection" is never "call".
  - "All precincts reporting" is always followed by "ballots may remain" until the evidence ladder allows more.

## 6. Follow-up outside VAI (recommendation only)

- Legacy desk `/results/race/[id]`: replace the `voteModeModel` placeholder rows with "No method breakdown available". This is a separate, owner-approved UI change.
- County files whose sums differ from published margins (`gov-AK` 15 pt; the AK and MO measures): Lester to check the forecast export.
