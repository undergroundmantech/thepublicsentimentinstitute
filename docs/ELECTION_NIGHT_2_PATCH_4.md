# Election Night 2.0, patch 4: today's civicAPI count, and the final phase of the count (engine 2.5.1)

> A fifth part followed (`docs/ELECTION_NIGHT_2_PATCH_5.md`): only races being counted are shown, a click on Results
> goes straight to the results, and the opening screen waits for the count. It ships in the same updater,
> `apply_election_night_2_patch5_full.py`, with a new replay pack, `election-night-2-patch5-replay-data.zip`.

The fourth part of the patch to the Election Night 2.0 final update, shipped with parts one to three in one updater.
It brings On Point's calls up to civicAPI's count as of 3:21 p.m. Eastern on November 16, and adds the rules the model needed for the last
stretch of a count: measures judged against their passing bar, and a "final phase" ten days after the polls close.

- Engine: `onpoint-engine/2.5.1` (was 2.5.0).
- Replay data pack: rebuilt, `election-night-2-patch5-replay-data.zip`. It carries the calls the live pages show.
- Status: built and tested on a copy of the site. Nothing has been deployed; no database or production setting touched.
- Calibration status: unchanged. **Not calibrated.**

## 1. Install

The Election Night 2.0 final update (`apply_election_night_2.py`) must already be applied. From the site's root:

```
python3 apply_election_night_2_patch5_full.py --dry-run
python3 apply_election_night_2_patch5_full.py
python3 apply_election_night_2_patch5_full.py --install-replay election-night-2-patch5-replay-data.zip
npx tsc --noEmit
npm run test:intelligence
```

**Install the new replay pack even if an earlier one is installed**: it is what moves the live pages to today's calls.
The updater also runs on a checkout that has any of the earlier patch packages, and then writes only what differs.
`--verify` checks the files; `--rollback` restores them as they were before the run.

## 2. Where the data comes from

civicAPI's public race endpoint, the one the site's own pages read: one pass over the 886 races in the recorded
history, one request at a time with a pause between them and an identifying User-Agent (about 15 minutes a pass). Two
passes were made, at 2:43 to 3:00 p.m. and 3:06 to 3:21 p.m. Eastern on November 16 (the second pass found no change since the first). Each race's state is added to the history as published, at the time it was fetched,
and also at civicAPI's own "last updated" time where the state had changed since the history's last entry. Nothing
is interpolated. The model then runs over the whole night again, from 6 p.m. on November 3 to today, exactly as it
would have run live, so every call in the pack has its real time.

The two scripts are in the site, for the next refresh:

```
python3 scripts/engine/fetch_civic_live.py <new folder> <history folder>
python3 scripts/engine/append_civic_live.py <history folder> <new history folder> <new folder> [<more folders>]
node --import ./scripts/intelligence/ts-resolve.mjs scripts/engine/build_civic_replay.ts --history <new history folder> --store <archive> --until <time>
node --import ./scripts/intelligence/ts-resolve.mjs scripts/engine/export_static_replay.ts --history <new history folder> --store <archive> --out public/replay/2026
```

Run them only while counts are still changing, a few times a day at most. The rebuild takes about an hour and a half.

## 3. What changed in the model (2.5.1)

**Measures are judged against their bar.** A measure was treated like a two-candidate race: the side with more votes
"led". Florida's Amendment 2 had 58% Yes, which is a 16-point Yes lead, and failed, because Florida needs 60%. The
model's own simulation already applied the bar, so the model said No while the count "said" Yes, and the race could
never be called. Now the leader in the count is the side the count puts over or under the bar, the margin is the
distance from the bar, and the stress test against the outstanding vote starts from the right side of it. For a
simple-majority measure nothing changes. Measures with a higher bar: Florida (60%), Colorado amendments (55%), New
Hampshire (two-thirds), Minnesota, Tennessee, Hawaii and Wyoming (a majority of all ballots cast, about 53%).

**The final phase.** Ten days after a race's polls close, the canvass is over or nearly so. From then on:

- a count that has stopped is settled at the recount floor (half a point) as long as the model still favours the
  leader at 85% or more (before, it needed 1 point and 95%);
