import { SCORECARD_2026 } from "./ratings2026";
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
// ── TIER STRUCTURE ──────────────────────────────────────────────────────────
//   Gold Standard → 6.00×   Nov 13 2026, from 2026 accuracy: On Point Polling, The Honest Poll, Big Data Poll,
//                            NYT/Siena, Quinnipiac, AtlasIntel, Emerson. See ratings2026.ts.
//   A++           → 4.00×   Elite accuracy (mean error ~2.0)
//   A+            → 3.00×   Top tier, strong multi-cycle track record
//   A             → 2.25×   Above average
//   A-            → 1.70×   Solid accuracy premium
//   B+            → 1.30×   Slightly above baseline
//   B             → 1.00×   Baseline — average pollster
//   B-            → 0.75×   Slight discount
//   C+            → 0.50×   Meaningful penalty
//   C             → 0.25×   Notable discount
//   C-            → 0.15×   Significant discount
//   D+/D          → 0.06×   Near-discard
//   D-            → 0.03×   Severe discount
//   F/F-          → 0.01×   Essentially discarded
//   Super F       → 0.005×  Discarded entirely
//   Unknown       → 0.60×   Unrated: slight penalty vs B baseline
// =============================================================================
// Nov 13 2026: grades come from 2026 accuracy, set in ratings2026.ts. The old table is retired.
export const POLLSTER_SCORECARD: Record<string, { grade: string; weight: number }> = SCORECARD_2026;

// Oct 22 2026, set by the publisher: ActiVote is left out of every average, and Wedgewood Polls stays out as well.
// Oct 30 2026, set by the publisher: Rasmussen Reports comes back in, entered as a Republican internal, so it carries
// the measured Republican internal correction below.
export const EXCLUDED_POLLSTERS = /activote|wedgewood|socal\s*strateg|socalpoll/i;
export function isExcludedPollster(name: string): boolean { return EXCLUDED_POLLSTERS.test(name || ""); }

