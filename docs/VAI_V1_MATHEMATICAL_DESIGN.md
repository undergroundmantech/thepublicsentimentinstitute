# Vote Arrival Intelligence v1: mathematical design

Status: **design only**. Nothing here is implemented or deployed. Every numeric hyperparameter is an **initial, unfitted value**, chosen to be deliberately wide, and must be replaced by estimates from the backtest plan ([VAI_V1_BACKTEST_PLAN.md](VAI_V1_BACKTEST_PLAN.md)) before any output is published.

Related documents:
- Current-model audit: [VAI_V1_RESEARCH_AUDIT.md](VAI_V1_RESEARCH_AUDIT.md) §3.
- Data contracts: [VAI_V1_DATA_SCHEMA.md](VAI_V1_DATA_SCHEMA.md).

## 0. Principles

1. **Anchor.** With no votes reported, every VAI output equals the published forecast. This covers the margin distribution, the win probability and, for chambers, the seat distribution (§6).
2. **Reported votes are not a random sample of the final vote.** Each county's counted share is linked to its uncounted share through a selection gap with explicit uncertainty (§3.3).
3. **Count order changes uncertainty, not direction.** The count-order dataset sets the *variance* of the selection gap and the labels shown to readers. In v1 it never sets a partisan mean (§5). A non-zero mean is allowed only after a backtest estimates it from point-in-time data.
4. **Inventory is separate from preference.** How many votes remain (§2) and how they will split (§3) are modelled separately and joined only in simulation (§4, §7).
5. **Precinct reporting % is metadata.** It never sets a completion fraction and never implies that counting is complete.
6. **Every displayed quantity carries a provenance label** (VERIFIED / OFFICIAL_STATEMENT / ESTIMATED / PRIOR / UNKNOWN). Quantities that cannot be estimated are reported as unavailable rather than guessed.

## 1. Notation and inputs

| Symbol | Meaning | Source | Label |
|---|---|---|---|
| r, s, c, k, t | race, state, county (reporting unit), candidate (k = 1…K), source time | | |
| V_{ck}(t) | votes reported for k in c | observation log, latest by source time | VERIFIED |
| N_c(t) = Σ_k V_{ck}(t) | votes reported in c | derived | VERIFIED |
| p_c(t) | precinct reporting % | provider | metadata only |
| O_c(t) | officially stated outstanding ballots | official statement (register id) | OFFICIAL_STATEMENT |
| E_c | forecast expected total votes in c | `st/{ST}.json` column 4 | PRIOR |
| s⁰_{ck} | forecast county share of k | `st/{ST}.json`; for K > 2, see §3.5 | PRIOR |
| m_pub, P_pub, D_pub | published margin, win probability and margin distribution | `index.json` (`m`, `pR`), `model.json` (`est.dist`, `p10`, `p90`) | PRIOR |
| T_c | final counted total in c, including late-arriving eligible ballots | latent | ESTIMATED |
| R_c(t) = T_c − N_c(t) | votes remaining in c | latent | ESTIMATED |
| π_c(t) = N_c(t)/T_c | completion fraction | latent, **never** p_c | ESTIMATED |

Log-ratio scale: η_{ck} = log(s_{ck}/s_{c,ref}), with the reference candidate fixed per race (the forecast leader). For two candidates the margin is m = tanh(η/2), and dm/dη ≈ 0.5 near an even race. So 0.10 on the log-ratio scale is about 5 margin points.

## 2. Inventory model: how many votes remain

### 2.1 Prior

$$
\log T_c = \log E_c + \tau_s + \tau_{g(c)} + u_c,\qquad
\tau_s\sim N(0,\sigma_{\tau s}^2),\ \tau_g\sim N(0,\sigma_{\tau g}^2),\ u_c\sim N(0,\sigma_{u,s}^2)
$$

- τ_s is a statewide turnout shock.
- τ_g is a regional shock (regions are groups of counties within a state).
- u_c is the county residual.
- The variance σ_{u,s}² is larger in the 16 postmark-grace jurisdictions (`lateCounting.receiptClassFromLedger = POSTMARK_GRACE`) and in states the ledger codes as "days to weeks".

Contests in the same state share τ_s and τ_g, so the Senate and Governor races in one state have strongly correlated turnout.

### 2.2 Observations

