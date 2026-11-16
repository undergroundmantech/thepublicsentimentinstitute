# Election Night 2.0: handoff

One document for the whole update (Phases 0 to 5, the final audit, and the recorded replay of election night built
from civicAPI's history). It replaces the four per-phase reports.

> **Patched by engine 2.5.0: read `ELECTION_NIGHT_2_PATCH_1.md` with this.** Since that patch the pages show On
> Point's own calls and nothing else, so wherever this document says a page shows civicAPI's call as the "official
> call" (sections 3, 6 and 9), the page now shows On Point's call instead; civicAPI's calls are still recorded on the
> ledger and used in the evaluation. The replay controls are a bar docked to the foot of the page, the charts are
> drawn at the size of their container, and the figures of section 9 are superseded by section 4 of the patch note.

- Engine version: `onpoint-engine/2.4.0`. New in 2.4.0: the 71 Senate and governor's races are modeled county by
  county in the recorded replay (section 4), which is what lets a contested state be called while it is still
  counting. House races, statewide offices and measures are modeled exactly as in 2.3.0. The call rule is that of
  2.3.0 with one addition for county-modeled races (section 6).
- Status: built and tested on a copy of the site. Nothing has been deployed, no database or production setting
  was touched, and every new capability is off until an operator switches it on.
- Calibration status: **not calibrated.** The real night has now been run through the engine (section 9), but its
  outcomes are civicAPI's counts as of November 11, not certified results. Every page and chart says
  "uncalibrated". Do not remove that word until Gate E passes on certified outcomes.
- The recorded replay is a separate data zip (`election-night-2-replay-data.zip`). The code package holds no
  election data.

## 1. Install and roll back

Run from the site's root folder (the one with `package.json`):

```
python3 apply_election_night_2.py --dry-run     # reads only; says what would change
python3 apply_election_night_2.py               # backs up, then writes
python3 apply_election_night_2.py --verify      # confirms every file matches the package
python3 apply_election_night_2.py --rollback    # restores the backup
```

The updater works on the original site or on a copy that already has any earlier phase applied. It refuses to
overwrite a file it does not recognise (a file edited by hand since), touches only the files listed in section 12,
contacts no network, and reads no secrets. After applying:

```
npx tsc --noEmit
npm run test:intelligence          # expect 353 tests, 0 failing (6 skipped)
npx next build --webpack           # as in the existing deploy
```

**The recorded replay of election night** is installed from its own zip, into `public/replay/2026`:

```
python3 apply_election_night_2.py --install-replay election-night-2-replay-data.zip   # checks every file
python3 apply_election_night_2.py --remove-replay                                     # takes it out again
```

It is static data: once the site is built and deployed with it, the replay works with no database, no store and no
environment switch. Without it the site works as before and simply offers no replay.

## 2. Operator switches (all off by default)

| Variable | Effect |
|---|---|
| `ONPOINT_ENGINE_API=on` | pages read the shared engine live |
| `ONPOINT_ENGINE_RECORDER=on` + `CRON_SECRET` + `INTELLIGENCE_CAPTURE_STORE=postgres` (or github / blob) | the recorder: stores every observation, carries the model-call ledger from update to update, gives the charts their history. Cron entry: `{ "path": "/api/results/engine-capture", "schedule": "*/5 * * * *" }` |
| `ONPOINT_REPLAY=on` | recorded (historical) replays kept in a server store are served. Not needed for the static replay pack |
| `NEXT_PUBLIC_ONPOINT_STATIC_REPLAY=off` | hides the static replay pack without removing it |
| `ONPOINT_ALLOW_SIMULATED=on` | simulated replays, and only when the deployment is not production |
| `ONPOINT_METHOD_PRIORS=on` | use vote-method strata when the provider reports them |
| `NEXT_PUBLIC_ONPOINT_AUTO_PROJECTION / LEGACY_SIDES / LEGACY_ODDS` | restore old Phase 1 behaviour, for comparison only |

With none set, the site behaves as before plus the Phase 1 corrections. With the engine on but the recorder off,
each request recomputes the current moment: model calls cannot accumulate (they need two consecutive updates) and
the charts have one point. For election night the recorder should be on.

Going-live checklist:
1. Apply, type-check, test, build.
2. Set the store and recorder variables; add the cron entry; deploy.
3. Open `/api/results/engine-capture` output in the cron log: read `status`, `manifest` and `health`. A 200 alone
   proves nothing.
4. Set `ONPOINT_ENGINE_API=on`. Check `/results/2026`, `/results/monitor`, `/results/2026/calls`.
5. Leave `ONPOINT_ALLOW_SIMULATED` unset in production. The server refuses simulated data there even if it is set.

## 3. What a visitor sees

- `/results/2026`: live national dashboard. Chamber cards (called seats, projected seats with 80% range, chance
  of control), and the night's charts. The House card leads with the **House popular vote**: the projected final
  national margin, large, with its range and the margin counted so far. (It is votes for House candidates in
  all 435 districts, not a generic-ballot poll; the pre-election poll average, D+12, is the benchmark in the
  panel below.)
- `/results/monitor`: the Situation Monitor with a LIVE / REPLAY switch. Replay has play, pause, step by
  observation, a scrubber and speeds 1x, 10x, 60x, 360x, 3600x. Seeking back shows only what was known then.
- **One clock for every page.** The replay control sits under all results pages. The time, the pace and whether it
  is playing carry from the national page to a state, a race, the monitor and the Calls Desk, including across a
  full page load. County maps and county tables show civicAPI's county rows as of the same moment.
- **Key moments.** Markers on the scrubber and a list to jump from: poll closings, first returns, civicAPI's calls
  (and a call it changed), model calls, lead changes in the count, changes of the model's favourite, and the
  chambers passing 50%, 90% and 99% or being decided on calls. The list narrows to headlines, to a kind of
  moment, or to the race or state in view. The double arrows step to the previous and next moment.
- **Two spans.** "Election night" (6 PM to 7 AM Eastern) and "The whole count" (through November 11), under More.
- `/results/2026/calls`: the Calls Desk. Three separate origins: model call, official (civicAPI), editorial (a
  named operator). A model call is never shown as an official call. It opens **by office**: the country (seats on
  calls, first and latest call, how the model's timing compared), then each state's Senate and governor's races,
  then the House by state and district, then key ballot measures (all measures one click away). Each row gives
  the winner, civicAPI's own stated call time, and the model's call time. "Every race, by status" is the earlier
  table.
- A standing notice at the foot of every results page: unofficial, not certified, where the data comes from, and
  a link to state election offices (usa.gov/election-office). In a replay it says "Recorded replay".
- Race pages: reported result first (top two by votes, whatever their party), then the model's projection,
  labelled as a model, with its own charts.
- Ten charts in a plain newspaper manner: chance of control (House, Senate), projected seats (House, Senate,
  governors), national House vote, and per race: win chance, projected margin with range, vote counted against
  expected, and the gap to the runner-up against ballots outstanding. Gaps in the record are hatched and labelled,
  never drawn as a line.
- Simulated data carries a full-width banner, "SIMULATION / NOT ACTUAL RESULTS", on every page that shows it.

## 4. How the engine works

One engine (`app/lib/engine`) feeds every page: observation, then race forecasts, then the national picture.

**Starting point.** Each race starts from the frozen pre-election forecast (`final-2026-11-03`): its margin and
its stated probability, which together imply a spread. Before any vote the engine reproduces the published
numbers (section 8, table A).

**Turnout.** The final vote in each race is uncertain. For a race read from its total (every House race, the
statewide offices, the measures) the evidence is the forecast total, the votes counted and the provider's percent,
treated as a noisy hint and never as an identity. A race short of 100% always keeps an uncertain remainder.
Turnout surprises are shared within a state and partly across the country.

**County by county (2.4.0, Senate and governor).** These 71 races have a county forecast
(`public/forecast/counties.json`), and civicAPI's history has their county rows, so in the recorded replay they are
modeled county by county: each county's outstanding vote is estimated on its own and given that county's forecast
margin, shifted by the swing the counted counties show. This is how a decision desk reads a state, and it is what
lets a contested state be called before the last county is in. Four parts:

- *Which counties are finished.* civicAPI's county percent turned out to be the counted votes divided by a fixed
  expected total (in most states this site's own county forecast, to the vote). It carries no information the
  count does not, and it stopped at 85 to 99 when a county was done. So the percent is not read at all. A county is
  taken as finished from two things: how long its count has not moved (nothing under 45 minutes, rising to a 90%
  chance at two and a half hours and 97% at ten), and where it sits against its state (a county holding about the state's share
  of its forecast vote is probably done; one at half of it is not, however quiet). Quiet time counts for nothing
  in the states that mail every voter a ballot or are known to count for days, or that report by town
  (`turnout.quiet.slowStates`): there a quiet county is routinely unfinished.
- *Turnout is shared.* When finished counties show a state's turnout running below the forecast, the states still
  counting start from that level too (leaving the state itself out, so nothing counts twice). On this night the
  forecast's turnout was high almost everywhere, and without this the model kept adding votes that never came, in
  the rural counties that finish first.
- *The ballots still out carry their own spread,* in two parts: 14 points of margin on the uncounted ballots of
  counties still open (ordinary precincts, in known places), and 25 on the late ballots of counties taken as
  finished (provisional and late mail, the least like the rest). So when what is left is one region, the
  projection leans on that region's counties and not on a blanket allowance.
- *When it applies.* Only when the provider's county rows add up to its race total, cover the forecast's counties,
  and say when each row last changed. New Hampshire and Vermont report by town and Alaska by its own districts;
  those races stay on their totals. **Live, civicAPI's search does not send county rows with change times, so a
  live night would run every race from its total, as 2.3.0 did.** The county model is in the recorded replay; using
  it live needs the capture job to keep each county's last change (not built).

**Margin.** The ballots still out are estimated from the forecast, shifted by what the counted ballots show
(swing), with an allowance for reporting-order bias: ballots counted first can differ from those counted last by
tens of points. When the provider reports vote method, strata are used instead.

**Draws.** 2,000 seeded Monte Carlo draws for chamber races (1,000 for others). Same input, same output, always.
One fixed seed serves the whole night, so each race keeps its draws from update to update and a change between
two updates is the data's. (Seeding by snapshot made a projected seat total wander by about a seat with no new
votes.)

**Rules.** Plurality, ballot measure (with its threshold), multi-seat, and:
- *Ranked choice* (AK; ME for Congress). The counts that arrive are first choices and are modeled as first
  choices. In every draw the final round is then simulated: the leading candidate of each side, plus a transfer of
  everyone else's ballots. The transfer is centred on the split that the published final-round margin implies and
  is uncertain (15 points of net share). A first-choice majority wins outright. These races are never model-called.
- *Majority runoff* (GA; LA House this year). The chance shown is the chance of winning outright. In a draw with no
  majority the seat is projected, for seat totals only, for the side with more first-round votes; it is never
  counted as decided.

**Senate control.** Independent winners are counted with the Democratic caucus (operator decision). This is an
assumption about what a winner would do, and the pages say so beside the Senate number.

**National.** One structure, in margin points: a race's error from its forecast = national swing + state swing +
its own. The national swing is learned from finished races only (partly counted races mislead), leaving out the
race being forecast. Because early finishers are not a random sample, half of the prior uncertainty about the
swing is kept in proportion to the races still open. The same two numbers set both the estimate and how much the
races move together in the joint draws, so chamber ranges and race ranges are consistent.

**Display.** An uncalled race never shows above 99.5%. Chamber control shows ">99%", never 100%, until seats
actually decided settle it.

## 5. Settings and their basis (`app/lib/engine/config.ts`)

Each is matched to the published forecast or is a stated judgement, with two exceptions, both in the county model
and both marked: they were set against the recorded night of November 3 and have not been tested on another.

| Setting | Value | Basis |
|---|---|---|
| `national.sdNational`, `sdState` | 5.4, 4 pts | chosen so the pre-vote House range equals the published 219 to 294 |
| `national.loading` | sen 1.15, house 1, gov 0.6 | governors: 0.6 matches the published range of 26 to 34. Senate: with independents in the Democratic caucus, 1.15 matches the published picture (at 1 the chance read 85% against a published 81%) |
| `senate.independentsCaucus` | "D" | operator decision, November 11 |
| `rcv.sdTransfer` | 0.15 | judgement. The first-choice spread is reduced by the same amount, so the published chance is reproduced before any vote |
| `national.runoffToFirstRoundSide` | true | judgement: without it every runoff seat drops out of projected seat totals |
| `national.selectionShare` | 0.5 | judgement: early finishers are not a random sample |
| `priorSd.minZ`, `byKind` | 0.15; 9.3 / 9.4 / 6.1 / 5.7 / 20 | a toss-up's spread cannot be read from a 50% probability, so it takes the median spread of its kind |
| `margin.sdOrderRace`, `sdOrderUnit` | 20, 6 pts | judgement. At 8 the first draft gave Osborn 98.8% at 39% of precincts; he lost by 6.7 |
| `turnout.sdPrecinct`, `sdRemainder` | 0.2, 0.15 | judgement, from the precinct-percent finding above |
| `turnout.rhoNational` | 0.6 | judgement: turnout beats or misses forecasts broadly at once |
| `turnout.quiet` (county model) | from 45 min, 90% at 150 min, 97% at 600 min, 60% of forecast vote, base 15%; late-ballot allowance 0.8% (sd), 0.5% after a night; county spread read from the state's finished counties (floor 3%) | judgement, **checked against the recorded night** and set below what it showed: outside the slow states a county quiet for 90 to 120 minutes with 60% of its forecast vote was within 5% of final 89% of the time (the setting gives it 39 to 64% before its place against the state is weighed) |
| `turnout.quiet.slowStates` | AK AZ CA CO HI IL MD NJ NV NY OR UT WA, CT MA ME NH RI VT | public knowledge before the night (all-mail states, states known to count for days, town-reporting New England). The night agreed: these are the states where a quiet county was often unfinished |
| `margin.sdUnit`, `sdUnitSmall`, `unitOutlierZ` (county model) | 4, 7 pts; 2.5 | **read from the recorded night**: a county's final swing differed from its state's by 7.5 points (sd) for counties under 2,000 votes and 4.2 for those over 100,000; the earlier 3 was a guess. A county more than 2.5 predictive sds out is down-weighted by the excess |
| `margin.sdOutstanding`, `sdOutstandingLate` (county model) | 14, 25 pts | **fitted to the recorded night**: the smallest values tried at which the 95% ranges of the Senate and governor's races held the final margin at least 95% of the time at every stage of the count. In-sample; section 9 |
| `probCeil` | 0.995 | display and policy cap for an unvalidated model, not a statistical claim |
| `spreadFactor` | 1 | the published forecast already widened by sqrt(2); applying it again would be a second decision |

To change one: edit `config.ts`, bump `MODEL_VERSION`, rebuild archives. Every stored state names its version.

## 6. Model calls

Threshold 99.3% (configurable; other settings can be replayed on a stored night with
`scripts/engine/sweep_calls.ts`).
1. A candidate reaches the threshold with every safeguard passing: FIRST_QUALIFIED.
2. On the next update with new data the same candidate still qualifies: MODEL_CALLED.

Re-reading unchanged data advances nothing. A drop, a change of leader or a failed safeguard resets the sequence.

**Safeguards, all required (the standard rule):** no blocking data flag (count above forecast, unknown counts,
ambiguous candidate, weak turnout evidence, test data, ranked choice, not modeled, provider rows inconsistent);
data not stale; at least 50% of the expected vote counted; the model's leader also leads the count; the runner-up
would need 60% or more of the high estimate of outstanding ballots; the 95% margin range excludes a loss; the
probability clears the threshold after two Monte Carlo standard errors.

**Too close to call (2.4.0).** The low end of the 95% range of the projected margin must be at least half a point,
not merely above zero. Most states recount at half a point, and provisional and cured ballots are settled at the
canvass days later. Without it the county model called Kansas's governor's race on November 5 at a margin of 0.7;
AP had not called it a week later. It applies to every race.

**Close races hold (2.4.0).** A race whose 95% range starts below 2 points must have qualified without a break
for 30 minutes before it is called, not just on two updates. A count that looks finished at 9 PM and takes
another batch at 9:20 is the commonest way to be wrong: without the hold, Florida's governor's race (1.3 points)
qualified at 8:58 PM and was back at 97% twenty minutes later. It applies to every race.

**Where the outstanding ballots are (2.4.0).** For a race modeled county by county, the outstanding-ballots test
is no longer "would the runner-up need 60% of what is out" but "would he need at least 10 points more of it,
head to head, than the counties it sits in are expected to give him". When all that is left is a region that
favours the leader, the race is not held; when what is left favours the runner-up, more is asked than before.
Races read from their totals keep the 60% test.

**First-report quarantine (2.3.0).** A race cannot qualify until three distinct updates with votes have been seen
for it, so the earliest possible call is at its fourth. NY-01 was called four minutes after its first report.

**Provider-row checks (2.3.0).** When the provider sends county rows, a race is flagged and cannot be model-called
while (a) a total row ("All Counties", "Statewide", "Total") sits among its county rows and the race total is above
the counties' sum, or (b) the race total is 1.25 times the sum of its county rows or more. Rows that sum to more
than the total are normal where a state lists towns and counties, and are ignored. On the recorded night this
flags the 29 New York races with the duplicated row and, for one frame, one Alabama district; nothing else.
Live, it works only if civicAPI's search results carry county rows; without them nothing is flagged and the
quarantine is the protection.

**The safe-seat lane (2.3.0).** As the networks call safe seats early. A race is in the lane when the pre-election
forecast gave its favourite 97% or more (296 of the 506 Senate, governor and House races), it is a plain
plurality race for Senate, governor or House, and the model's leader now is that same favourite. In the lane:
- the counted-share floor is 10% of the expected vote instead of 50%;
- the outstanding-ballots stress test is not applied (early in a count nobody can pass it).
- its quarantine is one update instead of three, so it can be called at its second update. In the lane the
  forecast and the count must agree, so a faulty first report cannot by itself produce a call against the
  forecast, which is what happened in NY-01.

- for a race modeled county by county (2.4.0) the lane's floor is 25%, not 10%. In the first part of a count that
  model reads single counties' first batches and moves more between updates than a race total does: Tennessee's
  Senate race qualified in the lane at 10% counted and read 88% twenty minutes later. The call was right, and the
  floor is there so that the next one is not made on such a reading.

Everything else still applies: the threshold after simulation error, the favourite leading the count, a 95% margin
range that excludes a loss, every data flag and the two updates in a row. Ballot measures,
ranked-choice and runoff races are never in the lane, and neither is a race where the model's leader is not the
forecast's favourite. A call made this way is labelled "safe seat" on the Calls Desk and in the log.
Settings: `DEFAULT_CALL_CONFIG.fast` and `.minUpdates` in `app/lib/engine/modelCalls.ts`.

After a call nothing is erased. If the model later turns, an alert is recorded beside the standing call. Official
and editorial calls are recorded separately and never produced by the model.

An official call follows the provider. If civicAPI withdraws a call or moves it to another candidate, the record
moves with it, an alert is raised and the log keeps every step. Each official call carries civicAPI's own stated
time (`called_at`) beside the time this site first read it.

## 7. Replay, the recorder and the simulated firewall

**Recorder.** For each new observation: `raw/` (as received), `snapshot/` (canonical input), `state/` (all
calculations and the ledger), `published/` (what a page would show), `manifest/` (hashes, model version, the
previous manifest's hash). Write-once. `verifyArchive` recomputes every state from its snapshot and requires the
same id.

**Replay.** At replay time T the page shows the latest observation at or before T. Nothing later can leak back.

**Simulated data.** Interpolated frames exist only to exercise the pages between real observations in
development. Enforced on the server, not in the page:
- served only with `ONPOINT_ALLOW_SIMULATED=on` and a non-production deployment;
- written to its own namespace; the live and historical namespaces refuse it;
- the evaluation harness refuses it for scoring;
- the archive builder refuses to write under `public/`;
- no simulated or replay archive is in this package.

## 8. Final audit

Scope: the math, every page and control, and the interface at desktop, 1920x1080 and phone widths, in both
themes. Findings are listed with what was done.

### Math

| Finding | Fix |
|---|---|
| Ranked-choice races and ballot measures started several points from the published probability | the baseline now starts at the published margin; 0 of 780 modeled races start more than 5 points off |
| Toss-ups were given a spread of about 1.5 points (a 50% probability says nothing about spread) | they take the median spread for their kind |
| The national swing estimate assumed one correlation and the joint draws another | one structure in points for both (section 4) |
| Swing uncertainty could exceed its own prior | capped at the prior |
| Early finishers treated as a random sample of races | half of the prior swing uncertainty is kept in proportion to races still open |
| The national House vote's range for outstanding ballots was about plus or minus 1% | it shares the national turnout draw |
| An uncalled race could read 100% on a race page | capped at 99.5% everywhere through one function |
| A shared national reporting-order estimate was tried | rejected: it made race-level accuracy worse on the real exports |

**Table A. Before any vote, engine against the published forecast**

| | Engine | Published |
|---|---|---|
| House: chance D, 80% range of D seats | 91.1%, 219 to 293 | 91.0%, 219 to 294 |
| Governors: chance D majority, range | 90.7%, 26 to 33 | 90.7%, 26 to 34 |
| Senate: chance D, range of D seats | 82.0%, 48 to 60 | 80.9%, 48 to 61 |

**Table B. The 14 real export checkpoints of November 3, run through the whole pipeline**
(PIPELINE TEST, NOT CALIBRATION: outcomes are the last export, not certified results)

| Held-out half of races | Value |
|---|---|
| Race-frames (ranked-choice and runoff races are not scored) | 877 |
| Brier score, log loss (held-out half) | 0.022, 0.072 |
| Final margin inside the 80% range | 89.9% |
| Final margin inside the 95% range | 97.1% |
| Calibration error (ECE) | 0.009 |
| Model calls, wrong | 239, 0 |
| Race-frames with 99.3% or more on the eventual loser | 3 (this line read 0 until November 13: the harness could not count a miss, and has been fixed) |

The 80% range holding 90% of outcomes means the ranges run somewhat wide overall. NY-01 and the Nebraska Senate
race were not called on these 14 exports. On the full record of the night NY-01 was called, and wrongly: section 9.

**Table C. Projected Democratic seats through the night (same exports, engine 2.1.0)**

| As of (ET) | House | Senate | Governors |
|---|---|---|---|
| 6:22 PM | 256.7 | 54.6 | 29.6 |
| 8:11 PM | 261.3 | 55.0 | 30.0 |
| 9:58 PM | 268.5 | 55.6 | 30.3 |
| 11:12 PM | 269.7 | 55.8 | 30.7 |
| 7:46 AM | 261.0 | 54.8 | 30.2 |

The House figure at 7:46 AM is about two seats lower than under 2.0.0. That is the Louisiana correction: LA-05 and
LA-06 had a Democrat leading a split Republican field, and a plurality rule read those as Democratic wins. Under
the all-party primary rule both go to a runoff and are projected for the side with the first-round majority.

On the interpolated stream (162 frames, development only, run on 2.0.0): 430 model calls, 0 wrong against its own last frame.
This shows the harness runs and nothing else: interpolated frames slide toward the final count, which flatters
every score.

### Functionality

| Finding | Fix |
|---|---|
| Several visitors at once could each start the 10 to 15 second live computation | requests in flight share one computation |
| A race with no observation was labelled as having data in simulated mode | reads MISSING |
| The live forecast route had been prerendered as a static page | forced dynamic |
| The monitor's race desk could not be closed with Back or Escape | it is a history entry; both close it |

### Interface

| Finding | Fix |
|---|---|
| Charts unreadable inside the race desk (colours, clipped labels) | colours follow the theme's text colour; right padding per chart; seat axes fit the data |
| Replay dock covered about a third of a phone screen | compact by default, with a "More" toggle |
| The simulation banner overlapped the sticky header | it takes its own row above the header |
| A missing full stop in the chamber sentence | fixed |

No page overflows horizontally at 390, 1440 or 1920 pixels; no new page errors in the console.

### Verified, and not verified

Verified here: type check clean; 366 tests, 0 failing; lint identical to the original on every changed file
(16 issues, all pre-existing); production build; archive verification 14 of 14 for the exports and 536 of 536 for
the recorded night under 2.4.0; every delta frame in the replay pack rebuilding its frame exactly; every model call
outside the Senate and governor's races the same as 2.3.0's (four held 20 to 30 minutes longer); the browser checks above and those of
the replay with every server switch off; the updater's apply, verify and rollback on a clean copy and on earlier
copies; the replay pack's install, checksum check and removal.

Not verified, because it cannot be from here: any production deployment, scheduler, database or secret; behaviour
against live civicAPI traffic; calibration.

## 9. The recorded replay of election night

### What it is

civicAPI's owner exported the history of every race his site carried for November 3: one file per race, holding
each snapshot the provider stored, with its timestamp. 886 races and 53,639 stored snapshots, from the first poll
closing through November 11. 813 of those races are races this site follows, including all 506 Senate,
governor and House races; the rest are mostly judicial retention votes the site has no page for.

The replay shows that record. At frame time T, each race holds the latest snapshot civicAPI had published at or
before T, unchanged. Nothing is interpolated and nothing after T is read. Frames are cut every 2 minutes on
election night (6 PM to 5 AM Eastern), every 10 minutes the next day and hourly through November 11; a tick with
nothing new is skipped. 536 frames in all. Each frame was run through the same engine and the same
model-call ledger as a live night, so the replay shows what this site would have shown.

### How it is built (to rebuild after an engine change)

```
python3 scripts/engine/extract_civic_history.py <CivicAPI_..._History.zip> <history dir>     # once per zip
node --import ./scripts/intelligence/ts-resolve.mjs scripts/engine/build_civic_replay.ts --history <history dir> --store <archive dir> --verify
node --import ./scripts/intelligence/ts-resolve.mjs scripts/engine/export_static_replay.ts --history <history dir> --store <archive dir> --out public/replay/2026
```

The build takes about an hour and `--verify` as long again (`--verify-only` checks an archive already built).
The archive directory is the full-precision working record (hash-chained, verifiable); keep it out of `public/`.
The export writes the public pack: one compressed state per frame, the national history, one history per race,
civicAPI's county rows per race, and the key moments. Only a recorded (HISTORICAL) archive can be exported.

### What the real data showed about the provider

These are properties of the feed, kept as recorded and worth knowing:

- **Counts go down.** 515 snapshots report fewer votes than the one before (corrections). They are replayed as
  published.
- **A call was moved.** South Carolina's Senate race was called for Darline Graham at 9:58:15 PM, withdrawn at
  10:00:15 and called for Annie Andrews in the same second. The ledger now follows a moved or withdrawn call.
- **New York's counts were doubled, then tripled.** New York's feed lists an "All Counties" total row beside the
  county rows, and civicAPI's race totals added both. In NY-01 the race total ran to twice the real count from the
  first report, then three times, until it was corrected at 2:45 PM on November 4. Its "percent reporting" read
  85.6% when the county row itself said 11.2%. 29 New York races carry the duplicate row. This is worth raising
  with civicAPI.
- **Candidate order and party labels change** between snapshots; identity is kept by civicAPI's candidate id.
- Alaska's Senate race has two Sullivans whom a name alone cannot tell apart; a spelling table now resolves them.

### How the model did on the real night

PIPELINE TEST, NOT CALIBRATION. Outcomes are civicAPI's calls, or the leader in its count as of November 11 where
it has made no call. They are not certified results.

| | Value |
|---|---|
| Frames | 536 |
| Races scored (plurality races at 99% of precincts or more on November 11) | 303 |
| Race-frames in the held-out half | 65,780 |
| Brier score, log loss (held-out half) | 0.022, 0.072 |
| Final margin inside the 80% range, the 95% range (held-out half) | 91.0%, 96.6% |
| Calibration error, ECE (held-out half) | 0.015 |
| Race-frames with 99.3% or more on the eventual loser (both halves) | 50 of 127,350: 42 from Massachusetts Question 7, 8 from NY-01 |
| civicAPI calls recorded | 654, one of them moved (South Carolina Senate) |
| Model calls (2.4.0) | 616: 338 House, 32 Senate, 34 governor, 101 statewide offices, 111 ballot measures; 164 of them in the safe-seat lane. Outside the Senate and governor's races every call is the same as under 2.3.0, and at the same minute except four close ones held 20 to 30 minutes longer (FL-18, FL-22, NC-01, Ohio secretary of state) |
| Wrong model calls | **0** (the 2.2.0 rule made one, NY-01: below) |
| Model call against civicAPI's call, all races where both exist | median 10 minutes **earlier**; the model was first in 298 of 541 |
| The same, Senate, governor and House | median 2 minutes later; first in 180 of 404 |
| The same, Senate alone; governors alone | median 8 minutes later (first in 14 of 32); 19 minutes later (first in 15 of 34). Under 2.3.0: 71 and 60 minutes later |

Three things in those numbers:

- **The ranges are too narrow early and too wide late.** With under a quarter of the vote counted, 67.7% of final
  margins fell inside the 80% range in the held-out half (73.6% in the other). From half counted on, 89% to 96% did.
  The overall 91% hides both. This is the first thing for a calibration pass to fix.
- **Massachusetts Question 7** was a miss of the pre-election forecast, not of the count or of its passing rule:
  the forecast gave it 99.1% to pass with 60.3% Yes, and it got 49.4%. It needed a simple majority (the index has
  that right); Massachusetts also requires the winning side of an initiative to be 30% of all ballots cast, which
  the race page now states and the model does not test. The live model started from that and came down slowly (96% at 55% counted). Its turnout
  flag kept it from being called.
- Race-frames are not independent: the same race appears in many frames. The scores describe one night.

**Projected Democratic seats through the night (mean and 80% range)**

| Eastern time | House | Senate |
|---|---|---|
| 5:58 PM (before any vote) | 256.5 (220 to 296) | 54.5 (48 to 60) |
| 8 PM | 259.7 (227 to 294) | 54.8 (49 to 60) |
| 9 PM | 265.2 (237 to 293) | 55.0 (50 to 59) |
| 10 PM | 267.1 (247 to 287) | 54.0 (50 to 57) |
| 11 PM | 269.1 (257 to 281) | 55.2 (53 to 57) |
| Midnight | 267.0 (259 to 275) | 55.3 (54 to 57) |
| 1 AM | 260.9 (255 to 266) | 56.0 (55 to 57) |
| 5 AM | 259.8 (256 to 264) | 55.3 (54 to 56) |
| November 11 | 258.8 (257 to 260) | 55.9 (55 to 56) |

As of November 11 civicAPI had called 255 House seats for Democrats and 168 for Republicans, with 12 uncalled; 21
Senate races for Democrats and 13 for Republicans, with Alaska uncalled (55 and 44 with the seats not up); and 23
governorships for Democrats and 12 for Republicans, with Alaska uncalled.

### The wrong model call under 2.2.0, and the rule since

Under the 2.2.0 rule the model called NY-01 for Chris Gallant at 9:56 PM at 99.7%. Nick LaLota finished 2.2 points
ahead in civicAPI's count and civicAPI called it for him. The call was made on the doubled count described above:
the model was told 273,000 votes were in (85% of the expected vote, 91.7% of precincts) when about 137,000 were,
with 17% of precincts, four minutes after the race's first report.

The 2.3.0 rule (section 6) stops it twice over: the provider-row check flags the race from its first report, and
the quarantine would not have let a race be called at its second update. Under 2.3.0 the recorded night has 607
model calls and none wrong, and NY-01 is never called. The earlier replay pack, which showed the wrong call and
its alerts, is superseded; this document is the record that it happened.

The same night under other rules, replayed from the stored forecasts (`scripts/engine/sweep_calls.ts`). Minutes are
civicAPI's call time minus the model's, so positive means the model was first:

| Rule | Model calls (safe-seat) | Wrong | Median, all races | Median, Senate, governor, House | Model first, Senate, governor, House |
|---|---|---|---|---|---|
| 2.2.0: no row checks, no quarantine, no lane | 581 (0) | 1 (NY-01) | -12 | -48 | 87 of 377 |
| Row checks only | 578 (0) | 0 | -29 | -65 | 79 of 375 |
| Quarantine only | 580 (0) | 0 | -27 | -66 | 78 of 377 |
| Row checks and quarantine, no lane | 578 (0) | 0 | -44 | -77 | 70 of 375 |
| Lane at 99% forecast, lane quarantine 1 | 579 (131) | 0 | -1 | -13 | 135 of 376 |
| Lane at 97%, lane quarantine 3 | 579 (151) | 0 | -2 | -31 | 125 of 376 |
| Lane at 97%, lane quarantine 2 | 579 (167) | 0 | -1 | -13 | 133 of 376 |
| **Lane at 97%, lane quarantine 1 (as shipped)** | 579 (178) | 0 | **+8** | **-2** | 155 of 376 |
| Lane at 95%, lane quarantine 1 | 581 (191) | 0 | +9 | -2 | 158 of 378 |
| As shipped, at a 99.5% threshold | 568 (164) | 0 | +4 | -3 | 144 of 367 |

(Replayed from stored rows the shipped rule makes 579 calls where the live ledger made 607; the replay is a close
copy, so read the table for the comparison between its rows.)

How to read it:
- The safety measures alone cost speed: with row checks and quarantine and no lane, the median call is 44 minutes
  behind civicAPI. The safe-seat lane is what buys the time back, and more.
- Every rule from the second row down has no wrong call on this night. So the night cannot tell them apart on
  safety; the choice between them was made on reasoning (section 6), and it was made knowing the answer. None of
  this is evidence the rule is safe on another night: that needs certified outcomes and a held-out half (Gate E).
- **Senate and governor's races stay about an hour behind civicAPI.** civicAPI calls safe statewide races at or
  minutes after poll closing, before votes are in (Virginia's Senate race at 7:06 PM). The lane needs 10% of the
  expected vote counted, which a state takes time to reach. Calling at poll closing with no votes would be
  publishing the pre-election forecast as a call; it is not built, and would be a separate decision.

### Senate and governor: the county model, and the night against AP's calls (2.4.0)

The aim set for 2.4.0 was to call contested Senate and governor's races sooner, ahead of the Associated Press where
that can be done without a wrong call. Under 2.3.0 it could not: read from a state's total, the ballots still out
could be anywhere and lean any way, and the honest range at 85% counted was six points either side.

**What was found on the way.**
- *The percent is not evidence.* civicAPI's county percent is the counted votes over a fixed expected total; for
  most states that expected total is this site's own county forecast, to the vote. It cannot say a county is
  finished, and it stopped at 85 to 99 when one was. (This is why, under 2.3.0, ten races AP had called on the
  night were still uncalled by the model on November 11: it was still waiting for 12 to 15% of the vote.)
- *Quiet time is evidence, outside the slow states.* A county holding 60% or more of its forecast vote whose count
  had not moved for 90 to 120 minutes was within 5% of its final count 89% of the time; after four hours, 97%. In
  Arizona, California, Maryland, Hawaii, Colorado, Oregon, Nevada and the town-reporting New England states the
  same test failed a quarter to all of the time.
- *The forecast's turnout was high almost everywhere* (final votes were 75 to 100% of the forecast, by state).
  A model that waits for the forecast's turnout adds votes that never come, and adds them in the rural counties
  that finish first, which tilted every early projection Republican by one to three points.
- *What is left, and where.* The first 2.4.0 build put one blanket allowance on all outstanding ballots, 25
  points late in a count, and a safety test that asked whether the runner-up could win 60% of what was out
  without looking at where it was. Together they held Ohio's Senate race for an hour after the model was sure and
  left Florida's governor's race and Louisiana's Senate race uncalled for good, although what remained was the
  Panhandle in one and rural parishes in the other. The allowance is now split (ordinary uncounted ballots in
  open counties; late ballots in finished ones), the test reads the counties, and a count that has been still all
  night is allowed to end. A correction of a few votes no longer restarts a county's quiet clock (a move is half
  a percent of the county's count or more).
- *A fast state should look fast.* Florida's counties all finish within a few percent of the same share of
  their forecast vote, and its late ballots are few. The model had assumed every state's counties scatter by 10%
  and that a finished county still has 1.2% to come, which left Florida's governor's race (1.3 points) a hair
  short of callable all night. The scatter is now read from the state's own finished counties and the late
  allowance is 0.6%, nearer what finished counties showed (median nothing, nine in ten under 1 to 2%).
- *One county is not a state.* The first build of the county model gave Dan Ahlers 99.95% in South Dakota's
  governor's race for 80 minutes on 4,524 votes from one small county that had gone quiet (he lost by 27), and did
  the same in Montana's Senate race. No call was made on either: the counted-share floors held. But the number was
  shown. A county's swing differs from its state's by 4 to 8 points, more for small counties, and now and then by
  30; the model had allowed 3. It now allows what the night showed and down-weights a county far outside it. The
  rebuilt night has no frame with 95% or more on an eventual loser in a county-modeled race.
- *How unlike the rest the outstanding ballots are does not shrink as a count ends.* Across all partisan races the
  ballots still out differed from those counted by 15 to 20 points (one standard deviation) at every stage, and by
  more for the last 5%. The 2.3.0 setting for a race total (20) was about right.

**How well the ranges held.** Senate and governor's races in county mode, every frame of the recorded night
against the final margin in civicAPI's count of November 11. In-sample: the spread was set on these races.

| Share of the final vote counted | Race-frames | Final margin inside the 80% range | inside the 95% range | Typical error of the projected margin (median, points) |
|---|---|---|---|---|
| under 10% | 685 | 100% | 100% | 4.0 |
| 10 to 25% | 624 | 98% | 100% | 3.0 |
| 25 to 50% | 1,268 | 96% | 100% | 1.9 |
| 50 to 75% | 2,504 | 99% | 100% | 1.5 |
| 75 to 90% | 4,245 | 96% | 100% | 1.4 |
| 90 to 97% | 2,520 | 83% | 96% | 0.6 |
| 97% and over | 17,134 | 92% | 96% | 0.1 |

The ranges are wide early (a 95% range that holds 100% of the time is too wide) and close to their nominal
level from 90% counted on. Before the spread on outstanding ballots was added, the 95% ranges held the final margin 55 to 72% of the time
between a quarter and 97% counted: a projection built from 90 counties was far surer than it had any right to be.

**Against AP.** AP's call times are used here as an internal benchmark only. They were read from a published
third-party table (its author took them from the AP data behind a news site's results pages, as of the morning of
November 4), cross-checked against two other published reports; nothing was taken from an AP feed, and the AP
scraper in this repository was not used. The times themselves are not reproduced here and should not be published
by this site. 67 of the 71 races had an AP call time; AP had not called Alaska's two races, Mississippi's Senate
race or Kansas's governor's race.

| | AP times | Model called | Median, model against AP | Model first |
|---|---|---|---|---|
| All 67, 2.3.0 | 67 | 57 | 82 minutes after | 9 | |
| All 67, 2.4.0 | 67 | 66 | 18 minutes after | 26 |
| Called by AP as polls closed (19) | 19 | 19 | 130 minutes after | 0 | |
| Called by AP on the count (48), 2.3.0 | 48 | 38 | 50 minutes after | 9 | |
| Called by AP on the count (48), 2.4.0 | 48 | 47 | **13 minutes before** | **26**, 2 tied, 4 more within 10 minutes |
| Of those, forecast favourite under 90% (25), 2.3.0 | 25 | 17 | more than 11 hours after | 3 | |
| Of those, forecast favourite under 90% (25), 2.4.0 | 25 | 24 | **22 minutes before** | **15**, 1 tied, 4 more within 10 minutes |

How to read it:
- **Where AP called on the count, the model is now first more often than not,** and by a median of 13 minutes.
  Under 2.3.0 it was first in 9 of 48. Safe seats, though, are called later than under the first 2.4.0 build:
  the wider early ranges keep several of them out of reach until more is counted.
- **The 19 races AP called as polls closed cannot be beaten, only tied,** and the model does not tie them: it
  needs votes. AP calls those from its voter survey. Calling them here would mean publishing the pre-election
  forecast as a call at poll close. That is not built.
- **What the model still will not call, or calls late.** Florida's governor's race (final margin 1.3 points) is called at 10:52 PM, 103 minutes after AP: it qualifies at about 9 PM, falls back when more votes land, and is called once it has held for half an hour. Louisiana's Senate race (1.8) comes at 1:00 AM, 29 minutes after AP. Maine's Senate race is ranked choice and never model-called. Arizona's governor's race comes two days late (a slow state). New Hampshire's two races are read from their totals (it reports by town) and are called on November 5. Kansas's governor's race (0.7) and Mississippi's Senate race (0.1) are never called: recount territory.
- **Closest calls it did make:** Florida governor (1.3 points), Louisiana Senate (1.8), Tennessee governor (2.5, at 11:58 PM, 45 minutes before AP) and Florida Senate (2.9, at 8:40 PM, 6 minutes after AP). Ohio's Senate race (4.9) is called at 10:52 PM and its governor's race (7.9) at 10:26 PM, about 20 minutes before AP. One called race later dipped below 95% (Oklahoma governor, to 94.5%, final margin 6 points) and recovered.
- **No wrong call** on the night, by any rule tried. That is one night. The settings that make the ranges hold were
  set on this night's races, so the table above is not a test of them. A fair test needs another election, or
  certified results and a split by state (Gate E, below).

### Two things for the calibration pass

- **Reporting order within a state.** Between 9 PM and midnight Eastern the projected Democratic House total ran
  7 to 9 seats above where it finished. About nine Texas districts read as Democratic leads on early vote and
  moved Republican together when election-day vote arrived. The final total stayed inside the 80% range
  throughout, but at its edge by midnight. The model lets each race's reporting order err independently; a shared
  state term is the candidate fix. It should be fitted on half the races and judged on the other half.
- **The ranges early in a count** (above) and **the safe-seat lane's settings** (97%, 10%, one update): the lane
  has been through one night with no miss, which is not a test of a rule built to fail rarely.

### What is still needed for Gate E

Certified outcomes: `{ "<raceId>": { "winnerName": "...", "marginPp": 2.3, "source": "..." } }` from state
canvasses, then

```
node --import ./scripts/intelligence/ts-resolve.mjs scripts/engine/evaluate.ts --store <archive dir> --source historical/civicapi-2026-11-03 --outcomes certified.json
```

Tune `config.ts` on half A only, bump `MODEL_VERSION`, rebuild, and report half B against the gate
(`DEFAULT_GATE` in `app/lib/engine/evaluate.ts`). Only then may "uncalibrated" come off. One election is one
night: settings tuned on it are still fitted to a single year.

## 10. Decisions taken on November 11, and known limits

**Decisions (operator), all applied in 2.1.0**

1. **Independents in the Senate** are counted with the Democratic caucus (Osborn in Nebraska and the other
   independent challengers). Stated as an assumption wherever the Senate number is explained. To change:
   `senate.independentsCaucus` in `config.ts` (`"D"`, `"R"` or `null`), or name a person in `senate.caucus`.
2. **Rule registry checked against the law in force for November 3, 2026.**

   | State | Registry | Check |
   |---|---|---|
   | Alaska | ranked choice: Senate, House, governor, state offices | in force for this election. The repeal measure on the same ballot does not govern it |
   | Maine | ranked choice: Senate and House only | correct. Governor and legislature are plurality; the court's advisory opinion of April 6, 2026 kept it so |
   | Georgia | majority or runoff: Senate, governor, state offices, **House added** | a majority is required in every general election |
   | Louisiana | **added**: House, majority or runoff | 2026 only: Act 7 moved the House races to the November 3 all-party primary, runoff December 12. The Senate race had closed primaries and is a plurality general |

   Ranked choice is now simulated (section 4).
3. **AP scraper.** `scripts/scrape_ap_ga_gov.py` is not touched, added or removed by this package, and nothing in
   this update uses it. civicAPI is the only results source.
4. **Michigan education boards.** Fixed. The four boards share one provider type, and all four were matched to
   the provider's single State Board of Education race. A lone provider race is now matched by candidate name when
   several of our races share its type. The three university boards, and 30 other races the matcher could not
   pair (South Carolina's statewide offices, ballot measures in eight states), are pinned to civicAPI's own race
   ids (`CIVIC_PINS` in `app/results/2026/live.ts`); live, a pin applies only if the site's reads return that race.

**Known limits**

- The ranked-choice transfer is centred on what the published forecast implies, not on ballots: no ranked ballot
  data is available on the night. (Alaska's two Sullivans are now told apart by a spelling table,
  `DEFAULT_ALIASES` in `app/results/2026/candidates.ts`; before it the senator's votes matched neither.)
- The replay pack is about 52 MB of static files. Frames are whole every tenth frame and deltas between; a
  browser without `DecompressionStream` (before 2023) cannot read it and is not offered the replay.
- The Calls Desk's "control decided" time is counted from civicAPI's calls and seats not up; it is not a call by
  this site.
- **The county model runs in the recorded replay, not live.** It needs each county row's last change time, which
  the history export gives and a single live read of civicAPI does not. Live, every race is read from its total,
  as in 2.3.0. To use it on a live night the capture job would have to carry each county's last change from one
  read to the next, and civicAPI's live responses would have to include county rows; neither is built or checked.
- **The county model's settings were set against one night.** The spread on outstanding ballots is fitted to it and
  the quiet-time settings were checked against it (section 5). On another night, in other states, they may be
  wrong in either direction. The 71 races are 36 states' worth of evidence, not 71: a state's Senate and
  governor's races share their counties.
- **Slow states stay slow.** Where a quiet county proves nothing (the 19 states in `turnout.quiet.slowStates`),
  the model cannot tell a finished count from a paused one, so Nevada's and Oregon's governor's races and Maine's
  Senate race are called late or not at all. New Hampshire, Vermont and Alaska are not county-modeled.
- **After election night the projected vote totals of races read from their totals still run high.** The feed's
  percent never reaches 100 for many of them although counting has all but stopped, so the model still expects
  ballots there: on November 11 it projected about 17 million more House votes than were counted. The
  projected margin is barely affected and is what the House card shows; the projected totals in the popular-vote
  panel should not be quoted after the night. (For Senate and governor the county model ends the count: on
  November 11 it expects 4% more votes than were counted.) Sharing the county model's turnout level
  with the House races was tried and withdrawn: it produced new House calls on margins of 2 to 5 points.
- The provider-row checks need county rows in the feed. The history export has them; whether civicAPI's live
  search results do has not been checked against a live election.
- A runoff seat's projection assumes the first-round side lead holds in the runoff. It is a projection only.
- **Polling cadence.** Unchanged (5 minutes through the caching proxy). Polling faster needs civicAPI's
  agreement.
- A stored state is about 1.2 MB of JSON (about 200 KB compressed).
- The old `/results/monitor` redirect was permanent (301); browsers that followed it may keep redirecting until
  their cache clears.
- Hydration warnings on results pages predate this work.
- `test-map-brand` and `test-theme-modes` fail on the original site too.

## 11. Data use

civicAPI is the only results source. Attribution is kept on every page and chart, and results are marked
unofficial until certified. Live requests go through the existing caching proxies at the existing cadence. No key
or secret is written to the client, the package or the archives.

The recorded replay is built from a history export that civicAPI's owner prepared for this use after seeing the
proposal: civicAPI's published snapshots, shown for research, analysis and interest. Keep a copy of that
exchange on file. The export zips contain only race data; they were checked for keys and account details and
hold none. `scripts/scrape_ap_ga_gov.py` is not used, not touched and not part of any package.

## 12. Files in this package

New (61):

- `app/api/results/engine-capture/route.ts`
- `app/api/results/engine/history/route.ts`
- `app/api/results/engine/route.ts`
- `app/api/results/engine/sources/route.ts`
- `app/api/results/forecast/route.ts`
- `app/lib/engine/civicFetch.ts`
- `app/lib/engine/civicHistory.ts`
- `app/lib/engine/config.ts`
- `app/lib/engine/countyBaselines.ts`
- `app/lib/engine/evaluate.ts`
- `app/lib/engine/frameDelta.ts`
- `app/lib/engine/gate.ts`
- `app/lib/engine/methodPriors.ts`
- `app/lib/engine/modelCalls.ts`
- `app/lib/engine/moments.ts`
- `app/lib/engine/national.ts`
- `app/lib/engine/normal.ts`
- `app/lib/engine/pipeline.ts`
- `app/lib/engine/raceModel.ts`
- `app/lib/engine/recorder.ts`
- `app/lib/engine/replay.ts`
- `app/lib/engine/rng.ts`
- `app/lib/engine/serve.ts`
- `app/lib/engine/snapshot.ts`
- `app/lib/engine/types.ts`
- `app/results/2026/EngineCharts.tsx`
- `app/results/2026/EngineRaceCharts.tsx`
- `app/results/2026/NationalLive.tsx`
- `app/results/2026/ReplayDock.tsx`
- `app/results/2026/calls/CallsByOffice.tsx`
- `app/results/2026/calls/CallsDesk.tsx`
- `app/results/2026/calls/policy.ts`
- `app/results/2026/candidates.ts`
- `app/results/2026/engineClient.ts`
- `app/results/2026/engineRow.ts`
- `app/results/2026/flags.ts`
- `app/results/2026/replayDock.css`
- `app/results/2026/staticReplay.ts`
- `app/results/ResultsNotice.tsx`
- `app/results/monitor/MonitorCharts.tsx`
- `docs/ELECTION_NIGHT_2.md`
- `docs/ELECTION_NIGHT_2_PHASE1.md`
- `docs/ELECTION_NIGHT_2_PHASE2.md`
- `docs/ELECTION_NIGHT_2_PHASE3.md`
- `docs/ELECTION_NIGHT_2_PHASE4_5.md`
- `scripts/engine/build_civic_replay.ts`
- `scripts/engine/build_replay.ts`
- `scripts/engine/evaluate.ts`
- `scripts/engine/export_static_replay.ts`
- `scripts/engine/extract_civic_history.py`
- `scripts/engine/sweep_calls.ts`
- `tests/intelligence/auditFinal.test.ts`
- `tests/intelligence/callRules.test.ts`
- `tests/intelligence/civicReplay.test.ts`
- `tests/intelligence/countyModel.test.ts`
- `tests/intelligence/phase1CallsAndOdds.test.ts`
- `tests/intelligence/phase1Candidates.test.ts`
- `tests/intelligence/phase2Engine.test.ts`
- `tests/intelligence/phase3Replay.test.ts`
- `tests/intelligence/phase45Serve.test.ts`
- `tests/intelligence/rulesAndCaucus.test.ts`

Changed (19):

- `app/api/civic/search/route.ts`
- `app/lib/csv/buildExport.ts`
- `app/results/2026/NationalDesk.tsx`
- `app/results/2026/NightDesk.tsx`
- `app/results/2026/[id]/RaceLive.tsx`
- `app/results/2026/[id]/StateLive.tsx`
- `app/results/2026/[id]/page.tsx`
- `app/results/2026/calls/CallsBoard.tsx`
- `app/results/2026/calls/calls.ts`
- `app/results/2026/calls/page.tsx`
- `app/results/2026/live.ts`
- `app/results/2026/liveFeed.ts`
- `app/results/2026/useLive.ts`
- `app/results/layout.tsx`
- `app/results/monitor/Monitor.tsx`
- `app/results/monitor/RaceBrief.tsx`
- `next.redirects.ts`
- `scripts/test-live-feed.mjs`
- `tests/intelligence/calls.test.ts`
