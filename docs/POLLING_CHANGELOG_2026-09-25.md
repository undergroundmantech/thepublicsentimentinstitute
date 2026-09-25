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