1. **Lower bound.** T_c ≥ N_c(t). Reported votes only *truncate* the prior. They are never divided by p_c.
   - Censored likelihood: P(T_c ≥ N_c) = 1 − Φ((log N_c − μ_c)/σ_c).
   - This bound informs τ_s and τ_g **only** when N_c is in the upper tail of its prior. That is the correct Tobit-style treatment, and it means partial counts cannot be read as finals.
2. **Official outstanding statements** (AZ today, others as the register grows):

   $$T_c = N_c(t) + (1-\rho_c)\,O_c(t) + L_c(t)$$

   - ρ_c is the rejected or uncured share, with a Beta prior. Its mean comes from the state's historical rejection rate if that is in the register, otherwise it is labelled UNKNOWN with a wide prior.
   - L_c(t) ≥ 0 is the eligible ballots not yet received. It is zero after the receipt deadline and has a wide prior before it in grace states.
3. **Completion evidence** (data schema §6). This applies only at `OFFICIAL_ELECTION_NIGHT_COMPLETE` and above.
   - `ALL_KNOWN_BALLOTS_COUNTED` after the receipt deadline sets T_c = N_c(t) plus a small provisional and cure residual.
   - `OFFICIAL_ELECTION_NIGHT_COMPLETE` sets only the election-night part. Later-counted ballots stay in R_c.
   - **`PRECINCTS_ALL_IN` contributes no likelihood term in v1.**

### 2.3 Turnout above expectation

If N_c(t) exceeds the 99th percentile of the prior for T_c:
- The truncation in §2.2 re-centres the posterior automatically.
- The county is flagged `TOTAL_EXCEEDS_EXPECTED`.
- σ_{u} for that county is doubled for the rest of the night, because its baseline was clearly wrong.
- The excess feeds into τ_s through the censored likelihood.

Nothing is clipped.

### 2.4 Late-arriving ballots

Late-arriving eligible ballots are **part of T_c**. The forecast turnout E_c already targets the final count. The receipt rule therefore changes:
- **When** completion can be declared: never before the deadline in `lateCounting`.
- **How wide** σ_{u,s} is.

It does not change the expected total. The register stores no quantity for late arrivals, so none is invented. Expected late-arrival volume is labelled PRIOR or UNKNOWN.

## 3. Preference model: how the remaining votes will split

### 3.1 County final share

$$
\theta_{ck} = \eta^0_{ck} + \alpha_k + \delta_{sk} + \delta_{g(c),k} + \gamma_k z_c + \varepsilon_{ck}
$$

| Term | Meaning | Prior |
|---|---|---|
| η⁰_{ck} | forecast county log-ratio | from s⁰ |
| α_k | race anchoring offset | solved, not fitted (§6) |
| δ_{sk} | statewide shift vs forecast | the published forecast distribution (§6) |
| δ_{gk} | regional shift | N(0, σ_g²), constrained so the expected-vote-weighted sum is zero |
| γ_k z_c | non-uniform swing: z_c is the county's standardised forecast lean | γ ~ N(0, σ_γ²), constrained so the weighted sum is zero |
| ε_{ck} | county residual | N(0, σ_ε²), constrained so the weighted sum is zero |

The **weighted sum-to-zero constraints** (weights E_c/ΣE_c) make the within-state terms redistribute vote between counties without moving the statewide total. That is how the zero-reporting anchor holds exactly (§6).

z_c and regions exist so that early-reporting counties, which are often geographically clustered (urban cores, one time zone), inform the rest of the state through their *lean* and *region*, and do not stand in for the state as a whole.

### 3.2 Reported and remaining shares in one county

The final county share θ_c splits into a counted part and an uncounted part through a **selection gap** g_{ck}(t):

$$
\rho_{ck}(t) = \theta_{ck} + (1-\pi_c)\,g_{ck}(t)\quad\text{(counted)},\qquad
q_{ck}(t) = \theta_{ck} - \pi_c\,g_{ck}(t)\quad\text{(remaining)}
$$

- To first order the vote-weighted average of counted and remaining equals θ, so final totals stay consistent.
- g is the difference between the counted and remaining log-ratios.
- Observed: y_{ck}(t) = log(V_{ck}/V_{c,ref}) = ρ_{ck}(t) + e_{ck}, with e having sampling variance 1/V_{ck} + 1/V_{c,ref}. This matters only for very small batches.

### 3.3 Selection-gap prior

