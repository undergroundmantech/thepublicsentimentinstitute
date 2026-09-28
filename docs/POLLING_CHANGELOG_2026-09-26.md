# Early vote: turnout shading where no party is reported, 26 September 2026

Twelve states send every early ballot as Unspecified, with no party attached: HI, ID, IL,
IN, MD, MN, MT, ND, OH, VA, VT and WI on the current feed. The map shaded by two party
margin, so every one of those states and every county inside them drew as flat grey.

Those places are now shaded green by raw ballot count.

- The scale is logarithmic. Virginia counties run from 50 requested ballots in Highland to
  75,205 in Fairfax, and on a linear scale Fairfax would be the only dark shape.
- The scale is built only from the places with no party data, so a state that mixes party
  counties and Unspecified counties keeps its party shading on the party counties.
- On the national map the party states keep the blue and red ramp and the no party states
  take the green one. Both legends show, and the green legend prints its real low, middle
  and high counts.
- The tooltip replaces the empty margin with the place's rank by ballots and its share of
  the state, or of all reported ballots on the national view.
- In the county table the Split column, which was one grey bar for every row, becomes an
  Intensity bar on the same green scale.
- The green comes from the site's `--win` token, so it follows the light and dark themes.

Files: `app/earlyvote/lib.ts` adds `volumeScale`, `turnoutFill` and `compact`.
`app/earlyvote/EarlyVoteDesk.tsx` uses them for the map fill, legend, tooltip and table.

# Early vote: TPSI party estimate for states with no party data

The twelve states that report every early ballot as Unspecified now show a simulated party
split built from TPSI polling. It is on by default in those states. A switch in the new
estimate panel goes back to the green turnout shading.

## What the page shows

- An estimate panel under the headline: the estimated margin, the 80% simulation range, and
  estimated Democratic, Independent and Republican ballots and shares.
- Places with no party data are shaded on the normal party ramp with thin diagonal hatching
  over them, so an estimated county never reads as a reported one. The legend says so.
- The county table gains Est. Dem, Est. Rep, Est. Ind and Est. margin columns, in italics.
- The tooltip gives the estimate for that county with its own 80% range.
- A "How this is estimated" section explains the method and prints the check below.

## How it is estimated

`scripts/earlyvote/build_party_model.py`, run on the TPSI national respondent database and
the TPSI county file:

1. Each county starts from its 2024 Trump two party share, moved by the swing TPSI measures
   inside its own sample from 2024 recall to the 2026 generic ballot: 2.1 points toward the
   Democrats. The same respondents answer both, so the panel's partisan tilt cancels.
2. TPSI likely voters set the party mix: 20.3% Independent. In 2024, Democrats voted Trump
   at 7.5%, Independents at 44.5% and Republicans at 94.7%. Those numbers fix the one
   Democratic and Republican split that reproduces each county's lean.
3. A weighted multinomial logit on party ID gives the early vote skew at the same local lean.
   Mail voters are clearly more Democratic than the whole electorate, and early in person
   voters slightly so. The gap is widest in Democratic counties and narrows in Republican ones.
   The mail skew applies to requested and returned ballots, the in person skew to in person.
4. All of it is refit on 300 bootstrap resamples of 3,013 likely voters. The page runs every
   resample against the live county counts, so the ranges are simulation ranges.

## Check against states that do report party, mail ballots requested

| State | TPSI estimate | 80% range | Registration |
|---|---|---|---|
| Florida | D+12.1 | D+5.6 to D+18.8 | D+11.2 |
| North Carolina | D+20.3 | D+15.1 to D+26.0 | D+25.0 |
| New Jersey | D+35.8 | D+31.1 to D+40.9 | D+39.0 |
| Pennsylvania | D+22.0 | D+16.9 to D+27.7 | D+42.4 |
| Oklahoma | R+17.7 | R+9.6 to R+25.9 | R+4.6 |
| Kentucky | R+15.1 | R+7.3 to R+22.6 | D+30.3 |

Florida is the closest comparison, because its registration tracks party ID well, and it
lands within a point. Pennsylvania mail voters are more Democratic than the model expects.
Kentucky and Oklahoma carry ancestral Democratic registration that a party ID model should
not reproduce. The twelve estimated states have no party registration at all, so party ID is
the right target there.

## Privacy

