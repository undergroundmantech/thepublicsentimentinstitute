# TPSI respondent component, version 2

Run of September 29 2026. Every Senate, governor and House race was re-run with this component and with the new third party level.

## 1. How the component worked before

This section records the model as it was found, before any change.

**Respondents.** `senate_mode.py` loaded the TPSI national respondent database: 4,337 respondents across six waves, February to September 2026. The file carries no survey weight. Its consumers filtered it in three different ways:

- the census leg dropped only rows missing age, race, college or region;
- the voter file kept `analysis_ready` rows;
- the national anchors dropped `rqcm_flag` rows.

The only weight anywhere outside the national rake was `turnout_propensity`.

**Demographic profiles.** County cells came from ACS table S1501, the five year 2024 estimates. There are 32 cells: 4 age bands, 4 race groups and college or not. Each cell was built as the product of the county's separate age, race and education margins. The universe was adults 18+. It was not citizen adults, registered voters or likely voters.

**Candidate preference.** The census leg fit one national ridge logistic model of the 2026 generic ballot on age, race, college and region, weighted by turnout propensity. It fit a second model of recalled 2024 vote on the same terms. The leg's swing is the difference of the two, applied to each county's 2024 result. There were no state effects: two states in one region with the same demographics swung identically. Candidates entered as additive log odds terms for incumbency, finance and primary unity.

**Turnout.** Turnout was a separate logistic fit on reported 2018 or 2022 midterm voting. Each cell's electorate is adults times turnout, and each county's share is Σ adults × turnout × preference / Σ adults × turnout. The electorate model then calibrates each county to certified 2022 and 2024 turnout and to the 2024 result.

**Polling calibration.** The census leg is calibrated only nationally. A log odds intercept is solved so the national likely voter share matches the anchor. State polls set the level of the history and polling leg, which is solved by bisection so that its turnout weighted county shares equal the poll average. The final share is a weighted blend of the three legs.

**Voter file.** No real voter file exists in the package. The voter file layer is synthetic: each county's 384 voter types are filled with up to 24 TPSI respondents as donors, then calibrated to certified turnout. It feeds the approval leg in voter file mode and the estimated vote by group tables.

**Audit.** The run summary recorded the national shifts, but `national_lv_d2` held the 2024 pass, 0.4925, rather than the 2026 anchor. The respondent filters, the universe and the anchor source were not recorded.

## 2. What changed

**Respondent source.** The unified respondent dataset replaces the database. It holds the same 4,238 analysis ready respondents with identical answers, plus model imputed values for skipped items. Each imputed value carries a source flag and a confidence score.

- Every consumer now drops the same rows: the 33 with a quality flag. That leaves 4,205.
- An imputed value is used only where its confidence is at least 0.7.
- An imputed value is never used for the generic ballot or the recalled 2024 vote, which are the outcomes the preference model is fitted on.

**Universe.** Cells are now citizen adults. Adults are multiplied by a citizen rate by race group, and turnout is applied after that. Registration is fitted from the respondents, so each state reports VAP, CVAP, registered voters and likely voters.

**State effects.** Each state gets its own effect on the 2024 to 2026 swing.

- Each respondent's swing residual is their 2026 ballot residual minus their 2024 vote residual, both measured against the national cell model.
- Each state's mean residual is converted to log odds.
- It is then shrunk toward zero by τ² / τ² + v, where v is the state's sampling variance and τ² is the true variance between states.
- A second, nested level does the same for state by race group.

The standard DerSimonian and Laird estimate of τ² comes out at zero on this sample. It depends on each state's sampling variance, which the turnout weights inflate. The model instead uses a split half moment estimate:

- Two random halves of a state's respondents share its true effect and nothing else.
- So the covariance of the two half estimates across states measures τ² directly.
- The estimate averages 40 fixed seed splits.
- It uses states with at least 10 respondents in each half, weighted by the smaller half.
- It is capped at 0.10.

The effects are centered so they redistribute the national vote rather than move it. The national intercept is recalibrated afterwards regardless.

**Estimated vote by group, with ranges.** Each group row keeps its constraint: one preference constant per county makes the voters reproduce that county's forecast exactly. Each row now also carries an 80 percent range for the Democratic and the Republican share, built from three sources:

- The race itself. A common shift of every county's constant is solved so that the whole electorate lands on the 10th and 90th percentile simulated two party shares. Every group then moves by its own sensitivity, and the Total row reproduces the simulated range exactly.
- The group estimate. A group holding share s of the electorate is read from about s × 4,205 respondents. Its spread is 1 / √ s N p 1−p.
- The pooled state effect's own spread.

The three are combined in log odds.

**Audit.** Each race's summary now holds a `respondent_model` block with:

- the source file and its hash, filter counts, imputations used and waves;
- the state's raw and pooled effect with their spreads;
- the pooling estimates;
- the CVAP rates;
- the VAP, CVAP, registered and likely voter chain with shares by race.

The summary also holds `third_party_level` and `crosstabs.ranges`. `national_lv_d2` now reports the 2026 anchor.

**Third party level.** A third party share used to be the weighted poll Other figure alone. A poll that does not ask records zero, so 12 ballot qualified candidates sat at exactly 0.0 percent, among them Chase Oliver in Georgia and all three minor candidates in Pennsylvania. The per race floors meant to catch this are dropped in uniform mode. Every race now uses one rule:

- **Structural** = 0.6 × label prior + 0.4 × the state's past third party share for the office, capped at 5 percent.
- **Label priors:**
  - Libertarian 1.5 percent;
  - Green 0.8;
  - named independent 1.0;
  - Constitution or Taxpayers 0.5;
  - other minor labels 0.4 to 1.0;
  - Other or write in 0.3 to 0.6.
- **Poll weight** = 0.95 × √ the share of poll weight that asked, applied to the Other share among only those polls.
- **Floors:** the total never falls below 0.6 of the summed priors, and no named candidate falls below half of their own prior.
- **Switch:** `THIRD_LEVEL=0` restores the old rule.

## 3. Data sources and assumptions

| Input | Source | Status |
|---|---|---|
| Respondents | TPSI unified respondent dataset, 4,238 rows, six waves | Real, used inside the model only, never exported |
| Adults by age, race, education | ACS 2024 five year S1501, county | Real |
| Citizen rate by race | National ACS 2023 CVAP to VAP ratios: White 0.985, Black 0.95, Hispanic 0.77, Asian and other 0.80 | Assumption, one national rate per group |
| Registration | Fitted from respondents; 3,161 of the registration answers are imputed | Audit only, does not enter the vote |
| Certified turnout and results | 2022 and 2024 county returns already in the package | Real |
| Voter file | TPSI respondents as donors to 384 voter types per county | Synthetic, as before |
| Polls | The race poll files and EXTRA_POLLS | Real |

Known limits:

- **Joint ACS profiles.** A true state specific joint profile of age by race by education needs ACS PUMS or the B01001 race iterations. Neither is in the package, so cells remain the product of county margins.
- **Citizen rates.** The Hispanic citizen share runs from about 0.6 in some California and Texas counties to above 0.9 in New Mexico. The single national rate is the largest assumption here. A county CVAP special tabulation would replace it.
- **Voter file.** Loading a real state voter file would replace the synthetic one. It would supply registration, vote history and modeled party, and it would let turnout be checked person by person rather than county by county.

No synthetic demonstration data was used anywhere in this run.

## 4. Validation

| Check | Result |
|---|---|
| Respondents used after filters | 4,205 of 4,238; 33 quality flags dropped |
| National anchor reported | 0.5719 two party, formerly misreported as 0.4925 |
| Between state spread, split half | τ = 0.082 log odds |
| Between state spread, DerSimonian and Laird | τ = 0, Q = 41.9 on 50 degrees of freedom |
| Split half correlation of raw state effects, 22 states | mean 0.30 across 20 splits |
| Leave one wave out, DerSimonian and Laird | τ = 0 for every wave left out |
| Largest pooled state effect | Maryland +0.072, Missouri −0.049 log odds |
| Median shrinkage of raw effects | 86 percent |
| State by race group level | τ = 0, so no group specific state effects |
| Census leg change, 71 races | mean +0.03 points, largest 1.21, sd 0.47 |
| Final margin change, 71 races | mean +0.07 points, largest 1.18 in Idaho governor |
| Final two party share against poll average, 42 races with 3+ polls | mean gap +0.34, root mean square 2.3 points |
| CVAP over VAP, median race | 0.949 |
| Modeled midterm voters over certified 2022 turnout | median 1.22, 10th to 90th percentile 1.06 to 1.48 |
| Third party candidates at zero | 12 before, 0 after, 97 named candidates |
| Group table constraint | largest county error 2.3e−14 |
| Group tables with ranges | 69 of 71; the two Alaska races are ranked choice and have none |

