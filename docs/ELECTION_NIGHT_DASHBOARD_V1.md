# Election Night Dashboard — Milestone 1

Branch: `ui/election-night-dashboard-v1` (cut from `ui/p0-result-clarity` @ `3e09003f`).
Route: `/results/2026`. Companion operator view: `/results/monitor` (unchanged in structure).

## What was built

`/results/2026` now opens with a national election night dashboard (`NationalDesk`) above the existing
"every race" hub (`RacesHub`, rendered in a new `embedded` mode). The page composition is:

1. **Header** — eyebrow with live/pre-election status dot, headline, lede, and a meta strip
   (polls close in / last read, races, counting, called) plus a link to the operator monitor.
2. **Four category cards** (role=tablist) — United States Senate, United States House, Governors,
   Other Races. Each card shows called seats by party, the uncalled remainder, a majority bar
   (Senate/House/Governors) or a kind-count strip (Other), a counting progress bar, and the live
   margin lean count. Selecting a card drives the map and the readout.
3. **National map** — `geo.json` state (or House district) paths. Reported units are filled with the
   `marginColor` ramp; uncalled units with an expected lean carry the P0-2 hatched-lean treatment
   (a stripe mask over a lean-coloured path) so projection is never drawn as a result; called units
   get a gold stroke. Hover/focus tooltip, click → race or state results page, keyboard operable.
4. **Readout** (right rail; stacks under the map below 1100px) — plain-language verdict with strictly non-definitive wording for
   uncalled races, chamber seat arc / governor tiles (Monitor's components), aggregate counting stats,
   and a "watch" list of the closest counting or earliest-closing races. Its bar is the reported
   two-way vote share once votes are in, or the established pre-election forecast chance before then;
   a one-line key above the list says which, and each bar carries a matching `aria-label`. No
   probability is ever derived from margin, turnout or percent reporting.
5. **Every race hub** — the existing `RacesHub` with `?k=` deep-linking so category CTAs land on the
   right filter (`/results/2026?k=sen#rh`).

Styling lives in `app/results/2026/results2026.css` (`.nat-*` block) and reuses `monitor.css` for the
seat arc, tiles, majority bar and seat key. All colours come from the global tokens, so Professional
Light works without overrides.

## Reused / extended

| Need | Reused from | How |
| --- | --- | --- |
| Seat/race state derivation | `app/results/monitor/Monitor.tsx` | Moved `seatOf`, `hasReturns`, `liveMargin`, `expM`, `raceLabel`, `GOV_HOLD` into `Chambers.tsx` as named exports; Monitor imports them (no behaviour change). |
| Chamber visualisation | `app/results/monitor/Chambers.tsx` | `SeatArc`, `GovTiles`, `MajorityBar`, `SeatKey`, `countSeats` used directly. |
| Lean border colour | `app/results/monitor/paint.ts` | `leanStroke` for the Other-category pixel grid. |
| Live returns + index | `app/results/2026/useLive.ts`, `live.ts` | `useIndex`, `useLive`, `STN`, `KIND_LABEL`, `FIRST_CLOSE`, `resultsHref`, `fmtK/fmtM`, `isInd`. |
| Margin colours | `app/lib/opp.ts` | `marginColor`, `marginColorInd`. |
| Chamber baseline (not-up seats) | `app/results/monitor/page.tsx` | Same `getModel()` → `chambers` computation, now also done in `app/results/2026/page.tsx`. |
| Category selector / featured race rows | Forecast console tile and row patterns | Adapted as `.nat-card` and `.nat-row`. |
| Race list | `RacesHub.tsx` | New `embedded` prop; keeps the full standalone layout when rendered elsewhere. |

## Shared component changes

- `app/results/monitor/Chambers.tsx`: added exports (`GOV_HOLD`, `hasReturns`, `liveMargin`, `expM`,
  `raceLabel`, `seatOf`). Existing exports unchanged.
- `app/results/monitor/Monitor.tsx`: imports the helpers instead of defining them; removed a now-unused
  `eslint-disable` comment. Rendering is unchanged.
- `app/results/2026/RacesHub.tsx`: `embedded` prop and `?k=` sync. Default (non-embedded) output unchanged.

## P0 corrections (3e09003f) preserved

- No definitive "wins"/"won"/"flips" language for uncalled projections anywhere in the new UI. The
  verdict, cards, tooltip and watch rows use "leads", "expected", "uncalled", "not yet called".
- Expected lean on the map is hatched and labelled "Expected lean (uncalled)" in the legend; it is
  visually distinct from reported returns and from calls (gold stroke).
- Pre-election phase is explicit ("Pre-election · N races · first polls close …") and no zeros are
  dressed as results.
- Monitor's seat derivation is shared rather than re-implemented, so its P0 semantics (called vs.
  leading, not-up holds) flow through unchanged.

