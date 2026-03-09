export type SampleType = "LV" | "RV" | "A";

export type Poll = {
  pollster: string;
  endDate: string; // ISO YYYY-MM-DD
  sampleSize: number;
  sampleType: SampleType;
  results: Record<string, number>; // candidate -> %
};

export type DailyRow = {
  date: string; // YYYY-MM-DD
  [candidate: string]: string | number;
};

// =============================================================================
// POLLSTER QUALITY SCORECARD
// =============================================================================
// Source: FiveThirtyEight/538 pollster ratings (grade + mean error + track record).
// Every poll's final weight is multiplied by its pollster's quality factor.
//
// Grade → weight multiplier:
//   A++      → 2.00×   Elite accuracy (mean error ~2.0), e.g. Quantus, AtlasIntel
//   A+       → 1.75×   Top tier, strong multi-cycle track record
//   A        → 1.50×   Above average
//   A-       → 1.30×   Solid accuracy premium
//   B+       → 1.15×   Slightly above baseline
//   B        → 1.00×   Baseline — average pollster
//   B-       → 0.85×   Slight discount
//   C+       → 0.65×   Meaningful penalty (mean error ~4.0–4.5)
//   C        → 0.50×   Half weight — notably YouGov, Quinnipiac, Marist fall here
//   C-       → 0.35×   Significant discount (mean error ~5.0+)
//   D+/D     → 0.20×   Near-discard
//   D-       → 0.12×   Severe discount — PPP, SurveyMonkey
//   F/F-     → 0.05×   Essentially discarded
//   Super F  → 0.02×   Discarded entirely
//   Unknown  → 0.70×   Unrated: slight penalty vs B baseline
// =============================================================================
export const POLLSTER_SCORECARD: Record<string, { grade: string; weight: number }> = {
  // ── A++ ──────────────────────────────────────────────────────────────────
  "quantus insights":                           { grade: "A++",    weight: 2.00 },
  "atlasintel":                                 { grade: "A++",    weight: 2.00 },
  "bsp research/shaw & company":                { grade: "A++",    weight: 2.00 },
  "bsp research":                               { grade: "A++",    weight: 2.00 },
  "shaw & company":                             { grade: "A++",    weight: 2.00 },
  "patriot polling":                            { grade: "A++",    weight: 2.00 },
  // ── A+ ───────────────────────────────────────────────────────────────────
  "onmessage inc.":                             { grade: "A+",     weight: 1.75 },
  "onmessage":                                  { grade: "A+",     weight: 1.75 },
  "big data poll":                              { grade: "A+",     weight: 1.75 },
  "u. georgia spia":                            { grade: "A+",     weight: 1.75 },
  "georgia spia":                               { grade: "A+",     weight: 1.75 },
  "the washington post":                        { grade: "A+",     weight: 1.75 },
  "washington post":                            { grade: "A+",     weight: 1.75 },
  "insideradvantage":                           { grade: "A+",     weight: 1.75 },
  "insider advantage":                          { grade: "A+",     weight: 1.75 },
  "rasmussen":                                  { grade: "A+",     weight: 1.75 },
  "rasmussen reports":                          { grade: "A+",     weight: 1.75 },
  // ── A ────────────────────────────────────────────────────────────────────
  "research & polling":                         { grade: "A",      weight: 1.50 },
  "fabrizio, lee & associates":                 { grade: "A",      weight: 1.50 },
  "fabrizio lee":                               { grade: "A",      weight: 1.50 },
  "fabrizio lee & associates":                  { grade: "A",      weight: 1.50 },
  "landmark communications":                    { grade: "A",      weight: 1.50 },
  "tipp":                                       { grade: "A",      weight: 1.50 },
  "tarrance":                                   { grade: "A",      weight: 1.50 },
  "tarrance group":                             { grade: "A",      weight: 1.50 },
  "data orbital":                               { grade: "A",      weight: 1.50 },
  // ── A- ───────────────────────────────────────────────────────────────────
  "susquehanna":                                { grade: "A-",     weight: 1.30 },
  "fabrizio/gbao":                              { grade: "A-",     weight: 1.30 },
  "fabrizio/gbao [wsj]":                        { grade: "A-",     weight: 1.30 },
  "global strategy group":                      { grade: "A-",     weight: 1.30 },
  "harrisx":                                    { grade: "A-",     weight: 1.30 },
  "harris x":                                   { grade: "A-",     weight: 1.30 },
  "trafalgar group":                            { grade: "A-",     weight: 1.30 },
  "trafalgar":                                  { grade: "A-",     weight: 1.30 },
  "socal strategies":                           { grade: "A-",     weight: 1.30 },
  "oh predictive insights":                     { grade: "A-",     weight: 1.30 },
  "oh predictive insights / mbqf":              { grade: "A-",     weight: 1.30 },
  "east carolina university":                   { grade: "A-",     weight: 1.30 },
  // ── B+ ───────────────────────────────────────────────────────────────────
  "j.l. partners":                              { grade: "B+",     weight: 1.15 },
  "jl partners":                                { grade: "B+",     weight: 1.15 },
  "j. l. partners":                             { grade: "B+",     weight: 1.15 },
  "emerson":                                    { grade: "B+",     weight: 1.15 },
  "emerson college":                            { grade: "B+",     weight: 1.15 },
  "emerson college polling":                    { grade: "B+",     weight: 1.15 },
  "mitchell research & communications":         { grade: "B+",     weight: 1.15 },
  "mitchell research":                          { grade: "B+",     weight: 1.15 },
  "wpai":                                       { grade: "B+",     weight: 1.15 },
  "suffolk":                                    { grade: "B+",     weight: 1.15 },
  "suffolk university":                         { grade: "B+",     weight: 1.15 },
  // ── B ────────────────────────────────────────────────────────────────────
  "mclaughlin":                                 { grade: "B",      weight: 1.00 },
  "mclaughlin & associates":                    { grade: "B",      weight: 1.00 },
  "mclaughlin and associates":                  { grade: "B",      weight: 1.00 },
  "fabrizio ward":                              { grade: "B",      weight: 1.00 },
  "harris poll":                                { grade: "B",      weight: 1.00 },
  "fabrizio/impact":                            { grade: "B",      weight: 1.00 },
  "uc berkeley":                                { grade: "B",      weight: 1.00 },
  "echelon insights":                           { grade: "B",      weight: 1.00 },
  "massinc polling group":                      { grade: "B",      weight: 1.00 },
  "massinc":                                    { grade: "B",      weight: 1.00 },
  "kaconsulting llc":                           { grade: "B",      weight: 1.00 },
  "marquette law school":                       { grade: "B",      weight: 1.00 },
  "washington post/george mason university":    { grade: "B",      weight: 1.00 },
  "washington post/george mason":               { grade: "B",      weight: 1.00 },
  // ── B- ───────────────────────────────────────────────────────────────────
  "u. massachusetts - lowell":                  { grade: "B-",     weight: 0.85 },
  "umass lowell":                               { grade: "B-",     weight: 0.85 },
  "u. massachusetts lowell":                    { grade: "B-",     weight: 0.85 },
  "wick":                                       { grade: "B-",     weight: 0.85 },
  "activote":                                   { grade: "B-",     weight: 0.85 },
  // ── C+ ───────────────────────────────────────────────────────────────────
  "harper polling":                             { grade: "C+",     weight: 0.65 },
  "siena/nyt":                                  { grade: "C+",     weight: 0.65 },
  "siena college/nyt":                          { grade: "C+",     weight: 0.65 },
  "siena/new york times":                       { grade: "C+",     weight: 0.65 },
  "co/efficient":                               { grade: "C+",     weight: 0.65 },
  "roanoke college":                            { grade: "C+",     weight: 0.65 },
  "spry strategies":                            { grade: "C+",     weight: 0.65 },
  "targoz market research":                     { grade: "C+",     weight: 0.65 },
  "hart research associates":                   { grade: "C+",     weight: 0.65 },
  "hart research":                              { grade: "C+",     weight: 0.65 },
  "muhlenberg":                                 { grade: "C+",     weight: 0.65 },
  "muhlenberg college":                         { grade: "C+",     weight: 0.65 },
  "cygnal":                                     { grade: "C+",     weight: 0.65 },
  "rmg research":                               { grade: "C+",     weight: 0.65 },
  "redfield & wilton strategies":               { grade: "C+",     weight: 0.65 },
  "redfield and wilton strategies":             { grade: "C+",     weight: 0.65 },
  "redfield & wilton":                          { grade: "C+",     weight: 0.65 },
  "research co.":                               { grade: "C+",     weight: 0.65 },
  "research co":                                { grade: "C+",     weight: 0.65 },
  "opinion insight":                            { grade: "C+",     weight: 0.65 },
  "epic/mra":                                   { grade: "C+",     weight: 0.65 },
  "st. anselm":                                 { grade: "C+",     weight: 0.65 },
  "saint anselm":                               { grade: "C+",     weight: 0.65 },
  "surveyusa":                                  { grade: "C+",     weight: 0.65 },
  "survey usa":                                 { grade: "C+",     weight: 0.65 },
  "glengariff group inc.":                      { grade: "C+",     weight: 0.65 },
  "glengariff group":                           { grade: "C+",     weight: 0.65 },
  "noble predictive insights":                  { grade: "C+",     weight: 0.65 },
  "beacon/shaw":                                { grade: "C+",     weight: 0.65 },
  // ── C ────────────────────────────────────────────────────────────────────
  "benenson strategy group":                    { grade: "C",      weight: 0.50 },
  "benenson strategy group/gs strategy group":  { grade: "C",      weight: 0.50 },
  "highground":                                 { grade: "C",      weight: 0.50 },
  "cnn/ssrs":                                   { grade: "C",      weight: 0.50 },
  "cnn":                                        { grade: "C",      weight: 0.50 },
  "quinnipiac":                                 { grade: "C",      weight: 0.50 },
  "quinnipiac university":                      { grade: "C",      weight: 0.50 },
  "remington":                                  { grade: "C",      weight: 0.50 },
  "remington research":                         { grade: "C",      weight: 0.50 },
  "marist college":                             { grade: "C",      weight: 0.50 },
  "marist":                                     { grade: "C",      weight: 0.50 },
  "selzer":                                     { grade: "C",      weight: 0.50 },
  "selzer & company":                           { grade: "C",      weight: 0.50 },
  "yougov":                                     { grade: "C",      weight: 0.50 },
  "leger":                                      { grade: "C",      weight: 0.50 },
  "ipsos":                                      { grade: "C",      weight: 0.50 },
  "virginia commonwealth u.":                   { grade: "C",      weight: 0.50 },
  "virginia commonwealth university":           { grade: "C",      weight: 0.50 },
  "siena college":                              { grade: "C",      weight: 0.50 },
  "gravis marketing":                           { grade: "C",      weight: 0.50 },
  "gravis":                                     { grade: "C",      weight: 0.50 },
  // ── C- ───────────────────────────────────────────────────────────────────
  "civiqs":                                     { grade: "C-",     weight: 0.35 },
  "monmouth":                                   { grade: "C-",     weight: 0.35 },
  "monmouth university":                        { grade: "C-",     weight: 0.35 },
  "abc/washington post":                        { grade: "C-",     weight: 0.35 },
  "data for progress":                          { grade: "C-",     weight: 0.35 },
  "university of texas at tyler":               { grade: "C-",     weight: 0.35 },
  "ut tyler":                                   { grade: "C-",     weight: 0.35 },
  "florida atlantic university":                { grade: "C-",     weight: 0.35 },
  "florida atlantic university/mainstreet research": { grade: "C-", weight: 0.35 },
  "florida atlantic":                           { grade: "C-",     weight: 0.35 },
  "franklin and marshall college":              { grade: "C-",     weight: 0.35 },
  "franklin & marshall":                        { grade: "C-",     weight: 0.35 },
  "u. new hampshire":                           { grade: "C-",     weight: 0.35 },
  "university of new hampshire":                { grade: "C-",     weight: 0.35 },
  "kaiser family foundation":                   { grade: "C-",     weight: 0.35 },
  "morning consult":                            { grade: "C-",     weight: 0.35 },
  "qriously":                                   { grade: "C-",     weight: 0.35 },
  // ── D+ / D ───────────────────────────────────────────────────────────────
  "ces / yougov":                               { grade: "D+",     weight: 0.20 },
  "victory insights":                           { grade: "D+",     weight: 0.20 },
  "patinkin research strategies":               { grade: "D+",     weight: 0.20 },
  "patinkin research":                          { grade: "D+",     weight: 0.20 },
  "change research":                            { grade: "D",      weight: 0.20 },
  "swayable":                                   { grade: "D",      weight: 0.20 },
  // ── D- ───────────────────────────────────────────────────────────────────
  "mason-dixon":                                { grade: "D-",     weight: 0.12 },
  "mason dixon":                                { grade: "D-",     weight: 0.12 },
  "focaldata":                                  { grade: "D-",     weight: 0.12 },
  "surveymonkey":                               { grade: "D-",     weight: 0.12 },
  "survey monkey":                              { grade: "D-",     weight: 0.12 },
  "ppp":                                        { grade: "D-",     weight: 0.12 },
  "public policy polling":                      { grade: "D-",     weight: 0.12 },
  // ── F / F- ───────────────────────────────────────────────────────────────
  "navigator":                                  { grade: "F",      weight: 0.05 },
  "baldwin wallace university":                 { grade: "F",      weight: 0.05 },
  "bullfinch":                                  { grade: "F",      weight: 0.05 },
  "gbao":                                       { grade: "F",      weight: 0.05 },
  "the political matrix/the listener group":    { grade: "F",      weight: 0.05 },
  "the political matrix":                       { grade: "F",      weight: 0.05 },
  "big village":                                { grade: "F-",     weight: 0.05 },
  "usc dornsife":                               { grade: "F-",     weight: 0.05 },
  "strategies 360":                             { grade: "F-",     weight: 0.05 },
  "citizen data":                               { grade: "F-",     weight: 0.05 },
  // ── Super F ──────────────────────────────────────────────────────────────
  "outward intelligence":                       { grade: "Super F", weight: 0.02 },
  "research america":                           { grade: "Super F", weight: 0.02 },
  "ascend action":                              { grade: "Super F", weight: 0.02 },
  "alaska survey research":                     { grade: "Super F", weight: 0.02 },
  "prri":                                       { grade: "Super F", weight: 0.02 },
  "raba research":                              { grade: "Super F", weight: 0.02 },
  "amber integrated":                           { grade: "Super F", weight: 0.02 },
  "center street pac":                          { grade: "Super F", weight: 0.02 },
  "anzalone liszt grove":                       { grade: "Super F", weight: 0.02 },
  "clarity":                                    { grade: "Super F", weight: 0.02 },
  "soonerpoll.com":                             { grade: "Super F", weight: 0.02 },
  "soonerpoll":                                 { grade: "Super F", weight: 0.02 },
};