$$
g_{ck}(t)\sim N\big(\mu_g,\ \sigma_g^2(\omega, \text{stage}(t), \text{category}_s)\big),\qquad \mu_g = 0\ \text{in v1}
$$

**Initial (unfitted) σ_g on the log-ratio scale**

| Stage of the count, under scenario ω | Category A or B (early or mail counted first) | Category C (one combined count) | Category D (varies) |
|---|---|---|---|
| First batch (pre-Election Day ballots only) | 0.30 | 0.10 | 0.25 |
| Mixed (Election Day vote arriving) | 0.20 | 0.08 | 0.20 |
| Tail (late mail, provisional, cured) | 0.15 | 0.10 | 0.15 |

These are roughly 15, 10 and 7.5 margin points of one-sigma disagreement between counted and uncounted ballots in mail-first states.

Two cases are clear-cut:
- Where the estimated π_c is close to 1, the gap barely matters, because the remaining weight π_c·g multiplies a small R_c.
- Where π_c is small, the county's counted share is a weak signal.

This is the formal replacement for E1's `w = min(1, 2·frac)`.

### 3.4 Shrinkage: what the counted vote says about the rest

Write x = (δ_s, δ_g, γ, ε, g) for one candidate contrast. Conditional on π (which is drawn from the inventory posterior), the model is linear and Gaussian:

$$
y_c - \eta^0_c - \alpha = \delta_s + \delta_{g(c)} + \gamma z_c + \varepsilon_c + (1-\pi_c) g_c + e_c
$$

The posterior is the Kalman / GLS update: x̂ = P Hᵀ (H P Hᵀ + Σ_e)⁻¹ (y − η⁰ − α).

Each reporting county gets an effective precision of

$$
w_c = \big[\sigma_\varepsilon^2 + (1-\pi_c)^2\sigma_g^2 + \mathrm{Var}(e_c)\big]^{-1} \le \sigma_\varepsilon^{-2}
$$

Three consequences:
1. **No county, however large, can carry more weight than 1/σ_ε².** E1 instead weights by votes, with a shrink of `sv/(sv + 0.08·expected)`, so a single county with 20% of the expected vote gets 71% of full weight on statewide swing.
2. Small early batches (large Var(e)) and early-stage batches in mail-first states (large (1−π)²σ_g²) get little weight.
3. Regional shifts and the lean slope carry information to non-reporting counties only in proportion to how well they are identified. With few reporting counties, γ stays near zero and the prior dominates.

**Remaining vote in a reporting county.** Draw q_{ck} = θ̂_{ck} − π_c g_{ck} from the joint posterior. θ̂ blends the county's own counted share with the hierarchical prior by precision.

**Non-reporting counties.** Draw θ_{ck} from the prior given the posterior δ_s, δ_g and γ.

### 3.5 More than two candidates

- K−1 log-ratios against the reference candidate.
- Candidates with forecast share below 0.5% are pooled into an explicit `OTHER`, which is labelled as pooled.
- δ_{sk} for the two main candidates comes from the published margin distribution. Minor candidates get an independent δ with a variance set from the polling spread when available, otherwise a wide default labelled PRIOR.
- **Data gap:** the county files hold only `[a, b, other, total]`. Until the forecast pipeline exports per-candidate county shares, K > 2 county baselines split `other` across minor candidates by their statewide forecast shares. This is labelled as an assumption.
- There is no forced two-party normalisation. Shares are a softmax over all K, and winners are decided on all K.

## 4. Projected final votes

$$
F_k = \sum_c \Big[ V_{ck}(t) + R_c \cdot \mathrm{softmax}_k(q_{c\cdot}) \Big],\qquad R_c = T_c - N_c(t) \ge 0
$$

- **Conservation:** F_k ≥ V_k(t) in every draw.
- **Unmatched votes.** Votes in regions absent from the county file (`UNMATCHED_REGION`) form a pseudo-county U with V_{Uk} = topline_k − Σ_{matched} V_{ck}. Its remainder is zero unless a topline expected total says otherwise, so these votes are never dropped. The coverage ratio Σ_{matched} N_c / topline N goes into the diagnostics. Below 0.98, the race is flagged and county inference is down-weighted towards the topline path (§4.2).

### 4.1 Method-aware variant (off by default)

