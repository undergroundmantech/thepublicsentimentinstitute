# Election Night 2.0, patch 1 (engine 2.5.0)

> **Delivered as one package with patch 2.** Patches 1 and 2 ship together as `apply_election_night_2_patch4_full.py`
> (one run on top of the final update) with one replay data pack. This document describes the patch 1 part;
> `docs/ELECTION_NIGHT_2_PATCH_2.md` describes the Calls Desk and has the combined install steps and file counts.
> File counts below (105 files) are for the patch 1 part alone.

A patch on top of the Election Night 2.0 final update (engine 2.4.0, `docs/ELECTION_NIGHT_2.md`). It answers the
review of the Situation Monitor in replay:

1. only On Point's calls are shown; civicAPI's calls are not;
2. no call popups over the map;
3. clear ways back to the full Situation Monitor and to the main results page, and a "2026 Results" tab in the header;
4. the replay controls are a bar that is part of the page and always there, not a floating card;
5. the charts are much larger, on the monitor and on the state and race pages;
6. past results (2018, 2020, 2022, 2024) for every state and county, with the shift between any two elections.
7. a past election as a map setting: the map as it voted then, the shift since, and the turnout against it, with all
   three in the hover for every county and state.

- Engine version: `onpoint-engine/2.5.0`. The race model is that of 2.4.0. What is new is in the call rule and around
  it, so that the model's own calls can carry the board without civicAPI's (section 3).
- Status: built and tested on a copy of the site. Nothing has been deployed, and no database or production setting
  was touched.
- Calibration status: unchanged. **Not calibrated.** The settings added here were chosen on the one recorded night
  and are in-sample. Every page still says "uncalibrated".
- Two parts, both needed: the code patch, and a new replay data pack built by engine 2.5.0 (section 1).

## 1. Install and roll back

The Election Night 2.0 final update must already be applied. Then, from the site's root folder:

```
python3 apply_election_night_2_patch4_full.py --dry-run
python3 apply_election_night_2_patch4_full.py
python3 apply_election_night_2_patch4_full.py --install-replay election-night-2-patch4-replay-data.zip
npx tsc --noEmit
npm run test:intelligence
```

`--verify` checks the files on disk against the patch. `--rollback` restores the files as the final update left them
(the replay pack is separate: the previous pack is kept beside the new one as `public/replay/2026.old-<time>` until
you delete it).

The updater refuses to replace a file that is not exactly the final update's version, and says which. It never
deletes anything, never runs npm, and sends nothing over the network.

**Install the new replay pack as well.** The pages now mark a race as called only on On Point's call. In a replay the
calls come from the pack's frames. Outside a replay, with no live engine running, they come from one small file inside
the pack (`public/replay/2026/onpoint-calls.json`: the calls as they stood at the last recorded update). With the code
patch applied and the old pack in place, the replay still plays, but its seat counts are civicAPI's and live pages
mark no race as called.

## 2. What changed for a visitor

### 2.1 Only On Point's calls

Every "called" mark on the 2026 results pages is now On Point's own call: the winner's check on a race page, the
filled seats and tiles, "N of M called", the map outlines, the feed, the key moments of the replay, the Calls Desk
and the seat counts on the charts. civicAPI still supplies every vote count, and is credited for it everywhere it was
before. Its winner flags are not displayed, and its calls no longer settle seats in the national projection.

One place decides it: `app/results/2026/useLive.ts` sets each race's winner flag from the engine's call ledger
(`onpointCalls.ts`), so every component that draws a winner follows without a rule of its own. civicAPI's calls are
still recorded on the ledger, unseen, because the evaluation compares the model's call times with them.

A call is labelled "On Point call", or "Unopposed" for a candidate with no opponent. The footer notice on every
results page now says that vote counts come from civicAPI, that calls are On Point's own, that they are projections
and not certified results, and it still points to the state election offices.

What is *not* changed, on purpose:

- The primary-night boards (August 18 and 25), the results archive, local races and the generic civicAPI race pages
  (`/results/race/...`, `/results/local`) still show civicAPI's winners. On Point's model never ran on those races,
  so the alternative was to show no winners at all. Say the word if you want that.
- State legislature chamber pages still count seats from civicAPI's district winners, for the same reason.

### 2.2 No call popups

The call card that slid over the map is gone. A state still flashes on the globe when its statewide race is called,
and the call appears in the feed (in bold), in the replay bar's key moments and on the Calls Desk.

### 2.3 Navigation

- The header has a **2026 Results** tab again, between Accuracy and Forecasts, with the results page, the Situation
  Monitor, the race list and the archive under it. (Results had been one column under More.)
