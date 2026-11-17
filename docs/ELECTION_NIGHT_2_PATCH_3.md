# Election Night 2.0, patch 3: entering the monitor, and Pointy in the Pro modes

> A fourth part followed (`docs/ELECTION_NIGHT_2_PATCH_4.md`): today's civicAPI count and engine 2.5.1, with a new
> replay data pack. All four parts ship in one updater, `apply_election_night_2_patch4_full.py`.

The third and last part of the patch to the Election Night 2.0 final update. It ships in the same single updater as
parts one and two (`docs/ELECTION_NIGHT_2_PATCH_1.md`, `docs/ELECTION_NIGHT_2_PATCH_2.md`). Three small things, all
front end. The engine (`onpoint-engine/2.5.0`), the call rules and the replay data pack are unchanged.

## 1. Install and roll back

One updater and one replay data pack carry all three parts. The Election Night 2.0 final update
(`apply_election_night_2.py`) must already be applied. From the site's root folder:

```
python3 apply_election_night_2_patch4_full.py --dry-run
python3 apply_election_night_2_patch4_full.py
python3 apply_election_night_2_patch4_full.py --install-replay election-night-2-patch4-replay-data.zip
npx tsc --noEmit
npm run test:intelligence
```

The replay data pack was rebuilt in part four; install it. `--verify` checks the files on disk; `--rollback` restores them as they were before the run.
The updater also runs on a checkout that already has part one, or parts one and two, and then writes only what
differs. It never deletes anything, never runs npm and sends nothing over the network.

## 2. What changed

**The 2026 Results tab opens the full experience.** Clicking the tab in the header now goes to the Situation Monitor
(it went to the main results page). Hovering the tab still opens the menu with every results page: 2026 results,
Situation Monitor, Calls desk, Every race, Results archive, How the forecast did. On a phone the menu lists the same
links.

**An opening screen for the monitor.** Entering the monitor used to show it half-built: the menu still open over
the old page, then an empty globe, then the panels filling in. Now:

- at the click on any link to the monitor, anywhere on the site, the menu closes and the opening screen goes up at
  once, before the route has changed;
- the same screen is the monitor's loading state while its code arrives;
- the monitor keeps it up until the map, the race list and the results are in (in a replay, until the first frame is
  in), for at least a second and a half so it never flashes, then fades it out over half a second.

The screen is a small animated wireframe globe, the name, and a progress line. It is the same in all three
appearance modes (dark and light versions), has no character on it, announces itself to screen readers as a loading
status, and stands still under "reduce motion". Safety limits: the click-time screen clears itself after eight
seconds if the route never changes, and the monitor's after twelve whatever happens. A new-tab click
(Ctrl, Cmd, Shift, middle button) is left alone.

**Pointy stays out of Pro Dark and Pro Light.** The home page globe drew the character walking between the closest
races in every mode. He, his dotted route, his footprints and his speech bubble now appear only in the Theme mode;
the Pro modes show the globe, the beacons on the closest races and the list beside it. Everywhere else on the site
the character already followed this rule.

## 3. Verification

- `npx tsc --noEmit`: clean.
- `npm run test:intelligence`: 397 tests, 391 pass, 6 skipped (the same six), 0 fail. New: 3 tests of the tab's
  target and menu, the opening screen's three stages and limits, and the home globe's mode check.
- ESLint on the changed files: no new problems.
- `next build --webpack`: compiles, 4,776 pages generated.
- In a browser: home page in Pro Dark and Pro Light, no character on the globe; in Theme, he is there. Hovering the
  tab opens the menu (7 links); clicking it closes the menu and shows the opening screen within 150 ms, the address
  changes to the monitor, and the screen fades once the monitor is ready. No page errors.
- The updater on clean copies: it refuses a checkout without the final update; on top of the final update a dry
  run changes nothing; applying writes 117 files (46 replaced, 71 added) and verifies them; `--verify` passes;
  `--install-replay` installs and checks 2,368 files; TypeScript and the tests pass in the patched copy; `--rollback`
  returns the copy to the final update exactly. On a copy that already has parts one and two it writes only the 12
  files that differ; on a copy with part one alone, 19.

## 4. Files

Changed: `app/components/Navbar.tsx`, `app/components/navMenu.ts`, `app/components/home/HomeGlobe.tsx`,
`app/results/monitor/Monitor.tsx`.

Added: `app/results/monitor/MonitorSplash.tsx`, `app/results/monitor/monitorSplash.css`,
`app/results/monitor/loading.tsx`, `tests/intelligence/patch3Entry.test.ts`, this document.

Not touched: the engine, the replay pack, the AP scraper, the database, any environment switch.
