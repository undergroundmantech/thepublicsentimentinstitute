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
3. **Staleness (Phase 2; replaces the 20-minute gap rule).** Every value, reported or modelled, stands until the next update. Silence is not drawn as missing data.
   - A line breaks only where a value is *known* to be missing: a null value, or a declared source outage.
   - An outage (`PrepareOptions.outages`: provider or `"*"`, from, to, reason) is shaded as "Results source unavailable: nothing new could be read". The line keeps the last reported value, and the readout says "Source unavailable since … (reason). Last reported values shown."
   - Every readout row carries a freshness line: **New reading at this time**, **Confirmed unchanged at …**, **No new reading since …**, or **Source unavailable since …**. "Confirmed" uses only confirmations at or before the cursor time; it never draws on later information.
   - The chart header shows **Last updated**: the latest `observedAt` or `confirmedThrough`.
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

`frozen-forecasts.json.gz` (schema `TPSI_FROZEN_FORECAST_HISTORY/2`) is rebuilt from the git history of `public/forecast/model.json`:

- 67 snapshots and 506 races; a race is written at a snapshot only when its figures changed;
- the model version is `UNVERSIONED`, because `model.json` carries none, and the snapshot is the commit;
- the interval is p10–p90 of the model's simulated margins.

**Published-only (Phase 2).** Each snapshot is classified against production deployment records:

- **Evidence:** `data/intelligence/history/production-deployments.json`, built by `build_frozen_history.ts --fetch-deployments` from the GitHub Deployments API (environment `Production`, created by Vercel).
- **Matching:** a deployment publishes a snapshot when the `model.json` blob at the deployment's commit equals that snapshot's blob. The go-live time is the deployment's first `SUCCESS` status.
- **Classes:**
  - `PUBLISHED`: served by a successful production deployment (65). It stays PUBLISHED even if a later commit reverted it. Two did: `1aeeb267` (reverted by `585426da`) and `d6010cb6` (reverted by `50cc9fd9`).
  - `UNVERIFIED`: no successful deployment served it (2: `2f32d4c7` and `d65fcc06`).
  - `REVERTED`: reverted and never served (0).
  - `INTERNAL`: never on the production branch (0).
- **Unresolved evidence:** 64 publications were matched, 1 deployment served a blob that matches no snapshot, and 4 deployments could not be resolved to a blob. All are listed in the file.
- **Public charts** draw one point per publication that changed the figures, at its **go-live time**, not its commit time. Non-PUBLISHED snapshots never reach a public surface.
- **Diagnostics:** on the preview only, `&diag=1` shows every snapshot at its commit time with its class. The provenance panel lists class counts and the evidence source.
- The readout states the provenance: "published …", "published …, later reverted" or (diag only) "committed …, never verified as published".

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
- **Off-scale values (Phase 2).** The margin domain is set by the model: it is the model extent, widened to fit the counted margin up to twice the model extent (or the model extent + 10 points). A counted margin beyond that runs along the edge as chevrons labelled "R +34.0 · off scale", and its end label carries ▲ or ▼. The readout always gives the true value.
- **Ticks.** A collision filter keeps at most one x-tick per 86 px (66 px on narrow screens), majors first.
- **Narrow end labels.** The right gutter is 66 px. The value tag moves to a second line.
- **Cross-metric readout.** Every tab's readout ends with a summary of the other two metrics at the same moment, for example "Win chance … · Reported votes …".
- **Theme.** All colors are `.rh` tokens (`--rh-d/r/i/l/g`, `--rh-o1..4`, `--rh-neutral`, surface, text, grid, cursor) with `:root[data-theme="light"]` overrides. This includes the readout card and grid inherited from `studio.css`, scoped to `.rh` so the polling chart is unchanged. Series colors are set through `style`, so CSS variables resolve.

## Public race-page integration (Phase 2)

- **Placement:** on `/forecast/[state]/[race]` there is a "Race history" section after "The trend", with a `History` nav item. All 506 frozen race ids map to these pages.
- **API:** `GET /api/race-history/[id]`. The id is validated against `^(sen|gov|house)-[A-Z]{2}(-[0-9A-Z]{1,3})?$`.
  - It reads the durable store if one is configured. Otherwise it reads the frozen PUBLISHED history. It never calls a results provider.
  - It returns `{history, nowMs, partial}` with `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Unknown races get 404, and failures get 503 with a short message.
  - `next.config.ts` traces the frozen file into the function.
- **Loading:** `RaceHistorySection` fetches only when the section comes within 600 px of the viewport. It loads the chart with `next/dynamic` (`ssr: false`) and reserves 420 px so the layout does not shift. Errors show inline.
- **Recording guard:** `recordModelOutput` refuses with `EPHEMERAL_STORE` on Vercel if the store is not durable, so a serverless filesystem cannot pass for history.

## Screenshots

These are in [docs/design-assets/race-history/](design-assets/race-history/). They come from a standalone harness that renders the real component, CSS and tokens, with the frozen data for the real races.

- desktop, 1280 px: `desktop-demo-prob`, `-margin`, `-votes`, `-shadow`, `-pre` and `desktop-real-gov-GA-prob`;
- mobile, 390 px: `mobile-demo-prob`, `-margin`, `-votes` and `mobile-real-gov-GA-prob`.

Phase 2 captures are in [docs/design-assets/race-history/phase2/](design-assets/race-history/phase2/). Real races are rendered through the PUBLIC surface (published-only, go-live times):

- `desktop-demo-offscale`, `desktop-demo-outage` (cursor inside the outage), `desktop-demo-margin`, `desktop-real-gov-GA-prob`;
- light theme: `desktop-light-demo-margin`, `desktop-light-real-gov-GA-prob`, `mobile-light-real-gov-GA-prob`;
- mobile, 390 px: `mobile-demo-margin`, `mobile-demo-votes`, `mobile-real-gov-GA-prob`.

All 26 Phase 2 captures report no horizontal overflow. The full set is outside the repository, in `~/research/screens/race-history-p2/`.

Why the harness: in this 8 GB codespace, running `next dev` and headless Chromium together repeatedly ran out of memory.

## Known notes

- At 1280 px the site header overflows (scrollWidth 1430). This is pre-existing site chrome, not this component; it is logged in [SITE_UI_AUDIT.md](SITE_UI_AUDIT.md).

## Limitations and open decisions

- **Outages are not wired from live data yet.** The chart and the contract support declared outages, but the recorder's run records (`runs/` in `capture.ts`) have no reader. Until one is added, only the synthetic demo shows an outage.
- **No live projections are recorded yet.** The existing flight-recorder / `LiveTimeline` engine does not call `recordModelOutput()`, and production has no durable store configured. Both are needed, and the publisher must pass a model version on every publication. No new forecast mathematics was activated.
- **Not covered:** statewide down-ballot pages and the `/results` race pages. Their ids do not map to the frozen race ids yet.
- **Decision for you:** the existing "The trend" chart stays above Race history, and the two overlap for the pre-election period. You may keep both, or retire TrendChart.