- The monitor has a line at the top that says where you are: `< 2026 results | Situation Monitor / Florida / Florida
  Governor`. Each step is a link: "Situation Monitor" returns to the whole country from any state or race.
- On the map, the button that used to read "Florida · Back to the country" now reads "< Full monitor".
- A race page has a "Situation Monitor" button at the top right, and its first breadcrumb reads "2026 results".
- A state page has "All 2026 results" and "Situation Monitor" buttons.

The Calls Desk (`/results/2026/calls`) was unlinked and marked no-index in the final update, and it still is. I added
no link to it. It is where the reasons behind every call are, so you may want it in the menu now that the calls are
On Point's: it is one line in `app/components/navMenu.ts`.

### 2.4 The replay bar

The replay controls are a full-width bar at the foot of the page. It is part of the page: the page keeps the bar's
height free beneath its content, and the monitor is sized to end where the bar begins, so the bar never covers
anything. One row: the clock, back and forward (by update, and by key moment), play, speed, the time line with the
night's key moments marked on it, the span (election night or the whole count), key moments, options, and exit.
"Key moments" and "Options" open upward out of the bar and close with their button or Escape.

When no replay is running and a recorded night is installed, the same bar shows one line, "Election night replay",
with a "Play the night" button, on every results page. So the replay is always one click away.

On a phone the bar is the clock, play and the time line; speed, the span and the moments list are under "...".

### 2.5 Larger charts

The charts were one fixed 640-unit drawing scaled to whatever width they were given, so in the monitor's 370-pixel
side panel the type came out at about six pixels. They are now drawn at the size of their container, in real pixels:
type and line weights stay the same size at any width.

- **Monitor.** The charts moved out of the side panel into a dock under the globe, the full width of the map, one
  chart at a time with tabs: House control, Senate control, House seats, Senate seats, Governors, Popular vote. Pick
  a state or a race and the dock shows that race instead (chance of winning, projected margin, votes counted), with
  a switch back to the national charts. Three buttons at the right set the dock's size: hidden, under the map, or in
  place of the map (the chart then fills the whole centre of the screen). The masthead above was tightened to give
  the map and the chart the room.
- **Race pages.** The chance of winning is now a headline chart across the page; the projected margin and the count
  sit beneath it.
- **State pages.** New: a chart section for the state's Senate and governor's races, at the same size.
- **Runoff states.** Georgia and Louisiana need a majority, so the model gives no single chance of winning there and
  the chart used to read "No observations yet". It now draws the model's chance of finishing first in this round,
  titled and captioned as that.
- Outside a replay, with no live engine, race and state pages show the same charts for election night from the
  replay pack, under a note that says what they are: the current model run over the recorded count, not what the
  page showed on the night.

### 2.6 Past results, 2018 to 2024

New on every state page, and on every Senate, governor and statewide-office race page: how the state and each of its
counties voted for President (2020, 2024), U.S. Senate and Governor (2018 to 2024).

- A statewide table: each election, the two leading candidates, their shares, the margin and the votes cast.
- A county table: one row per county, one column per election, each cell the margin (D+12.3, R+4.5) tinted by its
  size. Pick any two elections and a **Shift** column shows the move between them in each county, with the statewide
  shift above. Every column sorts; there is a county search; the 25 largest counties show first.
- On a race page the race's own 2026 count is the first column, so the shift reads "2026 so far against 2024", county
  by county, as the networks do it. While the count is open the page says plainly that a partial count is being
  compared with a finished one.
- In the monitor, a picked state lists its past statewide results in the side panel, and hovering a county shows its
  last three margins.

Source, method and what is missing: section 5.

### 2.7 A past election on the map

The same history is a map setting, so the comparison can be read off the map by hovering.

- **Monitor.** "Colour by" has a third choice beside Results and Versus expected vote: **Past election**. It opens a
  list of elections (2024 President, 2022 Senate, 2022 Governor and so on, each with the number of states that held
  it) and three shadings:
  - *As it voted*: the map as it looked in that election, every state, and every county of an open state.
  - *Shift since*: the 2026 margin in counted votes minus that election's margin, blue toward the Democrat, red
    toward the Republican, full colour at 20 points.
  - *Turnout*: 2026 votes counted as a share of all votes cast then, amber for fewer, teal for more.

  Hovering a state or a county adds a block to its tooltip: that election's margin, the two candidates' shares and
  the votes cast, the shift since, and the turnout (share and votes), with "so far" while the 2026 count is open.
  The 2026 side is the race in view: the state's Senate or governor's race, the race whose counties are on the map,
  or in the House view every district's votes added up (the districts are then only outlined). Where a state has no
  single race to compare (the statewide-offices view with several offices, the legislature view) the shift and
  turnout shadings stay grey and the tooltip says why; "As it voted" always works.
