# Polling averages: national refresh and the state map, 25 September 2026

Three things: the national series were refreshed off the RCP tables, fifteen state polls
were added after checking Wikipedia, RCP and the pollster releases, and the Polling
Averages page gained a clickable state map for the 2026 Senate and governor groups.

## Where the averages land

| Series | PSI average | RCP flat average |
|---|---|---|
| Trump job approval | **40.3 / 58.3**, net −18.0 | 38.9 / 59.7, net −20.8 |
| Generic ballot | **D 51.3 / R 43.4**, D+8.2 | 50.6 / 41.9, D+8.7 |

PSI runs two to three points friendlier to Trump than RCP on approval. That is the
pollster-grade weighting doing its job, not a data gap: Rasmussen, Quantus, Big Data and
Trafalgar all carry weight multipliers here and all sit on the high side of the approval
range, while RCP averages every included poll flat.

Approval now runs through 24 September, the generic ballot through 22 September.

## National polls added

Fifteen approval polls and fifteen generic-ballot polls from the supplied RCP tables.
The approval feed now runs through the 20 to 24 September Rasmussen wave; the generic
ballot through the 21 to 22 September Emerson wave.

Six approval rows already existed under the same pollster and end date but with different
figures. They split into two kinds:

**Reconciled to RCP** because the difference was a rounding or transcription drift and RCP
is the source the update was built from.

| Poll | Was | Now |
|---|---|---|
| Big Data Poll, 15 Sep | 39 / 59 | 40 / 58 |
| Economist/YouGov, 14 Sep | 40 / 58 | 40 / 59 |
| Marquette, 9 Sep | 41 / 56 | 38 / 62 |

Marquette is the one worth a second look. The field dates check out against the
Marquette Law School release page, 2 to 9 September, but the topline PDF was not
reachable, so this row now rests on the RCP figure alone.

**Left alone** because RCP is quoting a different voter screen of a poll the file already
carries in full. Taking the RCP row as well would enter the same survey twice.

| Poll | File carries | RCP quotes |
|---|---|---|
| Reuters/Ipsos, 14 Sep | 1,143 adults, 35 / 62 | 896 RV, 39 / 61 |
| NY Times/Siena, 13 Sep | 1,503 RV, 37 / 59 | 1,503 LV, 38 / 59 |
| Economist/YouGov, 8 Sep | 1,469 RV, 31 / 66 | 1,019 LV, 37 / 61 |

Three Rasmussen generic-ballot rows were added even though the file had carried no
Rasmussen on that series before. They are in the RCP table, so they are in.

## State polls added

Fifteen, each confirmed against a pollster release or a news report that stated the field
dates and sample.

**Senate.** Ohio gained two, Bowling Green State/YouGov 1 to 10 September and Trafalgar
14 to 16 September, both from the special-election page rather than the regular one.
Alaska gained co/efficient 14 to 17 September. South Carolina gained Rasmussen 14
September. Texas gained NBC News/Marist 17 to 20 September.

**Governor.** Idaho, Arkansas, Pennsylvania, New York (two), Tennessee, Alaska, Texas
(two) and Iowa. The Pennsylvania and New York additions are the ones that move a board:
Siena/NYT/Inquirer has Shapiro at 58 to 38, and Quinnipiac has Hochul at 58 to 39 against
Siena's 50 to 41 in an overlapping field. Both were verified directly rather than through
an aggregator.

**Alaska governor carries a caveat.** That race is a top-four ranked-choice contest with
four candidates on the ballot. The AARP/Fabrizio Ward and Impact Research survey asked
the full field and then simulated the final round; what is stored is that simulated final
round, flagged in the row's `notes`. It is the closest analog to a two-way number, not a
two-way number.

**Two reported finds were rejected as duplicates.** A "SurveyUSA, 16 September, 654 LV,
Klobuchar 47 Demuth 40" for Minnesota and a "DHM Research, 11 September, 600 LV, Kotek 43
Drazan 45" for Oregon both turned out to be release dates printed against polls the files
already carried under their true field dates, 9 to 14 and 3 to 9 September. Sample sizes
and toplines matched exactly.

