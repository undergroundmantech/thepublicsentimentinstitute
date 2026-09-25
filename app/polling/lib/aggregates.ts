import {
  Poll,
  getDateRange,
  getCandidateList,
  buildDailyWeightedSeries,
  getPollsterEntry,
} from "./buildDailyModel";

import { RAW_POLLS as GENERIC, GOLD_STANDARD_NAMES as GENERIC_GOLD } from "../genericballot/data";
import { RAW_POLLS as TRUMP, GOLD_STANDARD_NAMES as TRUMP_GOLD } from "../donaldtrumpapproval/data";
import { RAW_POLLS as VANCE, GOLD_STANDARD_NAMES as VANCE_GOLD } from "../jdvanceapproval/page";
import { RAW_POLLS as TRACK, GOLD_STANDARD_NAMES as TRACK_GOLD } from "../rightorwrongtrack/page";
import { RAW_POLLS as P2028, GOLD_STANDARD_NAMES as P2028_GOLD } from "../2028polling/page";

// 2025 governor races
import { VA_GOV_POLLS, NJ_GOV_POLLS } from "../2025pollingview/page";

// 2024 president (national + states)
import { RAW_POLLS as PR_NAT } from "../2024president/page";
import { RAW_POLLS as PR_PA } from "../pa2024president/page";
import { RAW_POLLS as PR_GA } from "../ga2024president/page";
import { RAW_POLLS as PR_AZ } from "../az2024president/page";
import { RAW_POLLS as PR_MI } from "../mi2024president/page";
import { RAW_POLLS as PR_NV } from "../nv2024president/page";
import { RAW_POLLS as PR_WI } from "../wi2024president/page";
import { RAW_POLLS as PR_NC } from "../nc2024president/page";
import { RAW_POLLS as PR_MN } from "../mn2024president/page";
import { RAW_POLLS as PR_NM } from "../nm2024president/page";
import { RAW_POLLS as PR_NJ } from "../nj2024president/page";
import { RAW_POLLS as PR_NH } from "../newhampshire/page";
import { RAW_POLLS as PR_TX } from "../tx2024president/page";
import { RAW_POLLS as PR_VA } from "../va2024president/page";

// multi-candidate primaries
import { RAW_POLLS as FL_GOP } from "../floridarepublicanprimary/page";
import { RAW_POLLS as TX_GOP } from "../texasrepublicanprimary/page";
import { RAW_POLLS as TX_DEM } from "../texasdemocratprimary/page";
import { RAW_POLLS as ME_DEM } from "../mainedemocratprimary/page";
import { KY04_POLLS } from "./ky04Polls";

