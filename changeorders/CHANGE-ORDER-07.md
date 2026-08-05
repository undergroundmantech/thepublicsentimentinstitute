# CHANGE ORDER 07 — ELECTION NIGHT PLACEHOLDER BOARD

**Date:** 2026-08-04
**Branch:** `tpsi-site-update-07-26` — commit in place, no PR, no branch switch
**Supersedes:** CO-06 draft, which is withdrawn. Its coverage-gate section is
folded in below as §3.

**Attached files**
- `tonight-page.tsx` — the placeholder route, drop-in
- `coverage.2026-08-04.ts` — coverage registry, drop-in
- `CO-07-mockup.html` — visual reference, four race states, both themes

---

## 0 · WHAT THIS ORDER DOES

Ships a standing placeholder board at `/results/tonight` for the August 4
primaries, and fixes the coverage gate on the results hub. It does **not**
touch the race page, which already works.

**Deadline:** Virginia polls close 7:00 PM ET.

### Deadline order

1. §1 placeholder route — ship first, it is self-contained
2. §3 coverage gate — ship second, it edits shared code
3. §4 deferred — do not start tonight

If §3 is at risk, ship §1 alone. The placeholder does not depend on it.

---

## 1 · THE PLACEHOLDER ROUTE

Drop `tonight-page.tsx` at `app/results/tonight/page.tsx`. No other edits.

### Structure authority

Built on the **Level 2 panel** of
`election_coverage_five_level_methodology_v6.html`, restyled in TPSI tokens per
CO-04's instruction: its fonts and colors are a foreign system, its layout is
not to be rearranged.

Sections, in the prototype's order:

```
site-header ........... brand + nav + theme toggle
race-header ........... kicker, h1 + deck, four meta-blocks, race-tabs
dashboard-grid
  card span-3 ......... Reported results (topline-shell)
  card span-3 ......... Forecast snapshot + Projection zone
board ................. Level 4 cards, 23 races grouped by state
method ................ semantics statement + disclosure + CivicAPI credit
```

### Isolation

Imports `_lib/raceState` and nothing else from `app/results/**`. Not
`ResultsDesk.tsx`, not `raceCapabilities.ts`. Tokens are declared locally on
`.desk`, so the page is unaffected by the state of the globals.css migration.
If §3 is reverted in full, this route still builds and still renders.

### Theme

Light default, per CO-04 §0.1 and the light/dark reference. Reads and writes
`data-opa-theme` plus `localStorage['opa-theme']`, the election section's own
key, so a stored preference from elsewhere on the desk still wins. Inline
no-flash script in the component prevents a light-mode frame on dark load.

The `DEFAULT_THEME` constant at the top of the file flips this in one line if
you want parity with `theme.jsx`, which currently falls back to dark.

---

## 2 · MICHIGAN IS LEVEL 2, NOT LEVEL 1

This is the substantive correction in this order.

The TPSI model for 84778 is **statewide**: n=254 against the Michigan voter
file, producing a single statewide share and margin. It produces **no county
estimates**. That makes the race Level 2 "Statewide forecast," which maps to
**tier 3 Forecast** in the CO-04 §1 capability matrix, not tier 4 Spotlight.

The distinction matters because `TIER_DEFAULTS` in `raceCapabilities.ts` turns
`countyModel: true` on at tier 4. A tier-4 assignment would mount a
PROJ. MARGIN column on a race that has nothing to put in it, producing exactly
the mixed table with em-dash cells that CO-04 §0.3 forbids.

`coverage.2026-08-04.ts` ships with `tier: 3`. Do not raise it.

### 2a · No vote-method card for Michigan

The Level 2 panel suppresses `.ballot-card`, and that suppression is correct
here for a concrete reason: **Michigan does not publish Early / VBM /
Election Day splits**, so there is no mode data to render.

- `modeData: false` for 84778.
- The Remaining Ballot Landscape section does **not** mount.
- Do not add it later "once data arrives." It is not coming for this race.
- The `deferred` line on the page states this explicitly, so a reader does not
  read the absence as an outage.

Design System §4.8 says render only when mode data exists, and §7 lists empty
shells for absent capabilities as reject-on-sight. Both point the same way.

### 2b · Also not rendered

County map and Results by county. Level 2 keeps both, but this standalone route
has no data source: no Michigan county geometry is bundled and CivicAPI's
race-search payload carries no county breakdown. They are absent with a link to
`/results/race/84778`, where they already live. Do not stub them.

---

## 3 · THE COVERAGE GATE (folded in from CO-06)

