# CO-07 ADDENDUM — LIVE FORECAST INTEGRATION

**Date:** 2026-08-04
**Files:** `raceCall.ts` (new), `tonight-page.tsx` (patch, §3 below)

---

## 0 · SUMMARY

The forecasting algorithm you described **already exists and is correct**. It
is `forecastRace()` in `app/lib/electoralModel.ts`, 612 lines, and it has moved
past the version we built in March: the divisor is now turnout-scaled rather
than a flat 6.5, there is a separate branch for runoff-rule races, and there is
a `poll_avg_shares` prior blend.

Your concern about the forecast being static is correct, but the cause is not
the engine. It is that **`tonight-page.tsx` never calls the engine.** I
hardcoded the outputs. That is my error and §3 fixes it.

Separately, the **three-sigma call rule does not exist anywhere in the
codebase**. `ForecastOutput` has no call field. That is §2.

---

## 1 · THE ALGORITHM AS IMPLEMENTED

Four steps, all in `forecastRace()`.

### Step 1 — model the total vote

```
implied_total  = reported_votes / percent_reporting
liveWeight     = percent_reporting ^ blend_k
modeled_total  = (1 − liveWeight)·expected_turnout + liveWeight·implied_total
```

Early on it trusts the pre-election turnout expectation. As reporting climbs,
it migrates toward what the actual count implies. `blend_k` controls how fast.
There is a 10× cap on `implied_total` so a bad precinct update cannot produce a
425M-vote projection.

### Step 2 — shrinking sigma

This is the mechanism you described. Pre-election:

```
divisor          = 6.5 for turnout ≤ 100K, ramping upward with turnout
sd_pre_election  = expected_turnout / divisor
```

Then as votes report:

```
scale     = modeled_vote_remaining / implied_total
sd_race   = sd_pre_election · clamp(scale, floor, 1)
```

`sd_race` is the standard deviation of the **remaining** vote. When the pool of
outstanding ballots shrinks, so does the uncertainty about what is in it. That
is the entire idea and it is implemented correctly.

### Step 3 — project the final result

Two paths, and the difference matters for your question.

**With `poll_avg_shares` supplied** — the dynamic path:

```
liveWt        = percent_reporting ^ blend_k
blendedShare  = liveShare · liveWt + pollPrior · (1 − liveWt)
modeled_votes = blendedShare · modeled_total
```

The projection starts at the poll and migrates toward the live result as
ballots land. **This is exactly the behavior you asked for, and it is already
built.**

**Without `poll_avg_shares`** — the static path:

```
modeled_votes = reported_votes + modeled_vote_remaining · expected_share
```

Here every outstanding ballot is allocated at the pre-election poll share
forever. If the live count diverges hard from the poll, the projection never
learns. **Always pass `poll_avg_shares`.**

### Step 4 — probabilities

```
pBeats(A, B, sd) = Φ( (A − B) / (sd · √2) )
```

The `√2` is correct: the difference of two independent normals with equal
sigma has variance 2σ². Plurality win probability is the product over all
opponents, then normalized. Majority uses `1 − Φ((threshold − mean)/sd)`.

---

## 2 · THE MISSING PIECE — the three-sigma call

`ForecastOutput` returns `sd_race` and `projected_margin_votes` but never turns
them into a verdict. Nothing in the desk can say a race is decided on TPSI's
own authority.

`raceCall.ts` adds it:

```
z = margin_votes / (sd_race · √2)
```

Same denominator as `pBeats`, so it is consistent with the win probability
already on screen. At **z ≥ 3.0** the leader sits outside the 99.73% interval
on the remaining vote and the race is callable. **z ≥ 2.0** yields `LEANING`,
which is not a call but lets the desk say something honest at 95%.

### The reporting gate

`MIN_REPORTING_TO_CALL = 0.35`. Never call below 35% of expected vote no matter
what z says.

The reason is that early returns are not a random sample. Whichever counties
report first are systematically different from the ones that report last, and
the normal model cannot see that. A 40-point lead on 3% of the vote from one
county produces a huge z and means nothing. In Michigan this matters
specifically: Wayne, Oakland and Macomb report fastest and are not
representative of the statewide Democratic electorate.

Override per-race for known reporting patterns, for example an all-mail state.

### Never overrides AP

This produces the TPSI claim only. AP's call and a TPSI call remain separate
and separately labeled, per Design System §5.7. If they disagree, both display.

---

## 3 · WIRING THE PAGE — the actual fix to your complaint

`tonight-page.tsx` currently has:

```ts
const MODEL = {
  a: { name: "Abdul El-Sayed", share: 54.8, win: 83.2 },
  b: { name: "Haley Stevens",  share: 45.2, win: 16.8 },
  ...
};
```

Those are constants. They never move. Replace with a live call to the engine on
every refresh:

