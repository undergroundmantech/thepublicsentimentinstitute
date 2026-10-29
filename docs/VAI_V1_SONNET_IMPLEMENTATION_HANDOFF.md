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

## 7. Phase A record (T0–T4, branch `vai/phase-a-foundations`)

Status: **built, tested, pushed, not merged, not deployed.** Nothing public reads any of it (enforced by T0).

### 7.1 Refs and integration

| Ref | SHA | Role |
|---|---|---|
| `origin/main` | `182bceff` | Lester's Oct 29 full rerun. Merged in as `fa3e7353`. |
| `feature/election-night-intelligence-v1` | `0559aad3` | Intelligence layer, merge base `44d06d08`. Merged in as `0c140248`; that branch is untouched. |
| `research/vote-arrival-intelligence-v1` | `673a5cf8` | Starting point (the research docs). |

- **Both merges were clean** and touched no common files.
- **Lester's work is preserved.**
  - `public/forecast`, `public/results` and `scripts/forecast` are exactly as on `182bceff`. No VAI commit touches them.
  - The uncommitted local `app/api/flightrecorder/[raceId]/route.ts` in the main worktree was left alone. The intel branch's version of that file is byte-identical to it.
- **Reused from the intelligence layer:**
  - `appendObservations`, `latestReadings` and `totalsFrom` (`app/lib/intelligence/observations.ts`);
  - the `VoteObservation`, `LoggedObservation`, `Sides`, `Issue` and `ReconciledReturns` types.

  VAI re-implements none of them.
- **Carried in by the merges (not VAI work, but review before any merge to main):**
  - The intel branch's forecast race page shows `RaceHistorySection` in place of the trend chart when a history exists. It also adds `@vercel/blob`, the portal and capture routes.
  - The research branch was cut from the election-night UI branch (`342e6178`). It therefore carries `NationalDesk`, the `NightDesk`/`RacesHub` changes and the race page v1, which are not on main.

### 7.2 Deviations from §2 and §3

- **Tests** use `node --test` with `scripts/intelligence/ts-resolve.mjs` (the intel runner), so there is no `scripts/test-*.mjs`. Run them with `npm run test:vai`.
- **Builders** are TypeScript run through the same resolver (`npm run vai:rules`, `npm run vai:prior`), not Python. This keeps the math shared between builder and tests.
- **The prior anchors the mean and P jointly**, not the median (see §7.6 and math §6, which is corrected).
- **The schema's `OFFICIAL` source tier maps to the intel `PRIMARY_OFFICIAL` tier** (`VAI_LABEL_TO_INTEL`).
- **Portability.**
  - Builder inputs come from `--root`, then `$VAI_INPUT_ROOT`, then the repo. Every input is sha256-recorded.
  - `build_count_order.py` takes `--research`, then `$VAI_RESEARCH_DIR`, then `~/research/vai`. It exits cleanly if neither exists; the committed JSON is self-contained. `SOURCE_DATE_EPOCH` pins `builtAt`.
  - All tests run from committed files.

### 7.3 New files and contracts

| File | Purpose |
|---|---|
| `tests/vai/guardrails.test.ts` | **T0.** Checks four things: no `voteModeModel`/`needleModel`/`electoralModel` imports; precincts reporting named only in `types.ts`/`integrity.ts` and never in arithmetic; no unseeded randomness or wall-clock reads in `_vai` or `scripts/vai`; no `_vai` or `data/vai` import from any page, route, component, middleware or config, and nothing VAI under `public/`. Each checker is self-tested. |
| `app/results/_vai/types.ts` | **T1.** Labels, provenance, `VoteObservationV2` (adds optional `candidates`, `providerBatchId` to the intel type; nothing is removed or renamed), integrity flags, `VaiReturnsFrame`, rules, inventory, completion levels, prior and anchor types. |
| `app/results/_vai/rules.ts`, `scripts/vai/build_race_rules.ts`, `data/vai/race_rules_2026.json` | **T2.** Deterministic rule registry built from the index (`asOf` 2026-10-29), `measures.json` and `model.json`. |
| `app/results/_vai/integrity.ts` | **T3.** `ingest()` and `reconcile()`: pure, with no API, scheduler or clock. |
| `app/results/_vai/prior.ts`, `scripts/vai/build_prior.ts`, `data/vai/prior_e69d2976f3a0.json` | **T4.** Frozen prior addressed by the hash of its inputs: `model.json`, `index.json`, the rule file and all 51 `st/*.json` files. The file is 460 KB; draws are not stored and are regenerated exactly. |
| `scripts/vai/io.ts` | Input root, hashing, stable JSON. |