### Verified current state

```
app/results/ResultsDesk.tsx:18   import { classifyRaceTier } from "./_data/raceCapabilities";
app/results/ResultsDesk.tsx:47   const tierOf = (d: any) => classifyRaceTier(d?.contest, d?.office);
app/results/ResultsDesk.tsx:55   const isCovered = (d: any) => tierOf(d) >= 3;

grep -c "raceRegistry\|RACE_REGISTRY" app/results/ResultsDesk.tsx   → 0
grep -c "coverageWatchlist"           app/results/ResultsDesk.tsx   → 0
```

`classifyRaceTier` is a regex over contest **names**. `NATIONAL_RE` matches
every US Senate race in the country → 5. `SPOTLIGHT_RE` matches every governor
and US House race → 4. `FORECAST_RE` matches every amendment → 3. So
`isCovered` currently means "the contest name sounds important," which across
five states tonight is thousands of races.

### The fix

1. Add `app/results/_data/coverage.2026-08-04.ts`.
2. In `ResultsDesk.tsx`, replace line 55 only:

```ts
// before
const isCovered = (d: any) => tierOf(d) >= 3;

// after
import { isCoveredId } from "./_data/coverage.2026-08-04";
const isCovered = (d: any) => isCoveredId(Number(d?.id));
```

3. Leave `tierOf` (47) and `byTierThenVotes` (48) untouched. They sort within
   the covered set, which is the correct surviving job for the regex.
4. Do not edit the call sites at 238, 296, 488. They inherit the fix.
5. Merge `AUGUST_CAPABILITY_OVERRIDES` into `RACE_CAPABILITY_OVERRIDES`.
   **Merge, do not replace** — 83479, 84322 and 84105 must survive. The comment
   at lines 48-57 claiming CivicAPI has no August ids is obsolete; delete it.

### Protected surfaces — do not filter

Per CO-05 §5a: `DeskSphere` and its county rendering, the wall of boards and
its 3-per-state cap, and the chyron. Density is the proof a real election night
is underway. Curation applies only where TPSI asserts a forecast or a call.

---

## 4 · DEFERRED — do not touch tonight

Measured in the July 22 snapshot, all carrying regression risk:

```
raw "JetBrains Mono" strings in app/results   70
var(--font-numeric) uses                      26
desk-local Google Fonts imports                2
Manrope / --font-mp references                49
hardcoded #2dd4bf (should be var(--live))     47
```

`ResultsDesk.tsx` still imports `Manrope` at line 7 and instantiates it at 24.
CO-05 was never executed. None of this affects what the board asserts tonight.

**Also stale and actively misleading:** `.github/skills/psi-ui/` claims
`--font-display` is Quantico (0 occurrences in `app/`), `--purple` is
`hsl(271,50%,65%)` (actually `#8a63ef`), and `--r-lg` is 22px (actually 11px).
An agent reading it will produce off-brand output with total confidence.
Retire or regenerate it after the election. `app/globals.css` is the truth.

---

## 5 · ACCEPTANCE CRITERIA

**Placeholder (§1-2)**

1. `/results/tonight` renders in both light and dark; toggle persists across
   reload and shares the `opa-theme` key with the rest of the desk.
2. Before any votes: reported results shows the countdown copy, not zeros in a
   table. Forecast snapshot shows 83.2% and the projection zone.
3. Below 10% reporting: forecast snapshot shows the gate box and the projection
   zone is hidden.
4. Above 10%: rings render, projected bars show "+X vs now" deltas against live
   share.
5. Projected bars are **dashed and tinted**. No solid fill anywhere in the
   projection zone.
6. Candidate B is `--c2` magenta. No red against blue inside this primary.
7. No Remaining Ballot Landscape section, in any state.
8. All 23 board cards link to `/results/race/{id}`.

**Coverage gate (§3)**

9. `grep -c "tierOf(d) >= 3" app/results/ResultsDesk.tsx` → 0
10. `grep -c "classifyRaceTier" app/results/ResultsDesk.tsx` → 1
11. `RACE_CAPABILITY_OVERRIDES` still contains 83479, 84322, 84105.
12. 84778 resolves tier 3, `forecast: true`, `countyModel: false`.
13. Hub board renders 24 races, not thousands.
14. `DeskSphere`, board wall, and chyron visually unchanged.
15. `npm run build` passes.

---

## 6 · OPEN ITEM

The deck, projection headline, and About copy in `tonight-page.tsx` are
Claude's drafts. Dustin reviews before go-live. Everything else executes
without him.