- a lead of 10 points or more is not held back by civicAPI's percent-reporting field, which it leaves at 0 for some
  states' measures (Alaska's Measure 3 sat at 68-32 marked "0%"), once the count has stopped, or once the model counts
  90% of its expected vote in and is past the call threshold;
- a race with no forecast (California's same-party seats) is called while still counting at a 10-point lead that is
  three times the vote listed as uncounted (it needed 40 points in a slow state).

Nothing else changed: the call threshold (99.3%), the recount floor, the ranked-choice rule and every other safeguard
are as in 2.5.0. Candidate races on election night are unchanged; the new rules reach races ten days on, and
measures with a bar above a simple majority.

## 4. Results as of 3:21 p.m. Eastern on November 16

**770 calls, none wrong** against civicAPI's current count, with each measure judged against its bar (the first
build of this patch flagged New Hampshire Question 1 as wrong: it is right; Yes has 64.8% and needs two-thirds).
Every one of On Point's calls agrees with civicAPI's own call where civicAPI has made one.

| | races civicAPI covers | called by On Point | not called |
|---|---|---|---|
| U.S. Senate | 35 | 34 (D 20, R 13, I 1) | 1 |
| Governor | 36 | 35 (D 23, R 12) | 1 |
| U.S. House | 435 | 417 (D 251, R 166) | 18 |
| Statewide offices | 151 | 139 | 12 |
| Ballot measures | 140 | 131 | 9 |
| Courts and other | 16 | 14 | 2 |

New since patch 1: 37 calls, among them Mississippi Senate (Scott Colom, 0.78 points, on the count after ten days),
Florida Amendment 2 (No: 58.2% against a 60% bar), New Hampshire Question 1 (No), Ohio attorney general and
treasurer, Iowa treasurer, Oklahoma's four statewide offices, Washington Initiatives IL26-638 and IP26-645, and 15
House seats in Arizona, California, Florida, New York, North Carolina and South Carolina, several settled at half a
point to a point and a half once their counts had stopped. No call was withdrawn or changed winner. Seven measures
with a bar above a simple majority (Colorado, Florida Amendment 3, Hawaii, Minnesota) keep their winner and move in
time, earlier or later, now that the count is read against the bar. Chambers: Senate 55 to 44 with Alaska open; House 251
to 166 called, plus 5 California seats contested by two Democrats; governors 23 to 12 called.

**Not called, and why** (44 races, plus 116 in the site's index that civicAPI does not cover):

- *Ranked choice, awaiting the tabulation* (4): Alaska Senate, Alaska governor, Alaska's House seat, Maine's 2nd
  district. No candidate has a majority of first choices; Alaska and Maine run the rounds after the count is in. The
  model calls these only on a certain first-choice majority.
- *Recount territory, under half a point* (8): Florida 7th and 27th, North Carolina 3rd and 5th, Tennessee 4th,
  Minnesota 1st, Louisiana 6th (runoff rule), Michigan State Board of Education.
- *Still counting* (13): California 23rd, Washington 5th, Colorado 4th, Louisiana 5th, California Propositions 4 and
  5, Colorado Amendments 85 and 87 and Propositions 135 and 136 (86% in), Washington Initiative IL26-001, Alaska
  Measures 2 and 3 (Alaska counts absentee ballots through November 18; the model has 86% of its expected vote in).
- *No forecast, lead under 10 points* (7): California's same-party seats 4, 7, 11, 14 and 40 and its insurance
  commissioner, and Montana PSC district 5.
- *Multi-seat boards, not modeled* (4): Arizona Corporation Commission and Michigan's three university boards.
- *civicAPI's returns arrived today* (2): Iowa secretary of agriculture and auditor (first count published 4:05 a.m.
  today; the model waits for three updates).
- *civicAPI lists no votes* (5): Alabama agriculture commissioner, Massachusetts and Missouri auditors, Wyoming
  superintendent, Missouri Supreme Court retention.

These will be called as civicAPI's count settles them: rerun the refresh (section 2) and reinstall the pack.

**One finding on the model, not on the calls.** Massachusetts Question 7 opened with 1,135 votes counted and the
model at 100% for Yes; No won by 1.3 points. The first-report quarantine and the other safeguards kept that from ever
becoming a call (it was called correctly for No today), but it is the model's only confident miss on the whole board
and points at measures' early uncertainty being too narrow. It is noted for the next model review, not changed here.

