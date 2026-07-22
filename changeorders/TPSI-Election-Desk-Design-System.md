# SKILL — TPSI Election Desk Design System (with code)
### DESIGN AUTHORITY for restyling the results/election pages.

## ⛔ RULE 0 — BRANCH DISCIPLINE
**DO NOT create, switch, or checkout any branch. Do not open a PR or merge.**
The owner is already working inside a non-main working branch. Commit your
work in place on the CURRENT branch. Violating this destroys in-flight work.

## RULE 0.1 — USE THE ESTABLISHED PALETTE
The token values in §1 are the TPSI palette already locked in prior change
orders (CO-01 foundation, CO-03 home, CO-04 desk). Do not invent colors, do
not sample from screenshots, do not keep legacy values. If the repo already
defines these variables, REUSE them; only add what's missing.

---

## 1 · TOKENS — drop-in CSS 

```css
/* ============ TPSI DESK TOKENS — light default, dark via [data-theme] ======= */
/* ============ TPSI DESK TOKENS — light default, dark via [data-theme] ======= */

:root {
  /* surfaces */
  --canvas:#f7f7f4; --panel:#ffffff; --panel2:#f1f1ed; --panel3:#e9e9e4;
  --hairline:#e8e8e2; --hairline2:#d9d9d1;
  /* ink */
  --ink:#17171b; --ink2:#5d5d58; --ink3:#9c9c93;
  /* party / candidate — DATA ONLY */
  --dem:#1d5fc4; --gop:#c22f3b; --c2:#b5338f;       /* c2 = candidate B in same-party races */
  --dem-tint:rgba(29,95,196,.08); --gop-tint:rgba(194,47,59,.08);
  /* non-partisan signal lane */
  --live:#0d9488; --called:#15803d; --gold:#a16207;
  /* brand gradient — max TWO placements per page */
  --brand-grad:linear-gradient(90deg,#d2494b 0%,#a44197 20%,#6d3ee9 51%,#3f60e8 100%);
  /* type */
  --mono:'JetBrains Mono',ui-monospace,monospace;
  --sans:'Geist',system-ui,sans-serif;
  /* shape */
  --r-panel:14px; --r-card:10px; --r-pill:999px;
  --shadow:0 1px 3px rgba(0,0,0,.05);
}

[data-theme="dark"] {
  --canvas:#0a0a0c; --panel:#111114; --panel2:#16161a; --panel3:#1c1c21;
  --hairline:rgba(255,255,255,.08); --hairline2:rgba(255,255,255,.15);
  --ink:#f2f2f0; --ink2:rgba(242,242,240,.62); --ink3:rgba(242,242,240,.36);
  --dem:#3b7bde; --gop:#d64550; --c2:#c757a8;
  --dem-tint:rgba(59,123,222,.14); --gop-tint:rgba(214,69,80,.14);
  --live:#2dd4bf; --called:#37b26c; --gold:#e8b93c;
  --shadow:none;
}
```

### Color LAW
- Party color is **data-only**: rails, chips, tinted numerals, bar fills, map fills.
  Never a panel/page background, never a large solid block.
- Same-party primary: candidate A = party hue, candidate B = `--c2`. **Never**
  the opposing party's color inside a one-party race. Nonpartisan: ink + `--c2`.
- `--live` / `--called` / `--gold` are the non-partisan signal lane and never
  double as party colors.
- `--brand-grad`: at most two placements per page (nav underrule, active
  switcher tab). **Never inside a desk panel.**
- Legacy values `#7c3aed`, `#9d5cf0`, `#e63946`, `#2563eb` are DEAD on sight.

---

## 2 · PAGE STRUCTURE (restyle in place — do NOT rearrange)

1. Race switcher strip (FILTER / ARCHIVE)
2. Race header — title + dek; meta stats REPORTED VOTES · EST. REPORTING ·
   RACE STATUS (Race Clock ring lives here); LAST UPDATED + auto-refresh;
   anchor tabs
3. Reported Results card **+** Forecast Snapshot card (side by side)
4. County Map (RESULTS / MARGIN / REMAINING)
5. Projected Turnout & Remaining Vote
6. Results by County (search + sort)
7. Live Timeline (telemetry flag only)
8. Remaining Ballot Landscape (mode data only)
9. About This Race + data-semantics footer

Mobile: same order stacked; results card before snapshot.

---

## 3 · TYPOGRAPHY

```css
/* Desk voice = mono. Prose = Geist. */
.desk h1,.desk h2,.desk h3,
.desk .panel-title,.desk .kicker,.desk .chip,
.desk th,.desk .num { font-family:var(--mono); }
.desk .prose,.desk .dek,.desk .why { font-family:var(--sans); }

.desk .num,.desk td.num,.desk th { font-variant-numeric:tabular-nums; }

.desk h1{ font-weight:800; font-size:clamp(20px,2.2vw,27px); letter-spacing:-.02em; }
.desk .panel-title{ font-weight:700; font-size:11px; letter-spacing:.12em;
  text-transform:uppercase; color:var(--ink2); }
.desk .kicker{ font-weight:700; font-size:9.5px; letter-spacing:.13em;
  text-transform:uppercase; color:var(--ink3); }
```
Rules: mixed case for titles; UPPERCASE only for kickers/labels/chips
(9–11px, .08–.14em). Never uppercase a sentence of prose. Never Geist inside
a desk panel; never mono for paragraphs.

