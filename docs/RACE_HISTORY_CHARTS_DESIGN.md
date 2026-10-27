# Race History charts: design and data semantics (for review)

Status: **protected preview only.** No public race page renders these charts yet. Public integration waits for the review of this document. No forecast calculation was changed, and no shadow projection was activated.

Preview: `/portal/intelligence/history` (portal session required, `noindex`, `force-dynamic`).

| URL | Shows |
| --- | --- |
| `/portal/intelligence/history` | Index of the synthetic scenarios and the tracked races |
| `?demo=three-way` | A full synthetic night covering every case the charts must handle |
| `?demo=sparse` | Sparse observations, a feed outage and a held value |
| `?demo=pre` | Pre-election forecast only (no election-night data) |
| `?race=<id>` | A real race: frozen history plus anything in the store. Add `&test=1` to admit TEST records |

## Files

| File | Role |
| --- | --- |
| [app/lib/intelligence/raceHistory.ts](../app/lib/intelligence/raceHistory.ts) | The data contract and series builders. Pure and client-safe, with no I/O. |
| [app/lib/intelligence/raceHistoryStore.ts](../app/lib/intelligence/raceHistoryStore.ts) | Server side: the model-output ledger, mapping recorder observations to points, and the frozen dataset reader |
| [app/lib/intelligence/raceHistoryDemo.ts](../app/lib/intelligence/raceHistoryDemo.ts) | Synthetic scenarios, all marked `SYNTHETIC` |
| [app/components/opp/RaceHistory.tsx](../app/components/opp/RaceHistory.tsx), [raceHistory.css](../app/components/opp/raceHistory.css) | The reusable chart section |
| [app/portal/intelligence/history/page.tsx](../app/portal/intelligence/history/page.tsx) | The protected preview |
| [scripts/intelligence/build_frozen_history.ts](../scripts/intelligence/build_frozen_history.ts) | Rebuilds `data/intelligence/history/frozen-forecasts.json.gz` (`npm run intelligence:frozen-history`) |
| [tests/intelligence/raceHistory.test.ts](../tests/intelligence/raceHistory.test.ts) | 31 tests |

## Data contract (`TPSI_RACE_HISTORY/1`)

There are two record kinds, and they are **not interchangeable**:

- **`MODEL_OUTPUT`** records what a model published at a moment: win probabilities, the projected final margin (with an interval only if the model published one) and projected final votes. Each record is stored as published and is never recomputed with a newer model.
- **`RESULT_OBSERVATION`** records what a results source reported: reported votes per candidate and the counted-vote margin. Nothing is ever turned into a probability.

Every point carries the following fields:

- `raceId`
- the candidate roster: id, display name, party as given, margin side
- `observedAt`: UTC; the time of publication, or the time the result was first seen
- `sourceTimestamp`: null when the source gives none, never filled in
- `sourceClass`
- `status`
- `revision`: `ORIGINAL`, `REVISION` or `CORRECTION`, plus `supersedes` and `note`
- `reporting`: `{pct, definition}`. The definition is required and never assumed.

Model points also carry the following:

- `model {id, version, snapshot, asOf}`
- `winProbabilityBasis`: `TWO_SIDE` or `MULTI_CANDIDATE`
- `margin {pp, reference {plus, minus}, low, high, intervalBasis}`
- `projectedFinalVotes`
- `provenance`

Result points also carry the following:

- `provider`
- `reportedVotes`
- `countedMargin`
- `totalsDecreased`
- `outOfOrder`
- `confirmedThrough`
- `provenance`

| Source class | Meaning | Public |
| --- | --- | --- |
| `FROZEN_FORECAST` | Pre-election OnPoint forecast, as published | Yes |
| `LIVE_PROJECTION` | Published election-night projection. Must carry a model version; an `UNVERSIONED` live projection is refused. | Yes |
| `RESULT_FEED` | Reported votes from the flight recorder | Yes |
| `SHADOW_MODEL` | The research pipeline | **Never.** It is dropped and counted on `PUBLIC`. On `PREVIEW` it is kept in a separate array and drawn only as a labelled grey overlay when it is ticked. |

| Status | Default on public | Notes |
| --- | --- | --- |
| `LIVE` | Admitted | |
| `NOT_PROVIDED` | Admitted, labelled | The source states neither live nor test (the civicAPI search feed). It is never called live. |
| `TEST` | Excluded and counted | Preview `&test=1` admits it |
| `SYNTHETIC` | Excluded and counted | Demo scenarios only |

## Semantics: please review these decisions

1. **Step-after lines.** A published value stands until the next publication replaces it. This is what the page showed; nothing is interpolated, and no intermediate points are generated.
2. **Gaps are null.** If the engine published no valid probability (the whole field, or one candidate), the line stops. In the readout the value is empty, not zero.
   - In a `TWO_SIDE` race, a candidate outside the two margin sides is listed as "not priced", not drawn at 0%.
3. **Result gap rule: `RESULT_GAP_MS` = 20 minutes.** A reported-vote line breaks if nothing new or confirming arrives for 20 minutes.
   - An unchanged re-read extends the held value through `confirmedThrough`, so a quiet feed is not a gap.
   - A model line is held until the next publication.
4. **Frozen to live transition.** The last frozen forecast is held until the first `LIVE_PROJECTION`. Both moments get a marker ("Final forecast" and "Live projections begin").
   - The frozen baseline is drawn dotted and stays visible on every range that includes it.
5. **Model revisions.** A record that restates an earlier snapshot with different figures is derived as a `REVISION` when the history is read. It is never stored that way, and the original record is never rewritten.
   - A change of model version adds a "Model x" marker.