The respondent file stays off the site. `public/earlyvote-party-model.json` holds fourteen
model numbers per draw and public county figures: the 2024 Trump share and adult population.
Keep the TPSI CSVs out of the repository and pass their paths in:

    TPSI_DB=path/to/TPSI_National_Respondent_Database.csv \
    TPSI_COUNTY=path/to/TPSI_Trump_Approval_By_County_Combined_FULL.csv \
    python3 scripts/earlyvote/build_party_model.py

Re-run it after each new TPSI wave.

# Early vote: tooltip follows the cursor

The map tooltip was landing about 1,200 pixels above the cursor and off to the right. It
was a `position: fixed` child of the page, but an element in the site shell creates its
own containing block, so the position was measured from that box instead of the window.
It is now rendered straight into the document body. It sits 14px beside the cursor,
centred on it vertically, flips to the left of the cursor near the right edge and stays
inside the window. The rank line is shortened so it no longer truncates.

# Early vote: nationwide party breakdown, reported plus TPSI estimate

The national early vote view now opens with one card each for Requested, Returned and
In person. Each card gives the final estimated party breakdown for the whole country.

- **Reported ballots are counted as reported.** Where a state publishes party, Democratic
  and Republican ballots go straight in. Every other label, such as No Party Affiliation,
  Other, Libertarian or Green, goes into Independent or other.
- **Unspecified ballots are estimated with the TPSI model.** That covers the twelve states
  with no party data, plus any Unspecified remainder inside a party state, such as
  Kentucky's. Mail skew applies to requested and returned ballots, early in person skew to
  in person ballots.
- **A no-party state is estimated from its own county counts.** The page fetches those
  counts, so the national figure matches what that state's page shows. Until they load, and
  for the Unspecified remainder in party states, counties are weighted by adults.
- **Each card shows:**
  - the final margin, with an 80% range that comes only from the estimated share
  - Democratic, Independent or other, and Republican ballots and shares, each with how
    much was reported
  - a bar with solid segments for reported ballots and hatched segments for estimated ones
  - a count of reported and estimated ballots
- Clicking a card switches the page to that category.

Files: `combineNational` in `app/earlyvote/lib.ts`. `simulate` now also returns its
per-draw totals, so reported and estimated ballots combine inside every draw.
`NationalCombined` and `CombinedBar` are in `app/earlyvote/EarlyVoteDesk.tsx`.

# Early vote: returned ballots modelled with party drop off

Returned ballots used to get the same estimated party mix as requested ones. They now get
their own, because parties send ballots back at different rates.

## The model

Each requester's chance of having returned a ballot is logistic(a + b_party), with the
Democratic offset fixed at 0.

- **The level a is solved per county.** The county's estimated requesters then return
  exactly the ballots it reports, so each county's own return rate is used. Early, when a
  county has returned a few percent of its requests, the party gap bites hard. As returns
  approach requests, the returned mix converges back onto the requested mix.
- **The offsets b are measured live from the feed.** They come from every state that
  publishes party for both requests and returns: Florida, Kentucky, North Carolina, New
  Jersey, Oklahoma and Pennsylvania on the 25 September feed. The typical state has
  Republican requesters returning at 0.74 times the Democratic odds.
- **Each simulation takes one measured state's offsets.** A volume-weighted average would
  let Pennsylvania decide the answer for every other state: its Republicans return at 0.40
  times the Democratic odds, while everyone else sits near 0.75.
- **Fallback.** When fewer than two states, or under 2,000 party ballots, have come back,
  the TPSI survey stands in. The prior is built from mail voters' turnout propensity by
  party and added to the model file.

## Live calibration

Idaho and Maryland publish party for returns but not for requests. They are the one direct
check on an estimated return mix, and on 25 September the uncalibrated model was too
Democratic in both:

| State | Model, R share of two party returns | Reported |
|---|---|---|
| Idaho | 60.9% | 65.5% |
| Maryland | 13.9% | 20.9% |

Estimated returns everywhere are shifted by the average gap in log odds, shrunk by
N / (N + 2,000), where N is those states' returned party ballots. Today that is 0.29
toward Republicans. The calibration updates itself as those states post more returns, and
any state that starts publishing party on returns only joins it automatically.

Held-out test on the 25 September feed: calibrating on Maryland alone moved Idaho from
59.9% to 66.9% Republican, against 65.5% reported. Calibrating on Idaho alone barely moved
Maryland, because Idaho's 988 ballots are shrunk hard.

## Where it shows

- The state page for a no-party state, on Returned, now differs from Requested. In the test
  data, Virginia requested reads D+11.6 and returned D+13.1.
- The nationwide Returned card uses the same model and says where its return rates come from.
- "How this is estimated" on Returned explains the drop off, names the states measured,
  and prints the calibration gap.