// Oct 22 2026: Trafalgar and InsiderAdvantage are labelled Republican leaning. Their lean is
// measured against the other polls of the same races in aggregates.ts and taken off their margin.
// Oct 22 2026: partisan lean firms in the site averages, each lean measured from the data in aggregates.ts.
// dir is the side the firm leans to; its polls are moved the other way by the measured lean before averaging,
// while every table shows the poll as published.
export type LeanDir = "R" | "D";
export const LEAN_FIRMS: { id: string; label: string; re: RegExp; dir: LeanDir }[] = [
  { id: "trafalgar", label: "Trafalgar", re: /trafalgar/i, dir: "R" },
  { id: "insideradvantage", label: "InsiderAdvantage", re: /insider\s*advantage/i, dir: "R" },
  // Nov 13 2026: Quantus ran 4 points right of the nonpartisan polls of the same races in the final month of 2026
  { id: "quantus", label: "Quantus Insights", re: /quantus/i, dir: "R" },
  { id: "impactresearch", label: "Impact Research", re: /impact\s*research/i, dir: "D" },
  // Oct 23 2026, set by the publisher: Democratic leaning firms get the same measured treatment. Each is moved only
  // if its own polls run to the left of the other polls of the same races, by as much as they do.
  { id: "ppp", label: "Public Policy Polling", re: /public\s*policy\s*polling|\bppp\b/i, dir: "D" },
  { id: "changeresearch", label: "Change Research", re: /change\s*research/i, dir: "D" },
  { id: "gsg", label: "Global Strategy Group", re: /global\s*strategy\s*group|\bgsg\b/i, dir: "D" },
  { id: "gbao", label: "GBAO", re: /\bgbao\b/i, dir: "D" },
  { id: "dataforprogress", label: "Data for Progress", re: /data\s*for\s*progress/i, dir: "D" },
  { id: "hart", label: "Hart Research", re: /hart\s*research/i, dir: "D" },
  { id: "gqr", label: "GQR", re: /\bgqr\b|greenberg\s*quinlan/i, dir: "D" },
  { id: "lake", label: "Lake Research Partners", re: /lake\s*research/i, dir: "D" },
  { id: "tulchin", label: "Tulchin Research", re: /tulchin/i, dir: "D" },
  { id: "tavern", label: "Tavern Research", re: /tavern\s*research/i, dir: "D" },
  { id: "civiqs", label: "Civiqs", re: /civiqs/i, dir: "D" },
  { id: "navigator", label: "Navigator Research", re: /navigator\s*research/i, dir: "D" },
  { id: "tpor", label: "Texas Public Opinion Research", re: /texas\s*public\s*opinion\s*research/i, dir: "D" },
  { id: "ztoa", label: "Z to A Research", re: /z\s*to\s*a\s*research/i, dir: "D" },
  { id: "mdw", label: "MDW Communications", re: /mdw\s*communications/i, dir: "D" },
  { id: "clarity", label: "Clarity Campaign Labs", re: /clarity\s*campaign/i, dir: "D" },
  // Oct 30 2026, set by the publisher: campaign and party internals, tagged (R) or (D), get the same measured
  // correction. All Republican internals are measured together against the nonpartisan polls of the same races, and
  // all Democratic internals the same way, and each poll is moved back by its side's measured lean.
  { id: "rinternal", label: "Republican internals", re: /\(R\)/, dir: "R" },
  { id: "dinternal", label: "Democratic internals", re: /\(D\)/, dir: "D" },
];
export const R_LEAN_FIRMS = LEAN_FIRMS;
// a bipartisan release, like Fabrizio Ward with Impact Research, is not a partisan internal
// a bipartisan release, a Democratic firm paired with a Republican one, is not moved either way
// Oct 31 2026, set by the publisher: Cygnal is a Republican firm, tagged (R) and corrected as a Republican internal, no longer bipartisan
const BIPARTISAN = /fabrizio|bipartisan|north\s*star|nsor|shaw|\bpos\b|public\s*opinion\s*strategies/i;
const bipartisan = (n: string) => BIPARTISAN.test(n) || (/\(D\)/.test(n) && /\(R\)/.test(n));
const INTERNAL_IDS = new Set(["rinternal", "dinternal"]);
export function leanFirms(name: string): string[] { const n = name || ""; return LEAN_FIRMS.filter((f) => f.re.test(n) && !(f.dir === "D" && bipartisan(n)) && !(INTERNAL_IDS.has(f.id) && bipartisan(n))).map((f) => f.id); }
export const rLeanFirms = leanFirms;
export const leanDirOf = (id: string): LeanDir => LEAN_FIRMS.find((f) => f.id === id)?.dir ?? "R";

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
// Recency decay: exponent 1.3, denom 21, a half life of about 16 days.
// Oct 22 2026: briefly tightened to denom 8 (about six days), then restored to
// denom 21 at the user's request the same day.
// =============================================================================
export const RECENCY_DENOM = 21;
export const RECENCY_EXP = 1.3;
export const RECENCY_HALF_LIFE_DAYS = Math.round(RECENCY_DENOM * Math.pow(Math.LN2, 1 / RECENCY_EXP) * 10) / 10;
export function recencyWeight(daysAgo: number): number {
  return Math.exp(-Math.pow(daysAgo / RECENCY_DENOM, RECENCY_EXP));
}

// =============================================================================
// Sample size weight — sigmoid curve heavily favouring n ≥ 1500
//
// Replaces the old √n formula. Key design goals:
//   • Small polls (n < 400) are near-discarded (weight < 0.15)
//   • n = 800  → ~0.50  (moderate weight)
//   • n = 1500 → ~0.90  (strong weight — the target threshold)
//   • n = 2000 → ~0.97  (near-maximum)
//   • n = 3000+→ ~1.00  (saturates; no runaway reward for mega-samples)
//
// Formula: sigmoid(n) = 1 / (1 + exp(-k * (n - midpoint)))
//   midpoint = 1100  — inflection point of the S-curve
//   k        = 0.003 — controls steepness around the midpoint
//
// The result is then scaled to [MIN_SAMPLE_WEIGHT, 1.0] so even the smallest
// poll retains a tiny non-zero weight (avoids hard divide-by-zero edge cases).
// =============================================================================
const SAMPLE_SIGMOID_MIDPOINT = 1100;
const SAMPLE_SIGMOID_K        = 0.003;
const MIN_SAMPLE_WEIGHT       = 0.05; // floor — never fully zero

export function sampleSizeWeight(n: number): number {
  const raw = 1 / (1 + Math.exp(-SAMPLE_SIGMOID_K * (n - SAMPLE_SIGMOID_MIDPOINT)));
  // Rescale from (0,1) sigmoid range to [MIN_SAMPLE_WEIGHT, 1.0]
  return MIN_SAMPLE_WEIGHT + (1 - MIN_SAMPLE_WEIGHT) * raw;
}