// 2026 Senate matchups (state modules with RACES + STATE_POLLS keyed by raceId)
// Every 2026 Senate and governor race the forecast carries polls for. These
// files are generated from the forecast's own poll feed, so the averages on
// this page and the margins on the forecast desk read the same polls.
import * as SEN_ALABAMA from "../senatepolling/alabama";
import * as SEN_ALASKA from "../senatepolling/alaska";
import * as SEN_ARKANSAS from "../senatepolling/arkansas";
import * as SEN_COLORADO from "../senatepolling/colorado";
import * as SEN_DELAWARE from "../senatepolling/delaware";
import * as SEN_FLORIDA from "../senatepolling/florida";
import * as SEN_GEORGIA from "../senatepolling/georgia";
import * as SEN_IDAHO from "../senatepolling/idaho";
import * as SEN_ILLINOIS from "../senatepolling/illinois";
import * as SEN_IOWA from "../senatepolling/iowa";
import * as SEN_KANSAS from "../senatepolling/kansas";
import * as SEN_KENTUCKY from "../senatepolling/kentucky";
import * as SEN_LOUISIANA from "../senatepolling/louisiana";
import * as SEN_MAINE from "../senatepolling/maine";
import * as SEN_MASSACHUSETTS from "../senatepolling/massachusetts";
import * as SEN_MICHIGAN from "../senatepolling/michigan";
import * as SEN_MINNESOTA from "../senatepolling/minnesota";
import * as SEN_MISSISSIPPI from "../senatepolling/mississippi";
import * as SEN_MONTANA from "../senatepolling/montana";
import * as SEN_NEBRASKA from "../senatepolling/nebraska";
import * as SEN_NEWHAMPSHIRE from "../senatepolling/newhampshire";
import * as SEN_NEWJERSEY from "../senatepolling/newjersey";
import * as SEN_NEWMEXICO from "../senatepolling/newmexico";
import * as SEN_NORTHCAROLINA from "../senatepolling/northcarolina";
import * as SEN_OHIO from "../senatepolling/ohio";
import * as SEN_OKLAHOMA from "../senatepolling/oklahoma";
import * as SEN_OREGON from "../senatepolling/oregon";
import * as SEN_RHODEISLAND from "../senatepolling/rhodeisland";
import * as SEN_SOUTHCAROLINA from "../senatepolling/southcarolina";
import * as SEN_SOUTHDAKOTA from "../senatepolling/southdakota";
import * as SEN_TENNESSEE from "../senatepolling/tennessee";
import * as SEN_TEXAS from "../senatepolling/texas";
import * as SEN_VIRGINIA from "../senatepolling/virginia";
import * as SEN_WESTVIRGINIA from "../senatepolling/westvirginia";
import * as SEN_WYOMING from "../senatepolling/wyoming";
import * as GOV_ALABAMA from "../governorpolling/alabama";
import * as GOV_ALASKA from "../governorpolling/alaska";
import * as GOV_ARIZONA from "../governorpolling/arizona";
import * as GOV_ARKANSAS from "../governorpolling/arkansas";
import * as GOV_CALIFORNIA from "../governorpolling/california";
import * as GOV_COLORADO from "../governorpolling/colorado";
import * as GOV_CONNECTICUT from "../governorpolling/connecticut";
import * as GOV_FLORIDA from "../governorpolling/florida";
import * as GOV_GEORGIA from "../governorpolling/georgia";
import * as GOV_HAWAII from "../governorpolling/hawaii";
import * as GOV_IDAHO from "../governorpolling/idaho";
import * as GOV_ILLINOIS from "../governorpolling/illinois";
import * as GOV_IOWA from "../governorpolling/iowa";
import * as GOV_KANSAS from "../governorpolling/kansas";
import * as GOV_MAINE from "../governorpolling/maine";
import * as GOV_MARYLAND from "../governorpolling/maryland";
import * as GOV_MASSACHUSETTS from "../governorpolling/massachusetts";
import * as GOV_MICHIGAN from "../governorpolling/michigan";
import * as GOV_MINNESOTA from "../governorpolling/minnesota";
import * as GOV_NEBRASKA from "../governorpolling/nebraska";
import * as GOV_NEVADA from "../governorpolling/nevada";
import * as GOV_NEWHAMPSHIRE from "../governorpolling/newhampshire";
import * as GOV_NEWMEXICO from "../governorpolling/newmexico";
import * as GOV_NEWYORK from "../governorpolling/newyork";
import * as GOV_OHIO from "../governorpolling/ohio";
import * as GOV_OKLAHOMA from "../governorpolling/oklahoma";
import * as GOV_OREGON from "../governorpolling/oregon";
import * as GOV_PENNSYLVANIA from "../governorpolling/pennsylvania";
import * as GOV_RHODEISLAND from "../governorpolling/rhodeisland";
import * as GOV_SOUTHCAROLINA from "../governorpolling/southcarolina";
import * as GOV_SOUTHDAKOTA from "../governorpolling/southdakota";
import * as GOV_TENNESSEE from "../governorpolling/tennessee";
import * as GOV_TEXAS from "../governorpolling/texas";
import * as GOV_VERMONT from "../governorpolling/vermont";
import * as GOV_WISCONSIN from "../governorpolling/wisconsin";
import * as GOV_WYOMING from "../governorpolling/wyoming";

// authoritative featured matchups (generic Republican/Democrat keys) from the polling index
import { TX_CORNYN_POLLS, TX_PAXTON_POLLS } from "../page";

/* =============================================================================
   Aggregate registry — every PSI two-series polling average in one place,
   normalised to a shared shape so the unified Polling Averages page can switch
   between them with one chart + table.
============================================================================= */

export type Series = { label: string; color: string };