Files:

- `returnTilt` and `returnedMix` in `app/earlyvote/lib.ts`
- the `returned` mode in `simulate` and `combineNational`
- `ReturnNote` in `app/earlyvote/EarlyVoteDesk.tsx`
- the return prior in `scripts/earlyvote/build_party_model.py`, which rebuilds
  `public/earlyvote-party-model.json`

# Early vote: map rated like the electoral map

The early vote map no longer shades on a continuous tint. Every county, and every state on
the national view, gets a rating, the same way the electoral map does.

- **Bands.** Early vote margins run far wider than race margins, so the cut points are
  wider than the forecast's:

  | Band | Margin |
  |---|---|
  | Toss-up | under 1 point |
  | Tilt | 1 to 5 |
  | Lean | 5 to 15 |
  | Likely | 15 to 30 |
  | Safe | 30 and up |

  Reported party margins and TPSI estimates are rated the same way. Estimated places keep
  their hatching.
- **Colours.** They go dark to light, Safe deepest and Tilt palest, and stay the same in
  both themes. Before, the dark theme ran the other way, with weak counties fading into the
  background. Neighbouring bands are now well apart in lightness:
  - Democratic: Safe #12348a, Likely #2f62d6, Lean #6f9bf0, Tilt #bdd1fa
  - Republican: Safe #8c1424, Likely #d0364a, Lean #ef8089, Tilt #fac6cb
  - Toss-up: #a4a9b5
- **Electoral map look.**
  - Shapes are outlined in the page colour, so each county reads as its own tile.
  - Hover brightens the shape and outlines it in ink.
  - The legend is the electoral map's row of rating chips, Safe D through Safe R.
- **Rating board above the map.** Like the electoral map's seat bar, but sized by ballots.
  It shows the share of ballots in Democratic and Republican rated places, a bar from Safe D
  to Safe R, and a count of places in each band.
- **Ratings in the tooltip and table.** The tooltip leads with the rating pill. The county
  table has a Rating column, in italics where the rating comes from the TPSI estimate.
- **Hatching.** It is now a light and a dark line together, so it shows on both deep and
  pale fills in either theme.

Turnout mode keeps its green volume shading.

# Forecast desk: poll lists and trackers read from the published run

Found while packaging the model. `scripts/forecast/build_app_forecast.py` read each race's recent
poll list and 60-day polling tracker from the model's own output folder. That folder stopped updating
on Sept 22, so every rebuild since had published current margins and odds next to Sept 22 poll lists.
Poll ages were also measured from a fixed Sept 22 date.

The builder now reads those tables from the run being published, `RES_DIR`, and measures poll ages
from `UPDATED`. `public/forecast` is rebuilt from the Sept 25 run.

- Race margins, win probabilities and seat counts are unchanged. `sync_site_numbers.py` changed 0 values.
- The recent poll lists now include the Texas, Alaska and Iowa polls added Sept 25. Texas Senate, for
  example, now leads with Texas Public Opinion Research and Marist University.
- The chamber trend lines are recomputed from the current trackers. Today's point is identical.

# Polling averages: PSI LOWESS trend lines and the Election Day polling average, Sept 28

Every head to head on the Polling Averages page now has a Trend lines panel under the PSI
average. That covers the generic ballot, approval, and every 2026 Senate and governor matchup.

## The trend lines

- **Observations.** Every individual poll counts once, with no sample size or pollster
  weight. Each poll sits at the midpoint of its field dates, and its margin is the first
  series minus the second.
- **Midpoints without a start date.** Polls that publish only an end date are placed 1.5 days
  before it, half the site's median field length of 3 days. That covers the national files
  and a few race files.
- **No double counting.** Published polling averages, such as the RealClearPolitics Avg row in
  Arizona, are left out.
- **The smoother.** Robust LOWESS at spans 0.30 recent, 0.45 balanced and 0.60 long-term, with
  three robust passes. It matches statsmodels exactly.
- **The reading.** The panel says whether the newest polling is moving away from the broader
  trend or confirming it. It counts as moving when the recent line sits at least a point
  from the long-term line, and more than one and a half times the recent line's own
  uncertainty.

## The Election Day polling average

The Election Day figure is 0.40 x the recent trend plus 0.60 x the long-term trend, carried
flat to Election Day, with an 80% range.

That rule was chosen on a backtest of the site's own polls. It projected 14 to 42 days ahead
and scored against the later polls. It missed by 2.6 points on average; the latest single
poll missed by 4.6. Extending the recent slope made every horizon worse.