Tests: guardrails 10, rules 9, integrity 15, anchor 12. Total **46/46**; the intelligence suite stays at 237/237. `tsc` and targeted `eslint` are clean. Rebuilding the rules and prior files reproduces them byte for byte.

### 7.4 Rule coverage (1,016 index races)

| Rule | Races | Notes |
|---|---|---|
| PLURALITY | 721 | Default with an explicit statement. gov-ME is a cited non-default plurality. |
| MEASURE_THRESHOLD | 125 | Thresholds parsed from `measures.json` notes with source URLs: CO amendments 0.55, FL 0.60, NH 0.6667. |
| CHAMBER_AGGREGATE | 87 | `leg`: Phase B chamber layer. |
| RETENTION | 28 | Unsupported; threshold unverified. |
| MAJORITY_RUNOFF | 25 | Georgia, O.C.G.A. § 21-2-501(a). |
| MEASURE_THRESHOLD_WITH_BALLOT_FLOOR | 13 | NE (35%, Yes) and MA (30%; question 9 is the No side). Partial: needs total ballots. |
| MEASURE_ALL_BALLOTS_DENOMINATOR | 7 | MN, TN ×3, HI ×2, WY. Unsupported: the forecast's 0.5319 is a 6% roll-off approximation. |
| RCV | 6 | sen/gov/house-AK, sen-ME, house-ME-1/2. Live counts are first choice only. |
| MAJORITY_ELSE_LEGISLATURE | 3 | VT governor, lieutenant governor and treasurer (Vt. Const. ch. II § 47). |
| MULTI_OPTION_ADVISORY | 1 | ID advisory question (six options). Unsupported. |

- **Support:** 752 SUPPORTED, 125 PARTIAL, 139 UNSUPPORTED.
- **Unverified and flagged:**
  - LA 2026 system (9 races);
  - other VT offices;
  - local and special races (86, PARTIAL);
  - possible multi-seat races (6);
  - `RULE_NOTE_UNCERTAIN` (11);
  - `NONSTANDARD_SIDES` (70, mostly `other`).

  The `NONSTANDARD_SIDES` cases worth noting outside `other`:
  - gov-RI: the independent is in slot B and the Republican is third;
  - ins-CA: D vs D;
  - aud-MA, aud-NE, lg-AR and treas-OK: one major party against a minor party.
- **Mississippi and other states with majority rules for statewide offices were not checked.** Every default is labelled as an assumption.

### 7.5 Integrity results (synthetic fixtures through the real intel code)

- Duplicates are refused and flagged.
- Out-of-order delivery: the latest reading by source time wins. The late arrival stays in the log and is counted as superseded.
- Downward revisions are flagged at candidate level, even when the total rises. The newer value is used and both readings are kept.
- Missing source time: readings are ordered by retrieval time and flagged. Freshness reports `NO_SOURCE_TIME` and never presents retrieval time as source time.
- Test data is excluded from every figure.
- Readings stamped after `asOf` are ignored.
- **Unmatched units** go into a pseudo-county.
- **Conservation:** reported = counties + unmatched + residual, exactly, per side.
  - Topline vs counties: the topline governs and the residual can go negative, flagged `JURISDICTION_SUM_EXCEEDS_TOPLINE`.
  - Checked on 300 seeded random logs.
