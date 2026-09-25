# Forecast changes, 24 to 25 September 2026

Run behind this build: senate and governor `fc_v14`, House `house_v5`, at
`APPROVAL_SRC=combined`, `AS_OF=2026-09-24`, `HIST_COMP_CENTER=0.0452`.

Current board: **Senate 71** counting Osborn and 70 without, median 52 seats.
**Governor 85**, median 29. **House 85.25**, mean 240.1 seats.

## Model changes

**Recency tilt.** Polling, fundamentals and the primary terms all carry more weight
relative to the 2024 presidential baseline. Worth knowing: M3's statewide level *is*
the polling average, so raising M3 raises polling. History only supplies the county
pattern inside a state. The leg carrying a historical level is M2, anchored on the
certified 2024 result, and that is the leg that lost weight.

| Lever | Was | Now |
|---|---|---|
| Proximity anchors | 0.45 / 0.65 / 0.80 | 0.48 / 0.68 / 0.83 |
| M1 share of remainder | 0.529 to 0.556 | 0.570 to 0.590 |
| HIST_W | 0.5 / 0.3 / 0.2 | 0.56 / 0.28 / 0.16 |
| TREND_CARRY | 0.50 | 0.55 |
| K_PRIMARY_PARTY | 0.30 | 0.33 |
| K_PRIMARY_CAND | 0.15 | 0.17 |
| K_UNITY | 0.025 | 0.028 |

Effect across 71 races: median shift 0.19, no leader changes. Reversible with
`NO_RECENCY=1`.

**Governor incumbency, systematic.** A sitting governor's personal vote, measured as
the county gap between their own past races and the nearest presidential race, now
applies to all 17 sitting governors on the ballot and to none of the 19 open seats.
It had been hand applied to two races, which the source called "the open non
uniformity in this model". Roster checked against the sitting governor list, not
inferred from candidate slots.

The first version was biased and was not shipped. The raw gap treats the whole
difference between a governor's last race and the presidential year as personal vote,
when much of it is the national swing between those cycles. Every governor elected in
2022 was compared against 2020 and inherited the same 7.3 point Republican lean.
Uncentred, 13 of 16 races moved Republican. Each pair is now centred on the national
House vote for that year against the presidential two party share, and the result is
balanced: 9 races moved Democratic, 8 Republican.

Primary turnout modulates the carry rather than adding a second term, because the raw
primary signal is already in the generic unity term. It applies where the incumbent's
own primary was contested, 6 of the 17.

**Open assumption:** the 0.612 carry rate was fitted on 192 House districts, not on
governors, and now drives 16 races. Vermont's term is 42 points, Pennsylvania's 15.

## Bugs fixed

**Frozen poll cutoff.** `AS_OF_DAILY` was hardcoded to 2026-09-21 while the forecast
ran at 2026-09-24. The last day of the daily series *is* the polling average, so
**every poll ending after 21 September contributed nothing** while still counting
toward the pollster house count, raising the weight on the polling leg without
entering its level. Seven polls across six races were affected. Now follows `AS_OF`.

**Stale published win probabilities.** The page updater rewrote margins, county rows
and crosstabs but never touched a race's `sim` block or the prose quoting it. Both had
been carried unchanged since the 22 September run, so 34 of 71 races were publishing a
stale win probability, Vermont's by 45 points and pointing the opposite way from its
own headline margin. All 71 now rebuilt from the run.

**Silent crosstab and county loss.** Rebuilding a race from the forecast CSVs drops
four crosstab cuts (Direction of the country, Top issue, Affording daily costs, Vote
history) and the county fields `e` and `pw`, because none come from the CSV. Now
merged back in published order, with `e` taken fresh from the run's elasticity column.

**House page truncation.** The House updater looked for a publish skeleton marker the
working copy does not carry, and `find` returning -1 sliced 20 characters off the front
of the page on every run. Two runs ate the page's `<title>` line.

**Site served stale numbers.** The data builder read simulations from the old output
directory and chamber odds from stale page extracts. The site had been showing Senate
75, Governor 83 and House 89.05 against published values of 71, 78 and 85.1.

**Poll dedupe.** The key was source plus the raw field-dates string, so the same poll
entered under two spellings, `July 15-20 2026` against `July 15-20, 2026`, survived as
two rows. Punctuation and case are now stripped and the end date is included.

**Partisan discount.** The weight penalty matched `(D)` and `(R)` but not `(I)`, while
the nonpartisan house count matched all three, so an `(I)` labelled sponsored poll was
kept out of the house count but never discounted. Now aligned.

**daysOut.** Was the literal `42`, written when UPDATED was 2026-09-22 and never
changed, so the site kept saying 42 days to go on every later run. Derived now.

## Polling added

Thirteen polls, all verified against the release documents rather than a secondary
report, and all now carried in `app/polling` as well as in the model.

- **UNH New England wave, 17 to 21 September**, six states fielded together: NH senate
  and governor, ME senate and governor, MA senate and governor, RI senate and governor,
  CT governor, VT governor. Sample sizes 1,418 / 1,312 / 835 / 598 / 564 / 540 likely
  voters. A widely shared summary of this wave put Deaton at 40 in the Massachusetts
  senate race; the release says 30, and 53 plus 40 plus 9 would total 102.
