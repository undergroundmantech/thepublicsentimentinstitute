# CHANGE ORDER 06 — ELECTION NIGHT COVERAGE GATE

**Date:** 2026-08-04
**Branch:** `tpsi-site-update-07-26` — commit in place, no PR, no branch switch
**Audited against:** the July 22 zip. Every line number and count below was
verified by grep, not recalled.

---

## 0 · WHAT THIS ORDER IS AND ISN'T

An earlier draft of this order contained sections on lead-candidate selection,
Washington party badges, truncated ballot titles, and poll-close labeling,
derived from a screenshot. **That screenshot was Decision Desk HQ's board, not
ours.** Those were DDHQ's problems. They are removed. Nothing below is
inferred from it.

What remains is what exists in our code and was confirmed by grep.

**Deadline:** Virginia polls close 7:00 PM ET. That is the first result of the
night and the hard gate.

---

## 1 · THE COVERAGE GATE — the only structural change

### Verified current state

```
app/results/ResultsDesk.tsx:18   import { classifyRaceTier } from "./_data/raceCapabilities";
app/results/ResultsDesk.tsx:47   const tierOf = (d: any) => classifyRaceTier(d?.contest, d?.office);
app/results/ResultsDesk.tsx:55   const isCovered = (d: any) => tierOf(d) >= 3;
```

```
grep -c "raceRegistry\|RACE_REGISTRY" app/results/ResultsDesk.tsx   → 0
grep -c "coverageWatchlist"           app/results/ResultsDesk.tsx   → 0
```

`classifyRaceTier` is a regex over contest **names** (`raceCapabilities.ts`,
lines ~110-125). `NATIONAL_RE` matches every US Senate race in the country → 5.
`SPOTLIGHT_RE` matches every governor and US House race → 4. `FORECAST_RE`
matches every amendment and statewide office → 3. So `isCovered` currently
means "the contest name sounds important," which across five states tonight is
thousands of races.

Two curated lists already exist in `_data/` and neither is imported anywhere in
the desk.

### The fix

1. Add `app/results/_data/coverage.2026-08-04.ts` (attached).
2. In `ResultsDesk.tsx`, replace line 55:

```ts
// before
const isCovered = (d: any) => tierOf(d) >= 3;

// after
import { isCoveredId } from "./_data/coverage.2026-08-04";
const isCovered = (d: any) => isCoveredId(Number(d?.id));
```

3. Leave `tierOf` and `byTierThenVotes` **exactly as they are.** They sort
   within the covered set. That is the correct surviving job for the regex.
4. Merge `AUGUST_CAPABILITY_OVERRIDES` into `RACE_CAPABILITY_OVERRIDES` in
   `_data/raceCapabilities.ts`. Merge, do not replace — the DC Mayor and
   Command Deck test-bed entries stay. The stale comment at lines 48-57 saying
   CivicAPI has no August ids is now obsolete; update or delete it.

`isCovered` is referenced at lines 238, 296, and 488. All three inherit the fix
from the single definition. Do not edit them individually.

### Protected — do not filter

Per CO-05 §5a, unchanged and out of scope:

- `DeskSphere` and its live county rendering
- The wall of boards and its 3-per-state cap (~line 296)
- The chyron's motion and presence

Density is the proof a real election night is underway. Curation applies only
where TPSI asserts a forecast, projection, or call.

### Verification

```bash
grep -n "isCoveredId" app/results/ResultsDesk.tsx          # expect 2 (import + def)
grep -c "tierOf(d) >= 3" app/results/ResultsDesk.tsx       # expect 0
grep -c "classifyRaceTier" app/results/ResultsDesk.tsx     # expect 1 — sort only
```

Board renders **24 races**: 1 spotlight, 10 featured, 13 list.

---

## 2 · THE SPOTLIGHT — Michigan U.S. Senate D, id 84778

The only race tonight carrying a TPSI model. It resolves to tier 4 via the
capability override, which turns on `forecast`, `countyModel`, `modeData`, and
`telemetry` through the existing `TIER_DEFAULTS` table. No new capability
plumbing is needed.

### Figures — use exactly these

