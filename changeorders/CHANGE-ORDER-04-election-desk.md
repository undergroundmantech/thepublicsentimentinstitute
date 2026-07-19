# CHANGE ORDER 04 — Election Desk Rebuild
### Five-level coverage system · Command Deck + Deep Dive · August primaries target

**Target repo:** `thepublicsentimentinstitute-site-v2` (execute against the
POST-Phase-4 codebase — the updated branch/zip, NOT the original snapshot).
**Depends on:** CO-01 (tokens/fonts, incl. Phase 4 Manrope migration) merged.
CO-03 (home hero/footer) is independent; order between 03 and 04 doesn't matter.
**Ship target:** the upcoming **August primaries** run on this new desk.
**Attached files:**
- `reference-deepdive.html` — **LAYOUT + FUNCTION AUTHORITY** for the race
  page: the page structure, section order, and component arrangement follow
  this document. Its fonts/colors/spacing are a foreign system — restyle
  everything in TPSI tokens (CO-01 light/dark sets, JetBrains Mono desk
  type), but do NOT rearrange its layout.
- `spec-command-deck.html` — COMPONENT-STYLE reference only (NOT page
  layout): use it for the gauge family (wheel + ring), county-table rail
  treatment, chips, state badges, and token usage. The bento grid it shows
  is NOT the page layout for this order.
- `reference-localboard.html` — FUNCTION reference for the local race board
  card grammar (incl. ballot measures & nonpartisan races). Same rule: TPSI
  tokens, not its styling.

---

## 0 · LOCKED DECISIONS (owner-confirmed; do not re-litigate)

1. **Theme:** LIGHT is the desk default. The existing light/dark toggle is
   retained and every component must be fully workable in dark via the CO-01
   token pairs. No light-only or dark-only components.
2. **Timeline/flight recorder:** the capture pipeline runs **internally**
   starting with the August primaries (silent). The public **Live Timeline**
   UI ships BUILT but **flag-off**, debuting for the **Nov 3 general**.
   Every forecast surface must therefore render correctly in BOTH states:
   `telemetry: false` (default; shows the "no history" marker) and
   `telemetry: true` (timeline section mounts).
3. **County table:** two variants of ONE component —
   `countyModel: true` → includes the PROJ. MARGIN column (all listed
   counties projected); `countyModel: false` (the common case) → column
   absent entirely. Never a mixed table with "—" cells.
4. **Local races (Levels 1–2 low-tier):** hosted on ONE page
   (`/results/local` or equivalent under the results route): a searchable
   board of compact cards, **direct CivicAPI passthrough, no storage, no
   snapshots, no per-race pages** (deliberate SEO consolidation). The board
   is the terminal surface for these contests.

---

## 1 · ARCHITECTURE — one tree, capability flags

Build ONE race-page component tree. Sections mount based on the race's config,
extending the existing registry pattern (`raceRegistry` / capability tiers):

```ts
type RaceTier = 5 | 4 | 3 | 2;           // TPSI numbering: 5=National, 4=Spotlight, 3=Forecast, 2=Featured
interface RaceCapabilities {
  tier: RaceTier;
  forecast: boolean;        // in-house model exists (tier 3+)
  countyModel: boolean;     // county-level projections (Spotlight only)
  modeData: boolean;        // Early/VBM/E-day splits available for this state
  telemetry: boolean;       // flight-recorder history exists AND public flag on
  raceRule: "PLURALITY" | "MAJORITY_RUNOFF" | "THRESHOLD_RUNOFF";
  spotlight: boolean;       // marquee placement flag
}
```

**Tier numbering is TPSI-canonical (5 high → 1 low).** The reference concept
document numbers tiers in the OPPOSITE direction — ignore its numbering
entirely; use only its component content.

Page anatomy (single route per hosted race; ORDER AND STRUCTURE PER
`reference-deepdive.html` — tier/flags decide which sections mount):