**Still unpolled.** Seven Senate races (CO, DE, IL, NJ, OR, WV, WY) and five governor
races (CO, HI, OK, SD, WY) have no public general-election poll at all. Those states stay
flat on the map rather than being filled in from the forecast.

## The state map

The Polling Averages page now opens the 2026 Senate and 2026 Governor groups with a
clickable map above the tile strip. Twenty-eight Senate races and thirty-one governor
races are on it.

- Each state is filled with the **leading candidate's own series colour**, not with red or
  blue by party. Montana, Nebraska, Idaho and South Dakota therefore read as independent
  amber where an independent leads, instead of as a washed-out major party.
- Opacity carries the margin, deepening to 20 points. A state with no public poll is left
  flat and is not clickable.
- Clicking a state, or tabbing to it and pressing Enter, selects that race. The headline,
  chart, crosstabs and poll table all follow, and the URL updates so the view is
  shareable.
- The nine states too small to hit at this scale (VT, NH, MA, RI, CT, NJ, DE, MD, DC)
  repeat as chips down the right-hand side, carrying the same margin text and the same
  click target.
- A readout strip under the map names the hovered or selected race, its margin, and how
  many polls stand behind it.
- Texas carries two Senate matchups. The map shows the better-polled one; both stay
  reachable from the tiles.

**Geometry is compiled, not fetched.** `app/polling/lib/usStatePaths.ts` holds the state
outlines already projected through `geoAlbersUsa`, generated by
`scripts/polling/gen-state-paths.mjs` from the `us-atlas` package. The page pulls it in
with a dynamic import, so it costs nothing on the national and 2024 views, needs no CDN
call at view time, and cannot half-render because a third-party host was slow. Regenerate
it only if the viewBox changes.

## Contrast

Two fixes on this page, both the same class of bug as the site-wide pass the day before.

- `.pa-cat.is-active` set `color: var(--canvas)` on `background: var(--canvas)`. The
  active category pill was canvas text on a canvas ground, so it read as blank in both
  themes. It now takes the ink ground.
- The map's own state strokes were first drawn in the canvas colour, which is near black
  in dark mode, so low-margin states merged into the page. Strokes are now ink-derived and
  every shape sits on a neutral base layer, so a shallow tint composites the same way in
  both themes. Checked at 1280px and 400px, light and dark, with no horizontal overflow
  and no console errors.

## Verification

- `npx tsc --noEmit` exits 0.
- `npx next build` fails with exactly three errors, all Google Font fetches from
  `app/layout.tsx`, a file untouched by this change. That is the sandbox's network, not
  the code, and it is the same failure this repo saw before these edits.
- The averages above were recomputed by running the site's own `buildDailyWeightedSeries`
  over the edited data files, not read off the rendered page.
- Map interaction was checked in a real browser: 28 live Senate shapes, 31 live governor
  shapes, three Senate chips and six governor chips, a click on Georgia moving the
  headline to Georgia, and a `?race=` deep link selecting and outlining the right state.

## Open

- The map's fill is a two-way margin, the same limitation the forecast desk carries. In
  Rhode Island's governor race the average is drawn as Foulkes against Guckian while the
  forecast projects Ken Block second. The tile and the race page are where that shows.
- Thirteen races run on a single poll, several of them months old. Alabama Senate, New
  Mexico Senate, Oklahoma Senate, Tennessee Senate, Maryland governor and Illinois
  governor are averages of one. The map shades them like any other state, which overstates
  how much is known about them.

---

# County forecasts on the desk, same day

Four fixes, found by sweeping every race rather than by looking only at the one reported.

**Alaska and Hawaii were drawing no county map at all.** The desk carried a hand-written
exclusion list, `NO_DETAIL = new Set(["AK", "HI"])`, on the reasoning that a state with a
single at-large district ships no county file. Both do ship. `AK.json` carries all 30
boroughs and census areas, `HI.json` all four island counties, and `counties.json` carries
a complete forecast row for every one of them, including the full four-candidate share
vector for the Alaska Senate race. Three races were showing "no county detail — the model
prices this race statewide" over data sitting right there: **Alaska Senate, Alaska Governor
and Hawaii Governor**, plus both at-large House seats.

The layer now draws whenever the state file actually has counties, and the district/county
toggle appears only where a state has more than one district. A single-district state opens
on its counties, since there is nothing to toggle between.