| Field | Value |
|---|---|
| Projection | El-Sayed 54.8% · Stevens 45.2% |
| Margin | El-Sayed +9.6 |
| Win probability | **83.2%** |
| 90% margin range | −6.8 to +25.7 |
| Sample | n = 254 |
| Universe | 19,999-record modeled voter file |
| Margin of error | ±6.9 at 95%, design-adjusted |
| Field dates | July 25–29, 2026 |
| Model | DSMeridian Model 10 / 12 |

### 83.2%, not 96%

Both numbers exist in the model output; only one is publishable. The 96%
bootstrap figure describes uncertainty in the **estimate**. The 83.2%
simulation figure is calibrated to the historical primary polling error
benchmark and describes uncertainty in the **outcome**. If the race lands
inside the 90% range, 83.2% survives scrutiny and 96% does not.

### Required disclosure

Renders in full anywhere the projection appears. Not a truncatable footnote:

> 754 interviews collected across two modes; reported ballot-test estimates are
> based on 254 text-message interviews conducted against the Michigan voter
> file, modeled across a 19,999-record voter universe; a concurrent
> 500-interview online panel sample was excluded following mode-comparison
> review.

### Call-source separation

`AP CALL` (driven by CivicAPI `winner: true`) and `TPSI PROJECTION` (driven by
our model) are different claims and must not share a treatment. If they
disagree, both display. The disagreement is the story.

### No forecast card anywhere else

The other 23 races resolve to tier 2, `forecast: false`. The existing
capability gate already handles this — verify it does rather than adding a
guard. Never render an empty or placeholder forecast panel; it reads as a
broken model. This is the Arizona precedent.

---

## 3 · TOKEN AND FONT NOTE — read before styling anything

`.github/skills/psi-ui/` is **stale and will mislead you.** Verified against
`app/globals.css` and `app/layout.tsx`:

| psi-ui doc claims | Reality in the code |
|---|---|
| `--font-display` = Quantico | Geist. Quantico appears **0** times in `app/` |
| `--purple` = `hsl(271,50%,65%)` | `#8a63ef` dark / `#6d3ee9` light |
| `--red` = `#e63946` | `#d64550` dark / `#c22f3b` light |
| `--blue` = `#2563eb` | `#3b7bde` dark / `#1d5fc4` light |
| `--panel` dark = `#161827` | `#111114` |
| `--r-lg` = 22px | 11px |

**`app/globals.css` is the source of truth. Ignore the skill doc's values.**
Someone should retire or regenerate that skill after tonight — an agent reading
it will produce off-brand output with total confidence.

Correct type stack: `--font-display` and `--font-body` are Geist,
`--font-numeric` is JetBrains Mono. Brand gradient is `--brand-grad`, the
four-stop `#d2494b → #a44197 → #6d3ee9 → #3f60e8`, and it stays restricted to
its two sanctioned placements.

---

## 4 · DEFERRED — do not touch tonight

Real, measured, and all carrying regression risk:

```
raw "JetBrains Mono" strings in app/results   70
var(--font-numeric) uses                      26
desk-local Google Fonts imports                2
Manrope / --font-mp references                49
hardcoded #2dd4bf (should be var(--live))     47
text-transform: lowercase rules               10
```

`ResultsDesk.tsx` still imports `Manrope` from `next/font/google` at line 7 and
instantiates it at line 24. CO-05 was never executed.

None of this affects what the board **asserts** tonight. A 70-string font
refactor at 5 PM is how you ship a broken board at 7:01. It waits.

---

## 5 · ACCEPTANCE CRITERIA

Blocking. All must pass before commit.

1. Board renders 24 races. Not thousands.
2. `grep -c "tierOf(d) >= 3" app/results/ResultsDesk.tsx` → 0
3. `grep -c "classifyRaceTier" app/results/ResultsDesk.tsx` → 1
4. `RACE_CAPABILITY_OVERRIDES` still contains 83479, 84322, and 84105 after the
   merge.
5. 84778 resolves to tier 4 with `forecast: true`.
6. Every other covered race resolves to tier 2 with `forecast: false`.
7. Win probability displays 83.2%.
8. The disclosure string renders in full wherever the projection appears.
9. 84950 and 84951 resolve `raceRule: "TOP_TWO"`.
10. `DeskSphere`, the board wall, and the chyron are visually unchanged.
11. `npm run build` passes.

---

## 6 · OPEN ITEM

The spotlight blurb in the registry `note` field for 84778 is Claude's draft.
Dustin reviews and replaces before go-live. Everything else executes without
him.