export type AggregateDef = {
  id: string;
  label: string;       // switcher label
  category: string;    // grouping tag
  title: string;       // headline
  subtitle: string;
  unit: "%" | "pt";    // axis unit
  keyA: string;
  keyB: string;
  seriesA: Series;
  seriesB: Series;
  marginLabel: string;
  fmtMargin: (net: number) => string;
  polls: Poll[];
  gold: string[];
  goldMult: number;
  /** Two-letter postal code, set only on the 2026 Senate and governor races so the
   *  Polling Averages page can place each one on a map. */
  stateAbbr?: string;
};

export type AggDaily = { date: string; t: number; a: number; b: number; net: number };
export type AggPollPoint = {
  pollster: string;
  date: string;
  t: number;
  a: number;
  b: number;
  margin: number;
  sampleSize: number;
  sampleType: string;
  grade: string;
};

const BLUE = "var(--dem)";
const RED = "var(--gop)";
const GREEN = "var(--approve)";
const AMBER = "#e0a23b";
const MAGENTA = "var(--disapprove)";

function round1(n: number) { return Math.round(n * 10) / 10; }
const netPM = (n: number) => (Math.abs(n) < 0.05 ? "Even" : n > 0 ? `+${n.toFixed(1)}` : `−${Math.abs(n).toFixed(1)}`);
const dvrMargin = (n: number) => (Math.abs(n) < 0.05 ? "Even" : n > 0 ? `D+${n.toFixed(1)}` : `R+${Math.abs(n).toFixed(1)}`);

// Dem-vs-Rep race factory (president + governor): A = Dem (blue), B = Rep (red).
function dvr(id: string, label: string, category: string, title: string, polls: Poll[], aLabel: string, bLabel: string, aKey: string, bKey: string): AggregateDef {
  return {
    id, label, category, title,
    subtitle: "Daily PSI-weighted average of every public poll of this race — recency decay, sample-size sigmoid, voter screen, and pollster grade.",
    unit: "%", keyA: aKey, keyB: bKey,
    seriesA: { label: aLabel, color: BLUE }, seriesB: { label: bLabel, color: RED },
    marginLabel: "Margin", fmtMargin: dvrMargin, polls, gold: [], goldMult: 1,
  };
}

const STATES_2024: [string, string, Poll[]][] = [
  ["pa", "Pennsylvania", PR_PA], ["ga", "Georgia", PR_GA], ["az", "Arizona", PR_AZ], ["mi", "Michigan", PR_MI],
  ["nv", "Nevada", PR_NV], ["wi", "Wisconsin", PR_WI], ["nc", "North Carolina", PR_NC], ["mn", "Minnesota", PR_MN],
  ["nm", "New Mexico", PR_NM], ["nj", "New Jersey", PR_NJ], ["nh", "New Hampshire", PR_NH], ["tx", "Texas", PR_TX], ["va", "Virginia", PR_VA],
];

const EXTRA: AggregateDef[] = [
  dvr("2025-va-gov", "Virginia Governor", "2025 Governor", "Virginia · governor (2025)", VA_GOV_POLLS, "Spanberger", "Earle-Sears", "Abigail Spanberger (D)", "Winsome Earle-Sears (R)"),
  dvr("2025-nj-gov", "New Jersey Governor", "2025 Governor", "New Jersey · governor (2025)", NJ_GOV_POLLS, "Sherrill", "Ciattarelli", "Mikie Sherrill (D)", "Jack Ciattarelli (R)"),
  dvr("2024-national", "National", "2024 President", "2024 national · president", PR_NAT, "Harris", "Trump", "Harris", "Trump"),
  ...STATES_2024.map(([sid, name, polls]) => dvr(`2024-${sid}`, name, "2024 President", `2024 ${name} · president`, polls, "Harris", "Trump", "Harris", "Trump")),
];

/* ---------- 2026 Senate matchups (generic adapter) ---------- */

type SenateModule = {
  STATE: { abbr: string; name: string };
  RACES: ReadonlyArray<{ raceId: string; candidates: ReadonlyArray<string> }>;
  STATE_POLLS: Record<string, ReadonlyArray<{ raceId?: string; pollster: string; endDate: string; sampleSize: number; sampleType: string; results: Record<string, number> }>>;
};