- **Race pages** (Senate, governor, statewide office). The county map has a third view beside forecast and results:
  **past elections**, with the same list and the same three shadings. It opens on the same office the last time it
  was up. The county tooltip carries the past result, votes cast then, shift and turnout in every view.
- A shift is drawn only where the 2026 race is a Democrat (or a Democratic-aligned independent) against a
  Republican. A partial count is paler and labelled "so far"; turnout reads low until the count is in, and the
  legend says so.
- Opening a state in the monitor now fits the state to the map, whatever the size of the chart under it (it was a
  fixed zoom, which left states small once the chart dock took half the height).

## 3. Engine 2.5.0: letting the model's calls carry the board

With civicAPI's calls hidden, 2.4.0 would have left the board unfinished: 97 House seats never called, unopposed
winners never marked, and every race without a forecast blank. 2.5.0 adds five things. None of them changes a
probability the model prints.

1. **Unopposed candidates** (lane `uncontested`). A race with one real candidate listed, by the forecast and by the
   provider alike, is recorded as called when its polls close. Until now a race counted as "unopposed" while only one
   of its candidates had votes, which was harmless when nothing was called on it; the test is now on who is listed.
2. **A count that has stopped.** Where the source says when a race's total last moved (the recorded history does), a
   race read from its total, not county by county, gets the same evidence the county model has had since 2.4.0: a
   count that has been still for hours is probably finished. After three days of silence (five in the states that
   count for days) the count is taken as over. The open-count safeguards then give way to tests on the votes
   actually counted: the leader must be at least 0.5 points ahead (most states' recount line), and a race the model
   gives 95% or more is called on a counted lead of a full point (lane `count-settled`). A provisional-ballot sliver
   arriving after half a day of silence does not restart the clock.
3. **Races with no forecast** (lane `count-settled`). The model cannot reason about them, so they are called on
   arithmetic alone: once the count has stopped with the leader 10 points clear, or earlier when the lead is at least
   20 points and three times the vote the provider lists as uncounted. In the states that count for days the early
   path needs 40 points: California showed "100%" on election night with half its mail uncounted.
4. **Ranked choice.** Still never called on the simulated final round. Called when a majority of first choices is
   certain, since a majority needs no transfers.
5. **The seat counts.** The national projection used to take civicAPI's winner flags as settled seats. It now takes
   On Point's calls instead, and "seats called" on every page and chart counts those. A seat that only one party
   can win (two Democrats in a top-two general) counts for that party once its polls close, before a winner is named.

Two guards came out of testing this on the recorded night:

- **A count that goes down.** Indiana's 3rd district lost 27,000 votes at the source for seventeen hours on November
  4 and showed the wrong leader. With "a still count is a finished count" in the model, that could have become a
  wrong call. A race whose total is more than 2% below its own earlier high is now flagged (`COUNT_DECREASED`), the
  flag blocks any call, and the stillness evidence is not used. After a day at the lower figure it is taken as the
  provider's correction (New York's totals were tripled for most of a day and then fixed).
- **The provider's percent.** See point 3.

Every number is in `DEFAULT_CALL_CONFIG.finished` (`app/lib/engine/modelCalls.ts`) and `turnout.quietTotal`
(`config.ts`), with the reasoning beside it.

What 2.5.0 does not do: it does not call a race inside half a point, it does not call ranked-choice races that go to
a second round, and it does not speed up the states that count for days. Those races stay uncalled on the board
until an operator records an editorial call (the mechanism exists; nothing here uses it).

## 4. The recorded night under 2.5.0

The archive and the replay pack were rebuilt from the recorded civicAPI history under 2.5.0 (536 frames, November 3
at 6 p.m. Eastern to November 11 at 9 p.m.). Outcomes below are the recording's own last frame, not certified
results: this is a pipeline test, not calibration.

| | races with returns | called by On Point | not called |
|---|---|---|---|
| U.S. Senate | 35 | 33 (D 19, R 13, I 1) | 2 |
| Governor | 36 | 35 (D 23, R 12) | 1 |
| U.S. House | 435 | 403 (D 246, R 157) | 32 |
| Statewide offices | 151 | 129 | 22 |
| Ballot measures | 140 | 120 | 20 |
| Courts and other | 16 | 13 | 3 |