It needs at least 8 polls. Trend lines need at least 6. On Sept 28, 22 of the 62 races for
2026 have a projection.

Files: `app/polling/lib/lowessTrend.ts`, `app/polling/lib/TrendPanel.tsx`, the panel mount in
`app/polling/genericballot/GenericBallotV2.tsx`, and the Python reference and backtest in
`scripts/polling/lowess/`.

# Forecast: all 71 races re-run on the LOWESS polling level, Sept 28

The Senate and governor forecast now takes its polling input from the same LOWESS system as the
Polling Averages page. All 71 races were re-run at 2,000 simulations each with `AS_OF=2026-09-28`
and the published settings. The House was not re-run and stays on the Sept. 25 House run.

## What changed in the model

- **Polling level.** Wherever a race has 8 or more polls, the level of its polling average is
  the LOWESS Election Day polling average: 0.40 x the recent trend plus 0.60 x the long-term
  trend. The PSI weighted average still sets the two main candidates' combined share, so
  undecided voters are handled as before. Races with fewer than 8 polls keep the PSI weighted
  average. On this run 21 races use LOWESS, 38 use the PSI average and 12 have no polls.
- **Ranked choice.** Alaska's LOWESS level is taken on the final round margins.
- **One poll set.** The model now reads the same polls as the site. 81 polls in 17 races that
  were on the site but missing from the model were added through `site_poll_sync.py`.
- **The desk.** Each race's poll line says which average fed it. A LOWESS race reads "N polls
  project to an Election Day polling average of X", with the PSI weighted average beside it.

## New polls in this run

| Race | Pollster | Field dates | Result |
|---|---|---|---|
| NC Senate | AARP, Fabrizio Ward and Impact Research | Sept. 17 to 20, LV | Cooper 53, Whatley 42 |
| TX Senate | Stratus Intelligence, Republican pollster | Sept. 22 to 24, LV | Paxton 48, Talarico 48 |
| TX Governor | Stratus Intelligence | Sept. 22 to 24, LV | Abbott 50, Hinojosa 45 |
| MI Senate | GBAO, Democratic internal | Sept. 19 to 22, 800 LV | El-Sayed 48, Rogers 44 |
| IA Senate | Big Data Poll | released Sept. 23, 650 RV | Turek 46.5, Hinson 42.2, Laehn 4.6 |
| TX Senate | Big Data Poll, leaners pushed | Sept. 24 to 26, LV | Talarico 46.8, Paxton 44.9 |
| TX Governor | Big Data Poll, leaners pushed | Sept. 24 to 26, LV | Abbott 48.9, Hinojosa 44.4 |
| SC Senate | Trafalgar | Sept. 23 to 25, LV | Graham 43.4, Andrews 42.3 |
| ME Senate | InsiderAdvantage | Sept. 22 to 23, LV | Jackson 46.4, Collins 45.6 |
| IA Senate | InsiderAdvantage | Sept. 22 to 23, LV | Turek 47.4, Hinson 45.7, Laehn 1.6 |

AARP and Stratus published no sample size, so those rows carry 0 with a note. Big Data Poll's
Iowa release gave no field dates, so it sits on its release date.

## Chamber control

| Chamber | Before | Sept 28 |
|---|---|---|
| Senate, Osborn with Democrats | 76.7% | 77.5% |
| Senate, Osborn not counted | 75.6% | 75.4% |
| Governors | 87.5% | 88.4% |
| House, not re-run | 89.5% | 89.5% |

## Races that moved most

Margins are Democratic side positive; win chance is the Democratic side's.

| Race | Margin before | Margin now | Win before | Win now | Why |
|---|---|---|---|---|---|
| NY Governor | +12.0 | +17.5 | 98.0% | 100% | LOWESS level |
| IA Governor | +7.0 | +10.9 | 87.5% | 96.2% | LOWESS level |
| MI Governor | +10.2 | +7.2 | 96.3% | 89.6% | LOWESS projects D+3.2, against a PSI average of D+7.3 |
| IA Senate | +0.9 | +3.5 | 55.8% | 71.5% | Big Data Poll and InsiderAdvantage |
| PA Governor | +21.4 | +24.0 | 100% | 100% | LOWESS level |
| NC Senate | +8.8 | +10.9 | 95.6% | 98.7% | AARP poll and LOWESS level |
| AK Senate, final round | +4.1 | +2.1 | 79.4% | 65.8% | LOWESS level |
| GA Senate | +9.7 | +11.2 | 97.9% | 99.2% | LOWESS level |
| AZ Governor | +10.2 | +8.7 | 96.2% | 94.4% | LOWESS level |
| NE Senate, Osborn | -0.5 | +0.8 | 45.8% | 56.5% | LOWESS level. **Flips to Osborn.** |
| ME Senate | +4.9 | +4.3 | 80.6% | 77.2% | InsiderAdvantage |
| SC Senate | -1.7 | -1.2 | 37.1% | 40.1% | Trafalgar |
| TX Senate | +2.9 | +3.2 | 69.6% | 70.7% | Stratus and Big Data Poll |
| TX Governor | -3.7 | -4.0 | 22.3% | 22.4% | Stratus and Big Data Poll |
| MI Senate | +4.3 | +4.2 | 76.8% | 78.0% | GBAO |