// =============================================================================
// Sample type weight
// LV=3× (likely voters, most predictive), RV=1× (baseline), A=0.1× (near-discard)
// Adults polls are essentially useless for election forecasting.
// =============================================================================
export function sampleTypeWeight(type: SampleType, opts?: ModelOptions): number {
  const t = opts?.sampleTypeWeights;
  if (t) return t[type];
  if (type === "LV") return 3;
  if (type === "RV") return 1;
  return 0.1; // Adults — near-discard
}

// =============================================================================
// MODEL PROFILES
//
// The weights above were built for horse races, where a likely-voter screen is
// the whole point and anyone still undecided is genuinely missing information.
// A job-approval or direction-of-country tracker is not a horse race:
//
//   • Adults are the standard population for approval. Gallup, Pew, AP-NORC and
//     Reuters/Ipsos all poll adults, and at 0.1x they were carrying 0.2% of the
//     Trump approval average between them. The tracker ladder keeps a mild
//     likely-voter preference instead of a 30-to-1 one.
//   • "Undecided" on approval is a respondent saying no opinion, not a voter who
//     has not made up their mind. At K = 3.0 a poll reporting 4% no opinion lost
//     60% of its weight, which punished the pollsters who report it honestly.
//
// Both profiles cap how much of one day's average a single poll may carry. That
// is what stops one survey from becoming the average: before the cap, a single
// Quantus poll from Aug 28 carried 64% of the Trump approval number.
// =============================================================================
export type ModelOptions = {
  sampleTypeWeights?: Record<SampleType, number>;
  undecidedPenaltyK?: number;
  maxPollShare?: number;          // 0 to 1; 0 or undefined disables the cap
};

export const ELECTION_PROFILE: ModelOptions = {
  maxPollShare: 0.15,
};

export const TRACKER_PROFILE: ModelOptions = {
  sampleTypeWeights: { LV: 1.15, RV: 1.0, A: 0.9 },
  undecidedPenaltyK: 0.6,
  maxPollShare: 0.15,
};

// A cap only means something when enough polls are in play to absorb the excess.
// With a 15% cap that is seven polls; below that the cap would simply flatten
// every poll to the same weight and throw away recency, so it is skipped.
function capPollShares(weights: number[], maxShare?: number): number[] {
  if (!maxShare || maxShare <= 0 || maxShare >= 1) return weights;
  if (weights.length < Math.ceil(1 / maxShare)) return weights;
  const w = [...weights];
  for (let pass = 0; pass < 24; pass++) {
    const total = w.reduce((a, b) => a + b, 0);
    if (total <= 0) return w;
    const cap = total * maxShare;
    let changed = false;
    for (let i = 0; i < w.length; i++) {
      if (w[i] > cap * (1 + 1e-9)) { w[i] = cap; changed = true; }
    }
    if (!changed) break;
  }
  return w;
}

// =============================================================================
// Pollster repetition discount
//
// Polls iterated newest→oldest. Most-recent poll from each firm = 1.00×.
// Older repeats discounted only if within 21 days of the newest.
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
// Final weight = sampleSizeWeight(n)          [sigmoid, inflection @ 1100, sat ~1.0]
//              × recencyWeight(dAgo)           [denom=21, exp=1.3, ~16-day half-life]
//              × sampleTypeWeight              [LV=3×, RV=1×, A=0.1×]
//              × pollsterRepetitionFactor      [same-firm repeat discount, 21-day window]
//              × getPollsterWeight             [538-grade multiplier; Gold=6×, B=1×]
//              × undecidedPenalty              [penalises high uncommitted share]
//
// KEY CHANGE vs previous version:
//   Old: √n (unbounded; a 10,000-sample poll earned only 2× a 2,500-sample poll)
//   New: sampleSizeWeight (sigmoid S-curve saturating near 1.0 above ~2,000;
//        polls under 400 are near-discarded; polls ≥ 1,500 earn near-maximum
//        sample credit, strongly favouring high-quality large-n surveys).
// =============================================================================
const UNDECIDED_PENALTY_K = 3.0;