---

## 4 · COMPONENT SNIPPETS

### 4.1 Panel shell
```css
.panel{ background:var(--panel); border:1px solid var(--hairline);
  border-radius:var(--r-panel); box-shadow:var(--shadow);
  display:flex; flex-direction:column; overflow:hidden; }
.panel-head{ display:flex; justify-content:space-between; align-items:center;
  padding:13px 16px; border-bottom:1px solid var(--hairline); }
```

### 4.2 Candidate row (Reported Results) — solid bars = reported
```tsx
<div className="cand">
  <span className="rail" style={{ background: c.color }} />
  <span className="ava">{initials}</span>
  <span className="nm">
    {c.name}{c.called && <span className="chk">✓</span>}
    {pollDelta != null && (
      <span className={`polldelta ${pollDelta >= 0 ? "pos" : "neg"}`}>
        {pollDelta >= 0 ? "+" : "−"}{Math.abs(pollDelta).toFixed(1)} VS POLL
      </span>
    )}
    <small>{c.party} · {c.note}</small>
  </span>
  <span className="votes num">{c.votes.toLocaleString()}</span>
  <span className="pct num" style={{ color: c.leader ? c.color : "var(--ink)" }}>
    {c.pct.toFixed(1)}%
  </span>
</div>
```
```css
.cand{ display:grid; grid-template-columns:3px 40px 1fr auto auto;
  gap:0 13px; align-items:center; padding:12px 0;
  border-bottom:1px solid var(--hairline); }
.cand .rail{ width:3px; height:38px; border-radius:2px; }
.cand .ava{ width:40px; height:40px; border-radius:50%; background:var(--panel2);
  display:flex; align-items:center; justify-content:center;
  font-family:var(--mono); font-weight:800; font-size:14px; color:var(--ink2); }
.cand .nm{ font-weight:700; font-size:16px; }
.cand .nm small{ display:block; font-family:var(--mono); font-weight:400;
  font-size:9.5px; letter-spacing:.07em; color:var(--ink3); margin-top:2px; }
.cand .chk{ display:inline-flex; width:16px; height:16px; border-radius:50%;
  background:var(--called); color:#fff; font-size:10px; font-weight:800;
  align-items:center; justify-content:center; margin-left:8px; }
.cand .votes{ font-family:var(--mono); font-size:12.5px; color:var(--ink2); text-align:right; }
.cand .pct{ font-family:var(--mono); font-weight:800; font-size:25px;
  min-width:92px; text-align:right; }
.polldelta{ font-family:var(--mono); font-size:9px; border-radius:4px;
  padding:1px 6px; margin-left:7px; }
.polldelta.pos{ color:var(--called); background:rgba(21,128,61,.08); }
.polldelta.neg{ color:var(--gop);    background:var(--gop-tint); }
```

### 4.3 Gauge family — ONLY two instruments get gauges
```tsx
/* Win Probability Wheel — half gauge */
<svg viewBox="0 0 158 88" className="wheel">
  <path d="M13,84 A66,66 0 0 1 145,84" fill="none"
        stroke="var(--panel3)" strokeWidth="15" strokeLinecap="round" />
  <path d={arcPath(pct)} fill="none"
        stroke={leaderColor} strokeWidth="15" strokeLinecap="round" />
</svg>
<div className="wheel-ctr">
  <div className="num" style={{fontSize:24,color:leaderColor}}>{label}</div>
  <div className="kicker">{leaderName}</div>
</div>
```
```tsx
/* Race Clock — full ring; one component, four states */
const R = 52, C = 2 * Math.PI * R;             // circumference
<svg viewBox="0 0 120 120" style={{transform:"rotate(-90deg)"}}>
  <circle cx="60" cy="60" r={R} fill="none" stroke="var(--panel3)" strokeWidth="10" />
  <circle cx="60" cy="60" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
          stroke={state==="CALLED" ? "var(--called)" : "var(--live)"}
          strokeDasharray={`${C*progress} ${C}`} />
</svg>
```
States: `SCHEDULED` ring depletes (countdown, `--ink2`) · `LIVE` ring fills
with EST. REPORTING (`--live`) · `CALLED` complete `--called` + ✓ + call time ·
`OFFICIAL` same + OFFICIAL chip.

### 4.4 Projection card + counted/remaining track — dashed = projected
```css
.pcard{ border:1px solid var(--hairline); border-radius:var(--r-card); padding:11px 13px; }
.pcard.lead{ border-color:color-mix(in srgb,var(--dem) 40%,transparent);
  background:color-mix(in srgb,var(--dem) 4%,transparent); }
.minitrack{ display:flex; height:9px; align-items:center; margin-top:8px; }
.minisolid{ height:9px; border-radius:99px 0 0 99px; }          /* counted */
.minidash{ height:9px; border:1.5px dashed; border-left:none;
  border-radius:0 99px 99px 0; opacity:.55; }                    /* projected */
```
```tsx
<div className="minitrack">
  <span className="minisolid" style={{width:`${countedPct}%`, background:c.color}} />
  <span className="minidash"  style={{width:`${remainPct}%`, borderColor:c.color}} />
</div>
```