## Not changed

Forecast math, models, race-call logic, ingestion/civicAPI proxy, flight recorder, intelligence branch,
individual race pages, `/results/monitor` layout, production.

## Validation

- `npx tsc --noEmit`: clean for all touched files. Two pre-existing errors in
  `app/api/flightrecorder/[raceId]/route.ts` come from uncommitted local work not on this branch.
- `npx eslint` on the six touched files (`NationalDesk.tsx`, `page.tsx`, `RacesHub.tsx`,
  `results2026.css`, `Chambers.tsx`, `Monitor.tsx`): 0 errors, 0 warnings (one new
  `set-state-in-effect` error was fixed by deriving the `?k=` filter during render; one pre-existing
  unused-disable warning removed).
- `npx eslint app/results/2026 app/results/monitor` still reports 9 errors / 3 warnings, all
  pre-existing and in files this milestone did not touch: `NightDesk.tsx` (5× set-state-in-effect,
  1× unescaped entity, 2 warnings), `[id]/RaceLive.tsx:38`, `useLive.ts:50`,
  `monitor/RaceBrief.tsx:16` (set-state-in-effect), `[id]/page.tsx:32` (unused var).
- `npx next build`: passes.
- Screenshots: `docs/audit-screenshots/election-night-v1/results-2026/` (390/768/1024/1280/1440 dark;
  390/1280 light) plus `report.json` from the audit harness (overflow probe, a11y counts, console
  errors). Dashboard-level horizontal overflow: none at any width. The only overflow reported is at
  1280px from the global masthead (`div.right` / `a.btn.gold`), the documented P1.
- Harness note: the site's scroll-driven card reveal (`sx-rise`, `motion.css`) leaves below-fold cards
  in their pre-reveal transform when the harness captures beyond the viewport, which looked like the
  rail overlapping the hub heading. Final captures emulate `prefers-reduced-motion` to show true
  layout. Normal scrolling with motion enabled was then checked with a stepped scroll to the hub
  heading (`scroll-1280-dark.jpg`, `scroll-390-dark.jpg`): rail bottom sits above the hub top at both
  widths (1280: 10.9px vs 88.9px; 390: −62.9px vs 87.1px), so there is no overlap.

## Limitations

- Live data is one subscription: `LiveProvider` (`app/results/2026/LiveProvider.tsx`) calls the
  unchanged `useLive` once for every race type and `NationalDesk` and the embedded `RacesHub` read it,
  so the four category totals no longer depend on the open tab. `RacesHub` still subscribes on its own
  when rendered outside the provider. Measured on a dev server: 40 civicAPI searches on load, 0
  duplicates, none added by switching tabs. Caching, sequential fetching and test-return blanking in
  `useLive` are untouched.
- The Other Races map shows a state as "reported" if any non-federal/governor race in it has returns;
  the tooltip lists the first few races only.
- No live data was available; all states were validated against the index/fixture and the pre-election
  phase. Counting/called visuals were exercised only through the shared Monitor helpers.
- Data as-of and polls-close timing use the client clock.
- The right rail is not sticky: it is usually the taller column, so sticking it had no effect and
  it is simpler to stack. Revisit if the map card grows taller than the rail.

## Next step for race pages (Milestone 2)

Give each `/results/2026/[state]/[race]` page the same header/meta grammar (status dot, called/counting
state, non-definitive verdict), reuse `.nat-row` for the county list, and link back to the dashboard with
the category preselected. `useLive` is already lifted into `LiveProvider` for the national page; wrap
race pages the same way if they ever sit beside a list.

## Fixture test

`node scripts/test-national-tally.mjs` compiles the real `nationalTally.ts` and `Chambers.tsx` helpers
and checks synthetic Senate/House/Governor/Other reads: no returns, empty provider read, blanked test
returns, partial returns, an official call (counted as called, not leading), tab-independent totals,
reported-share bar independent of percent reporting, forecast bar labelled as not a result, and
source guards (no margin-derived probability, one subscription).