function lastName(label: string) {
  return label.replace(/\s*\([A-Za-z/]+\)\s*$/, "").trim().split(/\s+/).slice(-1)[0] || label;
}
function partyColor(label: string) {
  if (/\(R\)/.test(label)) return RED;
  if (/\(D\)|\(I\/D\)/.test(label)) return BLUE;
  if (/\(I\)/.test(label)) return AMBER;
  return "#9b8cff";
}

// featured matchups stored with generic Republican/Democrat keys
function rdSenate(id: string, abbr: string, stateName: string, aShort: string, bShort: string, polls: Poll[]): AggregateDef {
  return {
    id, label: `${abbr} · ${aShort}–${bShort}`, category: "2026 Senate",
    title: `${stateName} · U.S. Senate — ${aShort} vs. ${bShort}`,
    subtitle: "Daily PSI-weighted average of every public poll of this 2026 U.S. Senate matchup.",
    unit: "%", keyA: "Republican", keyB: "Democrat",
    seriesA: { label: aShort, color: RED }, seriesB: { label: bShort, color: BLUE },
    marginLabel: "Margin",
    fmtMargin: (n) => (Math.abs(n) < 0.05 ? "Even" : n > 0 ? `${aShort}+${n.toFixed(1)}` : `${bShort}+${Math.abs(n).toFixed(1)}`),
    polls, gold: [], goldMult: 1, stateAbbr: abbr,
  };
}

function senateAggs(mod: SenateModule): AggregateDef[] {
  const abbr = mod.STATE.abbr, name = mod.STATE.name;
  const allPolls = (mod.STATE_POLLS[abbr] ?? Object.values(mod.STATE_POLLS).flat()) as unknown as Poll[];
  const out: AggregateDef[] = [];
  for (const race of mod.RACES) {
    const aLabel = race.candidates[0], bLabel = race.candidates[1];
    if (!aLabel || !bLabel) continue;
    const polls = allPolls.filter((p) => (p as Poll & { raceId?: string }).raceId === race.raceId);
    if (polls.length === 0) continue;
    const aShort = lastName(aLabel), bShort = lastName(bLabel);
    out.push({
      id: race.raceId.toLowerCase(),
      label: `${abbr} · ${aShort}–${bShort}`,
      category: "2026 Senate",
      title: `${name} · U.S. Senate — ${aShort} vs. ${bShort}`,
      subtitle: "Daily PSI-weighted average of every public poll of this 2026 U.S. Senate matchup.",
      unit: "%",
      keyA: aLabel, keyB: bLabel,
      seriesA: { label: aShort, color: partyColor(aLabel) },
      seriesB: { label: bShort, color: partyColor(bLabel) },
      marginLabel: "Margin",
      fmtMargin: (n) => (Math.abs(n) < 0.05 ? "Even" : n > 0 ? `${aShort}+${n.toFixed(1)}` : `${bShort}+${Math.abs(n).toFixed(1)}`),
      polls, gold: [], goldMult: 1, stateAbbr: abbr,
    });
  }
  return out;
}

function governorAggs(mod: SenateModule): AggregateDef[] {
  const abbr = mod.STATE.abbr, name = mod.STATE.name;
  const allPolls = (mod.STATE_POLLS[abbr] ?? Object.values(mod.STATE_POLLS).flat()) as unknown as Poll[];
  const out: AggregateDef[] = [];
  for (const race of mod.RACES) {
    const aLabel = race.candidates[0], bLabel = race.candidates[1];
    if (!aLabel || !bLabel) continue;
    const polls = allPolls.filter((p) => (p as Poll & { raceId?: string }).raceId === race.raceId);
    if (polls.length === 0) continue;
    const aShort = lastName(aLabel), bShort = lastName(bLabel);
    out.push({
      id: race.raceId.toLowerCase(),
      label: `${abbr} · ${aShort}–${bShort}`,
      category: "2026 Governor",
      title: `${name} · governor — ${aShort} vs. ${bShort}`,
      subtitle: "Daily PSI-weighted average of every public poll of this 2026 governor's race.",
      unit: "%",
      keyA: aLabel, keyB: bLabel,
      seriesA: { label: aShort, color: partyColor(aLabel) },
      seriesB: { label: bShort, color: partyColor(bLabel) },
      marginLabel: "Margin",
      fmtMargin: (n) => (Math.abs(n) < 0.05 ? "Even" : n > 0 ? `${aShort}+${n.toFixed(1)}` : `${bShort}+${Math.abs(n).toFixed(1)}`),
      polls, gold: [], goldMult: 1, stateAbbr: abbr,
    });
  }
  return out;
}