- Flags raised: coverage below 98%, a county above its expected maximum, and a stale feed. Staleness is judged by age, by provider activity when known, or by a fetch error.
- Precincts reporting changes nothing but itself.

### 7.6 Anchor results (forecast 2026-10-29, 2,000 sims, J = 20,000 stratified draws)

**Finding.** The published `est.margin` is the simulation **mean**:

| Comparison | Median gap | Max gap |
|---|---|---|
| Histogram mean vs `est.margin` | 0.016 | 0.053 |
| Histogram median vs `est.margin` | 0.145 | 0.575 |

`est.prob` is from the full run, not the histogram; it differs by up to 0.010 (sen-SC). A single offset cannot hit both: shifting to the median fails 58 of 71 races, and shifting to the mean fails 3 (gov-NE, gov-NV, sen-SC on P).

**Method (`WITHIN_BIN_WARP`).**
- Bin masses are kept exactly (max CDF gap at bin edges ≤ 1/J).
- Knots in the bins holding 0, p10 and p90 place the published mass below each value.
- One power warp γ in every other bin sets the mean.

**Result:**
- **All 71 Senate and governor races anchor.** Worst |mean gap| is 0.000002 and worst |P gap| is 0.00135 (sen-AR); p10 and p90 are exact.
- In 16 lopsided races 0 sits in an empty or edge bin, so the P knot is infeasible. Those P gaps are the histogram's own and all are within 0.005.
- **62 races are eligible for live use; 9 are withheld:**
  - RCV final round: sen-AK, gov-AK, sen-ME;
  - runoff/majority rules: sen-GA, gov-GA, gov-VT;
  - rule not fully supported or nonstandard sides: sen-LA, sen-MT, gov-RI.

**Non-anchored races, with what Lester must export:**

| Group | Races | Status | Needed from the forecast |
|---|---|---|---|
| House | 418 | UNSUPPORTED | A per-district `est.dist` (or draws) from `house_dyn.py`'s `marg` array, published as R − D. |
| House | 17 | UNCONTESTED | Nothing. |
| Statewide down-ballot | 163 | UNSUPPORTED | `est.dist` from `build_downballot.py`. |
| Measures | 146 | UNSUPPORTED | A Yes-share histogram from `build_measures.py` draws, plus total-ballots draws for the all-ballots and ballot-floor rules. |
| Other (local, judicial, special) | 114 | UNSUPPORTED | No forecast exists. |
| Legislative chambers | 87 | UNSUPPORTED | Phase B chamber layer. |

**County files that disagree with the published figure by more than 2 pt.** These are reported in the prior's `countyAudit` and were not edited:

| Race | Gap (pt) |
|---|---|
| gov-AK | 14.95 (the county file is first choice; the published figure is the final round) |
| bm-AK-ballot-measure-2 | 4.12 |
| bm-MO-proposition-a | 3.74 |
| bm-MO-amendment-3 | 3.67 |
| bm-MO-amendment-6 | 2.77 |
| bm-MO-amendment-7 | 2.27 |
| bm-AK-ballot-measure-3 | 2.20 |

Watch list: bm-MO-amendment-8 at 1.72. For the Senate and governor priors, the uniform county log-odds shift reaches every draw; re-aggregation error is below 1e-6 on every sampled draw.

<details><summary>Per-race anchor table (71 races)</summary>