$$
F_k = \sum_c \sum_m \big[V_{cmk}(t) + R_{cm}\, q_{cmk}\big],\qquad q_{cmk} = \theta_{ck} + \beta_{mk} + \ldots
$$

Enabled per state **only** when both of these hold:
1. Returns carry a verified method label.
2. R_{cm} has an OFFICIAL_STATEMENT or verified inventory.

β_{mk} is estimated from within-county method differences in the same night's data, shrunk to a historical prior (MEDSL method aggregates, used for **dispersion only**).

civicAPI provides neither condition, so the variant is off for all states in v1. Nothing infers method from time of release.

### 4.2 Races with no county file (449 of 815)

The same equations apply with one unit (the state or district):
- T from the published expected total (`tot` or `expTot`), plus the turnout prior.
- g with the category's σ_g.

Uncertainty is then dominated by the gap term until the count is far along. This is the intended behaviour, since there is no geographic information.

## 5. Reporting-order scenarios

For each state the count-order dataset gives a scenario set Ω_s:

| Scenario | Content | Initial prior weight |
|---|---|---|
| ω₁ | Ledger `releaseSequence` as written (category A, B, C or D) | 0.60 |
| ω₂ | Mixed: all methods arrive together (category-C behaviour) | 0.25 |
| ω₃ | Reversed or county-varying: Election Day first in some counties (category-D behaviour, or a documented county exception) | 0.15 |

Rules:
- If the ledger category is C, ω₁ and ω₂ coincide and the weights are merged.
- If the state has an `UNRESOLVED` caveat, the weight of ω₁ falls to 0.45.

**What a scenario controls.** A scenario sets:
1. stage(t), from time since the state's (county-specific where known) poll close and from cumulative N relative to the pre-Election Day ballot count where that is published.
2. σ_g(ω, stage).
3. The *labels* of what likely remains ("likely Election Day precincts", "late mail") with their PRIOR label.

It never sets μ_g.

**Scenario weights update by marginal likelihood:**

$$
P(\omega\mid y) \propto P(\omega)\int p(y\mid x,\omega)\,p(x)\,dx
$$

This is closed-form in the Gaussian model. Because ω only changes variances, data that disagree with the prior more than ω allows push weight towards wider scenarios. This is a check on dispersion with no partisan content. The posterior is a mixture over ω in simulation.

## 6. Anchoring to the published forecast

Required property: at N(t) = 0 everywhere, the predictive distribution of the race outcome equals the published one. The construction:

1. **Statewide component.** The draws of δ_s are the published forecast's margin draws, converted to the log-ratio scale.
   - Preferred: the forecast engine's own joint simulations (§8).
   - Interim: sample from the published `est.dist` histogram of each race.
2. **Within-state components** (δ_g, γ z, ε) have **expected-vote-weighted sum zero**, so they redistribute votes between counties without moving the statewide margin. Turnout terms enter the statewide margin only through composition, which is second order. That residual is removed by step 3.
3. **Offset α_k.** A one-dimensional root-find per contrast makes the prior predictive **median** margin equal m_pub. This absorbs nonlinearity (softmax, turnout composition) and the county-file mismatches found in the audit (§3.1: `gov-AK` 15 pt and others). α is solved once per frozen forecast and stored.
4. **Self-test** (stored in every assessment as `anchor.atZeroReporting`):
   - |median margin − m_pub| ≤ 0.05 pt.
   - |P(win) − P_pub| ≤ 0.005, allowing for histogram binning and Monte Carlo error at 20,000 draws.

   If either fails, the race's VAI output is withheld (`ANCHOR_FAILED`).

The toy example (§12) reproduces the published D +2.0 and P = 0.691 at zero reporting as D +1.96 and 0.689.

## 7. Simulation and outputs

Each draw j:
1. Choose ω.
2. Draw (τ, T_c) from the inventory posterior.
3. Compute π_c.
4. Draw x from the Gaussian posterior given π and ω.
5. Compute the q's and F_k.
6. Apply the race's rule.

Use 20,000 draws per race per tick. This is server-side or in a worker, not on the UI thread.

Outputs (data schema §5):
- Medians and 10–90% intervals of F shares, margin, T and R.
- Win, runoff and pass probabilities.
- Required share of the remaining vote.

**Win rules**