**Two candidates named Sullivan were both labelled "Sullivan".** The county tooltip prints
surnames. Alaska's Senate race runs Dan S. Sullivan against Dan J. Sullivan, and Oregon's
runs David Brock Smith against Brett Smith, so two rows in the same tooltip read
identically and the reader had no way to tell which was which. Where a surname repeats on a
ballot, those candidates now get their full name and the rest keep the short one.

**House county tooltips printed rounding dust.** The "other" row is computed as total minus
Democratic minus Republican, and in small counties that came out as a single vote at 0.0
percent. It now appears only when it rounds to something, and reads "other candidates".

**Sixteen House races were rendering a placeholder as a forecast.** Where the build cannot
price a ballot it parks the race at a flat 100-point margin with an empty candidate list.
The desk was dressing that up: "Neal favored by 100.0 · 100% to win", a vote line reading
`Neal 0 · 0.0%`, an opponent named **"ballot"** because the surname routine took the last
word of "No Republican on the ballot", and a simulated distribution whose ticks bracketed
"D+100.0 to D+100.0".

Those races now say what is true. Seven are genuinely unopposed (PA-03, NJ-08, MA-01,
MA-02, MA-05, MA-07, WI-02) and read "unopposed — no major-party opponent filed". Nine are
California top-two contests where both finalists come from the same party (CA-04, 07, 11,
12, 14, 29, 34, 37, 40) and read "the model does not price this ballot". The empty vote line
is gone, the placeholder name prints whole, and the distribution is replaced by a note
saying why there is no curve.

## What is still wrong, and is not a desk bug

**The nine California top-two races have the wrong party on one candidate.** CA-11 is Scott
Wiener against Connie Chan, both Democrats, and the model file labels Chan a Republican.
CA-40 is Ken Calvert against Young Kim, both Republicans, with Calvert in the Democratic
slot. The party comes from slot position in the pipeline, not from the candidate, so the
board paints these districts a full 100 points toward a party that is not actually being
opposed. Correcting it means fixing the party assignment where the race file is built; it
cannot be patched honestly in the desk, so it is named here rather than hidden.

**House county shading is the statewide House vote, not the district's.** County rows are
stored once per state under `house-<ST>` and every district in that state reads the same
map, so the county layer under FLORIDA 22ND is Florida's projected House vote by county.
The caption now says so outright. The source House county file carries only Democratic and
Republican counts, with no per-candidate breakdown, which is why 168 House districts with a
third candidate on the ballot show that candidate on the race page but not in the county
tooltip. Fixing that needs district-level county output from the House model.

## Verification

- All 506 races resolve a county key, and every county polygon in every state file has a
  forecast row. Zero unshaded polygons.
- A browser sweep of all 71 Senate and governor races: every one drew a complete county
  map, no JavaScript errors. Before this change, three drew nothing.
- Both uncontested shapes checked in light and dark.
- `npx tsc --noEmit` exits 0.

---

# Alaska Senate: the headline and the odds named different winners

The board was reading **Peltola +1.4** next to **Sullivan 57% to win**, which is not a
close call rendered awkwardly. It is two numbers that disagree about who is ahead, printed
side by side.

## What was wrong

Alaska is ranked choice, and the pipeline treats it specially. The head-to-head margin the
model simulates is not the number that decides the race, so the build swaps the headline
for the ranked-choice final round:

```python
margin = round(rcv["pct"][0] - rcv["pct"][1], 2) if rcv else mg
side   = side_from_sims(sims, margin, prob=1 - prob_d)
```

The swap only reached the headline. `p10`, `p90` and the whole outcome curve were still
read off the unshifted head-to-head vector, and `prob` still came from the run summary's
`win_prob_dem_side`, which is computed on that same unshifted vector. So the page carried:

| | value |
|---|---|
| headline margin, from the RCV final round | **D+1.36** |
| median of its own 2,000 simulations | **R+0.57** |
| win probability, from the unshifted run | **R 56.6%** |

A 1.93-point gap that straddles zero, so the two halves of the page named different
winners. For scale, every other race on the board agrees with its own simulation to about
a quarter of a point, and the 90th percentile of that gap is 0.57. Alaska was more than
three times the worst normal case, and the only one large enough to change the answer.