```
┌ Desk chrome: race switcher strip (all races on the desk date; ARCHIVE; FILTER)
├ 1 Race header — title, dek sentence, meta stats
│    (REPORTED VOTES · EST. REPORTING · RACE STATUS), updated time,
│    in-page nav tabs (Overview / Geography / Forecast / Counties)
├ 2 Reported Results card  +  Forecast Snapshot card (side-by-side zone)
├ 3 County Map section (RESULTS / MARGIN / REMAINING toggles)
├ 4 Projected Turnout & Remaining Vote
├ 5 Results by County (search + sort table)
├ 6 Live Timeline — "How the race is evolving" (telemetry flag)
├ 7 Remaining Ballot Landscape (modeData flag)
├ 8 About This Race (editorial) + data-semantics footer
```

### Tier capability matrix (authoritative)

| Component | T5 National | T4 Spotlight | T3 Forecast | T2 Featured | Local board |
|---|---|---|---|---|---|
| Majority-bar dashboard (270/51/218) | ● | — | — | — | — |
| Command Deck A Topline | per-race links | ● | ● | ● | card grammar |
| B Wheel + D Forecast | aggregate | ● | ● (statewide σ) | — | — |
| C Race Clock | ● | ● | ● | ● | inline chip |
| E County table | — | ● `countyModel:true` | ● no Proj. col | ● no Proj. col | — |
| F Map | national | ● county | ● county | ● county (results-only toggles) | — |
| §Turnout & Remaining | national roll-up | ● | ● statewide | — | — |
| §Ballot Landscape | — | ◐ `modeData` | — | — | — |
| §Live Timeline | ◐ `telemetry` | ◐ `telemetry` | ◐ `telemetry` | — | — |
| §About This Race | ● | ● | ● | ◐ optional | — |
| Gate + state machine + archive | ● | ● | ● | ● states only | states only |

**August-primaries reality:** T5 does not ship in this order (no general
imminent) — build the shared majority-bar component only if time allows,
otherwise defer to a small follow-up. Everything else ships.

---

## 2 · VOCABULARY CANON (use these strings/definitions everywhere)

- **EST. REPORTING** = estimated % of expected vote (TPSI methodology) — the
  LEADING reporting figure everywhere. Precinct-based % may appear as a
  secondary detail labeled `PRECINCTS`. One denominator leads; never mix
  unlabeled.
- **Race states:** `SCHEDULED → LIVE·GATED (<10%) → LIVE·FORECAST →
  PROJECTED (TPSI call) → OFFICIAL (certified)`. C's Race Clock, the header
  badges, and V1's state machine all speak this one vocabulary.
- **Vote modes:** `EARLY / VBM / ELECTION DAY` (exact labels).
- **Data semantics rule (from the concept doc — adopt fully):** reported
  values render solid; model outputs render muted/dashed and carry a
  `PROJECTED` label; forecast share bars use the SAME 0–100 scale as
  reported bars; the desk footer carries the semantics statement. When
  `telemetry:false`, forecast panels show:
  `NO HISTORY SNAPSHOTS — LIVE DATA ONLY`.
- **Win probability display:** normalize via the existing
  `normalizeWinProbabilitiesByCandidateCount`; residual mass is shown as
  `OTHER OUTCOMES <1%` in the wheel legend when nonzero. Do NOT display a
  separate "comeback probability" stat (duplicate of trailer win prob); the
  flip-threshold sentence in D covers the comeback framing.

---

## 3 · RACE PAGE ZONES (layout authority: `reference-deepdive.html`; styling: TPSI tokens + `spec-command-deck.html` components)

Implement each zone in the reference document's position and arrangement,
substituting TPSI components and vocabulary:

- **Zone 1 — Race header:** title (mono 800) + one-sentence dek (registry
  copy); meta stat blocks REPORTED VOTES · EST. REPORTING · RACE STATUS
  (state-machine string per §2); LAST UPDATED + auto-refresh indicator;
  in-page anchor tabs (Overview / Geography / Forecast / Counties). The Race
  Clock ring (gauge family, from spec-command-deck) renders compact inside
  the RACE STATUS block — countdown → reporting fill → called ✓ → OFFICIAL.
