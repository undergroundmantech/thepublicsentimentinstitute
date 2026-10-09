# Maps

## Data sources already in the repo

- US states: `app/polling/lib/usStatePaths.ts` (`US_STATE_PATHS`, viewBox `0 0 760 440`,
  geoAlbersUsa scale 900 translate [340,220]). The mock's `data/states.json` is this file
  re-exported as JSON. Use the TS import directly on the site.
- Counties: `public/forecast/states/{ST}.json` (`counties[].id`, `counties[].d`).
  County names: `public/forecast/counties.json._n`. County margins and simulated
  votes per race: `public/forecast/counties.json[raceId][fips]` = `[margin, dVotes, rVotes, total, ...]`.
  Margin sign: negative is Democratic lead, positive is Republican lead.
- Race summary: `public/forecast/model.json.races[]` with `stages.rate` as the model
  margin, `pollAvg`, `cands[]`, `open`, `inc`. Chamber odds and seat histogram in
  `model.json.chambers[office]` (`demControl`, `gopControl`, `demSeats`, `gopSeats`, `hist`).

## Rating bands
`|m| < 2` toss up · `2 to 6` lean · `6 to 12` likely · `12+` safe.
Independent races (first candidate party `IND` and `m < 0`) render `--rate-ind`.

## Rating colors, pale for close, deep for solid
```
safeD  #1a3fb0    likelyD #3d7bff    leanD  #a6c2ff
toss   #e7b341
leanR  #ffb3c0    likelyR #ff3b5c    safeR  #b0163a
ind    #b78cff    none    rgba(255,255,255,.08)
```
State labels: mono 600 8.5px, white at 85%, centered on the projected centroid `c`.
On lean and toss up fills switch the label to `#1a1030`. Skip labels for
DC RI DE CT NJ MD MA NH VT HI.

## County margin color
```js
function marginColor(m){
  var a = Math.min(40, Math.abs(m)) / 40;
  var mix = (c1,c2,t) => 'rgb(' + c1.map((v,i)=>Math.round(v+(c2[i]-v)*t)).join(',') + ')';
  return m < 0 ? mix([214,226,255],[16,40,140],a) : mix([255,220,228],[140,10,40],a);
}
```
Ramp legend: `linear-gradient(90deg,#10288c 0%,#3d7bff 25%,#d6e2ff 48%,#ffdce4 52%,#ff3b5c 75%,#8c0a28 100%)`
with `D +40` on the left and `R +40` on the right.

## Fitting a county file into a viewBox
Compute the bbox of all county paths once, then
```
sc = min((W-20)/(bw), (H-20)/(bh));  ox = (W - bw*sc)/2 - minX*sc;  oy = (H - bh*sc)/2 - minY*sc
<g transform="translate(ox,oy) scale(sc)"> paths with stroke-width 1/sc </g>
```
Mock uses `900 x 620` for the big map and `320 x 180` for story thumbnails.

## Interaction
- Paths fade in with a per path `animation-delay` (12ms per state, 4ms per county).
- Hover: `filter: brightness(1.25)`, white stroke. Tooltip shows race name, both
  candidates, model margin, poll average, rating (state) or county name, simulated
  margin and simulated votes (county).
- Click a state on the US map, or a row in Closest races, to load that state's
  county map and scroll to it. Only states with a county build are clickable.
- Office toggle `Senate | Governor` re-colors the map, seat bar, histogram and
  closest races list from `model.json`.

## Seat histogram
`chambers[office].hist` sorted by seat count. Bars colored blue when Dem seats reach
a majority, gold at an exact tie, red otherwise. Label every third bar in mono 9px.
Seat bar above it: segments for safe/likely/lean/ind/toss/lean/likely/safe including
seats not up (`meta.senNotUpD`, `meta.senNotUpR`, `meta.govNotUpD`, `meta.govNotUpR`),
white 2px marker at 50%.
