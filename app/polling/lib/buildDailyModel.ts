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
//   A++      → 4.00×   Elite accuracy (mean error ~2.0), e.g. Quantus, AtlasIntel
//   A+       → 3.00×   Top tier, strong multi-cycle track record
//   A        → 2.25×   Above average
//   A-       → 1.70×   Solid accuracy premium
//   B+       → 1.30×   Slightly above baseline
//   B        → 1.00×   Baseline — average pollster
//   B-       → 0.75×   Slight discount
//   C+       → 0.50×   Meaningful penalty
//   C        → 0.25×   Notable discount — YouGov, Quinnipiac, Marist
//   C-       → 0.15×   Significant discount
//   D+/D     → 0.06×   Near-discard
//   D-       → 0.03×   Severe discount — PPP, SurveyMonkey
//   F/F-     → 0.01×   Essentially discarded
//   Super F  → 0.005×  Discarded entirely
//   Unknown  → 0.60×   Unrated: slight penalty vs B baseline
// =============================================================================
export const POLLSTER_SCORECARD: Record<string, { grade: string; weight: number }> = {
  // ── A++ (4.00) ───────────────────────────────────────────────────────────
  "quantus insights":                           { grade: "A++",    weight: 4.00 },
  "atlasintel":                                 { grade: "A++",    weight: 4.00 },
  "bsp research/shaw & company":                { grade: "A++",    weight: 4.00 },
  "bsp research":                               { grade: "A++",    weight: 4.00 },
  "shaw & company":                             { grade: "A++",    weight: 4.00 },
  "patriot polling":                            { grade: "A++",    weight: 4.00 },
  // ── A+ (3.00) ────────────────────────────────────────────────────────────
  "onmessage inc.":                             { grade: "A+",     weight: 3.00 },
  "onmessage":                                  { grade: "A+",     weight: 3.00 },
  "big data poll":                              { grade: "A+",     weight: 3.00 },
  "u. georgia spia":                            { grade: "A+",     weight: 3.00 },
  "georgia spia":                               { grade: "A+",     weight: 3.00 },
  "the washington post":                        { grade: "A+",     weight: 3.00 },
  "washington post":                            { grade: "A+",     weight: 3.00 },
  "insideradvantage":                           { grade: "A+",     weight: 3.00 },
  "insider advantage":                          { grade: "A+",     weight: 3.00 },
  // ── A (2.25) ─────────────────────────────────────────────────────────────
  "research & polling":                         { grade: "A",      weight: 2.25 },
  "fabrizio, lee & associates":                 { grade: "A",      weight: 2.25 },
  "fabrizio lee":                               { grade: "A",      weight: 2.25 },
  "fabrizio lee & associates":                  { grade: "A",      weight: 2.25 },
  "landmark communications":                    { grade: "A",      weight: 2.25 },
  "tipp":                                       { grade: "A",      weight: 2.25 },
  "tarrance":                                   { grade: "A",      weight: 2.25 },
  "tarrance group":                             { grade: "A",      weight: 2.25 },
  "data orbital":                               { grade: "A",      weight: 2.25 },
  // ── A- (1.70) ────────────────────────────────────────────────────────────
  "susquehanna":                                { grade: "A-",     weight: 1.70 },
  "fabrizio/gbao":                              { grade: "A-",     weight: 1.70 },
  "fabrizio/gbao [wsj]":                        { grade: "A-",     weight: 1.70 },
  "global strategy group":                      { grade: "A-",     weight: 1.70 },
  "harrisx":                                    { grade: "A-",     weight: 1.70 },
  "harris x":                                   { grade: "A-",     weight: 1.70 },
  "trafalgar group":                            { grade: "A-",     weight: 1.70 },
  "trafalgar":                                  { grade: "A-",     weight: 1.70 },
  "socal strategies":                           { grade: "A-",     weight: 1.70 },
  "oh predictive insights":                     { grade: "A-",     weight: 1.70 },
  "oh predictive insights / mbqf":              { grade: "A-",     weight: 1.70 },
  "east carolina university":                   { grade: "A-",     weight: 1.70 },
  // ── B+ (1.30) ────────────────────────────────────────────────────────────
  "j.l. partners":                              { grade: "B+",     weight: 1.30 },
  "jl partners":                                { grade: "B+",     weight: 1.30 },
  "j. l. partners":                             { grade: "B+",     weight: 1.30 },
  "emerson":                                    { grade: "B+",     weight: 1.30 },
  "emerson college":                            { grade: "B+",     weight: 1.30 },
  "emerson college polling":                    { grade: "B+",     weight: 1.30 },
  "mitchell research & communications":         { grade: "B+",     weight: 1.30 },
  "mitchell research":                          { grade: "B+",     weight: 1.30 },
  "wpai":                                       { grade: "B+",     weight: 1.30 },
  "suffolk":                                    { grade: "B+",     weight: 1.30 },
  "suffolk university":                         { grade: "B+",     weight: 1.30 },
  // ── B (1.00 — baseline) ──────────────────────────────────────────────────
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
  // Rasmussen: rated A+ by 538 but carries a known Republican house effect;
  // weight is held at B baseline (1.00) as a house-effect penalty.
  "rasmussen":                                  { grade: "A+(adj)", weight: 1.00 },
  "rasmussen reports":                          { grade: "A+(adj)", weight: 1.00 },
  // ── B- (0.75) ────────────────────────────────────────────────────────────
  "u. massachusetts - lowell":                  { grade: "B-",     weight: 0.75 },
  "umass lowell":                               { grade: "B-",     weight: 0.75 },
  "u. massachusetts lowell":                    { grade: "B-",     weight: 0.75 },
  "wick":                                       { grade: "B-",     weight: 0.75 },
  "activote":                                   { grade: "B-",     weight: 0.75 },
  // ── C+ (0.50) ────────────────────────────────────────────────────────────
  "harper polling":                             { grade: "C+",     weight: 0.50 },
  "siena/nyt":                                  { grade: "C+",     weight: 0.50 },
  "siena college/nyt":                          { grade: "C+",     weight: 0.50 },
  "siena/new york times":                       { grade: "C+",     weight: 0.50 },
  "co/efficient":                               { grade: "C+",     weight: 0.50 },
  "roanoke college":                            { grade: "C+",     weight: 0.50 },
  "spry strategies":                            { grade: "C+",     weight: 0.50 },
  "targoz market research":                     { grade: "C+",     weight: 0.50 },
  "hart research associates":                   { grade: "C+",     weight: 0.50 },
  "hart research":                              { grade: "C+",     weight: 0.50 },
  "muhlenberg":                                 { grade: "C+",     weight: 0.50 },
  "muhlenberg college":                         { grade: "C+",     weight: 0.50 },
  "cygnal":                                     { grade: "C+",     weight: 0.50 },
  "rmg research":                               { grade: "C+",     weight: 0.50 },
  "redfield & wilton strategies":               { grade: "C+",     weight: 0.50 },
  "redfield and wilton strategies":             { grade: "C+",     weight: 0.50 },
  "redfield & wilton":                          { grade: "C+",     weight: 0.50 },
  "research co.":                               { grade: "C+",     weight: 0.50 },
  "research co":                                { grade: "C+",     weight: 0.50 },
  "opinion insight":                            { grade: "C+",     weight: 0.50 },
  "epic/mra":                                   { grade: "C+",     weight: 0.50 },
  "st. anselm":                                 { grade: "C+",     weight: 0.50 },
  "saint anselm":                               { grade: "C+",     weight: 0.50 },
  "surveyusa":                                  { grade: "C+",     weight: 0.50 },
  "survey usa":                                 { grade: "C+",     weight: 0.50 },
  "glengariff group inc.":                      { grade: "C+",     weight: 0.50 },
  "glengariff group":                           { grade: "C+",     weight: 0.50 },
  "noble predictive insights":                  { grade: "C+",     weight: 0.50 },
  "beacon/shaw":                                { grade: "C+",     weight: 0.50 },
  // ── C (0.25) ─────────────────────────────────────────────────────────────
  "benenson strategy group":                    { grade: "C",      weight: 0.25 },
  "benenson strategy group/gs strategy group":  { grade: "C",      weight: 0.25 },
  "highground":                                 { grade: "C",      weight: 0.25 },
  "cnn/ssrs":                                   { grade: "C",      weight: 0.25 },
  "cnn":                                        { grade: "C",      weight: 0.25 },
  "quinnipiac":                                 { grade: "C",      weight: 0.25 },
  "quinnipiac university":                      { grade: "C",      weight: 0.25 },
  "remington":                                  { grade: "C",      weight: 0.25 },
  "remington research":                         { grade: "C",      weight: 0.25 },
  "marist college":                             { grade: "C",      weight: 0.25 },
  "marist":                                     { grade: "C",      weight: 0.25 },
  "selzer":                                     { grade: "C",      weight: 0.25 },
  "selzer & company":                           { grade: "C",      weight: 0.25 },
  "yougov":                                     { grade: "C",      weight: 0.25 },
  "leger":                                      { grade: "C",      weight: 0.25 },
  "ipsos":                                      { grade: "C",      weight: 0.25 },
  "virginia commonwealth u.":                   { grade: "C",      weight: 0.25 },
  "virginia commonwealth university":           { grade: "C",      weight: 0.25 },
  "siena college":                              { grade: "C",      weight: 0.25 },
  "gravis marketing":                           { grade: "C",      weight: 0.25 },
  "gravis":                                     { grade: "C",      weight: 0.25 },
  // ── C- (0.15) ────────────────────────────────────────────────────────────
  "civiqs":                                     { grade: "C-",     weight: 0.15 },
  "monmouth":                                   { grade: "C-",     weight: 0.15 },
  "monmouth university":                        { grade: "C-",     weight: 0.15 },
  "abc/washington post":                        { grade: "C-",     weight: 0.15 },
  "data for progress":                          { grade: "C-",     weight: 0.15 },
  "university of texas at tyler":               { grade: "C-",     weight: 0.15 },
  "ut tyler":                                   { grade: "C-",     weight: 0.15 },
  "florida atlantic university":                { grade: "C-",     weight: 0.15 },
  "florida atlantic university/mainstreet research": { grade: "C-", weight: 0.15 },
  "florida atlantic":                           { grade: "C-",     weight: 0.15 },
  "franklin and marshall college":              { grade: "C-",     weight: 0.15 },
  "franklin & marshall":                        { grade: "C-",     weight: 0.15 },
  "u. new hampshire":                           { grade: "C-",     weight: 0.15 },
  "university of new hampshire":                { grade: "C-",     weight: 0.15 },
  "kaiser family foundation":                   { grade: "C-",     weight: 0.15 },
  "morning consult":                            { grade: "C-",     weight: 0.15 },
  "qriously":                                   { grade: "C-",     weight: 0.15 },
  // ── D+ / D (0.06) ────────────────────────────────────────────────────────
  "ces / yougov":                               { grade: "D+",     weight: 0.06 },
  "victory insights":                           { grade: "D+",     weight: 0.06 },
  "patinkin research strategies":               { grade: "D+",     weight: 0.06 },
  "patinkin research":                          { grade: "D+",     weight: 0.06 },
  "change research":                            { grade: "D",      weight: 0.06 },
  "swayable":                                   { grade: "D",      weight: 0.06 },
  // ── D- (0.03) ────────────────────────────────────────────────────────────
  "mason-dixon":                                { grade: "D-",     weight: 0.03 },
  "mason dixon":                                { grade: "D-",     weight: 0.03 },
  "focaldata":                                  { grade: "D-",     weight: 0.03 },
  "surveymonkey":                               { grade: "D-",     weight: 0.03 },
  "survey monkey":                              { grade: "D-",     weight: 0.03 },
  "ppp":                                        { grade: "D-",     weight: 0.03 },
  "public policy polling":                      { grade: "D-",     weight: 0.03 },
  // ── F / F- (0.01) ────────────────────────────────────────────────────────
  "navigator":                                  { grade: "F",      weight: 0.01 },
  "baldwin wallace university":                 { grade: "F",      weight: 0.01 },
  "bullfinch":                                  { grade: "F",      weight: 0.01 },
  "gbao":                                       { grade: "F",      weight: 0.01 },
  "the political matrix/the listener group":    { grade: "F",      weight: 0.01 },
  "the political matrix":                       { grade: "F",      weight: 0.01 },
  "big village":                                { grade: "F-",     weight: 0.01 },
  "usc dornsife":                               { grade: "F-",     weight: 0.01 },
  "strategies 360":                             { grade: "F-",     weight: 0.01 },
  "citizen data":                               { grade: "F-",     weight: 0.01 },
  // ── Super F (0.005) ───────────────────────────────────────────────────────
  "outward intelligence":                       { grade: "Super F", weight: 0.005 },
  "research america":                           { grade: "Super F", weight: 0.005 },
  "ascend action":                              { grade: "Super F", weight: 0.005 },
  "alaska survey research":                     { grade: "Super F", weight: 0.005 },
  "prri":                                       { grade: "Super F", weight: 0.005 },
  "raba research":                              { grade: "Super F", weight: 0.005 },
  "amber integrated":                           { grade: "Super F", weight: 0.005 },
  "center street pac":                          { grade: "Super F", weight: 0.005 },
  "anzalone liszt grove":                       { grade: "Super F", weight: 0.005 },
  "clarity":                                    { grade: "Super F", weight: 0.005 },
  "soonerpoll.com":                             { grade: "Super F", weight: 0.005 },
  "soonerpoll":                                 { grade: "Super F", weight: 0.005 },
};