const UNKNOWN_POLLSTER_WEIGHT = 0.70;

function normalizePollsterKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-");
}

/**
 * Returns the 538-grade quality weight for a pollster.
 * Lookup order:
 *   1. Exact normalized key match
 *   2. Any scorecard key is a substring of the pollster name
 *   3. The pollster name is a substring of any scorecard key (min 5 chars)
 *   4. Unknown fallback (0.70)
 */
export function getPollsterWeight(rawPollster: string): number {
  const n = normalizePollsterKey(rawPollster);
  if (POLLSTER_SCORECARD[n]) return POLLSTER_SCORECARD[n].weight;
  for (const key of Object.keys(POLLSTER_SCORECARD)) {
    if (n.includes(key)) return POLLSTER_SCORECARD[key].weight;
  }
  for (const key of Object.keys(POLLSTER_SCORECARD)) {
    if (key.includes(n) && n.length > 4) return POLLSTER_SCORECARD[key].weight;
  }
  return UNKNOWN_POLLSTER_WEIGHT;
}

/** Returns { grade, weight } for display in UI poll tables. "NR" if unrated. */
export function getPollsterEntry(rawPollster: string): { grade: string; weight: number } {
  const n = normalizePollsterKey(rawPollster);
  if (POLLSTER_SCORECARD[n]) return POLLSTER_SCORECARD[n];
  for (const key of Object.keys(POLLSTER_SCORECARD)) {
    if (n.includes(key)) return POLLSTER_SCORECARD[key];
  }
  for (const key of Object.keys(POLLSTER_SCORECARD)) {
    if (key.includes(n) && n.length > 4) return POLLSTER_SCORECARD[key];
  }
  return { grade: "NR", weight: UNKNOWN_POLLSTER_WEIGHT };
}