const SENATE_MODULES = [
  SEN_ALABAMA, SEN_ALASKA, SEN_ARKANSAS, SEN_COLORADO, SEN_DELAWARE, SEN_FLORIDA, SEN_GEORGIA, SEN_IDAHO, SEN_ILLINOIS, SEN_IOWA, SEN_KANSAS, SEN_KENTUCKY, SEN_LOUISIANA, SEN_MAINE, SEN_MASSACHUSETTS, SEN_MICHIGAN, SEN_MINNESOTA, SEN_MISSISSIPPI, SEN_MONTANA, SEN_NEBRASKA, SEN_NEWHAMPSHIRE, SEN_NEWJERSEY, SEN_NEWMEXICO, SEN_NORTHCAROLINA, SEN_OHIO, SEN_OKLAHOMA, SEN_OREGON, SEN_RHODEISLAND, SEN_SOUTHCAROLINA, SEN_SOUTHDAKOTA, SEN_TENNESSEE, SEN_TEXAS, SEN_VIRGINIA, SEN_WESTVIRGINIA, SEN_WYOMING,
] as unknown as SenateModule[];
const GOVERNOR_MODULES = [
  GOV_ALABAMA, GOV_ALASKA, GOV_ARIZONA, GOV_ARKANSAS, GOV_CALIFORNIA, GOV_COLORADO, GOV_CONNECTICUT, GOV_FLORIDA, GOV_GEORGIA, GOV_HAWAII, GOV_IDAHO, GOV_ILLINOIS, GOV_IOWA, GOV_KANSAS, GOV_MAINE, GOV_MARYLAND, GOV_MASSACHUSETTS, GOV_MICHIGAN, GOV_MINNESOTA, GOV_NEBRASKA, GOV_NEVADA, GOV_NEWHAMPSHIRE, GOV_NEWMEXICO, GOV_NEWYORK, GOV_OHIO, GOV_OKLAHOMA, GOV_OREGON, GOV_PENNSYLVANIA, GOV_RHODEISLAND, GOV_SOUTHCAROLINA, GOV_SOUTHDAKOTA, GOV_TENNESSEE, GOV_TEXAS, GOV_VERMONT, GOV_WISCONSIN, GOV_WYOMING,
] as unknown as SenateModule[];
const SENATE_AGGS: AggregateDef[] = [
  // featured TX general matchups (the live Talarico races) from the polling index
  rdSenate("tx-sen-cornyn-talarico", "TX", "Texas", "Cornyn", "Talarico", TX_CORNYN_POLLS as unknown as Poll[]),
  rdSenate("tx-sen-paxton-talarico", "TX", "Texas", "Paxton", "Talarico", TX_PAXTON_POLLS as unknown as Poll[]),
  ...SENATE_MODULES.flatMap(senateAggs),
];

const GOVERNOR_AGGS: AggregateDef[] = GOVERNOR_MODULES.flatMap(governorAggs);