- **Big Data Poll "Peach State Poll", 21 to 23 September**, 678 likely voters, Georgia
  senate and governor. The initial ballot is carried, not the leaned figures, because
  the model allocates undecideds itself.
- **GBAO for Working Class Majority PAC, 3 to 8 September**, 800 likely voters,
  Nebraska senate. Carries 0.36 percent of Nebraska's weight: the scorecard grades GBAO
  F at 0.01. Nebraska is effectively one unrated pollster's call, Wedgewood at 89.9
  percent of the weight.
- **Maine House**, ME-01 and ME-02 from the same UNH wave. ME-02 moved from Tilt R to
  Lean D.

## Desk UI

**Every candidate is now carried through to the site.** The forecast data had only
`dem` and `gop` as single names with an aggregate `other` vote, so the desk showed
233 of the 506 races as two way contests when they are not. Rhode Island governor was
being drawn as Foulkes against Guckian while the model projects **Ken Block second at
24.0 against the Republican's 22.9**.

- `model.json` races carry a `cands` list: name, party, projected share and projected
  votes for every candidate the model prices.
- `counties.json` rows gain a fifth slot, the per candidate share in that county, but
  only where a race runs more than two names, so a straight two way race adds nothing.
- The race page gains a **projected ballot** block: a stacked bar plus a ranked list of
  every candidate with share, votes and a track. It renders only where there are three
  or more names.
- The county tooltip shows the whole ballot rather than Democrat, Republican and an
  undifferentiated "other".
- Minor party tones sit outside the red and blue range so a strong independent reads as
  its own thing, not a weak major.

**One honest limitation left in place.** County shading is still a two party margin.
In the four races where a third candidate is projected to finish ahead of a major party
(Nebraska, Idaho and Montana senate, Rhode Island governor) the map caption now says so
and points the reader at the tooltip, rather than letting the colour imply a contest
that is not the one happening.

## Known open items

- One verifier check fails: Rhode Island governor's crosstab Republican share reads
  22.8 against a statewide 22.87, a 0.070 gap against a 0.065 bound. A display rounding
  difference, not a forecast error. The threshold was left alone rather than widened a
  second time; the real fix is to compare before rounding.
- `HIST_COMP_CENTER` is slightly off centre, residual about -0.008, roughly 0.2 points
  nationally. The constant feeds back into the electorate it is measured from, so it is
  not a simple offset. Mapping it properly needs three or four prepasses.
- Thirteen Senate history cycles still run on substitutes because the county files were
  never reachable, including Texas and Georgia losing 2014 entirely, and Alaska
  borrowing a 2018 governor race into its Senate history. 2010 is absent from the model
  altogether.
- No calibration harness. The proximity anchors, the recency tilt and the incumbency
  carry rate are all judgement, none validated against a past cycle.
- Senate median seats is on a knife edge between 52 and 53; a 0.09 point move in one
  race flips it.

## Theme and contrast

Four bugs, two of them site wide. Every text token now passes AA in both themes,
checked by computing the actual rendered colour rather than by eye.

**Custom properties that referenced themselves.** `globals.css` declared
`--font-display: var(--font-display)` and the same for body and numeric; the forecast
desk declared `--fc-bg: var(--fc-bg)` and `--fc-ink: var(--fc-ink)`. A custom property
that references itself is a cycle, which is invalid at computed-value time, so the
property resolves to nothing at all. next/font already declares the three font
variables on `<html>`, so those three lines were removed. The forecast pair is now
literal.

This is what produced the washed out page. Light mode still worked because the light
block assigns literals. **Dark mode had no background at all**, fell through to the
site's light canvas, then painted near white ink on it.

**The theme block was pasted three times.** Same comment, three copies, and the last
two carried the cycle. One block now.

**Raised surfaces drawn in the ink colour.** The desk's light mode set
`--fc-elev: rgba(var(--fc-line-rgb),0.97)`, and in light mode the line colour *is* the
ink, so every tooltip came out a near black card carrying near black text. The home
page had the same inversion on its result rows at 0.95, where every other surface on
that page is a low alpha overlay. Tooltip contrast is now 17.8 in both themes.

**Borders and shadows drawn in the canvas colour.** Eleven places on the home page.
The canvas is near white in light and near black in dark, so at those alphas the border
matched whatever it sat on and disappeared in *both* themes. Edges belong to the ink.

**Active pills that vanished.** `.lp-tabs .is-active` and `.lp-rating-tabs .is-active`
set `background: var(--canvas)` with white text: invisible in light mode. And the fixed
orange ratings card mixed fixed white text with theme dependent text, so half of it
flipped to near black on orange in dark mode while its neighbours stayed white. A fixed
surface takes fixed text.

**`@import` in the wrong place.** The Oswald import sat a hundred lines into the sheet.
`@import` has to be the first rule or the parser drops it, so Oswald never loaded and
every heading fell back to the system condensed face. Hoisted to the top.

Verified: 30 of the desk's 36 ink alphas clear AA for text; the four that do not are
backgrounds and hairlines, not text. All six global tokens clear AA in both themes.