// =============================================================================
// Core helpers
// =============================================================================

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function daysBetween(aISO: string, bISO: string): number {
  const a = parseISODate(aISO).getTime();
  const b = parseISODate(bISO).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// =============================================================================
// CHANGE 1: Recency decay — half-life ~14 days (denom=21, was 45)
// =============================================================================
export function recencyWeight(daysAgo: number): number {
  return Math.exp(-daysAgo / 21);
}

export function sampleTypeWeight(type: SampleType): number {
  if (type === "LV") return 3;
  if (type === "RV") return 1;
  return 0.5; // Adults
}

// =============================================================================
// CHANGE 3: Pollster repetition discount
//
// Polls iterated newest→oldest. Most-recent poll from each firm = 1.00×;
// older repeats from the same firm are progressively discounted:
//   1st (newest)  → 1.00×
//   2nd           → 0.75×
//   3rd           → 0.50×
//   4th+          → 0.33×
// =============================================================================
function pollsterRepetitionFactor(occurrenceIndex: number): number {
  if (occurrenceIndex <= 1) return 1.00;
  if (occurrenceIndex === 2) return 0.75;
  if (occurrenceIndex === 3) return 0.50;
  return 0.33;
}

// =============================================================================
// Combined poll weight
//
// Final weight = √(min(n, 1500))          [CHANGE 2: capped sample size]
//              × recencyWeight(dAgo)       [CHANGE 1: denom=21, ~14-day half-life]
//              × sampleTypeWeight          [LV=3×, RV=1×, A=0.5×]
//              × pollsterRepetitionFactor  [CHANGE 3: same-firm repeat discount]
//              × getPollsterWeight         [CHANGE 7: 538-grade quality multiplier]
// =============================================================================
export function pollWeight(
  p: Poll,
  asOfDateISO: string,
  pollsterOccurrenceIndex = 1
): number {
  const dAgo = clamp(daysBetween(p.endDate, asOfDateISO), 0, 3650);
  const effectiveN = Math.min(Math.max(0, p.sampleSize), 1500); // CHANGE 2
  const w =
    Math.sqrt(effectiveN) *
    recencyWeight(dAgo) *
    sampleTypeWeight(p.sampleType) *
    pollsterRepetitionFactor(pollsterOccurrenceIndex) * // CHANGE 3
    getPollsterWeight(p.pollster);                       // CHANGE 7
  return w;
}

export function getCandidateList(polls: Poll[]): string[] {
  const s = new Set<string>();
  for (const p of polls) {
    for (const k of Object.keys(p.results)) {
      if (k === "Undecided" || k === "Other") continue;
      s.add(k);
    }
  }
  return Array.from(s);
}

export function getDateRange(polls: Poll[]) {
  const dates = polls.map((p) => p.endDate).sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

// =============================================================================
// CHANGE 4: 14-day linear trend slope computation
//
// Computes pts/day slope for each candidate over the trailing daysBack window
// of the already-built daily series. Used to project momentum forward so the
// model isn't purely backward-looking.
// =============================================================================
function computeTrendSlopes(
  daily: DailyRow[],
  candidates: string[],
  daysBack = 14
): Record<string, number> {
  const slopes: Record<string, number> = {};
  if (daily.length < 3) {
    for (const c of candidates) slopes[c] = 0;
    return slopes;
  }

  const window = daily.slice(-Math.min(daysBack, daily.length));
  const n = window.length;

  for (const c of candidates) {
    const xs = window.map((_, i) => i);
    const ys = window.map((r) => Number(r[c] ?? 0));
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
    const den = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
    slopes[c] = den > 0 ? num / den : 0; // pts/day
  }

  return slopes;
}

// =============================================================================
// buildDailyWeightedSeries
//
// Builds daily weighted averages from startISO to endISO (inclusive).
// Uses all polls with endDate ≤ asOfDate on each day.
//
// Active improvements:
//
//  1. RECENCY DECAY (denom 45 → 21): ~14-day half-life makes late polls dominant.
//
//  2. SAMPLE SIZE CAP (max n=1500): √(1500) = 38.7 is the weight ceiling.
//     Prevents giant polls from swamping the average regardless of n.
//
//  3. POLLSTER REPETITION DISCOUNT: newest poll from each firm = 1.0×,
//     2nd = 0.75×, 3rd = 0.5×, 4th+ = 0.33×. Prevents house-effect compounding.
//
//  4. MOMENTUM TREND TERM: 14-day linear regression slope projected 5 days
//     forward at 40% strength, capped ±5 pts. Catches late-moving candidates.
//
//  7. POLLSTER QUALITY SCORECARD: every poll weight × 538-grade factor.
//     A++=2.0×, B=1.0× (baseline), C=0.5× (YouGov), D-=0.12× (PPP),
//     Super F=0.02×, unrated=0.70×.
// =============================================================================
export function buildDailyWeightedSeries(
  polls: Poll[],
  candidates: string[],
  startISO: string,
  endISO: string
): DailyRow[] {
  const start = parseISODate(startISO);
  const end   = parseISODate(endISO);

  const sorted = [...polls].sort((a, b) => a.endDate.localeCompare(b.endDate));
  const out: DailyRow[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayISO = iso(d);

    // All polls available as of this day
    const available = sorted.filter((p) => p.endDate <= dayISO);

    // Sort newest→oldest so the most-recent poll from each pollster gets
    // occurrence index 1 (full repetition weight); older repeats are discounted.
    const availableDesc = [...available].sort((a, b) => b.endDate.localeCompare(a.endDate));

    const row: DailyRow = { date: dayISO };
    const rawAvg: Record<string, number> = {};

    // ── Raw weighted average per candidate ──────────────────────────────────
    for (const c of candidates) {
      let num = 0;
      let den = 0;
      const pollsterIdx = new Map<string, number>();

      for (const p of availableDesc) {
        const v = p.results[c];
        if (typeof v !== "number") continue;

        const key = normalizePollsterKey(p.pollster);
        const occ = (pollsterIdx.get(key) ?? 0) + 1;
        pollsterIdx.set(key, occ);

        const w = pollWeight(p, dayISO, occ);
        num += v * w;
        den += w;
      }

      rawAvg[c] = den > 0 ? round1(num / den) : 0;
    }

    // ── CHANGE 4: Trend slope + momentum projection ────────────────────────
    // Compute 14-day regression slope from already-built series.
    // Project forward 5 days at 40% strength, capped ±5 pts.
    const trendSlopes = computeTrendSlopes(out, candidates, 14);

    const TREND_PROJECTION_DAYS   = 5;
    const TREND_PROJECTION_WEIGHT = 0.40;
    const TREND_MAX_ADJUSTMENT    = 5;

    for (const c of candidates) {
      const contrib = clamp(
        trendSlopes[c] * TREND_PROJECTION_DAYS * TREND_PROJECTION_WEIGHT,
        -TREND_MAX_ADJUSTMENT,
        TREND_MAX_ADJUSTMENT
      );
      row[c] = round1(rawAvg[c] + contrib);
    }

    out.push(row);
  }

  return out;
}