- **733 calls, none wrong** against the last recorded count. By lane: standard 506, safe seat 165, count settled 44,
  uncontested 18.
- **Chambers.** Senate: 20 called for Democrats and independents who caucus with them, 13 for Republicans, with 34
  and 31 not up. House: 246 to 157 called, 32 open. Governors: 23 to 12 called. All three are decided on On Point's
  own calls.
- **Not called, on purpose.** Races inside half a point when the count stopped (recount territory: Mississippi
  Senate at 0.49, six House seats, three statewide offices); ranked-choice races without a first-choice majority
  (Alaska Senate and governor, Maine's 2nd district); close races in the states that count for days; measures whose
  projected range still includes a loss.
- **Election night.** Georgia Senate 8:14 p.m., North Carolina Senate 8:40, Texas Senate 9:26, Florida governor and
  Ohio Senate 10:52, Maine Senate 12:52 a.m. (ranked choice, on a first-choice majority), Louisiana Senate 1:00,
  Nebraska Senate 1:28, Michigan Senate 1:44. Kansas governor, the closest call on the board (0.7 points), came on
  November 7 once the count had stopped.
- **Alerts: 3**, each kept on the record. Texas 11 and California Proposition 42: the called side's probability
  dipped (85% and 90%) and recovered. Indiana 3: civicAPI's count dropped by 27,000 votes and briefly showed the
  other candidate ahead; the call stood and was right, and the new COUNT_DECREASED guard kept the drop from being
  read as a finished count.
- **Against civicAPI's own calls** (evaluation only, never shown): of 616 races both called, On Point was first in
  307; median difference zero.
- **Internal benchmark, not for publication:** against the AP call times kept for testing, of the 48 Senate and
  governor races AP called on the count (not at poll close), On Point was first in 27 and level in 2, median 11
  minutes earlier; in the 31 competitive ones, first in 18, median 18 minutes earlier. Where AP calls a safe seat at
  poll close, On Point waits for votes and is later.
- Pipeline-test scoring (held-out half): Brier 0.021, margin error 1.6 points, 96.6% of outcomes inside the 95%
  range. The report still carries its PIPELINE TEST - NOT CALIBRATION banner; nothing is labelled calibrated.

## 5. Past results: source, method, checks

**Source.** The MIT Election Data and Science Lab's election returns: its precinct-level returns for 2018, 2020,
2022 and 2024, and its 2024 county-level Senate file. MEDSL publishes them on the Harvard Dataverse under CC0 1.0
and asks to be cited; the pages cite it under every table. Election returns are public records of the states.

*Where the copies came from, so you can decide whether to refresh them.* I read the files from MEDSL's public GitHub
repositories. The 2022 and 2024 repositories are current. The 2018 repository is marked deprecated in favour of the
Dataverse, and the 2020 files are no longer at the head of their repository (they are in its history). The Dataverse
versions may carry later corrections, and several sit behind a short form asking who is downloading. If you want the
current versions, download them from the Dataverse yourself and rebuild; it is one command and takes about ten
minutes:

```
python3 scripts/history/build_past_results.py <folder with the MEDSL files> --out public/results/history
```

**Method** (`scripts/history/build_past_results.py`, documented at its head). Precinct rows are added up to
counties. A precinct that carries a TOTAL row is counted from it alone, otherwise from its vote-mode rows, so nothing
is counted twice. A candidate's votes on every party line are his (fusion states). The two sides of a contest are its
two leading candidates statewide: the Democrat, or whoever is not the Republican, on one side (an independent such as
King, Sanders or Osborn stands there and is named); the Republican on the other. A contest between two candidates of
one party is marked and no party shift is drawn from it. Lines that are not candidates (TOTAL VOTES CAST, UNDERVOTES)
are dropped.

**Checks.** Every contest that has a 2024 statewide file from the same source was compared with it: 83 contests, median
difference 0.00%; anything more than 3% off for either major party loses its counties (three contests, above). A
second full run of the script reproduced every count in every file exactly. Twenty-eight results were also checked
by hand against certified totals (for example Georgia governor 2022, Arizona and Ohio President 2020, Wisconsin
Senate 2022, Pennsylvania Senate 2024: exact). The tests assert that every contest's counties add up to its
statewide line, that names are a candidate's full name, and that `states.json` agrees with the state files.

**Names.** Some states list a ticket (governor and running mate) or only a surname. The pages show the head of the
ticket by full name; the script's short table of these is keyed by state so that a common surname is never guessed.

**Statewide only.** For President 2024 in Indiana, Louisiana and New Jersey the precinct files are wrong (see
section 6), so their counties are left out; the statewide line is taken from MEDSL's statewide file and marked
"statewide only". MEDSL has no 2020 precinct returns for Indiana, so Indiana has no 2020 presidential line.

**Size.** 53 small files, about 0.75 MB in all, in `public/results/history`. A state's file is fetched when its page
or its panel in the monitor opens; `states.json` (every state's statewide lines, 42 KB) is fetched when the monitor
is first set to a past election.

## 6. Things to know

- **Live pages after the election.** With no live engine running, a results page marks as called the races the engine
  had called by the last recorded update (November 11, 9 p.m. Eastern). Races still uncalled then show a leader and
  no winner. The call *times* in that file are replay times and appear only inside the replay.
- **A finding outside this patch.** `public/forecast/pres24_counties.json`, the site's existing 2024 presidential
  county file, disagrees with MEDSL's statewide totals in six states: Oklahoma, Connecticut and Rhode Island are
  doubled, Louisiana has about half its vote, New Jersey is about 25% high and Indiana 5% high. The same faults are
  in MEDSL's precinct files for Louisiana, New Jersey and Indiana, which is why this patch shows those three
  contests statewide only, with no counties. Doubling does not move a margin, so the map that uses the file is mostly unaffected, but Louisiana's
  margins there rest on half the vote. I did not change the file.
- **The key-moments list** shows On Point's calls, alerts on them, lead changes and the chambers. A replay pack built
  before 2.5.0 still carries civicAPI's calls as moments; the bar hides them.
- **Operator switches** are unchanged from the final update.

## 7. Verification

Run in a sandbox copy of the site; nothing was deployed and no production system or database was touched.

- `npx tsc --noEmit`: clean.
- `npm run test:intelligence`: 390 tests, 384 pass, 6 skipped (the same six as before), 0 fail. New: 14 tests of the
  calls shown on the pages, 10 of the past results and the map setting.
- ESLint over everything touched: no new problems (one fewer than the final update; what remains was there before).
- `next build --webpack`: compiles, 4,776 pages generated.
- The archive was recorded from the history, then every frame was computed a second time and compared with what was
  stored: all 536 of 536 match, and the chain of frames has no breaks.
- The pages were opened in a browser at desktop and phone widths, dark and light, in replay and outside it: monitor
  (national, a state, each past-election shading, House view), race page, state page, main results page, header
  menu. No page errors and no sideways scrolling.
- The updater was run on a clean copy: it refuses a checkout without the final update; on top of the final update a
  dry run changes nothing; applying writes 105 files and verifies them; `--verify` passes; TypeScript and the tests
  pass in the patched copy; `--install-replay` installs and checks 2,368 files; `--rollback` returns the copy to the
  final update exactly.

## 8. Files

Three files to hand over, plus this document:

| file | what it is |
|---|---|
| `apply_election_night_2_patch4_full.py` | the updater (the changes are inside it). Run from the site root. |
| `election-night-2-patch4-full-changes.zip` | the same 105 files with a manifest of checksums, to read or diff |
| `election-night-2-patch4-replay-data.zip` | the replay pack rebuilt under 2.5.0, 59 MB, with `onpoint-calls.json` |

Both parts are needed: the code without the new pack shows no race as called outside a replay.

43 files changed, 62 added (53 of them the past-results data in `public/results/history`).

*Engine:* `app/lib/engine/` civicHistory, config, modelCalls, moments, national, pipeline, raceModel, snapshot,
types; `scripts/engine/export_static_replay.ts`.

*Pages:* `app/results/2026/` EngineCharts, EngineRaceCharts, NationalDesk, NightDesk, ReplayDock, replayDock.css,
engineClient, engineRow, nationalTally, useLive, onpointCalls (new), `[id]/` page, StateLive, StateCharts (new),
stateResults.css, and `calls/`; `app/results/monitor/` Monitor, MonitorCharts, Chambers, RaceBrief, monitor.css,
seatMath (new); `app/results/history/` PastResults and pastResults (new); `app/results/ResultsNotice.tsx`;
`app/components/` Navbar, navMenu.

*Data and scripts:* `public/results/history/` (new), `scripts/history/build_past_results.py` (new).

*Tests and docs:* five test files updated, `onPointCalls.test.ts` and `pastResults.test.ts` new;
`docs/ELECTION_NIGHT_2.md` gains a pointer to this document.

Not touched: the AP scraper (not added, changed or removed), the database, any environment switch, the primaries
boards, the archive, local and legislature pages, `public/forecast/`.
