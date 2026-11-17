# Election Night 2.0, patch 5: only races being counted, and the way into the results

The fifth part of the patch to the Election Night 2.0 final update, shipped with parts one to four in one updater.
It hides every race with no votes counted, makes a click on Results go straight to the results, and keeps the
opening screen up until the results have loaded.

- Engine: `onpoint-engine/2.5.1` (unchanged; no call changed).
- Replay data pack: rebuilt, `election-night-2-patch5-replay-data.zip`. Only `onpoint-calls.json` differs from the
  patch 4 pack: it now also lists the races that had votes counted (or a call) at any point of the night.
- Status: built and tested on a copy of the site. Nothing has been deployed; no database or production setting touched.
- Calibration status: unchanged. **Not calibrated.**

## 1. Install

**If patch 4 is installed** (`apply_election_night_2_patch4_full.py` with its replay pack, November 16), use the
patch 5 updater alone: it replaces 19 files and adds 4, and its replay update replaces one file of the installed pack.
From the site's root:

```
python3 apply_election_night_2_patch5.py --dry-run
python3 apply_election_night_2_patch5.py
python3 apply_election_night_2_patch5.py --install-replay election-night-2-patch5-replay-update.zip
npx tsc --noEmit
npm run test:intelligence
```

It refuses to run unless patch 4 is in place, and the replay update refuses unless the installed pack is patch 4's.
`--verify` checks the files; `--rollback` undoes the last step of this patch (run it twice to undo both) and never
reaches back into patch 4 or the final update.

**Otherwise** (the final update with none or only some of patches 1 to 4), use the combined updater, which carries
parts 1 to 5 and the whole replay pack:

```
python3 apply_election_night_2_patch5_full.py --dry-run
python3 apply_election_night_2_patch5_full.py
python3 apply_election_night_2_patch5_full.py --install-replay election-night-2-patch5-replay-data.zip
```

Either way, both steps are needed: the code hides races with no votes, and the replay data tells it which races had
votes (without it, the replay shows every race, as before). The combined updater's `--rollback` likewise undoes only
its own run (every updater shares the backup folder; before, a second rollback could reach into the final update).

## 2. Only races being counted are shown

A race appears on the results pages (the Situation Monitor, the 2026 results hub, each state's page and the Calls
Desk) only once votes are being counted in it.

- **In the replay**, a race is shown for the whole night if it had votes counted, or an On Point call, at any point
  of the night; one that never had a vote counted is hidden the whole time, rather than appearing and disappearing.
  808 races are shown and 121 are hidden (the list sent to civicAPI's owner: Los Angeles mayor, the Missouri Supreme
  Court retention, Alabama's agriculture commissioner and the rest).
- **Live**, a race is shown once civicAPI lists votes for it or On Point has called it. While the first live read is
  still arriving, the replay pack's list stands in, so the pages never flash every race and then drop some.
- The state legislature chamber panels are always shown (they are seat totals, not a single count).
- Nothing is deleted. A hidden race's own page still opens from a direct link and stays in the sitemap; it shows
  again on its own the moment civicAPI publishes votes for it.

**Races civicAPI has published since the recording.** Live, 842 races are shown, 34 more than the replay: civicAPI
has since published counts for the Nebraska Legislature (25 seats), Utah's State Board of Education (6), Louisiana
PSC districts 1 and 5, Nebraska PSC district 2 and the Kentucky Supreme Court's 3rd district. They show with their
counts but **without On Point calls**, because the recorded history the calls are built from does not have them yet.
The next refresh (patch 4, section 2) should add civicAPI's new races to the history before the rebuild.

**Three wrong matches removed.** The live search matched three races to a different civicAPI race that shares a
candidate's surname: the Missouri Supreme Court retention of Paul C. Wilson (to Missouri's auditor race), New Mexico
Supreme Court Justice David Thomson (to New Mexico House district 24) and D.C. State Board of Education Ward 1 (to
Ward 6). Each is now pinned as "no civicAPI race yet" and is never guessed at; when civicAPI publishes the race, add
its id to `CIVIC_PINS` in `app/results/2026/live.ts`.

**For civicAPI's owner (no code change):** for Wyoming's superintendent of public instruction, civicAPI lists Chad
Auer and Sergio Maldonado; the site's race lists Ana Cordova and Steve Harshman. One of the two candidate lists needs
checking before votes arrive.

## 3. The Results tab

- **Desktop, click:** goes straight to the Situation Monitor. The large menu closes at the click and stays closed on
  arrival, even though the pointer is still over the tab; it opens again only after the pointer has left the tab and
  come back. The same holds for every tab and every link inside the menu.