The gap is the ranked-choice transfer effect: Peltola leads first choices by 2.4 but the
head-to-head simulation sits slightly Republican, and the final-round tabulation puts her
1.4 ahead. That effect belonged in the distribution and was never applied to it.

## The fix

`side_from_sims` takes a `recenter` flag, set wherever the caller replaces the headline
with a figure the simulation does not itself produce — in practice, a ranked-choice race.
It shifts the whole simulated vector so its median lands on the reported margin before
anything is read off it, and then takes the probability from the shifted vector rather
than from the run summary, which would otherwise disagree by construction.

This assumes the transfer effect is constant across simulations. That assumption is
already built into publishing a single final-round number, so it adds nothing new; it just
applies it consistently instead of to one field out of four.

The same correction was applied to the shipped `model.json` so the site is right now
rather than after the next run:

| | was | now |
|---|---|---|
| Alaska Senate, probability | R 56.6% | **D 60.4%** |
| Alaska Senate, p10 / p90 | D+6.3 / R+7.7 | **D+8.5 / R+5.5** |
| Alaska Governor, probability | D 98.9% | D 99.1% |

Alaska Governor is the other ranked-choice race. Its gap was 0.61 and never crossed zero,
so nothing visible changed there.

Sanity check on the new number: a 1.36-point lead against a spread whose 10–90 band is
about 14 points wide implies roughly a 60% win probability. It lands on 60.4.

The board now reads the same way under all three colour-by views — margin, odds and
rating all say Tilt D, Peltola, 60.4%.

## Two smaller things found alongside it

**Every Republican in the race was tagged "incumbent".** The projected-ballot row decided
the tag by party rather than by person, so in a race running three Republicans it printed
"incumbent" against Dan J. Sullivan and Gerald Heikes as well as against the senator. It
now matches the candidate's name.

**A residual coin-flip.** `house-FL-22` still shows margin R+0.15 against a 49.7%
Republican probability. Both round to a dead heat from opposite sides of zero, which is
rounding on a genuine toss-up rather than a contradiction; it is left alone.

## What this does not fix

The chamber numbers still come from the correlated run, which used Alaska's unshifted
vector. Alaska moving from 43.4% to 60.4% Democratic adds about **0.17 expected Democratic
Senate seats**. That will not move the median off 52, but the published 71% Senate control
figure is now a fraction of a point stale and only a re-run will propagate it properly.
Recomputing the correlated distribution here would mean simulating it without the vectors,
which is guessing.

---

# Senate re-run and independents, 25 September 2026

All 35 Senate races re-run through `dynamic_mode.py` at `AS_OF=2026-09-25`, and every
independent on the board now reads as an independent rather than as a Democrat.

## The re-run

Five polls the site's own files carried had never reached the model: Bowling Green
State/YouGov and Trafalgar in Ohio, co/efficient in Alaska, Rasmussen in South Carolina
and NBC News/Marist in Texas. Ohio's two were missed because that race is the special
election and its polling table lives on a different page. All five are in.

**The first attempt used the wrong driver.** `senate_mode.py` produces the deterministic
county forecast and nothing else — no simulations, no win probabilities, no ranges.
`dynamic_mode.py` is the one that runs the 2,000 elections. Re-run on that.

The board barely moves, which is the expected result for five polls across four states:

| Race | was | now | |
|---|---|---|---|
| Texas | D+2.40 | **D+3.01** | NBC/Marist |
| Ohio | D+5.51 | **D+4.91** | Trafalgar pulls it back toward Husted |
| Idaho | R+13.45 | R+12.96 | |
| South Carolina | R+1.84 | R+2.22 | Rasmussen |

No leader changed. Every other race moved under 0.4, which is the as-of date advancing a
day. Senate control stays at **71%**, median 52 seats. The governor and House boards were
not re-run and are byte-for-byte unchanged.

## Alaska, properly this time

Earlier today I recentred Alaska's simulated distribution onto the page's ranked-choice
margin of D+1.36, on the assumption the page was right and the simulation had drifted.
**The page was the thing that was wrong.** The re-run settles it, and the answer is more
interesting than either number:

| | |
|---|---|
| First choices | **Peltola 44.0, Dan S. Sullivan 41.6** — Peltola +2.5 |
| Ranked-choice final round | **Sullivan 50.3, Peltola 49.7** — Sullivan +0.6 |
| Win probability | Sullivan 55% |

Peltola leads the first count. She loses the final round because the transfer assumption
sends 50.3% of the other two Republicans' second choices to Sullivan against 28.8% to her,
with 20.9% exhausting. A 2.5-point first-choice lead becomes a 0.6-point deficit.

The page now shows both, labelled, instead of one number that disagreed with the odds
printed beside it. The recentring logic stays in — it is what keeps the margin, the
probability and the curve describing the same quantity — but with a consistent run behind
it the shift it applies is now negligible rather than 1.9 points.

**Two pipeline bugs came out of this.** `update_pages.py` decided which races had moved by
comparing the *final round* margin but then wrote the *first choice* margin to the page,
and it never rewrote the `rcv` block at all, so that block kept whatever an older run left
there. Alaska Senate went onto the page as +2.49 when the model's answer was −0.63, and
Alaska Governor as +30.53 against a final round of +12.55. Both now write the final round
and rebuild the `rcv` block from the run, with the first-choice margin carried in its own
field so the page can still show it.

## Independents

Four Senate races run an independent against a Republican: **Nebraska (Osborn), South
Dakota (Bengs), Idaho (Achilles), Montana (Bodnar)**. The build puts whoever is not the
Republican into the `dem` slot, and the desk trusted the slot, so all four were drawn in
Democratic blue and labelled "Democrat".

The desk now reads the party off the candidate list instead:

- The candidate chip is a purple **I**, not a blue D.
- The party word under the odds says **Independent**.
- The margin prints **I+1.3**, not D+1.3.
- The rating band reads **Tilt I / Lean I / Likely I / Safe I** in independent purple.
- The county map shades purple against red rather than blue against red, and the caption
  says "the independent against the Republican".
- The national map, the sixty-day tracker, the correlated-race chips and the crosstab
  margins all take the same tone.

Off the desk: the polling averages page, its state map legend and both ratings pages now
use one independent purple. The polling page also names the party under each candidate's
number, which it never did. An `(I/D)` independent — one who caucuses with a party — reads
as an independent too, rather than being folded into blue.

## Six races had the wrong incumbent

Found while wiring the independent labels, because three of them put the "incumbent" tag on
the challenger.

| Race | was flagged | actually |
|---|---|---|
| Maine | Troy Jackson | **Susan Collins** |
| Nebraska | Dan Osborn | **Pete Ricketts** |
| South Dakota | Brian Bengs | **Mike Rounds** |
| Idaho | Todd Achilles | **Jim Risch** |
| Texas | Ken Paxton | nobody — Cornyn lost the primary |
| South Carolina | Darline Graham | nobody |

The builder looked for either candidate's surname anywhere in the seat note, and the seat
note is free text about how the ballot came to look the way it does. "Democrat withdrew for
independent Dan Osborn" made Osborn an incumbent. Maine's note names both candidates and
the Democrat was checked first, so Collins lost her own incumbency to her challenger.

Only three things in a seat note actually assert incumbency: an open seat, "<name> seeking
a term", and "<name> appointed". A note that merely explains how a nominee got there
asserts nothing, and 0 is the honest answer. Where a note says a party withdrew in favour
of an independent and the seat is not open, the seat is held by the party that did not
withdraw.

**Ohio is still wrong and cannot be fixed here.** Its note is "Special election, Vance
seat", which never says Husted was appointed, so he reads as no incumbent rather than as
the incumbent. That needs the seat note itself edited.

## A House regression caught before it shipped

Rebuilding the site data also rebuilds the House from `/tmp/pvi/house_nogal`, which is an
older House simulation than the one behind the published board. It silently rewound **415
districts**, flipped ME-02 from D+2.0 back to R+1.8 — undoing yesterday's Maine change —
and moved House control from 85.25 to 84.75. The House was not re-run and must not move, so
it is pinned to the published values. Worth knowing before the next build: that path needs
repointing at the current House run.

## Verification

- All 35 Senate races completed; the run summary carries simulations, win probabilities and
  ranges for every one.