export const AGGREGATES: AggregateDef[] = [
  {
    id: "generic-ballot",
    label: "Generic Ballot",
    category: "2026 House",
    title: "National generic ballot",
    subtitle:
      "A daily weighted average of every public House generic-ballot poll — recency decay, sample-size sigmoid, likely-voter screen, and pollster-grade weighting.",
    unit: "%",
    keyA: "Democrats", keyB: "Republicans",
    seriesA: { label: "Democrats", color: BLUE },
    seriesB: { label: "Republicans", color: RED },
    marginLabel: "Margin",
    fmtMargin: (n) => (Math.abs(n) < 0.05 ? "Even" : n > 0 ? `D+${n.toFixed(1)}` : `R+${Math.abs(n).toFixed(1)}`),
    polls: GENERIC, gold: GENERIC_GOLD, goldMult: 2,
  },
  {
    id: "trump-approval",
    label: "Trump Approval",
    category: "Approval",
    title: "Donald Trump · job approval",
    subtitle:
      "A daily weighted average of every public Trump job-approval poll, blended on the same PSI model — recency, sample size, voter screen, and pollster grade.",
    unit: "%",
    keyA: "Approve", keyB: "Disapprove",
    seriesA: { label: "Approve", color: GREEN },
    seriesB: { label: "Disapprove", color: MAGENTA },
    marginLabel: "Net approval",
    fmtMargin: netPM,
    polls: TRUMP, gold: TRUMP_GOLD, goldMult: 2,
  },
  {
    id: "vance-favorability",
    label: "Vance Favorability",
    category: "Approval",
    title: "JD Vance · favorability",
    subtitle:
      "A daily weighted average of every public JD Vance favorability poll, on the PSI model.",
    unit: "%",
    keyA: "Favorable", keyB: "Unfavorable",
    seriesA: { label: "Favorable", color: BLUE },
    seriesB: { label: "Unfavorable", color: RED },
    marginLabel: "Net favorability",
    fmtMargin: netPM,
    polls: VANCE, gold: VANCE_GOLD, goldMult: 2,
  },
  {
    id: "right-wrong-track",
    label: "Right / Wrong Track",
    category: "National mood",
    title: "Right track · wrong track",
    subtitle:
      "A daily weighted average of national direction-of-the-country polling, on the PSI model.",
    unit: "%",
    keyA: "RightTrack", keyB: "WrongTrack",
    seriesA: { label: "Right track", color: GREEN },
    seriesB: { label: "Wrong track", color: AMBER },
    marginLabel: "Net",
    fmtMargin: netPM,
    polls: TRACK, gold: TRACK_GOLD, goldMult: 2,
  },
  {
    id: "2028-vance-newsom",
    label: "2028: Vance vs Newsom",
    category: "2028",
    title: "2028 · Vance vs. Newsom",
    subtitle:
      "An early daily weighted average of hypothetical 2028 general-election matchups, on the PSI model.",
    unit: "%",
    keyA: "Vance", keyB: "Newsom",
    seriesA: { label: "Vance", color: RED },
    seriesB: { label: "Newsom", color: BLUE },
    marginLabel: "Margin",
    fmtMargin: (n) => (Math.abs(n) < 0.05 ? "Even" : n > 0 ? `Vance +${n.toFixed(1)}` : `Newsom +${Math.abs(n).toFixed(1)}`),
    polls: P2028, gold: P2028_GOLD, goldMult: 2,
  },
  ...EXTRA,
  ...SENATE_AGGS,
  ...GOVERNOR_AGGS,
];

/* ----------------------------- builder ----------------------------- */