- **Desktop, hover with a mouse:** opens the full menu, as before. Keyboard users get it on focus (Tab), not after a
  click.
- **Phone, tap:** Results is now the first tab of the bottom bar (six tabs). A tap goes straight to the monitor.
- **Phone or tablet, hold (about half a second):** opens the full menu instead, at the 2026 Results section, with a
  small vibration where the phone supports it. Releasing the hold does not navigate. In the phone menu, tapping a
  section's name goes to its page; the arrow beside it opens its list.

## 4. The opening screen stays until the results have loaded

The monitor sometimes opened with an empty map: the screen faded once the map was drawn, before the count had been
read. It now stays up until all of these are in: the map, the race list, the model's state and, live, the first read
of civicAPI's count (in the replay, the recorded night). Its line under the logo follows along ("Drawing the map",
"Loading the races", "Reading the count from civicAPI", "Putting On Point's calls on the map"). It shows for at least
1.6 seconds so it never flickers, and gives way after 30 seconds at most whatever happens, so it can never trap
anyone.

To shorten that wait, the browser now reads the site's cached results proxy four office types at a time instead of
one after another. **civicAPI sees no more requests than before**: the proxy still asks civicAPI for each type at
most once every five minutes and serves everyone else from its cache, and the forecast route's own reads of civicAPI
are still one type at a time.

Also fixed: the 2026 results hub could render a different race count on the server than in the browser (a
hydration warning, and a moment of "…" in place of the count). It now waits until it is on the page.

## 5. Verification

Run in a sandbox copy of the site; nothing was deployed and no production system or database was touched.

- In a browser (desktop, tablet and phone sizes), against the dev server: a click on Results shows the opening screen
  at once, the menu closed, and the monitor with its results; no menu after arrival; hover after leaving reopens it.
  A held touch opens the menu without navigating; a tap navigates. The phone bar's Results tab, held, opens the menu
  at 2026 Results. A direct open of the monitor in replay waits for the recording. One opening screen throughout, no
  second one.
- Replay: 808 races shown at every point of the night, none of the 121 never-counted races at any point. Live: 842.
- No hydration warnings on the results pages (the remaining development notice is the pre-existing head-script one).
- `npx tsc --noEmit`: clean. `npm run test:intelligence`: 407 tests, 401 pass, 6 skipped (the same six), 0 fail. New:
  which races are shown, live and in the replay; the pack's counted list; the three pins; the Results tab's click,
  hover and hold rules; the opening screen waiting for the count.
- ESLint over everything touched: no new problems.
- `next build --webpack`: compiles.
- The combined updater on clean copies: it refuses a checkout without the final update; on top of the final update
  a dry run changes nothing; applying writes 135 files (57 replaced, 78 added) and verifies them; `--verify` passes;
  `--install-replay` installs and checks 2,372 files; TypeScript and the tests pass in the patched copy, which is
  identical to the working tree; `--rollback` returns the copy to the final update exactly. On a copy with the patch 4
  package it writes the 23 files that differ and ends identical; on a copy with patch 1 alone it writes 48.
- The patch 5 updater: on a copy with patch 4 and its replay pack, a dry run changes nothing; applying writes 23
  files (19 replaced, 4 added) and verifies them; the replay update replaces one file and checks it; the copy is then
  identical to the working tree, and TypeScript and the tests pass; `--rollback` twice returns it to patch 4 exactly,
  and a third says there is nothing to undo. It refuses a checkout without patch 4, and the replay update refuses a
  pack that is not patch 4's.

## 6. Files

Added: `app/results/2026/shownIndex.ts`, `tests/intelligence/shownIndex.test.ts`,
`tests/intelligence/patch5Nav.test.ts`, this document.

Changed: `app/results/2026/useLive.ts`, `app/results/2026/LiveProvider.tsx`, `app/results/2026/RacesHub.tsx`,
`app/results/2026/[id]/StateLive.tsx`, `app/results/2026/live.ts` (the three pins), `app/results/2026/onpointCalls.ts`,
`app/results/monitor/Monitor.tsx`, `app/components/Navbar.tsx`, `app/components/MobileTabs.tsx`, `app/chrome.css`,
`app/phone.css`, `app/api/results/forecast/route.ts` (a comment), `scripts/engine/export_static_replay.ts` (the counted
list), `tests/intelligence/patch3Entry.test.ts`, `tests/intelligence/civicReplay.test.ts`, the earlier patch documents
(install lines).

Not touched: the AP scraper, the database, any environment switch.