- No race's headline margin and win probability name different winners any more, except
  `house-FL-22` at R+0.1 against 55% Democratic, which is a genuine coin flip reported from
  two model outputs that round either side of zero.
- Largest gap between a headline margin and the median of its own simulations is now 0.33,
  down from Alaska's 1.93. Median 0.10.
- Zero unshaded county polygons across all 506 races.
- House: 0 districts differ from the published board; all three chamber blocks identical.
- `npx tsc --noEmit` exits 0, no console errors in either theme.

---

# Alaska Senate and Governor re-run with the full Alaska poll table

Only these two races were re-run. Every other race, and every House district, is unchanged.

## What the model had been averaging

The Alaska Senate model was running on **three** polls: Rasmussen, the August Alaska Survey
Research head to head, and co/efficient. The site's own poll file carried ten. Alaska
Governor was running on **none**, flagged `no_polls`, so its level came entirely from the
fundamentals and 2024 legs.

## How each poll entered

One row per poll, in the form that fits how the model reads a ranked-choice race.

**Senate.** Where a poll published a ranked-choice final round, the final round is used,
because that is the count that decides the race and the model treats it as already final:
Alaska Survey Research 52 to 48, Fabrizio Ward and Impact Research 53 to 47, Data for
Progress 52 to 48. Two-way ballots enter as head to heads. Multi-candidate ballots with no
final round enter as first choice and are run forward through the transfer assumption.
Each poll that appeared both as a ranked-choice table and a first-past-the-post table was
entered once. Fabrizio Ward and Impact Research is a bipartisan AARP poll and carries no
partisan discount.

**co/efficient was corrected.** It had been carried as 46 to 48, which is its first-choice
ballot mislabelled as a head to head. Its actual head to head is Sullivan 49, Peltola 46.

**Governor.** The governor model runs the count forward itself from the first-choice split
between Kreiss-Tomkins and the whole Republican field, so both polls enter as that split:
co/efficient 43 against 43, Fabrizio 40 against 41. Fabrizio's own final round of 55 to 45 is
therefore not the number the model uses, but the model's result lands close to it.

## Results

| Race | was | now |
|---|---|---|
| Alaska Senate, final round | Sullivan +0.6, 45% | **Peltola +3.5, 77%** |
| Alaska Senate, first choice | Peltola +2.5 | Peltola +6.5 |
| Alaska Governor, final round | Kreiss-Tomkins +12.6 | Kreiss-Tomkins +12.5, >99% |

The Senate move comes from the three published final rounds, which all have Peltola ahead
by 4 to 6 points. The model had been getting its final round only from its transfer
assumption applied to first choices, and that assumption sends Republican second choices
to Sullivan more heavily than those polls' own final rounds show.

## Chamber odds were stale on every run today

The desk takes Senate and governor control from the published pages' `odds` block, and no
script ever rewrote that block. It still carried the 24 September figures. The Senate re-run
earlier today happened to agree to within rounding, 70.6 against 71, so nothing looked
wrong. Alaska does not agree:

| | was | now, from the simulations |
|---|---|---|
| Senate control, counting Osborn | 71% | **75%** |
| Senate control, without Osborn | 70% | 74% |
| Senate median seats | 52 | **53** |
| Governors control | 85% | 86% |

Both blocks are now computed from the 2,000 correlated runs.

## Two small fixes found in checking

- Recentring a ranked-choice simulation onto its headline now happens only when the two
  disagree by more than 0.75 points. On a consistent run the headline is the simulated mean,
  a tenth or two off the median, and recentring on that inflated Alaska Senate from the
  run's 77.1% to 78.5%.
- The probability formatter printed exactly 99.5% as "100%", the one number it exists to
  keep off the page. It prints ">99%" now.

---

# Texas Senate and Governor re-run with the full Texas poll tables

Only these two races were re-run. Every other race, and every House district, is unchanged.

## A bug of mine, found by this request

Earlier today I added the Marist poll to the Texas Senate race through `EXTRA_POLLS`. That
dictionary already had a `"TX"` entry, and a Python dict literal keeps only the last copy
of a repeated key, so the new entry silently replaced the old one. **Texas Southern,
Trafalgar, Emerson and ReconMR/Siena, all September polls, dropped out of the Texas Senate
average** and stayed out through the full Senate re-run. They are back, and there are no
repeated keys left in `EXTRA_POLLS`.