| Race | Published margin (mean) | P(R) | Calibrated mean gap | Calibrated P gap | γ | Median-shift gaps (mean, P) | Mean-shift gaps (mean, P) | Live use | Flags |
|---|---|---|---|---|---|---|---|---|---|
| gov-AK | -9.32 | 0.035 | -0.000001 | +0.00000 | 1.1943 | +0.035, -0.0001 | +0.000, -0.0006 | WITHHELD | COUNTY_BASELINE_DISCREPANCY, RCV_FINAL_ROUND_MARGIN, RULE_NOT_FULLY_SUPPORTED, THIRD_CANDIDATE_MATERIAL |
| gov-AL | +14.38 | 0.985 | -0.000001 | +0.00000 | 1.0337 | -0.209, -0.0017 FAIL | +0.000, -0.0006 | ELIGIBLE | — |
| gov-AR | +17.23 | 0.991 | +0.000001 | -0.00100 | 0.9641 | -0.201, -0.0014 FAIL | +0.000, -0.0010 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| gov-AZ | -7.42 | 0.093 | +0.000000 | +0.00000 | 1.0222 | -0.132, -0.0028 FAIL | +0.000, +0.0008 | ELIGIBLE | — |
| gov-CA | -23.48 | 0.001 | +0.000001 | -0.00060 | 0.9108 | +0.044, -0.0006 | +0.000, -0.0006 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| gov-CO | -22.21 | 0.004 | +0.000000 | +0.00000 | 1.0336 | +0.147, -0.0003 FAIL | +0.000, -0.0004 | ELIGIBLE | — |
| gov-CT | -17.87 | 0.005 | +0.000001 | +0.00000 | 0.9112 | +0.274, +0.0008 FAIL | +0.000, +0.0005 | ELIGIBLE | — |
| gov-FL | +4.51 | 0.786 | +0.000000 | +0.00000 | 1.0351 | -0.081, -0.0068 FAIL | +0.000, -0.0027 | ELIGIBLE | — |
| gov-GA | -2.04 | 0.335 | +0.000000 | +0.00000 | 0.9770 | +0.169, +0.0155 FAIL | +0.000, +0.0046 | WITHHELD | LIVE_RULE_NOT_PLURALITY |
| gov-HI | -36.63 | 0.001 | -0.000002 | +0.00000 | 1.1216 | +0.080, +0.0000 FAIL | +0.000, +0.0000 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| gov-IA | -4.74 | 0.189 | +0.000000 | +0.00000 | 1.0750 | -0.229, -0.0115 FAIL | +0.000, +0.0006 | ELIGIBLE | — |
| gov-ID | +22.02 | 0.998 | +0.000001 | +0.00055 | 0.9531 | -0.217, +0.0003 FAIL | +0.000, +0.0005 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| gov-IL | -21.86 | 0.001 | +0.000000 | -0.00050 | 0.9624 | -0.037, -0.0005 | +0.000, -0.0005 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| gov-KS | +0.29 | 0.527 | +0.000002 | +0.00000 | 0.8980 | -0.073, -0.0065 FAIL | +0.000, -0.0014 | ELIGIBLE | — |
| gov-MA | -26.16 | 0.001 | +0.000000 | -0.00055 | 1.0341 | +0.251, -0.0004 FAIL | +0.000, -0.0005 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| gov-MD | -33.60 | 0.001 | -0.000001 | -0.00050 | 1.0573 | +0.254, -0.0005 FAIL | +0.000, -0.0005 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| gov-ME | -12.73 | 0.018 | +0.000000 | +0.00000 | 0.9704 | +0.220, +0.0053 FAIL | +0.000, +0.0037 | ELIGIBLE | — |
| gov-MI | -12.46 | 0.015 | +0.000001 | +0.00000 | 0.9372 | -0.044, -0.0000 | +0.000, +0.0001 | ELIGIBLE | — |
| gov-MN | -14.26 | 0.012 | -0.000001 | +0.00000 | 1.0799 | +0.107, +0.0012 FAIL | +0.000, +0.0008 | ELIGIBLE | — |
| gov-NE | +4.67 | 0.816 | +0.000001 | +0.00000 | 0.9083 | -0.063, +0.0019 FAIL | +0.000, +0.0054 FAIL | ELIGIBLE | — |
| gov-NH | +8.25 | 0.908 | +0.000000 | +0.00000 | 1.0353 | +0.116, +0.0024 FAIL | +0.000, -0.0003 | ELIGIBLE | — |
| gov-NM | -13.33 | 0.011 | +0.000000 | +0.00000 | 0.9656 | +0.042, +0.0003 | +0.000, +0.0001 | ELIGIBLE | — |
| gov-NV | -5.09 | 0.192 | +0.000001 | +0.00000 | 0.9366 | +0.131, +0.0125 FAIL | +0.000, +0.0065 FAIL | ELIGIBLE | — |
| gov-NY | -16.88 | 0.004 | +0.000000 | -0.00045 | 0.9942 | +0.143, -0.0004 FAIL | +0.000, -0.0005 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| gov-OH | -2.62 | 0.313 | -0.000002 | +0.00000 | 1.1736 | -0.208, -0.0122 FAIL | +0.000, +0.0003 | ELIGIBLE | — |
| gov-OK | +6.28 | 0.807 | +0.000000 | +0.00000 | 1.0170 | -0.408, -0.0122 FAIL | +0.000, +0.0027 | ELIGIBLE | — |
| gov-OR | -6.03 | 0.150 | +0.000000 | +0.00000 | 1.0051 | +0.256, +0.0097 FAIL | +0.000, +0.0000 | ELIGIBLE | — |
| gov-PA | -20.80 | 0.001 | -0.000001 | -0.00050 | 1.1052 | -0.165, -0.0005 FAIL | +0.000, -0.0005 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| gov-RI | -14.08 | 0.011 | +0.000001 | +0.00000 | 0.9318 | +0.147, +0.0008 FAIL | +0.000, +0.0004 | WITHHELD | NONSTANDARD_SIDES, RULE_NOT_FULLY_SUPPORTED |
| gov-SC | +8.99 | 0.902 | +0.000000 | +0.00000 | 1.0438 | -0.238, -0.0049 FAIL | +0.000, +0.0001 | ELIGIBLE | — |
| gov-SD | +15.24 | 0.968 | -0.000001 | +0.00000 | 1.0577 | -0.555, -0.0052 FAIL | +0.000, -0.0013 | ELIGIBLE | — |
| gov-TN | +12.70 | 0.983 | +0.000000 | +0.00000 | 1.0495 | -0.218, -0.0019 FAIL | +0.000, -0.0004 | ELIGIBLE | — |
| gov-TX | +1.79 | 0.663 | +0.000000 | +0.00000 | 0.9466 | -0.081, -0.0069 FAIL | +0.000, +0.0002 | ELIGIBLE | — |
| gov-VT | +4.80 | 0.781 | +0.000000 | +0.00000 | 1.0021 | +0.116, +0.0020 FAIL | +0.000, -0.0031 | WITHHELD | LIVE_RULE_NOT_PLURALITY, RULE_NOT_FULLY_SUPPORTED |
| gov-WI | -5.16 | 0.203 | +0.000000 | +0.00000 | 1.0395 | +0.111, +0.0058 FAIL | +0.000, +0.0014 | ELIGIBLE | — |
| gov-WY | +31.84 | 1.000 | +0.000000 | +0.00000 | 0.9783 | -0.257, +0.0003 FAIL | +0.000, +0.0004 | ELIGIBLE | — |
| sen-AK | -4.68 | 0.185 | -0.000001 | +0.00000 | 1.0846 | -0.157, -0.0093 FAIL | +0.000, -0.0018 | WITHHELD | RCV_FINAL_ROUND_MARGIN, RULE_NOT_FULLY_SUPPORTED |
| sen-AL | +16.82 | 0.991 | +0.000000 | +0.00000 | 1.0336 | -0.034, +0.0004 | +0.000, +0.0005 | ELIGIBLE | — |
| sen-AR | +11.84 | 0.975 | +0.000000 | -0.00135 | 1.0484 | -0.086, -0.0026 FAIL | +0.000, -0.0015 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| sen-CO | -18.61 | 0.008 | -0.000001 | +0.00000 | 1.0743 | +0.129, -0.0001 FAIL | +0.000, -0.0004 | ELIGIBLE | — |
| sen-DE | -28.46 | 0.002 | -0.000001 | +0.00000 | 1.0757 | -0.015, -0.0001 | +0.000, -0.0001 | ELIGIBLE | — |
| sen-FL | +5.33 | 0.827 | +0.000000 | +0.00000 | 1.0186 | -0.237, -0.0112 FAIL | +0.000, -0.0010 | ELIGIBLE | — |
| sen-GA | -11.43 | 0.010 | -0.000001 | +0.00000 | 1.1070 | +0.057, +0.0002 FAIL | +0.000, +0.0000 | WITHHELD | LIVE_RULE_NOT_PLURALITY |
| sen-IA | -0.14 | 0.509 | +0.000000 | +0.00000 | 1.0032 | -0.203, -0.0188 FAIL | +0.000, -0.0041 | ELIGIBLE | — |
| sen-ID | +21.61 | 0.999 | -0.000001 | +0.00000 | 1.0493 | -0.315, -0.0001 FAIL | +0.000, +0.0000 | ELIGIBLE | — |
| sen-IL | -19.47 | 0.005 | -0.000002 | +0.00000 | 1.1015 | +0.078, +0.0005 FAIL | +0.000, +0.0004 | ELIGIBLE | — |
| sen-KS | -1.33 | 0.425 | +0.000000 | +0.00000 | 0.9766 | -0.184, -0.0170 FAIL | +0.000, -0.0038 | ELIGIBLE | — |
| sen-KY | +15.70 | 0.986 | -0.000001 | +0.00000 | 1.1283 | -0.059, -0.0005 FAIL | +0.000, -0.0003 | ELIGIBLE | — |
| sen-LA | +10.27 | 0.941 | +0.000001 | +0.00000 | 0.9447 | -0.387, -0.0089 FAIL | +0.000, -0.0027 | WITHHELD | RULE_NOT_FULLY_SUPPORTED |
| sen-MA | -33.64 | 0.001 | +0.000001 | -0.00050 | 0.9203 | -0.008, -0.0005 | +0.000, -0.0005 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| sen-ME | -2.57 | 0.295 | +0.000000 | +0.00000 | 1.0348 | +0.226, +0.0145 FAIL | +0.000, -0.0004 | WITHHELD | RCV_FINAL_ROUND_MARGIN, RULE_NOT_FULLY_SUPPORTED |
| sen-MI | -6.30 | 0.108 | +0.000001 | +0.00000 | 0.9380 | -0.003, +0.0014 | +0.000, +0.0016 | ELIGIBLE | — |
| sen-MN | -11.57 | 0.020 | +0.000000 | +0.00000 | 0.9730 | +0.019, +0.0020 | +0.000, +0.0019 | ELIGIBLE | — |
| sen-MS | +3.60 | 0.729 | -0.000001 | +0.00000 | 1.0438 | -0.189, -0.0122 FAIL | +0.000, -0.0018 | ELIGIBLE | — |
| sen-MT | +18.77 | 0.997 | +0.000001 | +0.00000 | 0.9337 | -0.213, -0.0000 FAIL | +0.000, +0.0002 | WITHHELD | RULE_NOT_FULLY_SUPPORTED, THIRD_CANDIDATE_MATERIAL |
| sen-NC | -9.61 | 0.023 | -0.000001 | +0.00000 | 1.0993 | +0.031, +0.0008 | +0.000, +0.0005 | ELIGIBLE | — |
| sen-NE | +0.05 | 0.516 | +0.000000 | +0.00000 | 1.0305 | -0.138, -0.0121 FAIL | +0.000, -0.0020 | ELIGIBLE | — |
| sen-NH | -9.34 | 0.075 | +0.000001 | +0.00000 | 0.9032 | +0.008, +0.0007 | +0.000, +0.0006 | ELIGIBLE | — |
| sen-NJ | -20.58 | 0.003 | -0.000001 | +0.00000 | 1.0626 | -0.195, -0.0002 FAIL | +0.000, -0.0001 | ELIGIBLE | — |
| sen-NM | -20.44 | 0.003 | -0.000001 | -0.00050 | 1.1093 | -0.103, -0.0005 FAIL | +0.000, -0.0005 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| sen-OH | -4.42 | 0.171 | +0.000000 | +0.00000 | 0.9834 | -0.062, -0.0030 FAIL | +0.000, +0.0009 | ELIGIBLE | — |
| sen-OK | +23.23 | 0.999 | +0.000000 | +0.00000 | 1.0280 | -0.074, +0.0005 FAIL | +0.000, +0.0005 | ELIGIBLE | — |
| sen-OR | -24.16 | 0.001 | +0.000001 | +0.00000 | 0.9245 | +0.111, -0.0004 FAIL | +0.000, -0.0005 | ELIGIBLE | — |
| sen-RI | -39.52 | 0.001 | +0.000001 | -0.00050 | 0.9502 | -0.181, -0.0005 FAIL | +0.000, -0.0005 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| sen-SC | -0.91 | 0.466 | +0.000001 | +0.00000 | 0.9270 | -0.244, -0.0232 FAIL | +0.000, -0.0078 FAIL | ELIGIBLE | — |
| sen-SD | +15.85 | 0.985 | -0.000001 | +0.00000 | 1.0335 | -0.367, -0.0028 FAIL | +0.000, -0.0012 | ELIGIBLE | — |
| sen-TN | +21.66 | 0.999 | +0.000001 | +0.00060 | 0.9456 | +0.156, +0.0007 FAIL | +0.000, +0.0006 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| sen-TX | -1.40 | 0.393 | -0.000001 | +0.00000 | 1.1145 | -0.124, -0.0117 FAIL | +0.000, -0.0021 | ELIGIBLE | — |
| sen-VA | -15.74 | 0.002 | +0.000000 | +0.00000 | 0.9708 | -0.034, +0.0002 | +0.000, +0.0002 | ELIGIBLE | — |
| sen-WV | +32.48 | 0.999 | -0.000002 | +0.00010 | 1.1161 | -0.243, -0.0000 FAIL | +0.000, +0.0001 | ELIGIBLE | KNOT_INFEASIBLE_P_B |
| sen-WY | +42.48 | 1.000 | +0.000000 | +0.00050 | 1.0085 | -0.323, +0.0005 FAIL | +0.000, +0.0005 | ELIGIBLE | KNOT_INFEASIBLE_P_B |