Nebraska is the only race whose favourite changed. The Senate page now projects 53 Democrats,
46 Republicans and Osborn; the desk, which counts Osborn with the Democrats, shows 54 to 46.

## Files

- `public/forecast/*`, rebuilt from the run, and 153 values synced across the site by
  `sync_site_numbers.py`.
- `scripts/forecast/build_app_forecast.py`: the output folder can be set with `OUT_FORECAST`.
- `scripts/forecast/model/`: `senate_mode.py`, `poll_daily.py`, `dynamic_mode.py`, and the new
  `lowess_trend.py` and `site_poll_sync.py`, plus the updated poll files for Texas, Iowa, North
  Carolina, South Carolina and Maine. They are reference copies.
- The OnPoint Senate and Governor pages were republished from this run.

## Vermont governor re-run, Sept 28

Only Vermont governor was re-run, with the Braun Research poll of Sept. 10 to 21: Scott 44,
Janoo 34, 817 likely voters, margin of error 3.4. Every other race keeps the numbers above.

| | Before | Now |
|---|---|---|
| Vermont margin | Janoo +6.5 | Scott +0.8 |
| Janoo win chance | 84.5% | 46.0% |
| Governors, Democratic control | 88.4% | 85.6% |

Vermont now leans to Scott, so projected governors go from 23 D and 13 R to 22 D and 14 R.

Vermont has 4 polls, too few for LOWESS, so it uses the PSI weighted average, which moved
from Janoo +5.9 to Scott +5.5. Braun Research carries 72% of that average. It has no
pollster grade, and the scorecard gives an unrated firm a quality weight of 0.60, while the
University of New Hampshire, graded C-, gets 0.15.

## Georgia governor re-run, Sept 28

Only Georgia governor was re-run. It picked up two new polls, and every other race keeps the
numbers above. Big Data Poll's Sept. 21 to 23 survey was already in.

| Pollster | Field dates | Sample | Jackson | Bottoms |
|---|---|---|---|---|
| InsiderAdvantage | Sept. 22 to 23 | 1,200 LV | 48 | 46 |
| YouGov | Sept. 15 to 18 | 3,299 LV | 46 | 44 |

YouGov published a registered voter result and two likely voter screens. The model and the
site use the first likely voter screen, as with other multi version releases, and the site
note lists the other two.

| | Before | Now |
|---|---|---|
| Georgia margin | Bottoms +2.1 | Bottoms +1.8 |
| Bottoms win chance | 66.4% | 64.3% |
| LOWESS polling average, 12 polls | Jackson +2.4 | Jackson +2.2 |
| Governors, Democratic control | 85.6% | 84.9% |

The new polls moved the polling average slightly toward Bottoms, but with two more polls the
polling leg now carries 46% of the blend, up from 41%. The polling leg favors Jackson, so the
race moves slightly his way.

## Nevada and Arizona governor re-run, Sept 28

Only these two races were re-run. Both were missing their early 2026 polls, from before the
primaries, in the model and on the site. They are now in both places. Every recent poll was
already there, so the newest polling is unchanged. Every other race keeps its numbers.

Nevada, three polls added:

| Pollster | Field dates | Sample | Lombardo | Ford |
|---|---|---|---|---|
| Global Strategy Group | May 5 to 11 | 700 LV | 45 | 42 |
| Noble Predictive Insights | March 10 to 13 | 845 RV | 39 | 38 |
| Hart Research | Feb. 11 to 17 | 800 LV | 46 | 43 |

Arizona, four polls added:

| Pollster | Field dates | Sample | Hobbs | Biggs |
|---|---|---|---|---|
| Noble Predictive Insights | May 5 to 7 | 996 RV | 41 | 37 |
| TIPP Insights | April 20 to 24 | 1,159 LV | 48 | 38 |
| Noble Predictive Insights | Feb. 23 to 26 | 1,023 RV | 42 | 35 |
| Center for Excellence in Polling | Jan. 22 to 24 | 519 LV | 50 | 41 |

TIPP's registered voter version, 1,501: Hobbs 45, Biggs 35, is left out, so the poll counts
once.

| | Before | Now |
|---|---|---|
| Nevada margin | Ford +5.7 | Ford +5.5 |
| Ford win chance | 85.2% | 82.4% |
| Nevada LOWESS average, 12 polls | Ford +2.0 | Ford +1.8 |
| Arizona margin | Hobbs +8.7 | Hobbs +9.5 |
| Hobbs win chance | 94.4% | 94.8% |
| Arizona LOWESS average, 20 polls | Hobbs +2.5 | Hobbs +3.8 |
| Governors, Democratic control | 84.9% | 84.4% |

Arizona moves most because the long-term trend now carries Hobbs's stronger spring polling.
The recent trend is still Hobbs +1.3, and the long-term trend is Hobbs +5.4. The PSI weighted
averages barely move, because the older polls get almost no recency weight.

# Governor forecast depolarized, all 36 governor races re-run, Sept 28

Governor races are more local than Senate races, and the model had treated them the same. Every
governor race was re-run with the change below. Senate and House numbers do not change.

## The evidence

The model's own certified results cover 108 governor races in 2014, 2018 and 2022. On them:

- The statewide governor vote followed the state's presidential lean at about 0.4 to 0.6 of full strength. On the same data, Senate races followed it at 1.0.
- It followed the national House vote environment at about 0.45.
- Held out one cycle at a time:

| Setting | Miss, points of margin | Winner right |
|---|---|---|
| Fully partisan, as before | 19.5 | 82.1% |
| 0.8 national, 0.8 lean | 16.8 | 83.0% |
| **0.6 national, 0.6 lean, now used** | **15.0** | **84.9%** |
| 0.5 national, 0.5 lean | 14.6 | 84.9% |

0.6 is the conservative end of the settings that help, since the model also has measured personal
votes and polls. With it, the average miss left in a single cycle falls from as much as 4.6 points
of margin to 1.5 or less, and deep red states come out unbiased. Deep blue states still lean more Republican than
the rule predicts, the Baker, Hogan and Scott pattern, so the rule is if anything cautious there.

## What changed in the model

- **Fundamentals.** The approval and census legs keep their county pattern. Their statewide level now counts the national environment at 0.6 and the state's lean against the nation at 0.6.
- **Polls.** They are untouched. In a well polled race the polling leg still carries most of the weight.
- **Incumbents.** A sitting governor's personal vote is now measured against the same depolarized baseline. The crossover every governor gets from compression is no longer also counted as that governor's own vote.
- **Simulations.** Each governor race shares 0.6 of the national vote shock and of the national group vote shocks. The rest becomes its own, so each race is as uncertain as before but less tied to the others. Turnout shocks stay national, since governors share the ballot with the Senate.

## Results

| | Before | Now |
|---|---|---|
| Democratic control of governorships | 84.4% | 84.0% |
| Average Democratic governors | 28.5 | 28.0 |
| 80% range | 25 to 32 | 25 to 31 |

No race changed favourite. The biggest moves are in states with no polls or few polls, where the
partisan lean had set the level:

| Race | Before | Now |
|---|---|---|
| Wyoming | R+37.5 | R+25.9 |
| Hawaii | D+42.9 | D+33.3 |
| Colorado | D+24.2 | D+16.7 |
| Oklahoma | R+20.0 | R+12.8 |
| California | D+27.6 | D+23.2 |
| South Dakota | R+10.5 | R+6.2 |
| Vermont, Scott | R+0.8 | R+4.8 |
| Alabama | R+15.1 | R+11.3 |
| Wisconsin | D+7.6 | D+5.2 |
| Nevada | D+5.5 | D+3.2 |
| Arizona | D+9.5 | D+7.6 |
| New Hampshire, Ayotte | R+6.6 | R+8.8 |
| Georgia | D+1.8 | D+0.9 |
| Florida | R+1.5 | R+0.8 |

Settings: `GOV_DEPOL=1 GOV_BETA=0.6 GOV_LAMBDA=0.6`, the default. `GOV_DEPOL=0` gives the old model.
The backtest is in `scripts/forecast/model/depolarization/`.
