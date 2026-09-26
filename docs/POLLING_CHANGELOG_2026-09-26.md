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