</details>

### 7.7 Unresolved mathematical issues

1. **Only histograms are available, not draws.** The within-bin shape is a calibration choice, constrained by mean, P, p10 and p90 but not identified by them. Cross-race correlation, needed for the chamber layer and for the §8 joint draws, cannot be recovered from per-race histograms.
2. **RCV.** The AK and ME priors are final-round margins, while live counts are first choice. The prior and the counts are not comparable until the forecast publishes a first-choice distribution, or VAI models transfers.
3. **Turnout is held at the county file's values.** The geography shift is a uniform two-party log-odds swing, so turnout and composition uncertainty is not yet in the prior; that is T5.
4. **County baseline gaps.** gov-AK and the AK/MO measures differ from the published figures by 2–15 pt. The state-level anchor is unaffected, but county expectations for those races are not trustworthy until the export is checked.
5. **Measure thresholds whose denominator is all ballots cast** cannot be evaluated from Yes/No counts alone.

### 7.8 Phase B scope (recommended)

- **From Lester, before Phase B estimation:**
  - Per-race simulation draws, ideally joint across races, with seed and run id.
  - Otherwise, `est.dist` for House, down-ballot and measures as in §7.6.
  - First-choice RCV distributions.
  - A check of the AK/MO county exports.
- **VAI:**
  - T5 inventory and T6 preference on top of `reconcile()` and the prior.
  - T7 simulation, regenerating draws from the prior file.
  - T9 backtest on the PA and GA archives.
  - The T8 shadow runner stays operator-only.
- **Before any merge to main:** decide on the carried-in UI work listed in §7.1.