export function undecidedPenalty(results: Record<string, number>, opts?: ModelOptions): number {
  const named = Object.entries(results).filter(([k]) => k !== "Undecided" && k !== "Other");
  // A poll that published only one side of a tracker has no measurable
  // uncommitted share; the gap is missing publication, not missing opinion, and
  // penalising it would be measuring our own sourcing rather than the poll.
  if (named.length < 2) return 1.0;

  const candidateSum = named.reduce((sum, [, v]) => sum + v, 0);
  const explicit = (results["Undecided"] ?? 0) + (results["Other"] ?? 0);
  const uncommittedShare = Math.max(explicit, 100 - candidateSum) / 100;

  const k = opts?.undecidedPenaltyK ?? UNDECIDED_PENALTY_K;
  return clamp(1 - k * Math.sqrt(Math.max(0, uncommittedShare)), 0.10, 1.00);
}

export function pollWeight(
  p: Poll,
  asOfDateISO: string,
  pollsterOccurrenceIndex = 1,
  daysSinceNewestFromSameFirm = 0,
  opts?: ModelOptions
): number {
  const dAgo = clamp(daysBetween(p.endDate, asOfDateISO), 0, 3650);
  const effectiveN = Math.max(0, p.sampleSize);
  return (
    sampleSizeWeight(effectiveN) *              // ← sigmoid S-curve (replaces √n)
    recencyWeight(dAgo) *
    sampleTypeWeight(p.sampleType, opts) *
    pollsterRepetitionFactor(pollsterOccurrenceIndex, daysSinceNewestFromSameFirm) *
    getPollsterWeight(p.pollster) *
    undecidedPenalty(p.results, opts)
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
// The average: a robust local trend fit (LOWESS) on the weighted polls.
//
// Oct 22 2026: the LOWESS trend used to be a second chart beside the average.
// It is now the average itself. For each day and each candidate, every poll
// available that day keeps its full weight above (sample, recency, screen,
// pollster grade, repeat and undecided discounts, with the 15 percent cap),
// and those weights are the local kernel of a LOWESS fit:
//   1. a weighted local linear fit in time, read at the day itself, so a
//      steady move in the newest polls shows up rather than lagging behind;
//   2. the slope is shrunk toward flat when few polls carry the weight, and the
//      lift it can add is capped, so one poll cannot tilt the line;
//   3. three robustness passes with bisquare weights on the residuals (the
//      Cleveland 1979 recipe), which replace the old z score clipping: an odd
//      poll is weighed down in proportion to how far it sits from the fit.
// =============================================================================
const LOESS_PASSES = 3;
const SLOPE_SHRINK_N = 6;       // slope x neff / (neff + 6)
const MAX_SLOPE = 0.35;         // points per day
const MAX_LIFT = 1.5;           // points the slope may add at the day itself
const MIN_SPREAD_DAYS = 2;      // below this weighted spread in time, no slope

// weighted median, so the robustness scale is set by the polls that carry the day, not by old ones
function wmedian(a: number[], w: number[]): number {
  const idx = a.map((_, i) => i).filter((i) => w[i] > 0).sort((i, j) => a[i] - a[j]);
  const tot = idx.reduce((t, i) => t + w[i], 0); if (!idx.length || tot <= 0) return 0;
  let acc = 0; for (const i of idx) { acc += w[i]; if (acc >= tot / 2) return a[i]; }
  return a[idx[idx.length - 1]];
}

/** One day's robust local fit. x is days before the day (0 or negative), w the poll weights. */
export function localFit(v: number[], x: number[], w: number[]): { value: number; weights: number[] } {
  const n = v.length;
  if (!n) return { value: 0, weights: [] };
  const r = new Array(n).fill(1);
  let value = 0, ww: number[] = w.slice();
  const passes = n >= 4 ? LOESS_PASSES + 1 : 1;
  for (let pass = 0; pass < passes; pass++) {
    ww = w.map((wi, i) => wi * r[i]);
    const S = ww.reduce((a, b) => a + b, 0);
    if (S <= 0) { ww = w.slice(); break; }
    const xm = ww.reduce((a, wi, i) => a + wi * x[i], 0) / S;
    const ym = ww.reduce((a, wi, i) => a + wi * v[i], 0) / S;
    let Sxx = 0, Sxy = 0, S2 = 0;
    for (let i = 0; i < n; i++) { Sxx += ww[i] * (x[i] - xm) ** 2; Sxy += ww[i] * (x[i] - xm) * (v[i] - ym); S2 += ww[i] * ww[i]; }
    const neff = S2 > 0 ? (S * S) / S2 : 0;
    let b = 0;
    if (neff >= 3 && Sxx / S >= MIN_SPREAD_DAYS * MIN_SPREAD_DAYS) {
      b = (Sxy / Sxx) * (neff / (neff + SLOPE_SHRINK_N));
      b = clamp(b, -MAX_SLOPE, MAX_SLOPE);
    }
    const lift = clamp(b * (0 - xm), -MAX_LIFT, MAX_LIFT);
    value = ym + lift;
    if (pass === passes - 1) break;
    const res = v.map((vi, i) => vi - (ym + b * (x[i] - xm)));
    // a floor of one point on the scale: polls that differ by ordinary sampling noise are never cut
    const s = Math.max(1, wmedian(res.map(Math.abs), ww));
    for (let i = 0; i < n; i++) { const u = res[i] / (6 * s); r[i] = Math.abs(u) < 1 ? (1 - u * u) ** 2 : 0; }
  }
  const tot = ww.reduce((a, b) => a + b, 0) || 1;
  return { value, weights: ww.map((x) => x / tot) };
}

/** Weighted entries for one candidate on one day, newest first, with the share cap applied. */
function dayEntries(availableDesc: Poll[], c: string, dayISO: string, opts: ModelOptions) {
  const pollsterMeta = new Map<string, { occ: number; newestDate: string }>();
  const entries: { poll: Poll; value: number; weight: number; x: number }[] = [];
  for (const p of availableDesc) {
    const v = p.results[c];
    if (typeof v !== "number") continue;
    const key = normalizePollsterKey(p.pollster);
    const meta = pollsterMeta.get(key) ?? { occ: 0, newestDate: p.endDate };
    const occ = meta.occ + 1;
    pollsterMeta.set(key, { occ, newestDate: meta.occ === 0 ? p.endDate : meta.newestDate });
    const daysSinceNewest = occ === 1 ? 0 : daysBetween(p.endDate, meta.newestDate);
    entries.push({ poll: p, value: v, weight: pollWeight(p, dayISO, occ, daysSinceNewest, opts), x: -daysBetween(p.endDate, dayISO) });
  }
  const capped = capPollShares(entries.map((e) => e.weight), opts.maxPollShare);
  return entries.map((e, i) => ({ ...e, weight: capped[i] }));
}

// Polls more than 150 days old carry a negligible share of the weight at a 16 day half life, so they
// are left out of the day's fit; a race with fewer than three polls in that window keeps its three newest.
const WINDOW_DAYS = 150;
function windowed(availableDesc: Poll[], dayISO: string): Poll[] {
  const w = availableDesc.filter((p) => daysBetween(p.endDate, dayISO) <= WINDOW_DAYS);
  return w.length >= 3 ? w : availableDesc.slice(0, 3);
}

/** Each poll's share of the average on one day for one candidate, after the robust passes. */
export function pollSharesOn(polls: Poll[], c: string, dayISO: string, opts: ModelOptions = ELECTION_PROFILE): Map<Poll, number> {
  const availableDesc = windowed(polls.filter((p) => p.endDate <= dayISO && !isExcludedPollster(p.pollster)).sort((a, b) => b.endDate.localeCompare(a.endDate)), dayISO);
  const e = dayEntries(availableDesc, c, dayISO, opts);
  const fit = localFit(e.map((x) => x.value), e.map((x) => x.x), e.map((x) => x.weight));
  const out = new Map<Poll, number>();
  e.forEach((x, i) => out.set(x.poll, fit.weights[i] ?? 0));
  return out;
}

// =============================================================================
// buildDailyWeightedSeries
// =============================================================================
export function buildDailyWeightedSeries(
  polls: Poll[],
  candidates: string[],
  startISO: string,
  endISO: string,
  opts: ModelOptions = ELECTION_PROFILE
): DailyRow[] {
  const start = parseISODate(startISO);
  const end   = parseISODate(endISO);
  const sortedDesc = polls.filter((p) => !isExcludedPollster(p.pollster)).sort((a, b) => b.endDate.localeCompare(a.endDate));
  const out: DailyRow[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayISO = iso(d);
    const availableDesc = windowed(sortedDesc.filter((p) => p.endDate <= dayISO), dayISO);
    const row: DailyRow = { date: dayISO };
    for (const c of candidates) {
      const e = dayEntries(availableDesc, c, dayISO, opts);
      row[c] = e.length ? round1(localFit(e.map((x) => x.value), e.map((x) => x.x), e.map((x) => x.weight)).value) : 0;
    }
    out.push(row);
  }
  return out;
}