The modeled likely voter count runs about 22 percent above 2022 turnout. The midterm turnout fit reads reported 2018 or 2022 voting, and respondents over report. This does not reach the forecast: the electorate model calibrates every county to certified turnout before any vote is counted.

## 5. Worked example: Texas and Maine

The two states sit at opposite ends. Texas has a large Hispanic electorate and one of the biggest TPSI state samples. Maine is almost entirely white and has one of the smallest.

| | Texas Senate | Maine Senate |
|---|---|---|
| TPSI respondents with both votes | 170, effective 155 | 19, effective 18.7 |
| Raw state swing effect | −0.118 ± 0.105 | −0.273 ± 0.235 |
| Pooled effect | −0.032 ± 0.065 | −0.017 ± 0.077 |
| Share of the raw effect kept | 27 percent | 6 percent |
| VAP | 22,643,776 | 1,137,277 |
| CVAP | 20,114,962 | 1,104,662 |
| Registered, modeled | 17,783,566 | 1,018,666 |
| Modeled midterm voters | 10,943,137 | 725,310 |
| Certified 2022 turnout | 8,106,768 | 679,064 |
| Forecast 2026 turnout | 9,968,440 | 736,622 |
| Hispanic share of VAP, CVAP, likely voters | 35.4, 30.7, 27.2 | 1.7, 1.4, 1.3 |
| Census leg before, after | 54.86, 54.08 | 55.81, 55.77 |
| Census leg weight in the blend | 0.11 | 0.16 |
| Final two party D before, after | 51.57, 51.52 | 51.83, 51.84 |
| Margin before, after | Talarico +3.0, +2.9 | Jackson +3.2, +3.2 |
| Win probability before, after | 70.0, 69.2 | 71.0, 73.0 |
| Third party total before, after | 1.8, 2.6 | 1.0, 2.3 |

Reading the two:

- **Texas.** The raw effect is below its own standard error, but the sample is large enough that about a quarter of it survives. The citizen adjustment cuts the Hispanic share of the modeled electorate from 35 to 27 percent. Both changes pull the census leg down 0.8 points. The census leg carries 11 percent of the blend in a race with 41 polls, so the final share moves 0.05 points.
- **Maine.** The raw effect is larger, but it rests on 19 people, so 94 percent of it is pooled away and the census leg barely moves.
- **Third party totals.** In Texas, Ted Brown's share now reads the 66 percent of poll weight that asked about a third choice, rather than averaging in the polls that did not. In Maine, Phillip Rench had been diluted to 1.0 percent by polls that never listed him. He now reads 2.3: his label prior, Maine's 3.7 percent past third party vote for the Senate, and the 40 percent of poll weight that asked.

Estimated vote by group in Texas, with the new 80 percent ranges:

| Group | Share of voters | Talarico | Paxton |
|---|---|---|---|
| All voters | 100 | 50.1, range 46.6 to 53.7 | 47.2, range 43.7 to 50.8 |
| White | 61.0 | 40.1, range 35.7 to 44.8 | 57.3, range 52.7 to 61.8 |
| Latino | 20.8 | 64.0, range 59.7 to 68.1 | 33.3, range 29.2 to 37.6 |
| Black | 11.3 | 72.4, range 67.5 to 76.8 | 25.0, range 20.8 to 29.9 |
| 18 to 29 | 14.3 | 55.4, range 49.9 to 60.7 | 42.0, range 36.7 to 47.4 |

## 6. Files

- `respondent_v2.py`: new; the loader, pooling, universe and audit.
- `senate_mode.py`: respondent hooks, citizen cells, national anchor fix and the third party level.
- `voters.py` and `dynamic_mode.py`: group ranges.
- `tpsi_national.py` and `meridian_all.py`: the same respondent loader.
- `RESP_V2=0` restores the old respondent component.
- `THIRD_LEVEL=0` restores the old third party rule.
