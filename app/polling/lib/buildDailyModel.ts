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
  // dynamic: candidate key -> value
  [candidate: string]: string | number;
};

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(isoDate: string) {
  // force local midnight to avoid TZ drift
  return new Date(`${isoDate}T00:00:00`);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function daysBetween(aISO: string, bISO: string) {
  const a = parseISODate(aISO).getTime();
  const b = parseISODate(bISO).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function recencyWeight(daysAgo: number) {
  // exponential decay; half-life ~31 days if denom=45
  return Math.exp(-daysAgo / 45);
}

export function sampleTypeWeight(type: SampleType) {
  if (type === "LV") return 1.5;
  if (type === "RV") return 1;
  return 0.5; // Adults
}

/**
 * Undecided handling + penalty
 *
 * 1) If a poll omits Undecided and/or Other, we infer it from 100 - sum(known results).
 * 2) We penalize polls with high (Undecided + Other) share by shrinking their weight.
 *
 * Tuning notes:
 * - "undecidedPenaltyStart" = the point where penalty begins
 * - "undecidedPenaltyMax" = the maximum shrink applied to poll weight
 */
const undecidedPenaltyStart = 1; // % (no penalty up to this)
const undecidedPenaltyMax = 0.95; // max shrink: at very high undecided, w *= (1 - 0.55) = 0.45
const undecidedPenaltyCap = 75; // % (cap to avoid extreme outliers)

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function normalize100(p: Poll, candidates: string[]) {
  // Compute undecided + other, even if missing, using residual.
  // Then proportionally rescale candidate results to (100 - uo).
  let sumCandidates = 0;
  for (const c of candidates) {
    const v = p.results[c];
    if (typeof v === "number") sumCandidates += v;
  }

  const reportedUnd = typeof p.results["Undecided"] === "number" ? p.results["Undecided"] : 0;
  const reportedOther = typeof p.results["Other"] === "number" ? p.results["Other"] : 0;

  // Residual (in case they didn't report Undecided/Other, or rounding leaves remainder)
  const residual = Math.max(0, 100 - (sumCandidates + reportedUnd + reportedOther));

  // Treat residual as undecided by default (conservative) unless you want it split.
  const undecided = round1(reportedUnd + residual);
  const other = round1(reportedOther);

  const uo = clamp(undecided + other, 0, 100);

  // Scale candidates so they sum to 100 - uo (so "decided share" is consistent)
  const targetSum = 100 - uo;
  const scale = sumCandidates > 0 ? targetSum / sumCandidates : 0;

  const scaled: Record<string, number> = {};
  for (const c of candidates) {
    const v = p.results[c];
    if (typeof v !== "number") continue;
    scaled[c] = round1(v * scale);
  }

  return { scaledResults: scaled, undecided, other, undecidedPlusOther: uo };
}

function undecidedPenaltyFactor(undecidedPlusOtherPct: number) {
  // No penalty until start; then linear ramp to max by cap.
  const uo = clamp(undecidedPlusOtherPct, 0, undecidedPenaltyCap);
  if (uo <= undecidedPenaltyStart) return 1;

  const t = (uo - undecidedPenaltyStart) / Math.max(1, undecidedPenaltyCap - undecidedPenaltyStart);
  const shrink = clamp(t * undecidedPenaltyMax, 0, undecidedPenaltyMax);
  return 1 - shrink; // multiply weight by this
}

export function pollWeight(p: Poll, asOfDateISO: string, candidatesForUndecidedCalc?: string[]) {
  const dAgo = clamp(daysBetween(p.endDate, asOfDateISO), 0, 3650);

  // Base weight
  let w =
    Math.sqrt(Math.max(0, p.sampleSize)) *
    recencyWeight(dAgo) *
    sampleTypeWeight(p.sampleType);

  // Apply undecided/other penalty if we can compute it
  if (candidatesForUndecidedCalc && candidatesForUndecidedCalc.length) {
    const { undecidedPlusOther } = normalize100(p, candidatesForUndecidedCalc);
    w *= undecidedPenaltyFactor(undecidedPlusOther);
  } else {
    // Fallback: use reported Undecided/Other only (no residual inference)
    const und = typeof p.results["Undecided"] === "number" ? p.results["Undecided"] : 0;
    const oth = typeof p.results["Other"] === "number" ? p.results["Other"] : 0;
    const uo = clamp(und + oth, 0, 100);
    w *= undecidedPenaltyFactor(uo);
  }

  return w;
}

export function getCandidateList(polls: Poll[]) {
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

/**
 * Builds DAILY weighted averages from start..end (inclusive).
 * Uses all polls with endDate <= asOfDate.
 *
 * Changes:
 * - Infers missing Undecided as residual (100 - sum(results)).
 * - Rescales candidate shares to "decided share" (100 - (Undecided+Other)),
 *   so polls with big undecided don't artificially look like "low support".
 * - Penalizes polls with high Undecided+Other by shrinking their weight.
 */
export function buildDailyWeightedSeries(
  polls: Poll[],
  candidates: string[],
  startISO: string,
  endISO: string
): DailyRow[] {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);

  const sorted = [...polls].sort((a, b) => a.endDate.localeCompare(b.endDate));

  const out: DailyRow[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayISO = iso(d);

    // polls available as of that day (inclusive)
    const available = sorted.filter((p) => p.endDate <= dayISO);

    const row: DailyRow = { date: dayISO };

    for (const c of candidates) {
      let num = 0;
      let den = 0;

      for (const p of available) {
        // Normalize poll results to decided share and infer undecided if missing
        const { scaledResults } = normalize100(p, candidates);
        const v = scaledResults[c];
        if (typeof v !== "number") continue;

        const w = pollWeight(p, dayISO, candidates);
        num += v * w;
        den += w;
      }

      row[c] = den ? round1(num / den) : 0;
    }

    out.push(row);
  }

  return out;
}