| Rule | Races | Output |
|---|---|---|
| `PLURALITY` | Default | pWin_k = share of draws where k has the most votes |
| `MAJORITY_RUNOFF` | GA general (50% + 1), plus any race listed in `data/vai/race_rules_2026.json` (task T2) | pWin_k(outright) = share of draws where F_k/ΣF > 0.5. pRunoff = share with no majority. The runoff winner is **not modelled** (null). |
| `MEASURE_THRESHOLD` | Measures with `thr` (for example FL 60%) | pPass = share of draws where Yes/(Yes+No) ≥ thr. Measures whose denominator is *all ballots cast in the election* (for example MN constitutional amendments) are flagged `DENOMINATOR_RULE_UNSUPPORTED` and pPass is null. |
| `RCV` | AK (all general races) and ME federal races, per the ledger | First-choice shares and P(some candidate passes 50% of first choices) only. pWin is null with the label "Ranked-choice tabulation required." No transfer model in v1. |

**Required share of the remaining vote** (two leading candidates i, j):

$$
s^*_{i} = \tfrac12 + \frac{V_j - V_i}{2\,R^{ij}}
$$

R^{ij} is the remaining vote going to i or j. It is reported as an interval from the R draws, and it is shown only when R^{ij} > 0 with ESTIMATED provenance. Thresholds work the same way, using thr in place of ½.

**Completion statements** follow the evidence ladder only. A projection never reads "all votes counted" because of p_c = 100 or π̂ ≈ 1.

## 8. Correlated chamber outcomes

Chamber control comes from **joint** draws. It never comes from multiplying per-race probabilities.

1. **Required artefact.** The forecast engine already runs 2,000 seeded joint simulations (`model.json` `meta.sims`; national, regional and state draws in `scripts/forecast/model/dynamic_mode.py`). VAI needs them **exported and frozen**: a J × R matrix of race margins (or log-ratios) for the final pre-close publication, with its sha256. This is a change to Lester's pipeline and needs his approval. Until then, VAI chamber probability is **UNAVAILABLE**. No independent-race fallback is allowed.
2. **Importance reweighting.** Each race r with returns gives a Gaussian likelihood L_r(δ_r) for its statewide shift, which is the marginal of §3.4. Draw j gets weight

   $$w_j \propto \prod_r L_r\big(\delta_r^{(j)}\big)$$

   - Races in the same state share τ_s, and the state shifts of different offices are linked through the forecast's correlation.
   - At zero reporting all w_j are equal, so the chamber distribution equals the published one **exactly**.
3. **Degeneracy.** Monitor ESS = (Σw)²/Σw². When ESS < J/10:
   - Fit a multivariate normal to the frozen draws (mean μ, covariance Σ).
   - Condition analytically on the Gaussian likelihoods: Σ_post = (Σ⁻¹ + Λ)⁻¹.
   - Draw J fresh joint samples.

   This keeps cross-race information (an early-closing state informs correlated states) while avoiding particle collapse.
4. **Seat counting.** Per draw, count seats under each race's rule. RCV and runoff races contribute "undetermined" seats. Control probabilities are reported with an undetermined bucket rather than resolving those seats arbitrarily. Called races (provider calls) are **not** fixed in VAI. The publication states stay separate.
5. **Shrinkage of national information.** Early states are not representative of the nation. Cross-state learning flows only through the forecast's own covariance, so live returns can never imply more national correlation than the forecast already contains.

## 9. Feed integrity

| Condition | Treatment in the math |
|---|---|
| Duplicate reading | Ignored before inference (same key, source time and votes) |
| Out-of-order reading | State is the latest by source time; earlier ones stay in the log only |
| Downward revision | Latest value used. Var(e_c) is inflated by κ_rev (initial ×4) for that county for 30 minutes. Flagged. |
| Stale feed | No new inference. The last assessment is shown with `STALE_FEED`; uncertainty is not reduced by elapsed time. |
| Missing county in feed | Treated as non-reporting (prior). Never as zero votes cast. |
| Unmatched region | Pseudo-county U plus a coverage check (§4) |
| Topline and county disagree | The topline reconciles through U. If coverage is below 0.98, the race is flagged and county weight shrinks. |
| Turnout above expectation | §2.3 |
| Test data | Excluded before inference |

## 10. Hyperparameters

