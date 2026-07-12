# The Public Sentiment Institute — Handoff Doc
**Date:** June 17, 2026  
**Repo:** `undergroundmantech/thepublicsentimentinstitute`  
**Branch:** `main`  
**Last pushed commit:** `47bab85` — "Fix 425M vote blip: cap implied_total at 10x expected_turnout in forecast model"

---

## Quick Start (new codespace)

```bash
npm install
npm run dev          # starts on :3000 (Turbopack)
```

Stack: **Next.js 16.1.6**, TypeScript strict, Tailwind, Node v24.

---

## What was built in this session

### June 16 GA / AL / OK / DC runoffs — now active

All races are live on `/results`. Key spotlight races wired everywhere:

| Race | CivicAPI ID | Rule |
|------|------------|------|
| GA US Senate R Runoff | 83316 | PLURALITY |
| GA Governor R Runoff | 83266 | PLURALITY |
| AL US Senate R Runoff | 83428 | PLURALITY |
| OK State Question 832 | 83476 | PLURALITY |
| DC US House Delegate D | 83478 | PLURALITY |
| DC Mayor D Primary | 83479 | **RANKED_CHOICE** |

Full GA/AL/OK/DC race sets are in `RACE_FORECAST_DEFAULTS` (~line 155 of `app/results/page.tsx`) and `app/results/_data/raceRegistry.ts`.

### Archived races
All May 26 TX runoffs, all June 2 CA/IA/MT/NJ/NM/SD/TX races, and all June 9 SC/ME/NV/ND races are `archived: true` in the registry and `FEATURED` array.

### DC Mayor RCV rule
`83479` uses `raceRule: "RANKED_CHOICE"`. The system renders:
- Badge: `RANKED CHOICE` (not "THRESHOLD 35%")
- Win probability header: `WIN PROBABILITY · RCV ≥50%`
- Runoff label: `RCV NEXT ROUND`
- `pollsCloseIso`: `"2026-06-16T20:00:00-04:00"` (polls close 8 PM ET)

### Forecast splash screen
`ForecastPanel` hides forecast body until 10% reporting (`SPLASH_THRESHOLD = 10`). Shows animated equalizer bars ("FORECAST RUNNING"). "SHOW FORECAST ANYWAY" button → reveals forecast under amber "EARLY ESTIMATE" banner.

### Forecast 425M vote blip fix
`app/lib/electoralModel.ts` — `forecastRace()` caps `implied_total = Math.min(raw_implied, 10 * expected_turnout)`. Prevents API garbage during precinct updates from spiking the model.

### Home page spotlight ticker
`app/components/SpotlightRaceCard.tsx` — RACES array has GA Senate, AL Senate, OK SQ832, DC Mayor (RANKED_CHOICE). OOB guard: `RACES[activeIdx % RACES.length]`.

---

## Key files

| File | Purpose |
|------|---------|
| `app/results/page.tsx` (~3667 lines) | Main election night dashboard. All race configs, forecast logic, UI |
| `app/results/_data/raceRegistry.ts` (140 lines) | Slug ↔ ID ↔ date ↔ archived registry |
| `app/lib/electoralModel.ts` (612 lines) | Forecast model. `RaceRule` type, `forecastRace()` |
| `app/components/SpotlightRaceCard.tsx` (322 lines) | Home page live ticker |
| `app/api/forecast/route.ts` | Forecast API endpoint |

### Critical constants in `app/results/page.tsx`

- **`RACE_FORECAST_DEFAULTS`** (line ~58): per-race rule, turnout, poll avg, overrideReporting
- **`STATE_POLLS_CLOSE`** (line ~191): `{ GA: "...T19:00:00-04:00", AL: "...T20:00:00-05:00", OK: "...T20:00:00-05:00" }`
- **`FEATURED`** (line ~224): all races shown in the picker; set `archived: true` to retire
- **`ALL_SPOTLIGHT_META`** (line ~2074): spotlight tab definitions with `shortLabel`, `about`, `title`
- **`SPOTLIGHT_RACES`** (line ~2198): filtered from ALL_SPOTLIGHT_META (excludes archived)
- **`activeStates`** (line ~1190 area): ordered list driving state tabs
- **`stateActiveLabel`** (line ~1803): human-readable state labels in the picker

---

## AP Results Scraper

A **browser-free** Python scraper fetches all 159 GA counties directly from the AP elections JSON API.

```bash
python3 scripts/scrape_ap_ga_gov.py
```

- **Output:** `ga_gov_runoff_county_results.csv` (workspace root)
- **No dependencies** beyond stdlib (`urllib`, `gzip`, `csv`, `json`)
- **AP endpoint:** `https://interactives.apelections.org/election-results/data-live/2026-06-16/results/races/GA/20260616GA12385/`
  - `summary.json` — topline (eevp, candidates, totals)
  - `detail.json` — all counties (keys `"11001"…"11159"`, `reportingunitLevel: 2`)
  - `metadata.json` — candidate names (dict keyed by candidateID string)

**Current results (June 17 ~2:45 AM ET):**
- Rick Jackson **52.6%** (372,042) — WINNER
- Burt Jones **47.4%** (334,648)
- 97.4% est. vote, 99.7% precincts

**To scrape a different race**, update `BASE` in the script:
```
BASE = "https://interactives.apelections.org/election-results/data-live/2026-06-16/results/races/{STATE}/{AP_RACE_ID}"
```
Find the AP race ID by opening the AP results page in a browser, opening DevTools → Network → filter `.json`, and watching for `summary.json` or `detail.json` calls.

---

## Untracked files (NOT pushed, local only)

```
scripts/scrape_ap_ga_gov.py         — AP scraper (new, not committed)
ga_gov_runoff_county_results.csv    — 159-county output
ga_gov_runoff_county_results.json   — earlier JSON output
ap_raw_rows.json                    — earlier raw AP rows
```

These were **not added to git** intentionally. Commit them if you want to preserve the scraper.

---

## Possible next tasks

1. **Archive June 16 races** once results are final — set `archived: true` in `raceRegistry.ts` and in the `FEATURED` array entries in `page.tsx`
2. **Add `overrideReporting`** to June 16 races once fully called (e.g., `overrideReporting: 99.5`)
3. **Add `manualCall`** to definitively called races in `RACE_FORECAST_DEFAULTS`
4. **Extend AP scraper** to other June 16 races (AL Senate, OK SQ832, DC Mayor) — same pattern, just change `BASE` URL
5. **Update poll averages** for any race where the forecast looks off vs. actual results

---

## Backup branch

`dustin-backup` at `ee5d808` — snapshot taken before the 425M blip fix, contains all the June 16 race additions.
