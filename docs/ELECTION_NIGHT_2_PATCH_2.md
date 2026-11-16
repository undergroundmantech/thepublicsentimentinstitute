# Election Night 2.0, patch 2: the Calls Desk

The second part of the patch to the Election Night 2.0 final update. Part one is everything in
`docs/ELECTION_NIGHT_2_PATCH_1.md` (engine 2.5.0: On Point's calls only, the docked replay bar, larger charts,
navigation, past results and the past-election map setting). Part two, described here, makes the Calls Desk a page of
the site: one table of every race, with On Point's calls and the progress of everything not yet called.

- Engine: `onpoint-engine/2.5.0`, as in part one. The Calls Desk changes no call rule, model or data.
- Replay data pack: the one built for part one (engine 2.5.0), delivered alongside.
- Status: built and tested on a copy of the site. Nothing has been deployed; no database or production setting touched.
- Calibration status: unchanged. **Not calibrated.** The page says so.

## 1. Install and roll back

Patches 1 and 2 are delivered as **one updater and one replay data pack**. The Election Night 2.0 final update
(`apply_election_night_2.py`, engine 2.4.0) must already be applied. Then, from the site's root folder:

```
python3 apply_election_night_2_patch2_full.py --dry-run
python3 apply_election_night_2_patch2_full.py
python3 apply_election_night_2_patch2_full.py --install-replay election-night-2-patch2-replay-data.zip
npx tsc --noEmit
npm run test:intelligence
```

Both parts are needed: without the replay pack, pages outside a replay mark no race as called.

`--verify` checks the files on disk against the package. `--rollback` restores the files as they were before the run.
The updater also runs on a checkout where patch 1 was already applied on its own, and then writes only what differs.
It refuses to replace a file that is neither the final update's version nor patch 1's, never deletes anything, never
runs npm and sends nothing over the network.

## 2. What the page is

`/results/2026/calls`. The desk does not make calls. It shows the calls the engine has made, exactly as every other
results page reads them, and where every other race stands.

**One table, one row per race** (Senate, House, governor, statewide offices, ballot measures, courts and other; state
legislature chambers are not listed). Columns:

| column | what it shows | source |
|---|---|---|
| Race | name, linked to the race page | site |
| Status | Called, Too close to call, Too early to call, No votes yet | On Point's call, else the count |
| Winner or leader | the called winner, or the current leader and who they lead | call; civicAPI count |
| Lead now | the leader's lead in counted votes, and their share | civicAPI count |
| % in | share counted, with a small bar | civicAPI |
| Votes counted | all votes counted | civicAPI |
| Win probability | the model's chance for the candidate it favours | engine |
| Forecast result | the model's projected final margin with its 80% range | engine |
| Called at | when On Point called it, Eastern time | engine ledger |

- **Filters.** Tabs by race type with counts; buttons by status with counts; a state list; a search box for a race or
  a candidate. "Clear" resets them.
- **Sorting.** Every column header sorts; a second click reverses. Rows with no value in the sorted column stay last.
  The default order is office, then race name.
- **Layout.** A sheet: sticky header, sticky first column, banded rows, right-aligned figures, a coloured edge per
  status. It scrolls inside its own frame on a desktop and sideways on a phone. The first 150 rows are drawn; a
  button shows the rest.
- **In a replay** the table is the night as of the replay clock, and the replay bar is on the page as on the others.

**The statuses.** "Called" is On Point's call and nothing else: civicAPI's own calls are not read by this page. The
other three describe the count and are not calls:

- *Too close to call*: at least 35% counted and the lead under 5 points, or 95% counted and still not called.
- *Too early to call*: votes are in, fewer than that.
- *No votes yet*.

These thresholds are display labels only (`app/results/2026/calls/tracker.ts`); they feed nothing in the engine.

**Without a live engine** (the site as deployed today, outside a replay): calls come from the pack's
`onpoint-calls.json`, the count from civicAPI as on the other pages, and the two model columns show the pre-election
forecast, marked "pre-election". Once a race is called the probability column reads "called".

## 3. Getting there and back

- Header: **2026 Results → Calls desk**.
- Main results page: a "Calls desk" button beside "Open the situation monitor".
- Situation Monitor: "Calls desk" in the top navigation row.
- On the desk: a "2026 results" back button, and "Situation Monitor" and "Every race, with maps" buttons. Every race
  name opens its race page.
- The page is no longer hidden from search engines and is in the sitemap. (It was unlinked and no-index before.)

## 4. What replaced what

The page used to render the engine's internal desk (qualification states, safeguards, the event log) with a fallback
board. It now renders the table alone. The old components (`CallsDesk.tsx`, `CallsByOffice.tsx`, `CallsBoard.tsx`)
are left in place and unused, because the updater never deletes files and older tests read them; they can be removed
by hand later. The event log is no longer shown on any page.

## 5. Verification

- `npx tsc --noEmit`: clean.
- `npm run test:intelligence`: 394 tests, 388 pass, 6 skipped (the same six), 0 fail. New: 4 tests of the table's
  statuses, rows, filters, sorting and of the page's links and call source.
- ESLint on the new and changed files: clean.
- `next build --webpack`: compiles, 4,776 pages generated, `/results/2026/calls` among them.
- Opened in a browser in the recorded replay at 11:10 p.m. on election night and at the last frame, dark and light,
  desktop and phone: no page errors, no sideways page scroll. At 11:10 p.m.: 296 called, 125 too close, 246 too early,
  262 without votes. At the last frame: 732 called. Outside a replay the sandbox cannot reach civicAPI, so the live
  table was seen only before any count (every race "No votes yet").
- The combined updater on a clean copy: it refuses a checkout without the final update; on top of the final update a
  dry run changes nothing; applying writes 111 files (45 replaced, 66 added) and verifies them; `--verify` passes;
  `--install-replay` installs and checks 2,368 files; TypeScript and the tests pass in the patched copy; `--rollback`
  returns the copy to the final update exactly. On a copy with patch 1 already applied it writes only the 11 files
  that differ.

## 6. Files

Changed: `app/results/2026/calls/page.tsx`, `app/results/2026/calls/calls.css`, `app/components/navMenu.ts`,
`app/results/monitor/Monitor.tsx`, `app/results/2026/NationalDesk.tsx`, `app/sitemap.ts`.

Added: `app/results/2026/calls/CallsTracker.tsx`, `app/results/2026/calls/tracker.ts`,
`tests/intelligence/callsTracker.test.ts`, this document.

The lists above are the Calls Desk part. The whole package is 111 files (45 replaced, 66 added, 53 of the added being
the past-results data); the rest are listed in `docs/ELECTION_NIGHT_2_PATCH_1.md`, section 8.

Not touched by the Calls Desk part: the engine, the replay pack. Not touched by any part: the AP scraper, the
database, any environment switch.