// Unrated pollsters: slight penalty below B baseline.
const UNKNOWN_POLLSTER_WEIGHT = 0.60;

function normalizePollsterKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-");
}

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
// Recency decay — exponent 1.3 (softer than 1.8), denom 21 (~14-day half-life)
// =============================================================================
export function recencyWeight(daysAgo: number): number {
  return Math.exp(-Math.pow(daysAgo / 21, 1.3));
}

// =============================================================================
// Sample type weight
// LV=3× (likely voters, most predictive), RV=1× (baseline), A=0.1× (near-discard)
// Adults polls are essentially useless for election forecasting.
// =============================================================================
export function sampleTypeWeight(type: SampleType): number {
  if (type === "LV") return 3;
  if (type === "RV") return 1;
  return 0.1; // Adults — near-discard
}

// =============================================================================
// Pollster repetition discount
//
// Polls iterated newest→oldest. Most-recent poll from each firm = 1.00×.
// Older repeats discounted only if within 21 days of the newest — beyond that,
// recency decay already handles the penalty and double-discounting is unfair.
//   1st (newest)          → 1.00×
//   2nd (within 21 days)  → 0.75×
//   3rd (within 21 days)  → 0.50×
//   4th+ (within 21 days) → 0.33×
// =============================================================================
function pollsterRepetitionFactor(
  occurrenceIndex: number,
  daysSinceNewest: number
): number {
  if (occurrenceIndex <= 1 || daysSinceNewest > 21) return 1.00;
  if (occurrenceIndex === 2) return 0.75;
  if (occurrenceIndex === 3) return 0.50;
  return 0.33;
}