## 5. On the Calls Desk

A fifth status, **Still counting**, for a race with votes in and a lead of 5 points or more that is not called yet (the
count, or Alaska's or Maine's ranked-choice tabulation, is still to finish). "Too close to call" is now only a lead
under 5 points; before, every uncalled race with 95% in was labelled "too close", which read wrongly for Alaska's
governor's race at 23 points. A race civicAPI lists with no percent reporting is judged on its lead.

## 6. Live pages

Tested in a browser against civicAPI itself (this time the sandbox could reach it), outside any replay:

- the Calls Desk and the Situation Monitor read civicAPI's current count and show all 770 of On Point's calls, each with
  the right winner, and no civicAPI call;
- 22 races the live pages had never found now appear: civicAPI files them under office names the live search did
  not ask for ("Statewide" for South Carolina's six offices, "State Supreme Court", "Chief Financial Officer", and so
  on), and three Washington measures under "Local", which is read by race id instead. The engine already had all of
  them. Each type is one more cached request per five minutes (the proxy caches for every visitor), each id one more;
- a race pinned to its civicAPI id is now that race or nothing: two Washington initiatives used to be read from the
  same third measure when their own was missing;
- the monitor's chamber panels said "422 of 435 called by On Point" where On Point had called 417: the other five are
  California seats with two Democrats on the ballot, which count toward the seats but are not On Point's calls. The
  label now says so ("417 of 435 called by On Point · 5 decided within one party").

## 7. Verification

Run in a sandbox copy of the site; nothing was deployed and no production system or database was touched.

- The archive was recorded from civicAPI's history plus today's two passes, then every frame was computed a second
  time and compared with what was stored: all 540 of 540 match, and the chain of frames has no breaks. (The
  recording was interrupted once by the environment at November 10 and continued from its last stored frame.)
- Before adding the new pins, the matcher was run over every race in today's data: all 1,016 races map to the same
  civicAPI race as in the recorded archive.
- `npx tsc --noEmit`: clean. `npm run test:intelligence`: 400 tests, 394 pass, 6 skipped (the same six), 0 fail. New:
  measures against their bar, the final phase, the "Still counting" status, and the live search's pins and types.
- ESLint over everything touched: no new problems.
- `next build --webpack`: compiles, 4,776 pages generated.
- Pipeline-test scoring, held-out half (outcomes are civicAPI's last frame, measures against their bar; not
  certified results, not calibration): Brier 0.023, margin error 1.8 points, 94.3% of outcomes inside the 95% range,
  no frame at or above the call threshold on a loser.
- Live pages in a browser against civicAPI: section 6.
- The updater on clean copies: it refuses a checkout without the final update; on top of the final update a dry run
  changes nothing; applying writes 125 files (51 replaced, 74 added) and verifies them; `--verify` passes;
  `--install-replay` installs and checks 2,372 files; TypeScript and the tests pass in the patched copy; `--rollback`
  returns the copy to the final update exactly. On a copy with the previous package (parts one to three) it writes
  the 24 files that differ.

## 8. Files

Changed: `app/lib/engine/config.ts`, `app/lib/engine/types.ts`, `app/lib/engine/raceModel.ts`,
`app/lib/engine/modelCalls.ts`, `scripts/engine/build_civic_replay.ts`, `app/results/2026/calls/tracker.ts`,
`app/results/2026/calls/CallsTracker.tsx`, `app/results/2026/calls/calls.css`, `tests/intelligence/onPointCalls.test.ts`,
`tests/intelligence/callsTracker.test.ts`, the three earlier patch documents (install lines).

Also changed: `app/lib/engine/evaluate.ts` and `scripts/engine/evaluate.ts` (measures scored against their bar),
`app/results/2026/live.ts`, `app/results/2026/useLive.ts`, `app/api/civic/search/route.ts` (the live search),
`app/results/2026/nationalTally.ts`, `app/results/2026/NationalDesk.tsx`, `app/results/monitor/Monitor.tsx` (the labels).

Added: `scripts/engine/fetch_civic_live.py`, `scripts/engine/append_civic_live.py`, this document.

Not touched: the AP scraper, the database, any environment switch.