## What changed in the inputs

Both races now read their polls from one file each, built from the full tables supplied,
rather than from a docx plus scattered additions:

| Race | polls in the model | was |
|---|---|---|
| Texas Senate | 39 | 23 |
| Texas Governor | 35 | 25 |

New to the Senate: Texas Public Opinion Research September 19 to 22, the four September polls
above, and the spring and 2025 polls that had never been carried. New to the governor:
Texas Public Opinion Research, Marist, Texas Southern, Emerson and ReconMR/Siena from
September, plus the January and February polls.

Two consistency changes: Fabrizio Ward and Impact Research, and Beacon and Shaw, are
bipartisan teams and are now treated that way in the Senate race, as the governor race
already treated them, rather than taking the partisan discount. Overton published a leaned
and an unleaned ballot; both are carried and averaged, the existing convention for this race.

## Results

| Race | was | now |
|---|---|---|
| Texas Senate | Talarico +3.0, 69% | **Talarico +2.9, 70%**, Lean D |
| Texas Governor | Abbott +5.2, 84% | **Abbott +3.8, 78%**, Lean R |

The Senate barely moves: the four restored polls and the new Texas Public Opinion Research
poll average out near where Marist had already put it. The governor moves 1.4 toward
Hinojosa, because the model had been missing Marist and ReconMR/Siena, both of which have
her ahead, and Texas Southern and Emerson, which have Abbott ahead by less than his average.

Senate control rounds from 75 to **76%**; median stays 53. Governors unchanged at 86%.

The site's polling-average page reads the same polls: Talarico +2.4, Abbott +3.3.

---

# Why the rest of the site was not updating

Only `/forecast` reads `public/forecast/model.json`. Everything else that shows Senate
numbers reads one of two hand-typed tables that were last edited on 23 September:

- `app/components/senateModel.ts`, read by the home page swarm, both coverage globes, the
  electoral map, the situation room and the publish deck.
- `SENATE_RAW` and `GOV_RAW` inside both `/forecastratings` pages.

So every re-run today reached one page. The home page still had Alaska at D+6.5, Maine
at D+13.0, Nebraska on the Democratic side and Ohio at D+0.9.

`scripts/forecast/sync_site_numbers.py` rewrites both tables from `model.json` and prints
every value it changed: 175 on this run. `senateModel.ts` is now marked as generated.
It has to be run after each forecast build.

---

# Iowa Senate re-run with the full Iowa poll table

Only Iowa Senate was re-run. Every other race, and every House district, is unchanged.

The race now reads its polls from `polls_ia.csv`, built from the full table, rather than
the docx plus an `EXTRA_POLLS` entry, the same move made for Texas. 20 polls, up from 17;
the three new ones are the pre-primary Echelon, GQR and Change Research polls. Polls
published in two versions follow the existing conventions: YouGov and Abacus keep their
likely voter version, and co/efficient's two ballots are averaged. Beacon and Shaw is
treated as bipartisan, as in Texas.

| | was | now |
|---|---|---|
| Iowa Senate | Turek +0.6, 54% | **Turek +0.5, 54%**, Tilt D |

It barely moves because every poll the model was missing is from before the June primary
and carries almost no weight on 25 September.

## Worth a decision: how little Marist counts

Marist is the newest Iowa poll and the only one with Turek clearly ahead, 50 to 42, and it
carries **2.5%** of the average. Trafalgar carries 32%. Three things stack:

- The TPSI scorecard grades Marist **C**, weight 0.25. Trafalgar is A-, weight 1.70.
- It is a registered voter sample, weighted a third of a likely voter one.
- 5% undecided takes it to 0.15 on the undecided penalty.

The scorecard is a TPSI editorial choice, so it was left alone. But it is the single
biggest reason this race sits at a coin flip rather than leaning Turek.

**A matching gap in the same scorecard.** "New York Times/Siena University" matches no
entry and falls through to unrated, weight 0.60, which is *higher* than the C+ 0.50 the
scorecard assigns "siena/nyt". That name is how the Maine, New Hampshire and Michigan
Senate files record their September Siena polls, so the gap favours those polls slightly
in three live races. Not changed here, since only Iowa was asked for.
