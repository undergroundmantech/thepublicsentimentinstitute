# Election Day P0 hotfix: change report (Nov 3, 2026)

Status words: PASS = verified here with evidence; FAIL = defect found; BLOCKED = needs production, GitHub or credentials I do not have; NOT VERIFIED = not exercised.

## Files changed
| File | Change |
|---|---|
| `app/results/monitor/monitor.css` | Situation Monitor header: H1 `clamp(30px,4vw,48px)`, subtitle and eyebrow clamps, title owns its row; footer hidden on the fixed-height monitor at >=1101px |
| `app/results/2026/NightDesk.tsx` (CSS block + 1 line) | Reported results and Forecast snapshot stacked full width; container-query reflow; six-field stats strip; race history now also loads in the monitor's embedded desk |
| `app/components/CsvUtility.tsx`, `csvUtility.css`, `app/layout.tsx` | Download CSV strip above the footer on `/results*` and `/forecast*` |
| `app/lib/csv/csv.ts`, `buildExport.ts` | Escaping, filenames, export builder |
| `app/results/2026/calls/*` | Unlinked read-only calls board at `/results/2026/calls` (noindex; not in nav, footer or sitemap) |
| `app/components/Navbar.tsx`, `app/chrome.css` | Measured nav fit: whole nav folds into Menu before any link clips; focus trap and focus return; CTA and search stay in the bar longer; utility links reachable in the menu |
| `tests/intelligence/csv.test.ts`, `calls.test.ts` | 12 new unit tests |

Race titles (for example "Florida Senate") are deliberately NOT enlarged (addendum overrides item 1's title bullet). Forecast mathematics, calibration and the three visual modes are untouched.

## 1. Race layout: PASS (local dev, Chromium)
Race page `/results/2026/sen-FL` at 390, 768, 1280, 1920 px, dark and light: Reported results and Forecast snapshot stacked, each the full desk width; no horizontal scroll; no clipped names or figures. Not exercised: Pro Light/Pro Dark/Theme mode switch (only `data-theme` dark/light), and the monitor's embedded desk with live data (same CSS, container-query based, so it reflows by the desk's own width).

## 2. Recorders and graphs
Findings from the code and configuration in the zip (no `.git`, no production access):
- Primary durable recorder `/api/intelligence/capture`: NOT in `vercel.json` crons in this snapshot (handoff doc: "Not scheduled"). Only the legacy `/api/flightrecorder/capture` runs, every minute. **FAIL for the snapshot as supplied; production state BLOCKED.**
- Vercel cron cannot fire every 30 s; the handoff states one call per minute covers both 30 s slots and the 30 s guarantee is "unproven". **NOT VERIFIED.**
- GitHub Actions `flight-recorder.yml`: `schedule` is commented out (only `workflow_dispatch`), cadence in file is 10 min. `release/recorder-30s-2026-11-03` is not in the zip. **BLOCKED.** To enable on the default branch, restore the cron in the workflow; do not run two schedules for the same slots.
- Existing `npm run test:intelligence`: 269 tests, 263 pass, 0 fail (rest skipped). This proves code paths only, not a running recorder.
- Graphs: `useRaceHistory` and `/api/race-history/[id]` render the five charts from the frozen dataset locally (sen-FL). Recorded live points: BLOCKED (needs a durable store in production). History is now also loaded in the monitor's embedded desk (previously disabled there).
- Last verified recording timestamp: none available.

## 3. Download CSV: PASS (local)
Race and national exports download with BOM, CRLF, UTC-stamped filename. RAW_REPORTED, MODEL_PROJECTED, FORECAST_PREELECTION and HISTORY_* rows are separate `data_class` values; blanks are never zero; before the first polls close (23:00Z) civicAPI test returns are excluded and the file says so (`?test=1` includes them flagged `is_test_data=TRUE`). Live civicAPI rows NOT VERIFIED (sandbox has no civicAPI access; verify on the preview after polls close).

## 4. Calls board: PASS (local)
`/results/2026/calls` renders 1,016 races, filters by chamber, state, winner party and call status, search, freshness and stale warnings, and a no-calls state. Official = civicAPI winner flag; projection = the race desk's own rule (published forecast, >=50% counted, >=99.5% chance), labelled "not an official call"; never inferred from probability alone. State legislatures show official calls only. Live-call rendering NOT VERIFIED (needs live civicAPI).

## 5. Header: PASS (local)
Widths 1920 to 320: nav visible with no clipping down to 1366; folds into Menu at 1280 and below; search icon always in the bar; CTA in the bar to 961 px, in the menu below. No logo/nav/tools overlap. Menu: focus moves in, Tab stays inside, Escape closes and returns focus to the Menu button. At 320 px a pre-existing page-level horizontal overflow remains. Phone (<=860 px) uses the bottom tab bar's Menu tab, unchanged.

## Remaining blockers
Production recorder schedule, GitHub Actions schedule and release branch, last recorded timestamp, Vercel preview, production SHA, and live civicAPI checks all need someone with repo and Vercel access.