```ts
import { forecastRace } from "@/app/lib/electoralModel";
import { evaluateCall } from "@/app/lib/raceCall";

/** Pre-election prior. This is the ONLY place the poll numbers live. */
const POLL_PRIOR = { Candidate1: 0.548, Candidate2: 0.452, Candidate3: 0 };
const EXPECTED_TURNOUT = 1_100_000;   // ← set from the TPSI turnout model

const fc = useMemo(() => {
  const all = sortC(mi);
  const total = counted(mi);
  const pct = estRep(mi) / 100;

  return forecastRace({
    race_rule: "PLURALITY",
    percent_reporting: pct,
    reported_vote_total: total,
    expected_turnout: EXPECTED_TURNOUT,
    reported_share: {
      Candidate1: total ? (all[0]?.votes ?? 0) / total : 0,
      Candidate2: total ? (all[1]?.votes ?? 0) / total : 0,
      Candidate3: total ? (all[2]?.votes ?? 0) / total : 0,
    },
    expected_share: POLL_PRIOR,
    poll_avg_shares: POLL_PRIOR,   // ← REQUIRED. Without it the projection is static.
  });
}, [mi]);

const call = useMemo(
  () => evaluateCall(fc, { Candidate1: "El-Sayed", Candidate2: "Stevens" }),
  [fc]
);
```

Then bind the display to the engine rather than the constants:

| Element | Was | Becomes |
|---|---|---|
| Win probability ring | `MODEL.a.win` | `fc.plurality_odds_to_win.Candidate1 * 100` |
| Projected share bars | `MODEL.a.share` | `fc.modeled_share.Candidate1 * 100` |
| Projected margin | `+9.6` hardcoded | `fc.projected_margin_pct` |
| Est. reporting ring | API value | `fc.modeled_percent_reporting * 100` |
| Verdict line | static sentence | `call.line` |
| Race status chip | `STATUS_COPY[state]` | driven by `call.verdict` |

**`reported_share` must be ordered to match the prior.** `sortC()` sorts by
votes descending, so once Stevens leads she becomes `all[0]` and the mapping
silently inverts. Map by candidate name, not by position.

### What this changes on screen

Before polls close, `percent_reporting = 0`, so `modeled_total = expected_turnout`
and `modeled_share` equals the poll prior. The page shows 54.8 / 45.2 and 83.2%,
identical to today. **Nothing regresses.**

Once ballots report, every number moves on its own. The projection migrates
from the poll toward the count, the win probability responds to both the margin
and the collapsing sigma, and the verdict line escalates from too early to
leaning to callable.

---

## 4 · TWO BUGS THE CALL RULE EXPOSES

Both documented in full at the bottom of `raceCall.ts`.

### 4a · The 0.1 sigma floor freezes the call threshold at 90% reporting

For `PLURALITY` races, `Math.max(0.1, ...)` stops sigma shrinking once the
outstanding pool falls below 10% of the total. On a 1.1M Michigan primary:

| Reporting | Remaining | sd_race | Margin needed for z=3 |
|---|---|---|---|
| 50% | 550,000 | 60,100 | 254,983 (23.18 pts) |
| 75% | 275,000 | 30,050 | 127,491 (11.59 pts) |
| 90% | 110,000 | 12,020 | 50,997 (4.64 pts) |
| 95% | 55,000 | 12,020 | 50,997 (4.64 pts) |
| 99% | 11,000 | 12,020 | **50,997 (4.64 pts)** |

From 90% onward the threshold never moves again. **Any race closer than 4.64
points can never be called by the model**, however complete the count. At 99%
reporting the model asserts 12,020 votes of uncertainty about a pool of 11,000
outstanding ballots.

El-Sayed at a projected +9.6 clears this comfortably. A close race does not.

Fix, in `electoralModel.ts` around line 511:

```ts
const floor = Math.min(0.1, safeDiv(modeled_vote_remaining, implied_total));
sd_race = sd_pre_election * (isRunoffStyle
  ? Math.min(1, scale)
  : Math.max(floor, Math.min(1, scale)));
```

Keeps the damping through the middle of the count, releases it in the last 10%.

### 4b · Divisor discontinuity at 5,000,000 turnout

```
turnout 4,999,999  →  divisor 19.50
turnout 5,000,000  →  divisor 14.50
```

The interpolation ramps toward 19.5, the clamp above it returns 14.5. One
additional expected voter widens sigma by 34%. Not urgent tonight, nothing is
near 5M, but it will misfire on a general election.

---

## 5 · BLOCKING INPUT

`EXPECTED_TURNOUT` for the Michigan Democratic Senate primary. Everything in
§1 keys off it: sigma, remaining vote, the call threshold. A bad turnout
assumption produces a confident wrong answer rather than an obviously wrong
one, which is the worse failure.

The 1.1M in the sample code above is my placeholder, not a TPSI number.