### 4.5 Margin box-and-whisker (lives in the OPTIONS drawer)
```tsx
<svg viewBox="0 0 420 46">
  <line x1="210" y1="6" x2="210" y2="40" stroke="var(--hairline2)" />        {/* EVEN */}
  <line x1={w95a} y1="23" x2={w95b} y2="23" stroke={color} strokeWidth="1.5" />
  <line x1={w95a} y1="16" x2={w95a} y2="30" stroke={color} strokeWidth="1.5" />
  <line x1={w95b} y1="16" x2={w95b} y2="30" stroke={color} strokeWidth="1.5" />
  <rect x={b50a} y="15" width={b50b-b50a} height="16" rx="2"
        fill={color} fillOpacity=".30" stroke={color} />
  <line x1={best} y1="13" x2={best} y2="33" stroke="var(--ink)" strokeWidth="2" />
</svg>
```
box = 50% of outcomes · whiskers = 95% · center tick = best guess.

### 4.6 County table (two variants, never mixed)
```tsx
{countyModel && <th>PROJ. MARGIN</th>}   // all rows, or column absent entirely
```
```css
.tbl th{ position:sticky; top:0; background:var(--panel2);
  font-family:var(--mono); font-size:9.5px; letter-spacing:.12em;
  text-transform:uppercase; color:var(--ink3); text-align:right; padding:11px 14px; }
.tbl th:first-child,.tbl td:first-child{ text-align:left; }
.tbl td{ padding:9px 14px; border-bottom:1px solid var(--hairline);
  text-align:right; font-size:12.5px; }
.mgn{ display:inline-flex; align-items:center; gap:7px;
  font-family:var(--mono); font-weight:700; font-size:12px; }
.mgn .rail{ width:3px; height:15px; border-radius:2px; }
```
No zebra stripes. Sticky header. Search + sort chips in the panel head.

### 4.7 Status chips / state machine
```css
.badge{ font-family:var(--mono); font-size:10.5px; letter-spacing:.1em;
  padding:5px 12px; border-radius:var(--r-pill);
  border:1px solid var(--hairline2); color:var(--ink2); background:var(--panel); }
.badge.closed  { color:var(--gop);    border-color:color-mix(in srgb,var(--gop) 35%,transparent); }
.badge.official{ color:var(--called); border-color:color-mix(in srgb,var(--called) 35%,transparent); }
.badge.live    { color:var(--live);   border-color:color-mix(in srgb,var(--live) 35%,transparent); }
.badge.live i{ display:inline-block; width:6px; height:6px; border-radius:50%;
  background:var(--live); margin-right:7px; animation:pulse 1.7s infinite; }
@keyframes pulse{ 50%{ opacity:.3; } }
```
States: `SCHEDULED → LIVE·GATED → LIVE·FORECAST → PROJECTED → OFFICIAL`.

### 4.8 Ballot Landscape mode row
```tsx
{["EARLY","VBM","ELECTION DAY"].map(mode => ( /* exact labels */ ))}
```
Row = mode label · est. remaining (mono, `--gold` if large) · % counted bar
(`--live`) · projected split bar (muted fills) · lean chip. Section closes
with a `Why it matters:` sentence in Geist. Render only when mode data exists.

---

## 5 · DATA-SEMANTICS LAW (enforce visually)
1. **Reported = solid. Projected = muted/dashed + `PROJECTED` label.** Always.
2. Forecast bars share the SAME 0–100 scale as reported bars.
3. `EST. REPORTING` (% of expected vote) leads; precinct % only as secondary
   labeled `PRECINCTS`.
4. Probabilities normalize; residual shows as `OTHER OUTCOMES <1%`. No
   separate "comeback probability".
5. <10% reporting → forecast gated, with a `SHOW FORECAST ANYWAY` override.
6. No telemetry → no timeline section at all, and the snapshot footer reads
   `NO HISTORY SNAPSHOTS — LIVE DATA ONLY`.
7. Desk footer carries the semantics statement + `POWERED BY CIVICAPI`.

## 6 · COPY RULES
No em dashes (use `·`, commas, periods). `election night` never hyphenated.
Full org name only in kickers/©; product voice says TPSI. Numbers: tabular
mono, thousands separators, `~` for estimates, `>99%` / `<1%` at extremes.

## 7 · ANTI-PATTERNS (reject on sight)
Party color as background/decoration · red-vs-blue in a same-party primary ·
legacy `#7c3aed`/`#9d5cf0`/`#e63946`/`#2563eb` · mixed PROJ. MARGIN column
with "—" cells · Geist inside desk panels · mono paragraphs · uppercase
sentences · centered desk text · solid bars for projections · unlabeled
projections · empty shells for absent capabilities · gradient inside panels ·
invented data or fake history.