| Parameter | Initial value (unfitted) | How it must be estimated | Data |
|---|---|---|---|
| σ_ε (county residual, log-ratio) | 0.10 | Dispersion of county swing around state swing across earlier pairs of elections, by state | `pres24_counties.json` plus earlier county finals (MEDSL) |
| σ_γ (lean slope) | 0.05 per SD of lean | Regression of county swing on prior lean, across cycles | Same |
| σ_g region | 0.05 | Within-state regional swing dispersion | Same |
| σ_g(ω, stage, category) | §3.3 table | **Point-in-time** backtest only (PA, GA archive captures). Final method splits give upper and lower plausibility bounds, not estimates. | Archive captures; MEDSL method aggregates as bounds |
| σ_u, σ_τs, σ_τg (turnout) | 0.10, 0.06, 0.05 | Forecast turnout error vs final, by county, in earlier cycles; early-vote snapshot error | Earlier finals, `ev_history/` |
| ρ_c rejection prior | UNKNOWN (Beta(1,30)) | Official rejection and cure statistics per state | Register (to be added) |
| κ_rev | 4 | Backtest anomaly injection | Synthetic |
| Scenario weights | 0.60 / 0.25 / 0.15 | Backtest (likelihood across PA and GA nights) | Archive captures |

Hyperparameters are estimated only from elections **before** the one evaluated, and are frozen in `data/vai/hyper_v1.json` with provenance.

## 11. What remains: verified and estimated

| Quantity | Label | Source |
|---|---|---|
| Votes counted | VERIFIED | Provider |
| Officially outstanding ballots | OFFICIAL_STATEMENT | Official statement (register id, as-of time); summed only over counties that have one |
| Ballots eligible to arrive later | PRIOR (rule), UNKNOWN (volume) | Count-order `lateCounting` |
| Estimated remaining votes | ESTIMATED, with an interval | §2, §4 |
| Likely composition of the remaining vote | PRIOR, scenario-weighted | §5 |
| Precinct reporting % | metadata (VERIFIED as a number, **not** completion) | Provider |

## 12. Worked example (hypothetical; not real data)

Reproduce with `python3 scripts/vai/toy_example.py`. E1 is re-implemented line for line from `project()` and `liveOdds()`.

**Setup**
- Three counties with expected votes A 500k (D 60%), B 300k (D 50%), C 200k (D 30%).
- Published forecast: D +2.0, sd 4 pts, P(D) = 0.691.
- First batch: county A reports 200,000 early and mail ballots at D 68%. Nothing else has reported.

| Estimator | Projected margin | P(D wins) | Implied total votes |
|---|---|---|---|
| Published forecast (zero reporting) | D +2.0 | 0.691 | 1.0M |
| VAI at zero reporting (anchor check) | D +1.96 (sd 3.98) | 0.689 | 1.0M |
| E1, county A `pr` = 0 (falls back to votes / expected) | D +15.4 | **1.000** | 1.0M |
| E1, county A `pr` = 10 | D +25.3 | **1.000** | **2.5M** (`200k / 0.10`) |
| E1, county A `pr` = 100 (mail batch with all precincts flagged) | D +7.0 | 0.983 | 0.7M (county A treated as finished) |
| VAI v1 (initial hyperparameters) | D +4.3 (80%: −0.4 to +9.0) | 0.878 | 1.0M; county A remaining 299k (80%: 240k to 367k) |

**Readings**
- E1 turns one unrepresentative batch into near-certainty. Its uniform swing gives the batch 71% weight statewide, and its `liveOdds` spread shrinks with the (model-derived) percent in.
- E1's output depends heavily on the meaning of `pr`.
- VAI moves towards the batch, because it is evidence, but keeps the outcome uncertain because the batch may be unrepresentative.
- Whether VAI's degree of movement is *right* is exactly what the backtest must establish. The example demonstrates the mechanics and makes no claim about accuracy.

## 13. Limitations

- σ_g is the single most important parameter and, for 2026, it is not identified from data. Only two states have point-in-time archives, and they are sparse.
- The count-order dataset helps mainly by *widening* uncertainty when the reported vote is likely unrepresentative. It gives no directional adjustment in v1.
- Method-aware estimation is off everywhere, because civicAPI has no method field.
- RCV, runoff-winner and all-ballots-denominator measures are reported as unavailable, not modelled.
- Chamber probabilities need the forecast's joint draws to be exported.
- A county file that differs from the published margin is patched by α, but the cause should be fixed upstream (audit §7 question 7).