- **Zone 2 — Reported Results + Forecast Snapshot (side-by-side):**
  LEFT: reported-results card — candidate rows (rail, name+party sub-line,
  votes, share, solid 0–100 bars), leader `Leads by N votes` line,
  poll-delta chips where a poll average exists, reported-total + EST.
  REPORTING footer, race-status chip.
  RIGHT: forecast snapshot card (tier 3+; hidden tier 2 with the results
  card widening per the reference's results-only variant) — the WIN
  PROBABILITY WHEEL (half-gauge w/ race-rule chip + legend incl. `OTHER
  OUTCOMES <1%`); verdict + flip-threshold sentence; PROJECTED FINAL SHARE
  muted bars on the same 0–100 scale with `±N.N vs current` chips; current
  vs projected margin stats; the model-read sentence ("What changes from
  here"). OPTIONS drawer holds the margin box-and-whisker + model
  statistics grid. Runoff module mounts per raceRule. Footer: semantics or
  `NO HISTORY SNAPSHOTS — LIVE DATA ONLY` per §2.
- **Zone 3 — County Map:** real county topology (onpoint `ResultMap`
  harvest, §7); toggles RESULTS / MARGIN / REMAINING (REMAINING only with
  forecast); hover/focus county detail line as in the reference; rating
  legend.
- **Zone 4 — Projected Turnout & Remaining:** per §4a below.
- **Zone 5 — Results by County:** the full table per §4-table notes: search
  box + sort (Total / Reporting / A–Z / Margin), Option B leader rails,
  sticky header, and the two-variant PROJ. MARGIN rule (§0.3).
- **Zone 6 — Live Timeline:** per §4c (telemetry flag).
- **Zone 7 — Remaining Ballot Landscape:** per §4b (modeData flag).
- **Zone 8 — About This Race + semantics footer:** per §4d.

**Theming:** light default per §0.1; every color through tokens; desk type
JetBrains Mono throughout (§7). Mobile: zones stack in the same order;
Zone 2 cards stack results-first.

## 4 · SECTION SPECS (content/behavior detail for Zones 4–8; restyle in TPSI tokens)

**§4a Turnout & Remaining** (tier 3+): three stat blocks
(VOTES REPORTED / EST. OUTSTANDING / PROJECTED TURNOUT — AUC turnout model
feeds the latter two), then per-candidate stacked tracks on ONE shared scale:
solid reported + dashed est. remaining → projected total labels. Close with
the one-sentence model read (`X is projected to receive about N more
outstanding votes, expanding/narrowing the lead to ~N`). All projected
elements muted + labeled per §2.

**§4b Ballot Landscape** (`modeData:true` only, effectively Spotlight): one
row per mode (EARLY / VBM / ELECTION DAY): est. remaining count, % counted
progress, projected split bar per candidate, lean tag; ends with the
`Why it matters:` plain-English sentence generated from the mode gaps. This
is the public face of the mode-aware model — never extrapolate one mode's
surge onto another (the sentence should be able to say exactly that).

**§4c Live Timeline** (`telemetry:true` only; BUILD NOW, FLAG OFF):
three charts on one shared time axis — WIN PROBABILITY · EST. REPORTING ·
PROJECTED FINAL SHARE — hover-synced (one moment highlights across all
three), click-to-expand each. Marks: gate region, TPSI call line, now-point.
Data source: flight-recorder snapshots (§6). When flag off, section does not
mount and D's footer carries the absence line. Public debut: Nov 3 general.

**§4d About This Race** (editorial): port the V1 ABOUT THIS RACE block
(registry-driven copy) unchanged in function; restyle to tokens. This is the
newsroom voice — required for tiers 3+.

---

## 5 · LOCAL RACE BOARD (function reference: `reference-localboard.html`)

One page under the results route (e.g. `/results/local?date=…`):
- Header + **search/filter** (jurisdiction, office, text) + county filter.
- Grid of compact cards: jurisdiction + % reporting; office; candidate rows
  (rail, name, party or NONPARTISAN, pct, votes); status chip
  (LEADER / PROJECTED WINNER / MEASURE PASSES–FAILS per Civic call);
  `Leads by N` line; updated time. **Ballot measures** render YES/NO rows.
  Candidate-palette rule applies (nonpartisan/one-party → neutral + `--c2`,
  never fake red/blue).
- **Direct CivicAPI passthrough:** fetch on load + the standard 30s refresh;
  NO storage, NO snapshots, NO flight recorder, NO per-race routes or links
  implying them. Card grammar is terminal.
- SEO: single indexed page; no generated per-race URLs.

---

## 6 · FLIGHT DATA RECORDER — capture pipeline (internal, ships now)

- On the desk's existing 30s refresh cycle, persist a per-race snapshot at a
  **1-minute cadence** (dedupe within the minute): timestamp, votes per
  candidate, est. reporting, win probabilities, projected shares/margin,
  remaining estimate, race state. Storage: simplest durable option available
  in the deployment (per-race JSON blobs or a small KV/DB table — Codespace
  proposes; owner approves before implementation).
- Recording is **silent**: no public UI reads it in August. §4c reads it when
  the flag flips for Nov 3. Archive playback (V1's archive mode) becomes the
  internal QA harness for the timeline.
- Scope guard: capture only tiers 3+ (never the local board).

---

## 7 · V1 PARITY & LEGACY DECISIONS

- **Parity checklist (nothing lost from the live desk):** race navigator
  (as the switcher strip), spotlight staging, ABOUT THIS RACE, forecast
  gating + SHOW FORECAST ANYWAY override, TOO-EARLY→PROJECTED→OFFICIAL
  machine, AUTO-REFRESH 30s indicator, ARCHIVE mode, FORECAST β chip,
  POWERED BY CIVICAPI credit, rating vocabulary (TIED→SAFE), light/dark
  toggle, poll-close countdown (**fix the timestamp bug** — the live desk
  renders `20635d`; correct the date math while porting).
- **onpoint/.jsx stack:** HARVEST `ResultMap` (real county geometry) and
  `electionLib` utilities into the new tree (converted to TS); RETIRE the
  rest of the onpoint page stack (`OpaResultsPage`, `DayView`,
  `ElectionCalendar`, `ElectionResults`, `RaceDetail`, `resultRow`) once the
  new desk reaches parity. Flag any onpoint piece with no TPSI equivalent
  for owner review BEFORE deletion.
- **Desk typography exception:** desk headlines/panel titles/labels remain
  **JetBrains Mono** (`--font-numeric` family) — the Geist display switch
  (CO-03) does NOT apply inside the desk. Enforce via desk component classes.

---

## 8 · EXECUTION PLAN (branch `co04/election-desk`; commit + green build per phase)

1. **Phase A — Registry & vocabulary:** extend race config with
   `RaceCapabilities`; implement state-machine + reporting-definition
   utilities; wire the August primary races into the registry with real
   tiers/flags. Commit.
2. **Phase B — Command Deck:** build A–F per §3 against
   `spec-command-deck.html`; both themes. Commit.
3. **Phase C — Deep Dive:** §4a, §4b, §4d; §4c built behind the flag with a
   fixture-data storybook/test route for QA. Commit.
4. **Phase D — Local board:** §5. Commit.
5. **Phase E — Recorder:** §6 capture pipeline (after owner approves the
   storage proposal). Commit.
6. **Phase F — Parity + retirement:** §7 checklist pass; onpoint harvest;
   legacy retirement PR notes. Commit.
7. **QA gates:** every phase — `npm run build` green; both themes on every
   new surface; mobile 360/768/1440; no legacy hexes
   (CO-01 grep set) in new code; race-state fixtures rendered for all five
   states; `countyModel` on/off and `telemetry` on/off fixtures rendered.
8. PR `co04/election-desk` → current integration branch (owner names it at
   execution time — do NOT assume `main`).

## 9 · ACCEPTANCE CHECKLIST (owner sign-off)

- [ ] Page structure matches `reference-deepdive.html` zone order (owner will compare side-by-side)
- [ ] August primary races live on the new desk, light default, dark fully working
- [ ] Gate + override + full state machine functioning against live CivicAPI
- [ ] D shows verdict + flip threshold; box-whisker + stats in OPTIONS drawer
- [ ] County table renders both variants correctly (with/without PROJ. MARGIN)
- [ ] Ballot Landscape appears only where mode data exists; sentence reads correctly
- [ ] Timeline mounts ONLY with `telemetry:true` (fixture); absence line otherwise
- [ ] Recorder writing 1-min snapshots for tier-3+ races (verified in storage)
- [ ] Local board: search works, measures + nonpartisan render, no per-race URLs, no storage
- [ ] Nothing on the V1 parity checklist missing; countdown bug fixed
- [ ] All copy: no em dashes; "election night" unhyphenated; vocabulary per §2