6. **Corrections and decreases.** A reported total that falls is kept as recorded and drawn as an open gold ring (`DECREASE` or `CORRECTION`).
7. **Out-of-order readings.** Points are ordered by `observedAt`. A reading whose `sourceTimestamp` runs backward is flagged `OUT_OF_ORDER` and counted; it is not reordered by source time or rewritten.
8. **Projected margin versus counted margin.** These are separate series:
   - solid: the projected final margin;
   - dashed: the counted-vote margin, labelled "votes counted so far, not a projection".

   The shaded interval appears only where the model published `low` and `high`, and its basis is stated.

   The sign convention is `plus − minus` in points. The site convention is plus = GOP. A point stated with the sides swapped is aligned to the latest reference, and its interval is swapped too. Labels read "D +2.0" or "R +2.4", never a bare sign.
9. **Vote totals.**
   - solid: reported votes;
   - dashed: estimated final votes from a published model;
   - dotted: the frozen pre-election estimate of the final vote.

   These series are never merged.
10. **Time.** Everything is stored in UTC. The display defaults to ET, with UTC and Local toggles. Ticks fall on the zone's own midnights, including the 25-hour day of the November 1 EDT→EST change.
    - "Election night" opens at 4 PM ET on November 3 (21:00Z).

## Storage (same ObjectStore as the flight recorder)

```
model/<race>/<observedAt>_<id12>.json          FROZEN_FORECAST / LIVE_PROJECTION
model-shadow/<race>/<observedAt>_<id12>.json   SHADOW_MODEL (separate prefix; no public read reaches it)
heads/model/<race>.json, heads/model-shadow/<race>.json   rebuildable "latest" pointers
obs/<race>/...                                 reported votes, written by the recorder, only read here
```

- **Immutable and idempotent.** The key is derived from the race, the time and the content, so re-recording the same output is `ALREADY_RECORDED`.
- **Material updates only.** An output whose figures equal the latest one is `UNCHANGED`: it is not stored again, and the head records `lastConfirmedAt`.
- **Full resolution is kept.** `decimate()` is display-only. For each pixel column it keeps the first, last, minimum and maximum points, plus every gap and flagged point, so an extreme or a correction is never smoothed away.
- **No provider requests.** Reading history makes no network request; the test asserts this.

### Frozen pre-election history

`frozen-forecasts.json.gz` (320 KB) was rebuilt from the git history of `public/forecast/model.json`:

- 52 published snapshots and 506 races;
- a race is written at a snapshot only when its figures changed;
- the time of a snapshot is the **commit time**, which is the earliest moment the site could have shown it;
- the model version is `UNVERSIONED`, because `model.json` carries none, and the snapshot is the commit;
- the interval is p10–p90 of the model's simulated margins.

**For review:** the history includes every commit, **reverts included**. In gov-GA, for example, it shows a sharp move on October 14 and some snapshots that alternate back and forth. That is what was published, but you may prefer to keep only commits that reached production.

## UI

The chart reuses the polling-average chart language: the `studio.css` container, gridlines, axis type, end labels, tooltip card and party colors.

- **Tabs:** `WIN PROBABILITY | EXPECTED MARGIN | VOTE TOTALS`. The default is Win Probability; the `initialChart` prop can change it.
- **Range:** Election night, 24 hours, 7 days, All. Ranges with no data are disabled.
  - The default is Election night if it has data, otherwise All.
  - "No live data" opens on All with the pre-election history.
- **Zone:** ET, UTC, Local.
- **Cursor:**
  - Snaps to the nearest observation.
  - Shared across all three tabs.
  - Works with mouse hover, touch and keyboard (←/→, Home/End, Esc).
  - The readout shows, for each source: the exact timestamp (zone and UTC); the source class; the provider or model with its version and snapshot; the published or first-seen time; the source time; reporting with its definition; the status chip; the values; and any revision or correction note.
- **Legend:** explains every line style, the band, the correction ring and the gap rule.
- **Mobile (W < 560):**
  - the readout docks under the chart instead of floating;
  - end labels drop the name suffix;
  - the controls wrap;
  - no horizontal overflow at 390 px.
- **Empty states:** no forecast, no reporting yet, and probabilities not published.
- **Shadow overlay:** a checkbox on the preview only (`allowShadowOverlay`). The shadow series are grey, labelled "Shadow … (not published)", and never share a series with the published lines.

## Screenshots

These are in [docs/design-assets/race-history/](design-assets/race-history/). They come from a standalone harness that renders the real component, CSS and tokens, with the frozen data for the real races.

- desktop, 1280 px: `desktop-demo-prob`, `-margin`, `-votes`, `-shadow`, `-pre` and `desktop-real-gov-GA-prob`;
- mobile, 390 px: `mobile-demo-prob`, `-margin`, `-votes` and `mobile-real-gov-GA-prob`.

The full-page app captures are outside the repository, in `~/research/screens/race-history/`, together with the polling-average reference.

Why the harness: in this 8 GB codespace, running `next dev` and headless Chromium together repeatedly ran out of memory.

## Known notes

- At 1280 px the site header overflows (scrollWidth 1430). This is pre-existing site chrome, not this component.
- A counted margin far outside the projected range is clipped to the y-domain; the readout gives the exact value.

## Not done (by design)

- **No public race-page integration.** It needs approval of the semantics above first. The integration point is `loadRaceHistory(store, raceId, {surface: "PUBLIC"})` → `<RaceHistory history={loaded.prepared} />`.
- **No live projections are recorded yet.** There is no published live model yet. When one exists, its publisher must call `recordModelOutput()` with a model version on every publication.