// =============================================================================
// Combined poll weight
//
// Final weight = √n                        [no cap — larger samples rewarded]
//              × recencyWeight(dAgo)       [denom=21, exp=1.3, ~14-day half-life]
//              × sampleTypeWeight          [LV=3×, RV=1×, A=0.1×]
//              × pollsterRepetitionFactor  [same-firm repeat discount, 21-day window]
//              × getPollsterWeight         [538-grade quality multiplier]
// =============================================================================
const UNDECIDED_PENALTY_K = 3.0;

export function undecidedPenalty(results: Record<string, number>): number {
  // Sum only real candidates (skip Undecided/Other if explicitly present)
  const candidateSum = Object.entries(results)
    .filter(([k]) => k !== "Undecided" && k !== "Other")
    .reduce((sum, [, v]) => sum + v, 0);

  // Explicit undecided/other bucket (if present)
  const explicit = (results["Undecided"] ?? 0) + (results["Other"] ?? 0);

  // Use whichever is larger: explicit label or implicit gap from 100
  const uncommittedShare = Math.max(explicit, 100 - candidateSum) / 100;

  return clamp(1 - UNDECIDED_PENALTY_K * Math.sqrt(Math.max(0, uncommittedShare)), 0.10, 1.00);
}

export function pollWeight(
  p: Poll,
  asOfDateISO: string,
  pollsterOccurrenceIndex = 1,
  daysSinceNewestFromSameFirm = 0
): number {
  const dAgo = clamp(daysBetween(p.endDate, asOfDateISO), 0, 3650);
  const effectiveN = Math.max(0, p.sampleSize);
  return (
    Math.sqrt(effectiveN) *
    recencyWeight(dAgo) *
    sampleTypeWeight(p.sampleType) *
    pollsterRepetitionFactor(pollsterOccurrenceIndex, daysSinceNewestFromSameFirm) *
    getPollsterWeight(p.pollster) *
    undecidedPenalty(p.results)           // ← new
  );
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
// Outlier correction — Z-score clipping per candidate
//
// Any poll result deviating more than OUTLIER_Z_THRESHOLD sample standard
// deviations from the unweighted mean is clipped toward the mean boundary.
// Preserves directional signal without letting a single rogue poll dominate.
//
//   - Threshold: 2.0σ
//   - Min polls: 3 (below this σ is unreliable; clipping skipped)
//   - Uses sample stddev (÷ n−1) for an unbiased estimate
// =============================================================================
const OUTLIER_Z_THRESHOLD = 2.0;
const OUTLIER_MIN_POLLS   = 3;

function clipOutliers(values: number[]): number[] {
  if (values.length < OUTLIER_MIN_POLLS) return values;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  const stddev = Math.sqrt(variance);

  if (stddev === 0) return values;

  return values.map((v) => {
    const z = (v - mean) / stddev;
    if (Math.abs(z) <= OUTLIER_Z_THRESHOLD) return v;
    return mean + Math.sign(z) * OUTLIER_Z_THRESHOLD * stddev;
  });
}

// =============================================================================
// buildDailyWeightedSeries
//
// Builds a daily weighted average for each candidate from startISO to endISO.
// Only polls with endDate ≤ asOfDate are included on each day (no lookahead).
//
// Weighting factors applied per poll:
//   1. RECENCY DECAY       — exponential, ~14-day half-life, exponent 1.3
//   2. SAMPLE SIZE         — √n, no cap (larger samples continue to earn weight)
//   3. SAMPLE TYPE         — LV=3×, RV=1×, Adults=0.1×
//   4. REPETITION DISCOUNT — same-firm older polls discounted within 21-day window
//   5. POLLSTER QUALITY    — 538-grade multiplier (A++=4×, B=1×, Super F=0.005×)
//   6. OUTLIER CLIPPING    — per-candidate 2σ clip before weighted average
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

    const available = sorted.filter((p) => p.endDate <= dayISO);

    // Newest→oldest so occurrence index 1 = most recent poll from each firm.
    const availableDesc = [...available].sort((a, b) => b.endDate.localeCompare(a.endDate));

    const row: DailyRow = { date: dayISO };

    for (const c of candidates) {
      // Track per-pollster: [occurrenceIndex, endDate of newest poll from firm]
      const pollsterMeta = new Map<string, { occ: number; newestDate: string }>();
      const entries: { value: number; weight: number }[] = [];

      for (const p of availableDesc) {
        const v = p.results[c];
        if (typeof v !== "number") continue;

        const key = normalizePollsterKey(p.pollster);
        const meta = pollsterMeta.get(key) ?? { occ: 0, newestDate: p.endDate };
        const occ = meta.occ + 1;
        pollsterMeta.set(key, { occ, newestDate: meta.occ === 0 ? p.endDate : meta.newestDate });

        const daysSinceNewest = occ === 1 ? 0 : daysBetween(p.endDate, meta.newestDate);

        entries.push({
          value: v,
          weight: pollWeight(p, dayISO, occ, daysSinceNewest),
        });
      }

      const clipped = clipOutliers(entries.map((e) => e.value));

      let num = 0;
      let den = 0;
      for (let i = 0; i < entries.length; i++) {
        num += clipped[i] * entries[i].weight;
        den += entries[i].weight;
      }

      row[c] = den > 0 ? round1(num / den) : 0;
    }

    out.push(row);
  }

  return out;
}