function normalize(s: string) {
  return s.toLowerCase().replace(/\(r\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function isGold(pollster: string, gold: string[]) {
  const p = normalize(pollster);
  return gold.some((g) => p.includes(normalize(g)));
}
function effSample(pollster: string, n: number, gold: string[], mult: number) {
  if (!Number.isFinite(n) || n <= 0) return n;
  return isGold(pollster, gold) ? Math.round(n * mult * mult) : n;
}
const ts = (iso: string) => new Date(iso + "T00:00:00").getTime();

export type BuiltAggregate = {
  daily: AggDaily[];
  polls: AggPollPoint[];
  latest: { a: number; b: number; net: number } | null;
};

export function buildAggregate(def: AggregateDef): BuiltAggregate {
  const adjusted = def.polls.map((p) => ({
    ...p,
    sampleSize: effSample(p.pollster, p.sampleSize, def.gold, def.goldMult),
  }));
  const range = getDateRange(def.polls);
  const base = buildDailyWeightedSeries(adjusted as Poll[], [def.keyA, def.keyB], range.start, range.end);

  const daily: AggDaily[] = base.map((row) => {
    const a = Number((row as Record<string, number | string>)[def.keyA] ?? 0);
    const b = Number((row as Record<string, number | string>)[def.keyB] ?? 0);
    return { date: row.date, t: ts(row.date), a, b, net: round1(a - b) };
  });

  const polls: AggPollPoint[] = def.polls
    .map((p) => {
      const a = Number((p.results as Record<string, number>)[def.keyA] ?? NaN);
      const b = Number((p.results as Record<string, number>)[def.keyB] ?? NaN);
      return {
        pollster: p.pollster.replace(/\*\*/g, "").trim(),
        date: p.endDate,
        t: ts(p.endDate),
        a, b,
        margin: round1(a - b),
        sampleSize: p.sampleSize,
        sampleType: p.sampleType,
        grade: getPollsterEntry(p.pollster).grade,
      };
    })
    .filter((p) => Number.isFinite(p.a) && Number.isFinite(p.b));

  const last = daily[daily.length - 1] ?? null;
  return {
    daily,
    polls,
    latest: last ? { a: round1(last.a), b: round1(last.b), net: last.net } : null,
  };
}

/* =============================================================================
   Multi-candidate aggregates (primaries) — N candidates, no head-to-head margin.
============================================================================= */

export type MultiSeries = { key: string; label: string; color: string };
export type MultiAggregateDef = {
  id: string;
  label: string;
  group: string;
  title: string;
  subtitle: string;
  unit: "%" | "pt";
  series: MultiSeries[];
  polls: Poll[];
  gold: string[];
  goldMult: number;
};
export type MultiDaily = { date: string; t: number; v: number[] }; // v aligned to series
export type MultiPollPoint = { pollster: string; date: string; t: number; v: number[]; sampleSize: number; sampleType: string; grade: string };
export type BuiltMulti = { daily: MultiDaily[]; polls: MultiPollPoint[]; latest: number[] | null };

// categorical palette for primary fields (candidates are same-party, so non-semantic colors)
const CAND_PALETTE = ["#5b8cf0", "#e5484d", "#3ecf8e", "#e0a23b", "#c64ad6", "#42c9d4", "#9b8cff"];

function multiDef(id: string, label: string, title: string, subtitle: string, polls: Poll[]): MultiAggregateDef {
  const cands = getCandidateList(polls);
  const totals = new Map<string, number>();
  for (const p of polls) {
    for (const c of cands) {
      const v = Number((p.results as Record<string, number>)[c]);
      if (Number.isFinite(v)) totals.set(c, (totals.get(c) ?? 0) + v);
    }
  }
  const ordered = cands.slice().sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0));
  const series = ordered.map((c, i) => ({ key: c, label: c, color: CAND_PALETTE[i % CAND_PALETTE.length] }));
  return { id, label, group: "Primaries", title, subtitle, unit: "%", series, polls, gold: [], goldMult: 1 };
}

// The Primaries category was retired from the polling desk. The primary poll
// files stay on disk, but nothing registers them, so no Primaries tab renders.
export const MULTI_AGGREGATES: MultiAggregateDef[] = [];

export function buildMulti(def: MultiAggregateDef): BuiltMulti {
  const adjusted = def.polls.map((p) => ({ ...p, sampleSize: effSample(p.pollster, p.sampleSize, def.gold, def.goldMult) }));
  const keys = def.series.map((s) => s.key);
  const range = getDateRange(def.polls);
  const base = buildDailyWeightedSeries(adjusted as Poll[], keys, range.start, range.end);
  const daily: MultiDaily[] = base.map((row) => ({
    date: row.date,
    t: ts(row.date),
    v: keys.map((k) => round1(Number((row as Record<string, number | string>)[k] ?? 0))),
  }));
  const polls: MultiPollPoint[] = def.polls
    .map((p) => ({
      pollster: p.pollster.replace(/\*\*/g, "").trim(),
      date: p.endDate,
      t: ts(p.endDate),
      v: keys.map((k) => { const val = Number((p.results as Record<string, number>)[k]); return Number.isFinite(val) ? val : NaN; }),
      sampleSize: p.sampleSize,
      sampleType: p.sampleType,
      grade: getPollsterEntry(p.pollster).grade,
    }))
    .filter((p) => p.v.some((x) => Number.isFinite(x)));
  const last = daily[daily.length - 1] ?? null;
  return { daily, polls, latest: last ? last.v : null };
}
