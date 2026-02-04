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
  if (type === "LV") return 1.15;
  if (type === "RV") return 1.0;
  return 0.85; // Adults
}

export function pollWeight(p: Poll, asOfDateISO: string) {
  const dAgo = clamp(daysBetween(p.endDate, asOfDateISO), 0, 3650);
  return Math.sqrt(Math.max(0, p.sampleSize)) * recencyWeight(dAgo) * sampleTypeWeight(p.sampleType);
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
        const v = p.results[c];
        if (typeof v !== "number") continue;
        const w = pollWeight(p, dayISO);
        num += v * w;
        den += w;
      }

      row[c] = den ? Math.round((num / den) * 10) / 10 : 0;
    }

    out.push(row);
  }

  return out;
}
