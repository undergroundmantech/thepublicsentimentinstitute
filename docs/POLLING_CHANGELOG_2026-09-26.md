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
