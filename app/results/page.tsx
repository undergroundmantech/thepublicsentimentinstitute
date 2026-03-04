"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ForecastOutput, RaceRule } from "@/app/lib/electoralModel";

const CIVIC_BASE = "https://civicapi.org";
const POLL_MS = 30_000;

function calculateWinProbability(leaderVotes: number, runnerUpVotes: number, percentReporting: number): number {
  if (percentReporting >= 99) return 100;
  if (percentReporting <= 0 || (leaderVotes === 0 && runnerUpVotes === 0)) return 50;
  const currentTotal = leaderVotes + runnerUpVotes;
  const estimatedTotal = currentTotal / (percentReporting / 100);
  const remainingVotes = estimatedTotal - currentTotal;
  const gap = leaderVotes - runnerUpVotes;
  if (gap > remainingVotes) return 100;
  const margin = (leaderVotes - runnerUpVotes) / currentTotal;
  const certaintyWeight = Math.sqrt(percentReporting / 100);
  const z = margin * 15 * certaintyWeight;
  const prob = 1 / (1 + Math.exp(-z));
  return 50 + (prob - 0.5) * 100;
}

type RaceCandidate = { name: string; party: string; votes: number; percent: number; winner: boolean; incumbent?: boolean; major_candidate?: boolean; color: string; };
type RegionCandidate = { name: string; party: string; votes: string | number; percent: string | number; winner: boolean; color: string; incumbent?: boolean; major_candidate?: boolean; };
type RegionResult = { region: { name: string; type: string; fill?: string; percent_reporting?: number; }; candidates: RegionCandidate[]; };
type RaceDetail = { election_name: string; election_type: string; election_scope: string; election_date: string; country: string; province: string | null; district: string | null; municipality: string | null; polls_open: string | null; polls_close: string | null; last_updated: string | null; percent_reporting?: number; candidates: RaceCandidate[]; region_results?: RegionResult[] | Record<string, RegionResult>; };
type FeaturedRace = { id: number; state: "TX" | "NC" | "AR" | "TEST"; office: string; party: "Democratic" | "Republican" | "N/A"; label: string; };

const RACE_FORECAST_DEFAULTS: Partial<Record<number, { raceRule: RaceRule; expectedTurnout?: number; pollAvg?: Record<string, number>; }>> = {
  44286: { raceRule: "MAJORITY", expectedTurnout: 2_800_000, pollAvg: { "Talarico": 48.5, "Crockett": 44.1, "Hassan": 0.4 } },
  44285: { raceRule: "MAJORITY", expectedTurnout: 2_500_000, pollAvg: { "Paxton": 37.5, "Cornyn": 33.0, "Hunt": 18.3 } },
  44287: { raceRule: "MAJORITY", expectedTurnout: 2_190_000, pollAvg: { "Abbott": 91.0 } },
  44288: { raceRule: "MAJORITY", expectedTurnout: 2_660_000, pollAvg: { "Hinojosa": 65.0, "Bell": 15.0 } },
  44292: { raceRule: "MAJORITY", expectedTurnout: 1_950_000, pollAvg: { "Patrick": 78.0, "Hopkins": 8.0, "Mabry": 7.0 } },
  44293: { raceRule: "MAJORITY", expectedTurnout: 980_000, pollAvg: { "Goodwin": 72.0, "Head": 15.0, "Velez": 7.0 } },
  44289: { raceRule: "MAJORITY", expectedTurnout: 1_900_000, pollAvg: { "Roy": 33.0, "Middleton": 23.0, "Huffman": 13.0, "Reitz": 6.0 } },
  44290: { raceRule: "MAJORITY", expectedTurnout: 980_000, pollAvg: { "Johnson": 25.0, "Jaworski": 22.0, "Box": 13.0 } },
  44208: { raceRule: "MAJORITY", expectedTurnout: 1_900_000, pollAvg: { "Huffines": 33.0, "Craddick": 21.0, "Hancock": 13.0, "Berlanga": 4.0 } },
  44209: { raceRule: "MAJORITY", expectedTurnout: 970_000, pollAvg: { "Eckhardt": 65.0 } },
  44291: { raceRule: "MAJORITY", expectedTurnout: 1_850_000, pollAvg: { "Miller": 48.0, "Sheets": 18.0 } },
  // 44294: { raceRule: "MAJORITY", expectedTurnout: 960_000, pollAvg: {} },
  44295: { raceRule: "MAJORITY", expectedTurnout: 1_850_000, pollAvg: { "Wright": 21.0, "Matlock": 20.0 } },
  44344: { raceRule: "MAJORITY", expectedTurnout: 90_000, pollAvg: { "Herrera": 43.0, "Gonzales": 34.0, "Canseco": 14.0, "Barton": 8.0 } },
  // 44374: { raceRule: "MAJORITY", expectedTurnout: 90_000 },
  // 44366: { raceRule: "MAJORITY", expectedTurnout: 85_000 },
  // 44323: { raceRule: "MAJORITY", expectedTurnout: 55_000 },
  // 44324: { raceRule: "MAJORITY", expectedTurnout: 45_000 },
  // 44328: { raceRule: "MAJORITY", expectedTurnout: 55_000 },
  44329: { raceRule: "MAJORITY", expectedTurnout: 85_000, pollAvg: { "Yarbrough": 48.0, "Binkley": 32.0 } },
  // 44351: { raceRule: "MAJORITY", expectedTurnout: 60_000 },
  // 44331: { raceRule: "MAJORITY", expectedTurnout: 90_000 },
  // 44722: { raceRule: "MAJORITY", expectedTurnout: 250_000, pollAvg: { "Sanders": 98.0 } },
  // 44721: { raceRule: "MAJORITY", expectedTurnout: 38_000 },
  44729: { raceRule: "MAJORITY", expectedTurnout: 265_000, pollAvg: { "Cotton": 86.0, "Little": 8.0, "Ashby": 4.0 } },
  44730: { raceRule: "MAJORITY", expectedTurnout: 33_000, pollAvg: { "Shoffner": 58.0, "Dunbar": 36.0 } },
  // 44723: { raceRule: "MAJORITY", expectedTurnout: 250_000, pollAvg: { "Rutledge": 98.0 } },
  // 44724: { raceRule: "MAJORITY", expectedTurnout: 250_000, pollAvg: { "Griffin": 98.0 } },
  44725: { raceRule: "MAJORITY", expectedTurnout: 260_000, pollAvg: { "Hammer": 35.0, "Norris": 30.0, "Harrison": 24.0 } },
  // 44726: { raceRule: "MAJORITY", expectedTurnout: 33_000, pollAvg: { "Grappe": 98.0 } },
  44728: { raceRule: "MAJORITY", expectedTurnout: 250_000, pollAvg: { "Jester": 62.0, "Olson": 28.0 } },
  // 44727: { raceRule: "MAJORITY", expectedTurnout: 250_000 },
  46303: { raceRule: "PLURALITY", expectedTurnout: 700_000, pollAvg: { "Whatley": 52.0, "Brown": 18.0, "Morrow": 15.0 } },
  46302: { raceRule: "PLURALITY", expectedTurnout: 760_000, pollAvg: { "Cooper": 76.0, "Colon": 5.0, "Dues": 4.0 } },
  46306: { raceRule: "PLURALITY", expectedTurnout: 80_000, pollAvg: { "Foushee": 44.0, "Allam": 42.0, "Patterson": 8.0 } },
  46304: { raceRule: "PLURALITY", expectedTurnout: 62_000, pollAvg: { "Buckhout": 28.0, "Buck": 24.0, "Hanig": 18.0, "Rouse": 12.0 } },
};

function sortCandidatesByPollData(candidates: RaceCandidate[], pollAvg?: Record<string, number>): RaceCandidate[] {
  if (!pollAvg || Object.keys(pollAvg).length === 0) return [...candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  return [...candidates].sort((a, b) => {
    const getPollScore = (name: string): number => { const lower = name.toLowerCase(); for (const [key, score] of Object.entries(pollAvg)) { if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return score; } return -1; };
    const sa = getPollScore(a.name), sb = getPollScore(b.name);
    if (sa >= 0 && sb >= 0) return sb - sa;
    if (sa >= 0) return -1; if (sb >= 0) return 1;
    return (b.percent ?? 0) - (a.percent ?? 0);
  });
}

const FEATURED: FeaturedRace[] = [
  { id: 44287, state: "TX", office: "Governor", party: "Republican", label: "TX Governor — Republican Primary" },
  { id: 44288, state: "TX", office: "Governor", party: "Democratic", label: "TX Governor — Democratic Primary" },
  { id: 44285, state: "TX", office: "US Senate", party: "Republican", label: "TX US Senate — Republican Primary" },
  { id: 44286, state: "TX", office: "US Senate", party: "Democratic", label: "TX US Senate — Democratic Primary" },
  { id: 44292, state: "TX", office: "Lieutenant Governor", party: "Republican", label: "TX Lt. Governor — Republican Primary" },
  { id: 44293, state: "TX", office: "Lieutenant Governor", party: "Democratic", label: "TX Lt. Governor — Democratic Primary" },
  { id: 44289, state: "TX", office: "Attorney General", party: "Republican", label: "TX Attorney General — Republican Primary" },
  { id: 44290, state: "TX", office: "Attorney General", party: "Democratic", label: "TX Attorney General — Democratic Primary" },
  { id: 44208, state: "TX", office: "Comptroller", party: "Republican", label: "TX Comptroller — Republican Primary" },
  { id: 44209, state: "TX", office: "Comptroller", party: "Democratic", label: "TX Comptroller — Democratic Primary" },
  { id: 44291, state: "TX", office: "Agriculture Commissioner", party: "Republican", label: "TX Ag Commissioner — Republican Primary" },
  { id: 44294, state: "TX", office: "Land Commissioner", party: "Democratic", label: "TX Land Commissioner — Democratic Primary" },
  { id: 44295, state: "TX", office: "Railroad Commissioner", party: "Republican", label: "TX Railroad Commissioner — Republican Primary" },
  { id: 44344, state: "TX", office: "US House 23", party: "Republican", label: "TX District 23 — Republican Primary" },
  { id: 44374, state: "TX", office: "US House 2", party: "Republican", label: "TX District 2 — Republican Primary" },
  { id: 44366, state: "TX", office: "US House 8", party: "Republican", label: "TX District 8 — Republican Primary" },
  { id: 44323, state: "TX", office: "US House 35", party: "Republican", label: "TX District 35 — Republican Primary" },
  { id: 44324, state: "TX", office: "US House 35", party: "Democratic", label: "TX District 35 — Democratic Primary" },
  { id: 44328, state: "TX", office: "US House 33", party: "Democratic", label: "TX District 33 — Democratic Primary" },
  { id: 44329, state: "TX", office: "US House 32", party: "Republican", label: "TX District 32 — Republican Primary" },
  { id: 44351, state: "TX", office: "US House 19", party: "Republican", label: "TX District 19 — Republican Primary" },
  { id: 44331, state: "TX", office: "US House 31", party: "Republican", label: "TX District 31 — Republican Primary" },
  { id: 44722, state: "AR", office: "Governor", party: "Republican", label: "AR Governor — Republican Primary" },
  { id: 44721, state: "AR", office: "Governor", party: "Democratic", label: "AR Governor — Democratic Primary" },
  { id: 44729, state: "AR", office: "US Senate", party: "Republican", label: "AR US Senate — Republican Primary" },
  { id: 44730, state: "AR", office: "US Senate", party: "Democratic", label: "AR US Senate — Democratic Primary" },
  { id: 44723, state: "AR", office: "Lieutenant Governor", party: "Republican", label: "AR Lt. Governor — Republican Primary" },
  { id: 44724, state: "AR", office: "Attorney General", party: "Republican", label: "AR Attorney General — Republican Primary" },
  { id: 44725, state: "AR", office: "Secretary of State", party: "Republican", label: "AR Secretary of State — Republican Primary" },
  { id: 44726, state: "AR", office: "Secretary of State", party: "Democratic", label: "AR Secretary of State — Democratic Primary" },
  { id: 44728, state: "AR", office: "Land Commissioner", party: "Republican", label: "AR Land Commissioner — Republican Primary" },
  { id: 44727, state: "AR", office: "Treasurer", party: "Republican", label: "AR Treasurer — Republican Primary" },
  { id: 46303, state: "NC", office: "US Senate", party: "Republican", label: "NC US Senate — Republican Primary" },
  { id: 46302, state: "NC", office: "US Senate", party: "Democratic", label: "NC US Senate — Democratic Primary" },
  { id: 46306, state: "NC", office: "US House 4", party: "Democratic", label: "NC District 4 — Democratic Primary" },
  { id: 46304, state: "NC", office: "US House 1", party: "Republican", label: "NC District 1 — Republican Primary" },
  { id: 9999999, state: "TEST", office: "Test Map", party: "N/A", label: "Map Test — Blank Counties" },
];

async function fetchRaceById(id: number): Promise<RaceDetail> {
  const res = await fetch(`${CIVIC_BASE}/api/v2/race/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Race fetch failed (${id}) ${res.status}`);
  return res.json();
}
async function fetchRaceMapBlankSvg(id: number): Promise<string | null> {
  const res = await fetch(`${CIVIC_BASE}/api/v2/race/${id}?generateMap`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.text();
}

function fmtPct(x?: number) { if (typeof x !== "number") return "—"; return `${x.toFixed(1)}%`; }
function getRaceReportingPct(race?: RaceDetail) { const v = race?.percent_reporting; return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null; }
function getRaceProjectionAlways(race?: RaceDetail): { leaderName: string; prob: number } | null {
  if (!race?.candidates?.length) return null;
  const reporting = typeof race.percent_reporting === "number" ? race.percent_reporting : 0;
  const officialWinner = race.candidates.find((c) => c.winner);
  if (officialWinner) return { leaderName: officialWinner.name, prob: 100 };
  const ordered = [...race.candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  const leader = ordered[0], runnerUp = ordered[1];
  if (!leader || !runnerUp) return { leaderName: leader?.name ?? "—", prob: 50 };
  const prob = calculateWinProbability(leader.votes, runnerUp.votes, reporting);
  return { leaderName: leader.name, prob };
}
function prettyTime(iso?: string | null) { if (!iso) return "—"; return new Date(iso).toLocaleString(); }
function parseIsoDate(iso?: string | null): Date | null { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d; }
function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "CLOSED";
  const totalSec = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}
function formatLocalCloseTime(d: Date): string { return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function normalizeRegionName(s: string) { return s.toLowerCase().replace(/[_-]+/g, " ").replace(/[''"]/g, "").replace(/\./g, "").replace(/\s+county$/i, "").replace(/\s+parish$/i, "").replace(/\s+borough$/i, "").replace(/\s+/g, " ").trim(); }
function titleCaseKey(key: string) { return key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "); }
function getRegionKeyFromElement(el: Element): string | null {
  const attrs = ["data-name", "data-county", "name", "aria-label", "id"];
  for (const a of attrs) { const v = el.getAttribute(a); if (v && v.trim()) return normalizeRegionName(v.trim()); }
  const title = el.querySelector?.("title")?.textContent?.trim();
  if (title) return normalizeRegionName(title);
  return null;
}
function coerceRegionResults(input: unknown): RegionResult[] { if (Array.isArray(input)) return input as RegionResult[]; if (input && typeof input === "object") return Object.values(input as Record<string, RegionResult>); return []; }

type TooltipLine = { name: string; party: string; votes: number | null; pct: number | null; winner: boolean; color?: string; };
type TooltipState = { show: boolean; x: number; y: number; title: string; reporting: string | null; reportingPct: number | null; lines: TooltipLine[]; };

function safeNum(x: unknown): number | null { if (typeof x === "number" && Number.isFinite(x)) return x; if (typeof x === "string") { const n = Number(x.replace(/,/g, "").trim()); return Number.isFinite(n) ? n : null; } return null; }
function safePct(x: unknown): number | null { if (typeof x === "number" && Number.isFinite(x)) return x; if (typeof x === "string") { const n = parseFloat(x.replace("%", "").trim()); return Number.isFinite(n) ? n : null; } return null; }
function getCandidatesFromRR(rr: any): RegionCandidate[] { const c1 = rr?.candidates, c2 = rr?.region?.candidates, c3 = rr?.data?.candidates; const found = (Array.isArray(c1) ? c1 : null) ?? (Array.isArray(c2) ? c2 : null) ?? (Array.isArray(c3) ? c3 : null); return (found ?? []) as RegionCandidate[]; }
function buildTooltipLines(rr: any): TooltipLine[] { return [...getCandidatesFromRR(rr)].map((c) => ({ name: String(c?.name ?? ""), party: String(c?.party ?? ""), votes: safeNum(c?.votes), pct: safePct(c?.percent), winner: !!c?.winner, color: c?.color })).filter((x) => x.name).sort((a, b) => { const av = a.votes ?? -1, bv = b.votes ?? -1; if (bv !== av) return bv - av; return (b.pct ?? -1) - (a.pct ?? -1); }); }

type MarginBucket = "tilt" | "lean" | "likely" | "safe" | "tied";
function marginBucket(absMargin: number): MarginBucket { if (absMargin < 0.0001) return "tied"; if (absMargin < 2) return "tilt"; if (absMargin < 6) return "lean"; if (absMargin < 12) return "likely"; return "safe"; }
function toShaded(hex: string, bucket: MarginBucket) {
  let r = 0, g = 0, b = 0; const h = hex.replace("#", "");
  if (h.length === 3) { r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16); }
  else { r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, saturation = 0, lightness = (max + min) / 2;
  if (max !== min) { const d = max - min; saturation = lightness > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: hue = (g - b) / d + (g < b ? 6 : 0); break; case g: hue = (b - r) / d + 2; break; case b: hue = (r - g) / d + 4; break; } hue /= 6; }
  let l = 0.5;
  switch (bucket) { case "safe": l = 0.5; break; case "likely": l = 0.65; break; case "lean": l = 0.8; break; case "tilt": l = 0.95; break; case "tied": l = 1.0; break; }
  return `hsl(${hue * 360}, ${saturation * 100}%, ${l * 100}%)`;
}
function computeCountyMargin(rr: any): { leaderName: string | null; leaderColor: string | null; absMargin: number | null; bucket: MarginBucket | null } {
  const candidates = getCandidatesFromRR(rr);
  if (!candidates.length) return { leaderName: null, leaderColor: null, absMargin: null, bucket: null };
  const rows = candidates.map((c) => ({ name: c.name, color: typeof c?.color === "string" ? c.color : null, pct: safePct(c?.percent), votes: safeNum(c?.votes) })).filter((r) => r.color);
  if (!rows.length) return { leaderName: null, leaderColor: null, absMargin: null, bucket: null };
  const hasPct = rows.some((r) => typeof r.pct === "number");
  const metric = (r: any) => (hasPct ? (r.pct ?? -1) : (r.votes ?? -1));
  rows.sort((a, b) => metric(b) - metric(a));
  const leader = rows[0], runnerUp = rows[1];
  if (!runnerUp) return { leaderName: leader.name, leaderColor: leader.color, absMargin: 100, bucket: "safe" };
  const m = Math.abs(metric(leader) - metric(runnerUp));
  return { leaderName: leader.name, leaderColor: leader.color, absMargin: m, bucket: marginBucket(m) };
}
function countyFill(rr: any): string | null { const apiFill = rr?.region?.fill; if (typeof apiFill === "string" && apiFill.trim()) return apiFill; const { leaderColor, bucket } = computeCountyMargin(rr); if (!leaderColor || !bucket) return null; return toShaded(leaderColor, bucket); }
function countyFingerprint(rr: any): string { const candidates = getCandidatesFromRR(rr); if (!candidates.length) return ""; return candidates.map((c) => `${c.name}:${safeNum(c?.votes) ?? 0}`).sort().join("|"); }

// ─── OVERLAY ────────────────────────────────────────────────────────────────
function ProjectedWinnerOverlay({ show, candidate, prob, color, reporting, onDismiss }: { show: boolean; candidate: string; prob: number; color: string; reporting: number; onDismiss: () => void; }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onDismiss} />
      <div className="res-overlay-card relative w-[min(680px,92vw)] overflow-hidden">
        <div className="res-tri-stripe" />
        <div className="p-7 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="res-eyebrow" style={{ color: "var(--rep)" }}><span className="res-live-dot" style={{ background: "var(--rep)" }} />PROJECTION ALERT</div>
              <div className="res-overlay-title mt-3">Projected<br />Winner</div>
              <div className="res-overlay-name mt-2" style={{ color: color || "var(--purple-soft)" }}>{candidate}</div>
            </div>
            <button onClick={onDismiss} className="res-close-btn">CLOSE ✕</button>
          </div>
          <div className="mt-6">
            <div className="res-stat-row mb-2"><span className="res-stat-label">WIN CONFIDENCE</span><span className="res-stat-val" style={{ color: "var(--purple-soft)" }}>{prob.toFixed(1)}%</span></div>
            <div className="res-bar-track"><div className="res-bar-fill" style={{ width: `${Math.max(0, Math.min(100, prob))}%`, background: "linear-gradient(90deg, var(--purple), var(--purple2))", boxShadow: "0 0 20px rgba(124,58,237,0.5)" }} /></div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {[["STATUS", "PROJECTED"], ["CONFIDENCE", `${prob.toFixed(1)}%`], ["REPORTING", `${reporting.toFixed(1)}%`]].map(([label, val]) => (
              <div key={label} className="res-stat-block"><div className="res-stat-block-label">{label}</div><div className="res-stat-block-val">{val}</div></div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <div className="res-note">Click outside to dismiss</div>
            <button onClick={onDismiss} className="res-btn-primary">CONTINUE →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAP ────────────────────────────────────────────────────────────────────
function countyTotalVotes(rr: any): number {
  return getCandidatesFromRR(rr).reduce((sum, c) => sum + (safeNum(c?.votes) ?? 0), 0);
}

function MapWithCountyTooltip({ svgText, regionResults }: { svgText: string; regionResults: RegionResult[] | Record<string, RegionResult> }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, x: 0, y: 0, title: "", reporting: null, reportingPct: null, lines: [] });
  const countyFingerprintsRef = useRef<Map<string, string>>(new Map());
  const countyVoteTotalsRef = useRef<Map<string, number>>(new Map());

  // Zoom/pan state
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, tx: 0, ty: 0 });
  const [scale, setScale] = useState(1);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const toggleLock = useCallback(() => {
    lockedRef.current = !lockedRef.current;
    setLocked(lockedRef.current);
  }, []);

  const regionResultsArr = useMemo(() => coerceRegionResults(regionResults), [regionResults]);
  const regionMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const rr of regionResultsArr as any[]) { const k = normalizeRegionName(String(rr?.region?.name ?? rr?.name ?? "")); if (!k) continue; m.set(k, rr); }
    return m;
  }, [regionResultsArr]);

  const flashCounty = useCallback((shape: SVGGraphicsElement) => {
    shape.classList.remove("county-updated");
    void (shape as any).offsetWidth;
    shape.classList.add("county-updated");
    setTimeout(() => shape.classList.remove("county-updated"), 1200);
  }, []);

  const applyTransform = useCallback(() => {
    const host = wrapRef.current; if (!host) return;
    const svg = host.querySelector("svg"); if (!svg) return;
    const { scale, x, y } = transformRef.current;
    svg.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    svg.style.transformOrigin = "0 0";
  }, []);

  const resetZoom = useCallback(() => {
    transformRef.current = { scale: 1, x: 0, y: 0 };
    setScale(1);
    applyTransform();
  }, [applyTransform]);

  // Wheel zoom
  useEffect(() => {
    const host = wrapRef.current; if (!host) return;
    const onWheel = (e: WheelEvent) => {
      if (lockedRef.current) return; // locked — let scroll pass through
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { scale: s, x, y } = transformRef.current;
      const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.min(8, Math.max(1, s * delta));
      const newX = mx - (mx - x) * (newScale / s);
      const newY = my - (my - y) * (newScale / s);
      transformRef.current = { scale: newScale, x: newX, y: newY };
      setScale(newScale);
      applyTransform();
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [applyTransform]);

  // Pan via pointer drag — works everywhere including county shapes
  useEffect(() => {
    const host = wrapRef.current; if (!host) return;
    let capturedId: number | null = null;
    const onDown = (e: PointerEvent) => {
      isPanningRef.current = false;
      capturedId = e.pointerId;
      panStartRef.current = { mx: e.clientX, my: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y };
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons === 0) return;
      const dx = e.clientX - panStartRef.current.mx;
      const dy = e.clientY - panStartRef.current.my;
      if (!isPanningRef.current && Math.sqrt(dx * dx + dy * dy) > 4) {
        isPanningRef.current = true;
        setTooltip((t) => ({ ...t, show: false }));
        if (capturedId !== null) { try { host.setPointerCapture(capturedId); } catch {} }
        host.style.cursor = "grabbing";
      }
      if (!isPanningRef.current) return;
      transformRef.current.x = panStartRef.current.tx + dx;
      transformRef.current.y = panStartRef.current.ty + dy;
      applyTransform();
    };
    const onUp = () => {
      isPanningRef.current = false;
      capturedId = null;
      host.style.cursor = "crosshair";
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    return () => { host.removeEventListener("pointerdown", onDown); host.removeEventListener("pointermove", onMove); host.removeEventListener("pointerup", onUp); };
  }, [applyTransform]);

  useEffect(() => {
    const host = wrapRef.current; if (!host) return;
    host.innerHTML = svgText;
    const svg = host.querySelector("svg"); if (!svg) return;
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.display = "block";
    svg.style.transformOrigin = "0 0";
    countyFingerprintsRef.current = new Map();
    const shapes = Array.from(svg.querySelectorAll("path, polygon")) as SVGGraphicsElement[];
    shapes.forEach((shape) => {
      const key = getRegionKeyFromElement(shape); if (!key) return;
      const prettyKey = titleCaseKey(key);
      shape.style.pointerEvents = "all"; shape.style.cursor = "crosshair";
      shape.style.stroke = "#0a0f1e"; shape.style.strokeWidth = "0.8";
      shape.style.transition = "fill 420ms ease, filter 300ms ease, stroke 200ms ease, stroke-width 200ms ease";

      const onMove = (ev: PointerEvent) => {
        if (isPanningRef.current) return; // dragging — no tooltip
        const currentRR = regionMap.get(key);
        const tw = 320, th = 280, p = 12, offset = 14;
        const rect = host.getBoundingClientRect();
        const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
        let x = px + offset, y = py + offset;
        if (x + tw > rect.width - p) x = px - tw - offset;
        if (y + th > rect.height - p) y = py - th - offset;
        x = Math.max(p, Math.min(rect.width - tw - p, x)); y = Math.max(p, Math.min(rect.height - th - p, y));
        const pct = typeof currentRR?.region?.percent_reporting === "number" ? currentRR.region.percent_reporting : typeof currentRR?.percent_reporting === "number" ? currentRR.percent_reporting : null;
        const lines = currentRR ? buildTooltipLines(currentRR) : [];
        const hasVotes = lines.some((l) => l.votes !== null && l.votes > 0);
        setTooltip({
          show: true, x, y,
          title: currentRR?.region?.name ?? (currentRR?.name ? titleCaseKey(currentRR.name) : prettyKey),
          reporting: pct !== null ? `${pct.toFixed(1)}% REPORTING` : "0% REPORTING",
          reportingPct: pct ?? 0,
          lines: hasVotes ? lines : [],
        });
      };
      const onEnter = (ev: PointerEvent) => {
        if (isPanningRef.current) return;
        shape.style.stroke = "rgba(255,255,255,0.9)"; shape.style.strokeWidth = "2.0"; shape.style.filter = "brightness(1.22) saturate(1.1)";
        onMove(ev);
      };
      const onLeave = () => {
        shape.style.stroke = "#0a0f1e"; shape.style.strokeWidth = "0.8"; shape.style.filter = "";
        setTooltip((t) => ({ ...t, show: false }));
      };
      shape.addEventListener("pointerenter", onEnter); shape.addEventListener("pointermove", onMove); shape.addEventListener("pointerleave", onLeave);

      const currentRR = regionMap.get(key);
      const fill = currentRR ? countyFill(currentRR) : null;
      shape.style.opacity = "0";
      requestAnimationFrame(() => {
        shape.style.fill = fill || "rgba(255,255,255,0.04)"; shape.style.opacity = "1";
        if (currentRR) {
          const fp = countyFingerprint(currentRR);
          const prevFp = countyFingerprintsRef.current.get(key);
          if (prevFp === undefined) { shape.classList.add("county-pop"); setTimeout(() => shape.classList.remove("county-pop"), 520); }
          countyFingerprintsRef.current.set(key, fp);
          countyVoteTotalsRef.current.set(key, countyTotalVotes(currentRR));
        }
      });
    });
  }, [svgText, regionMap]); // eslint-disable-line

  useEffect(() => {
    const host = wrapRef.current; if (!host) return;
    const svg = host.querySelector("svg"); if (!svg) return;
    const shapes = Array.from(svg.querySelectorAll("path, polygon")) as SVGGraphicsElement[];
    shapes.forEach((shape) => {
      const key = getRegionKeyFromElement(shape); if (!key) return;
      const currentRR = regionMap.get(key); if (!currentRR) return;
      const fill = countyFill(currentRR); if (fill) shape.style.fill = fill;
      const fp = countyFingerprint(currentRR);
      const prevFp = countyFingerprintsRef.current.get(key);
      const newTotal = countyTotalVotes(currentRR);
      const prevTotal = countyVoteTotalsRef.current.get(key) ?? 0;
      const votesGrew = newTotal > prevTotal;
      if (prevFp !== undefined && fp !== prevFp) {
        if (votesGrew) { flashCounty(shape); } else { shape.classList.add("county-pop"); setTimeout(() => shape.classList.remove("county-pop"), 520); }
      }
      countyFingerprintsRef.current.set(key, fp);
      countyVoteTotalsRef.current.set(key, newTotal);
    });
  }, [regionMap, flashCounty]);

  return (
    <div className="relative h-full" style={{ overflow: "hidden" }}>
      <div ref={wrapRef} className="w-full h-full [&_svg]:w-full [&_svg]:h-full" style={{ display: "flex", alignItems: "stretch", cursor: "crosshair" }} />
      {/* Zoom controls */}
      <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", flexDirection: "column", gap: 4, zIndex: 40 }}>
        <button onClick={toggleLock} title={locked ? "Unlock zoom" : "Lock zoom"} style={{ width: 28, height: 28, background: locked ? "rgba(245,158,11,0.15)" : "rgba(10,15,30,0.85)", border: `1px solid ${locked ? "#f59e0b" : "rgba(255,255,255,0.15)"}`, color: locked ? "#f59e0b" : "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "5px" }}>
          {locked
            ? <svg height="12" strokeLinejoin="round" viewBox="0 0 16 16" width="12" style={{color:"currentColor", display:"block"}}><path fillRule="evenodd" clipRule="evenodd" d="M9.5 6V7H6.5V6C6.5 5.17157 7.17157 4.5 8 4.5C8.82843 4.5 9.5 5.17157 9.5 6ZM5 7V6C5 4.34315 6.34315 3 8 3C9.65685 3 11 4.34315 11 6V7H12V11.5C12 12.3284 11.3284 13 10.5 13H5.5C4.67157 13 4 12.3284 4 11.5V7H5Z" fill="currentColor"/></svg>
            : <svg height="12" strokeLinejoin="round" viewBox="0 0 16 16" width="12" style={{color:"currentColor", display:"block"}}><path fillRule="evenodd" clipRule="evenodd" d="M13.5 7V6C13.5 5.17157 12.8284 4.5 12 4.5C11.1716 4.5 10.5 5.17157 10.5 6V7H12V8.5V9V11.5C12 12.3284 11.3284 13 10.5 13H5.5C4.67157 13 4 12.3284 4 11.5V7H9V6C9 4.34315 10.3431 3 12 3C13.6569 3 15 4.34315 15 6V7H13.5Z" fill="currentColor"/></svg>
          }
        </button>
        {!locked && <button onClick={() => { const host = wrapRef.current; if (!host) return; const rect = host.getBoundingClientRect(); const cx = rect.width / 2, cy = rect.height / 2; const { scale: s, x, y } = transformRef.current; const ns = Math.min(8, s * 1.4); transformRef.current = { scale: ns, x: cx - (cx - x) * (ns / s), y: cy - (cy - y) * (ns / s) }; setScale(ns); applyTransform(); }} style={{ width: 28, height: 28, background: "rgba(10,15,30,0.85)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)", fontWeight: 700 }}>+</button>}
        {!locked && <button onClick={() => { const host = wrapRef.current; if (!host) return; const rect = host.getBoundingClientRect(); const cx = rect.width / 2, cy = rect.height / 2; const { scale: s, x, y } = transformRef.current; const ns = Math.max(1, s / 1.4); if (ns <= 1) { resetZoom(); return; } transformRef.current = { scale: ns, x: cx - (cx - x) * (ns / s), y: cy - (cy - y) * (ns / s) }; setScale(ns); applyTransform(); }} style={{ width: 28, height: 28, background: "rgba(10,15,30,0.85)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)", fontWeight: 700 }}>−</button>}
        {!locked && scale > 1 && <button onClick={resetZoom} style={{ width: 28, height: 28, background: "rgba(10,15,30,0.85)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", fontSize: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)", fontWeight: 700, letterSpacing: "0.05em" }}>RST</button>}
      </div>
      {tooltip.show && (
        <div className="res-map-tooltip absolute z-50 pointer-events-none w-[320px]" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="res-tri-stripe" style={{ height: "2px" }} />
          <div className="p-3">
            <div className="flex items-baseline justify-between mb-1">
              <div className="res-tooltip-title">{tooltip.title}</div>
              <div className="res-badge res-badge-purple">COUNTY</div>
            </div>
            <div className="res-reporting-row"><span className="res-note">{tooltip.reporting}</span></div>
            <div className="res-bar-track mt-1" style={{ height: "2px" }}><div className="res-bar-fill" style={{ width: `${tooltip.reportingPct}%`, background: "var(--purple)", height: "2px" }} /></div>
            <div className="mt-3 border-t pt-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              {tooltip.lines.length > 0 ? (
                <>
                  <div className="grid grid-cols-[1fr_72px_52px] gap-1 pb-1 mb-1 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                    {["CANDIDATE", "VOTES", "PCT"].map((h) => (<div key={h} className={`res-th ${h !== "CANDIDATE" ? "text-right" : ""}`}>{h}</div>))}
                  </div>
                  {tooltip.lines.map((c, i) => (
                    <div key={i} className="grid grid-cols-[1fr_72px_52px] items-center gap-1 py-1.5 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: c.color || "rgba(255,255,255,0.35)" }} />
                        <div className="min-w-0"><div className="res-cand-name truncate">{c.name}{c.winner ? " ✓" : ""}</div><div className="res-cand-party">{c.party}</div></div>
                      </div>
                      <div className="text-right res-num">{c.votes?.toLocaleString() ?? "—"}</div>
                      <div className="text-right res-pct-big">{c.pct !== null ? `${c.pct.toFixed(1)}%` : "—"}</div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="py-5 flex flex-col items-center gap-2">
                  <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.20)" strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="8.5" stroke="rgba(255,255,255,0.30)" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.8" fill="rgba(255,255,255,0.30)"/></svg>
                  </div>
                  <div className="res-note" style={{ color: "rgba(255,255,255,0.30)", letterSpacing: "0.18em" }}>NO RESULTS YET</div>
                  {(tooltip.reportingPct ?? 0) === 0 && <div className="res-note" style={{ color: "rgba(255,255,255,0.15)", fontSize: "7.5px" }}>AWAITING FIRST RETURNS</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CANDIDATE LIST ──────────────────────────────────────────────────────────
function CandidateList({ candidates, reporting, raceId, isMajorityRunoff }: { candidates: RaceCandidate[]; reporting: number; raceId?: number; isMajorityRunoff?: boolean }) {
  const defaults = raceId ? RACE_FORECAST_DEFAULTS[raceId] : undefined;
  const ordered = useMemo(() => sortCandidatesByPollData(candidates, defaults?.pollAvg), [candidates, defaults?.pollAvg]);
  return (
    <div className="space-y-2">
      <div className="res-candidate-list">
        {ordered.map((c, idx) => {
          const isLeading = idx === 0 && !c.winner;
          return (
            <div key={`${c.name}-${c.party}`} className="res-candidate-row">
              <div className="res-cand-bar" style={{ background: c.color || "rgba(255,255,255,0.2)" }} />
              <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="res-cand-dot" style={{ background: c.color || "rgba(255,255,255,0.35)", boxShadow: `0 0 10px ${c.color || "rgba(255,255,255,0.2)"}40` }} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="res-cand-name-lg">{c.name}</span>
                      {c.winner && !isMajorityRunoff && <span className="res-badge res-badge-win">✓ WINNER</span>}
                      {c.winner && isMajorityRunoff && <span className="res-badge" style={{ borderColor: "rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.08)", color: "#f59e0b" }}>RUNOFF</span>}
                      {isLeading && !c.winner && <span className="res-badge res-badge-purple">LEADING</span>}
                    </div>
                    <div className="res-cand-party">{c.party} · {c.votes.toLocaleString()} votes</div>
                  </div>
                </div>
                <div className="res-pct-topline shrink-0">{fmtPct(c.percent)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── COUNTY TABLE ────────────────────────────────────────────────────────────
function CountyTotalsTable({ regionResults, collapsed, onToggle, maxHeight }: { regionResults: RegionResult[] | Record<string, RegionResult>; collapsed: boolean; onToggle: () => void; maxHeight?: string }) {
  const data = useMemo(() => {
    return coerceRegionResults(regionResults).map((rr) => {
      const candidates = buildTooltipLines(rr);
      const { absMargin } = computeCountyMargin(rr);
      const rawName = (rr as any)?.region?.name || (rr as any)?.name || "Unknown";
      return { name: titleCaseKey(rawName), reporting: rr?.region?.percent_reporting ?? (rr as any)?.percent_reporting ?? 0, candidates, margin: absMargin };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [regionResults]);

  const reportedCount = data.filter(d => d.reporting > 0).length;

  return (
    <div className="res-panel" style={{ overflow: "hidden" }}>
      {/* Clickable header with toggle */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "var(--background2)",
          border: "none",
          borderBottom: collapsed ? "none" : "1px solid var(--border)",
          cursor: "pointer",
          transition: "background 140ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="res-panel-tag">COUNTY BREAKDOWN</span>
          {data.length > 0 && (
            <span className="res-badge">
              {reportedCount}/{data.length} REPORTING
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="res-note" style={{ color: "rgba(255,255,255,0.25)" }}>
            {collapsed ? "SHOW TABLE" : "HIDE TABLE"}
          </span>
          {/* Chevron icon */}
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{
              transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 240ms cubic-bezier(0.22,1,0.36,1)",
              flexShrink: 0,
            }}
          >
            <path d="M2 4L6 8L10 4" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Collapsible content */}
      <div style={{
        overflow: collapsed ? "hidden" : "auto",
        maxHeight: collapsed ? "0px" : (maxHeight ?? "340px"),
        transition: "max-height 400ms cubic-bezier(0.22,1,0.36,1)",
      }}>
        {data.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            <span className="res-note" style={{ color: "rgba(255,255,255,0.2)" }}>NO COUNTY DATA</span>
          </div>
        ) : (
          <div style={{ overflowY: "auto" }}>
            <table className="w-full border-collapse">
              <thead className="res-thead">
                <tr>{["COUNTY / RPT", "CANDIDATES", "MARGIN"].map((h, i) => (<th key={h} className={`res-th px-4 py-2.5 ${i === 2 ? "text-right" : "text-left"}`}>{h}</th>))}</tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="res-table-row">
                    <td className="px-4 py-3 align-top" style={{ width: "160px" }}>
                      <div className="res-cand-name-lg">{row.name}</div>
                      <div className="res-bar-track mt-2" style={{ width: "80px", height: "2px" }}><div className="res-bar-fill" style={{ width: `${row.reporting}%`, background: "var(--purple)", height: "2px" }} /></div>
                      <div className="res-note mt-1">{row.reporting.toFixed(1)}% RPT</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                        {row.candidates.length > 0 ? row.candidates.slice(0, 4).map((cand, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 py-1 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                            <div className="flex items-center gap-2 min-w-0"><span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: cand.color || "rgba(255,255,255,0.35)" }} /><span className="res-note truncate">{cand.name}</span></div>
                            <span className="res-cand-name shrink-0">{cand.pct !== null ? `${cand.pct.toFixed(1)}%` : "—"}</span>
                          </div>
                        )) : <span className="res-note italic">Awaiting…</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      {row.margin !== null ? (<><div className="res-pct-xl">{row.margin >= 0 ? "+" : ""}{row.margin.toFixed(1)}%</div><div className="res-note">SPREAD</div></>) : <span className="res-note">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LEGEND ──────────────────────────────────────────────────────────────────
function Legend() {
  const stops: Array<[string, string]> = [["TIED", "#888"], ["TILT", "#aaa"], ["LEAN", "#bbb"], ["LIKELY", "#ccc"], ["SAFE", "#ddd"]];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="res-note mr-1">SHADE</span>
      {stops.map(([label]) => (<span key={label} className="res-badge">{label}</span>))}
    </div>
  );
}

// ─── SWING-O-METER ────────────────────────────────────────────────────────────
function SwingOMeter({ candidates, colors, probabilities, raceRule, reportingPct }: {
  candidates: [string, string, string, string]; colors: [string, string, string, string];
  probabilities: { c1: number; c2: number; c3: number }; raceRule: "PLURALITY" | "MAJORITY"; reportingPct: number;
}) {
  const W = 280, H = 160, CX = W / 2, CY = H - 20;
  const R_OUTER = 110, R_INNER = 68;

  const othersProb = Math.max(0, 1 - probabilities.c1 - probabilities.c2 - probabilities.c3);
  const showC3 = probabilities.c3 > 0.01;
  const showOthers = othersProb > 0.01;

  const segments = [
    { key: "c1", prob: probabilities.c1, color: colors[0], name: candidates[0] },
    { key: "c2", prob: probabilities.c2, color: colors[1], name: candidates[1] },
    ...(showC3 ? [{ key: "c3", prob: probabilities.c3, color: colors[2], name: candidates[2] }] : []),
    ...(showOthers ? [{ key: "others", prob: othersProb, color: raceRule === "MAJORITY" ? "#c0392b" : colors[3], name: raceRule === "MAJORITY" ? "RUNOFF" : "Others" }] : []),
  ];

  const total = segments.reduce((s, seg) => s + seg.prob, 0) || 1;

  function polarToXY(angleDeg: number, r: number) {
    const rad = (angleDeg - 180) * (Math.PI / 180);
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  }
  function describeArc(startDeg: number, endDeg: number, rOuter: number, rInner: number) {
    const s = polarToXY(startDeg, rOuter), e = polarToXY(endDeg, rOuter);
    const si = polarToXY(endDeg, rInner), ei = polarToXY(startDeg, rInner);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${e.x} ${e.y} L ${si.x} ${si.y} A ${rInner} ${rInner} 0 ${large} 0 ${ei.x} ${ei.y} Z`;
  }

  let cursor = 0;
  const arcSegments = segments.map((seg) => {
    const span = (seg.prob / total) * 180;
    const start = cursor;
    const end = cursor + span;
    cursor = end;
    const midDeg = start + span / 2;
    const midPt = polarToXY(midDeg, (R_OUTER + R_INNER) / 2);
    return { ...seg, start, end, midPt };
  });

  const leader = segments.reduce((a, b) => (b.prob > a.prob ? b : a), segments[0]);

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <path d={describeArc(0, 180, R_OUTER, R_INNER)} fill="rgba(255,255,255,0.04)" />
        {arcSegments.map((seg) => (
          <g key={seg.key}>
            <path d={describeArc(seg.start + 0.8, seg.end - 0.8, R_OUTER, R_INNER)} fill={seg.color} opacity={0.85} />
            {(seg.end - seg.start) > 20 && (
              <text x={seg.midPt.x} y={seg.midPt.y + 3} textAnchor="middle" fontSize="7" fontWeight="700" fill="rgba(255,255,255,0.85)" fontFamily="var(--font-body)" letterSpacing="0.5">
                {(seg.prob * 100).toFixed(0)}%
              </text>
            )}
          </g>
        ))}
        <text x={CX} y={CY - 22} textAnchor="middle" fontSize="20" fontWeight="900" fill="white" fontFamily="var(--font-body)" letterSpacing="-0.5">
          {(leader.prob * 100).toFixed(1)}%
        </text>
        <text x={CX} y={CY - 8} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.45)" fontFamily="var(--font-body)" letterSpacing="1">
          {leader.name.split(" ").pop()?.toUpperCase()}
        </text>
        <circle cx={CX} cy={CY} r="5" fill="rgba(255,255,255,0.15)" />
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 6, justifyContent: "center" }}>
        {arcSegments.map((seg) => (
          <div key={seg.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-body)", fontSize: "8px", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>{seg.name.split(" ").pop()}</span>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 900, color: seg.color }}>{(seg.prob * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, padding: "6px 0 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>REPORTING</span>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>{reportingPct.toFixed(1)}%</span>
        </div>
        <div style={{ height: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${reportingPct}%`, background: "rgba(255,255,255,0.30)", transition: "width 800ms ease" }} />
        </div>
      </div>
    </div>
  );
}

// ─── FORECAST PANEL TYPES ────────────────────────────────────────────────────
interface ForecastCivicCandidate { name: string; party: string; color: string; votes: number; percent: number; winner: boolean; }
interface ForecastHistoryTimestamp { timestamp: string; }
interface ForecastHistoryList { id: number; count: number; timestamps: ForecastHistoryTimestamp[]; }
interface ForecastResponse { forecast: ForecastOutput; race: { election_name: string; election_date: string; percent_reporting: number; candidates: ForecastCivicCandidate[]; }; }
const FORECAST_CANDIDATE_KEYS = ["Candidate1", "Candidate2", "Candidate3", "Others"] as const;
type FCKey = (typeof FORECAST_CANDIDATE_KEYS)[number];
function fcastPct(n: number, decimals = 1) { return (n * 100).toFixed(decimals) + "%"; }
function fcastFmt(n: number) { return n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }
function fcastShortDate(ts: string) { return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function getTimestamps(hl: ForecastHistoryList | null): ForecastHistoryTimestamp[] { return hl?.timestamps ?? []; }

// ─── FORECAST PANEL ───────────────────────────────────────────────────────────
function ForecastPanel({ raceId, refreshTick, raceData, onForecastUpdate }: { raceId: number; refreshTick: number; raceData?: RaceDetail; onForecastUpdate?: (leader: string, prob: number) => void }) {
  const defaults = RACE_FORECAST_DEFAULTS[raceId];
  const TX_RACE_IDS = [44285, 44286, 44287, 44288, 44289, 44290, 44291, 44292, 44293, 44294, 44295];
  const [raceRule, setRaceRule] = useState<RaceRule>(() => TX_RACE_IDS.includes(raceId) ? "MAJORITY" : (defaults?.raceRule ?? "PLURALITY"));
  const [expectedTurnoutOverride, setExpectedTurnoutOverride] = useState(defaults?.expectedTurnout ? String(defaults.expectedTurnout) : "");
  const [historyList, setHistoryList] = useState<ForecastHistoryList | null>(null);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const raceDataRef = useRef<RaceDetail | undefined>(raceData);
  useEffect(() => { raceDataRef.current = raceData; }, [raceData]);
  const raceIdRef = useRef(raceId); const raceRuleRef = useRef(raceRule); const turnoutRef = useRef(expectedTurnoutOverride);
  const playingRef = useRef(playing); const historyListRef = useRef<ForecastHistoryList | null>(null); const historyIndexRef = useRef(historyIndex);
  useEffect(() => { raceIdRef.current = raceId; }, [raceId]);
  useEffect(() => { raceRuleRef.current = raceRule; }, [raceRule]);
  useEffect(() => { turnoutRef.current = expectedTurnoutOverride; }, [expectedTurnoutOverride]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { historyListRef.current = historyList; }, [historyList]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);
  const timestamps = useMemo(() => getTimestamps(historyList).map((t) => t.timestamp), [historyList]);

  const runForecastLive = useCallback(async (id: number, rule?: RaceRule, turnout?: string) => {
    setLoadingForecast(true); setError(null);
    try {
      const res = await fetch("/api/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(raceDataRef.current ? { type: "civic_raw", raceData: raceDataRef.current } : { type: "civic", raceId: String(id) }), race_rule: rule ?? raceRuleRef.current, expected_turnout: (turnout ?? turnoutRef.current) ? Number(turnout ?? turnoutRef.current) : undefined, poll_avg: RACE_FORECAST_DEFAULTS[id]?.pollAvg }) });
      const data = await res.json();
      if (raceIdRef.current !== id) return;
      if (data.error) throw new Error(data.details ?? data.error);
      setForecast(data);
      if (onForecastUpdate && data.forecast) {
        const src = data.forecast.majority_win_prob ?? data.forecast.plurality_odds_to_win;
        const names = data.forecast.candidate_names ?? [];
        const keys = ["Candidate1","Candidate2","Candidate3"] as const;
        const best = keys.reduce((a,b) => ((src[b]??0) > (src[a]??0) ? b : a), "Candidate1" as typeof keys[number]);
        onForecastUpdate(names[keys.indexOf(best)] ?? "", (src[best] ?? 0) * 100);
      }
    } catch (e: any) { if (raceIdRef.current === id) setError(e.message); }
    finally { if (raceIdRef.current === id) setLoadingForecast(false); }
  }, []);

  const runForecastAtIndex = useCallback(async (id: number, tsList: ForecastHistoryTimestamp[], idx: number, rule?: RaceRule, turnout?: string) => {
    if (!tsList.length) return runForecastLive(id, rule, turnout);
    setLoadingForecast(true); setError(null);
    try {
      const timestamp = tsList[idx].timestamp; const priorTimestamp = idx > 0 ? tsList[0].timestamp : undefined;
      const res = await fetch("/api/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "civic_history", raceId: String(id), timestamp, priorTimestamp, race_rule: rule ?? raceRuleRef.current, expected_turnout: (turnout ?? turnoutRef.current) ? Number(turnout ?? turnoutRef.current) : undefined, poll_avg: RACE_FORECAST_DEFAULTS[id]?.pollAvg }) });
      const data = await res.json();
      if (raceIdRef.current !== id) return;
      if (data.error) throw new Error(data.details ?? data.error);
      setForecast(data);
    } catch (e: any) { if (raceIdRef.current === id) setError(e.message); }
    finally { if (raceIdRef.current === id) setLoadingForecast(false); }
  }, [runForecastLive]);

  useEffect(() => {
    const d = RACE_FORECAST_DEFAULTS[raceId];
    const newRule: RaceRule = TX_RACE_IDS.includes(raceId) ? "MAJORITY" : (d?.raceRule ?? "PLURALITY");
    const newTurnout = d?.expectedTurnout ? String(d.expectedTurnout) : "";
    setRaceRule(newRule); setExpectedTurnoutOverride(newTurnout);
    raceRuleRef.current = newRule; turnoutRef.current = newTurnout;
    setForecast(null); setHistoryList(null); historyListRef.current = null;
    setHistoryIndex(0); historyIndexRef.current = 0;
    setPlaying(false); setError(null); setLoadingHistory(false);
    let cancelled = false;
    // HISTORY DISABLED — skip timestamp fetch, go straight to live
    // (async () => {
    //   try {
    //     const res = await fetch(`/api/forecast?action=timestamps&raceId=${raceId}`);
    //     const data: ForecastHistoryList = await res.json();
    //     if (cancelled) return;
    //     setHistoryList(data); historyListRef.current = data;
    //     const tsList = getTimestamps(data);
    //     if (tsList.length > 0) { const last = tsList.length - 1; setHistoryIndex(last); historyIndexRef.current = last; await runForecastAtIndex(raceId, tsList, last, newRule, newTurnout); }
    //     else { await runForecastLive(raceId, newRule, newTurnout); }
    //   } catch (e: any) { if (!cancelled) setError(e.message); }
    //   finally { if (!cancelled) setLoadingHistory(false); }
    // })();
    (async () => {
      try { await runForecastLive(raceId, newRule, newTurnout); }
      catch (e: any) { if (!cancelled) setError(e.message); }
    })();
    return () => { cancelled = true; };
  }, [raceId]); // eslint-disable-line

  const prevTickRef = useRef(0);
  useEffect(() => {
    if (refreshTick === 0 || refreshTick === prevTickRef.current) return;
    prevTickRef.current = refreshTick;
    if (playingRef.current) return;
    runForecastLive(raceIdRef.current);
  }, [refreshTick]); // eslint-disable-line

  const isFirstOptionsRender = useRef(true);
  useEffect(() => {
    if (isFirstOptionsRender.current) { isFirstOptionsRender.current = false; return; }
    const timer = setTimeout(() => { const id = raceIdRef.current; /* HISTORY DISABLED */ runForecastLive(id); }, 400);
    return () => clearTimeout(timer);
  }, [raceRule, expectedTurnoutOverride]); // eslint-disable-line
  useEffect(() => { isFirstOptionsRender.current = true; }, [raceId]);

  useEffect(() => {
    if (playing && timestamps.length > 1) {
      playRef.current = setInterval(() => { setHistoryIndex((prev) => { const next = prev + 1; if (next >= timestamps.length) { setPlaying(false); return prev; } historyIndexRef.current = next; const hl = historyListRef.current; if (hl) runForecastAtIndex(raceIdRef.current, hl.timestamps, next); return next; }); }, 1800);
    } else { if (playRef.current) clearInterval(playRef.current); }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, timestamps.length]); // eslint-disable-line

  const candidateLabels: Record<FCKey, string> = useMemo(() => {
    const names = forecast?.forecast.candidate_names ?? ["Candidate 1", "Candidate 2", "Candidate 3", "Others"];
    return { Candidate1: names[0], Candidate2: names[1], Candidate3: names[2], Others: raceRule === "MAJORITY" ? "Runoff" : names[3] };
  }, [forecast]);

  const formatCandidateName = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return <>{name}</>;
    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(" ");
    return <>{first}<br />{last}</>;
  };
  const candidateColors: Record<FCKey, string> = useMemo(() => { const colors = forecast?.forecast.candidate_colors ?? ["#3b82f6", "#ef4444", "#22c55e", "#94a3b8"]; return { Candidate1: colors[0], Candidate2: colors[1], Candidate3: colors[2], Others: raceRule === "MAJORITY" ? "#c0392b" : colors[3] }; }, [forecast, raceRule]);
  const isLoading = loadingHistory || loadingForecast;
  const swingoProbs = useMemo(() => { if (!forecast) return { c1: 0.5, c2: 0.5, c3: 0 }; const f = forecast.forecast; const src = raceRule === "PLURALITY" ? f.plurality_odds_to_win : f.majority_win_prob; return { c1: src.Candidate1, c2: src.Candidate2, c3: src.Candidate3 }; }, [forecast, raceRule]);

  return (
    <div className="res-panel" style={{ padding: 0 }}>
      <div className="res-tri-stripe" />
      <div className="res-panel-header" style={{ flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="res-panel-tag">FORECAST MODEL</span>
          {/* FORECAST BETA badge */}
          <span style={{
            display: "inline-flex", alignItems: "center", padding: "2px 6px",
            border: "1px solid rgba(124,58,237,0.45)", background: "rgba(124,58,237,0.10)",
            fontFamily: "var(--font-body)", fontSize: "6.5px", fontWeight: 700,
            letterSpacing: "0.16em", color: "var(--purple-soft)",
          }}>FORECAST β</span>
          {isLoading && <span className="res-badge res-badge-purple" style={{ fontSize: "7px" }}><span className="res-live-dot" style={{ background: "var(--purple)", width: 4, height: 4 }} />UPDATING</span>}
          {!isLoading && forecast && <span className="res-badge" style={{ fontSize: "7px", color: "rgba(255,255,255,0.25)" }}>AUTO / 30s</span>}
        </div>
        <button className="res-btn-ghost" style={{ padding: "3px 8px", fontSize: "7px" }} onClick={() => setShowOptions((v) => !v)}>{showOptions ? "HIDE OPTIONS" : "OPTIONS"}</button>
      </div>
      {showOptions && (
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--background2)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div><div className="res-note" style={{ marginBottom: 5 }}>RACE RULE</div><select value={raceRule} onChange={(e) => setRaceRule(e.target.value as RaceRule)} className="res-select" style={{ width: "100%" }}><option value="PLURALITY">Plurality</option><option value="MAJORITY">Majority / Runoff</option></select></div>
          <div><div className="res-note" style={{ marginBottom: 5 }}>EXPECTED TURNOUT (OPTIONAL)</div><input type="number" placeholder="e.g. 5000000" value={expectedTurnoutOverride} onChange={(e) => setExpectedTurnoutOverride(e.target.value)} className="res-input" /></div>
          <button className="res-btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={isLoading} onClick={() => { runForecastLive(raceIdRef.current); /* HISTORY DISABLED */ }}>{isLoading ? "RUNNING…" : "RERUN FORECAST"}</button>
        </div>
      )}
      <div className="res-forecast-body" style={{ padding: "14px 16px" }}>
        {error && <div style={{ border: "1px solid rgba(230,57,70,0.25)", background: "rgba(230,57,70,0.06)", color: "rgba(255,77,90,0.90)", padding: "8px 10px", fontFamily: "var(--font-body)", fontSize: "9.5px", letterSpacing: "0.10em", marginBottom: 12 }}>⚠ {error}</div>}
        {isLoading && !forecast && (
          <div style={{ padding: "36px 0", textAlign: "center" }}>
            <div className="res-note" style={{ color: "var(--purple-soft)", marginBottom: 10 }}>RUNNING FORECAST MODEL…</div>
            <div className="res-bar-track" style={{ width: "80%", margin: "0 auto" }}><div className="res-bar-fill" style={{ width: "60%", background: "linear-gradient(90deg,var(--purple),var(--blue2))", animation: "res-loading-pulse 1.4s ease-in-out infinite" }} /></div>
          </div>
        )}
        {forecast && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span className="res-note" style={{ color: "rgba(255,255,255,0.3)" }}>{forecast.race.percent_reporting}% REPORTING</span>
              <span className={`res-badge ${raceRule === "MAJORITY" ? "res-badge-purple" : "res-badge-red"}`}>{raceRule === "MAJORITY" ? "MAJORITY" : forecast.forecast.mode_trigger}</span>
            </div>
            <div style={{ marginBottom: 16, padding: "14px 12px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>WIN PROBABILITY · {raceRule === "PLURALITY" ? "MOST VOTES" : "MAJORITY ≥50%"}</div>
              <SwingOMeter candidates={forecast.forecast.candidate_names ?? ["C1", "C2", "C3", "Others"]} colors={forecast.forecast.candidate_colors ?? ["#3b82f6", "#ef4444", "#22c55e", "#94a3b8"]} probabilities={swingoProbs} raceRule={raceRule} reportingPct={forecast.race.percent_reporting} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: forecast.forecast.modeled_share["Candidate3"] > 0.005 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 6, marginBottom: 14 }}>
              {(["Candidate1", "Candidate2", "Candidate3"] as const).filter(k => k !== "Candidate3" || forecast.forecast.modeled_share["Candidate3"] > 0.005).map((key) => {
                const color = candidateColors[key], share = forecast.forecast.modeled_share[key], votes = forecast.forecast.modeled_votes[key], isLeader = forecast.forecast.leader === key;
                return (
                  <div key={key} style={{ padding: "10px 10px 8px", background: "rgba(255,255,255,0.025)", border: `1px solid ${isLeader ? color + "44" : "rgba(255,255,255,0.06)"}` }}>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: color + "cc", marginBottom: 4, lineHeight: 1.4 }}>{formatCandidateName(candidateLabels[key])}</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "clamp(17px, 1.8vw, 22px)", fontWeight: 900, color, lineHeight: 1 }}>{fcastPct(share)}</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "7.5px", letterSpacing: "0.10em", color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{fcastFmt(votes)} PROJ</div>
                    {isLeader && <div style={{ marginTop: 6, fontSize: "5.5px", color, fontWeight: 700, fontFamily: "var(--font-body)", letterSpacing: "0.16em", textTransform: "uppercase", border: `1px solid ${color}55`, padding: "1px 4px", display: "inline-block" }}>LEADER</div>}
                  </div>
                );
              })}
            </div>
            {raceRule === "MAJORITY" && (
              <div style={{ marginBottom: 14, padding: "10px 12px", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)" }}>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(245,158,11,0.7)", marginBottom: 8 }}>RUNOFF PROBABILITY</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}><span style={{ fontFamily: "var(--font-body)", fontSize: "7.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>Runoff needed</span><span style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 900, color: "#f59e0b" }}>{fcastPct(forecast.forecast.runoff_needed_prob)}</span></div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 8 }}><div style={{ height: "100%", width: fcastPct(Math.min(forecast.forecast.runoff_needed_prob, 1)), background: "#f59e0b", transition: "width 600ms ease" }} /></div>
                {FORECAST_CANDIDATE_KEYS.map(k => forecast.forecast.runoff_prob[k] > 0.005 ? (
                  <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: candidateColors[k], display: "inline-block" }} /><span style={{ fontFamily: "var(--font-body)", fontSize: "8px", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>{candidateLabels[k]}</span></div>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, color: candidateColors[k] }}>{fcastPct(forecast.forecast.runoff_prob[k])}</span>
                  </div>
                ) : null)}
              </div>
            )}
            <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 14 }}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>MODEL STATISTICS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
                {[["TOTAL", fcastFmt(forecast.forecast.modeled_total_vote)], ["REMAINING", fcastFmt(forecast.forecast.modeled_vote_remaining)], ["MARGIN", `${fcastFmt(forecast.forecast.projected_margin_votes)} (${fcastPct(forecast.forecast.projected_margin_pct)})`], ["STD DEV", fcastFmt(forecast.forecast.sd_race)]].map(([label, val]) => (
                  <div key={label} style={{ paddingBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "6.5px", fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.70)" }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
            {timestamps.length > 1 && (
              <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>HISTORICAL PLAYBACK</div>
                  <button className="res-btn-ghost" style={{ padding: "3px 9px", fontSize: "8px" }} onClick={() => { if (playing) { setPlaying(false); return; } if (historyIndex >= timestamps.length - 1) setHistoryIndex(0); setPlaying(true); }}>{playing ? "⏹ STOP" : "▶ PLAY"}</button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span className="res-note">{fcastShortDate(timestamps[0])}</span><span className="res-note">{fcastShortDate(timestamps[timestamps.length - 1])}</span></div>
                <input type="range" min={0} max={timestamps.length - 1} value={historyIndex} onChange={(e) => { const idx = Number(e.target.value); setHistoryIndex(idx); historyIndexRef.current = idx; const hl = historyListRef.current; if (hl) runForecastAtIndex(raceIdRef.current, hl.timestamps, idx); }} style={{ width: "100%", accentColor: "var(--purple)", height: "4px", cursor: "pointer" }} />
                <div className="res-note" style={{ textAlign: "center", marginTop: 6, color: "var(--purple-soft)" }}>{fcastShortDate(timestamps[historyIndex])} · {historyIndex + 1}/{timestamps.length}</div>
              </div>
            )}
            {timestamps.length === 0 && <div className="res-note" style={{ textAlign: "center", fontStyle: "italic", paddingTop: 4 }}>No history snapshots — live data only</div>}
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RACE PICKER PANEL (replaces old tab bar) ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function RaceScrollWindow({ races, raceCache, selectedId, onSelect, search, onSearchChange, maxHeight }: {
  races: FeaturedRace[]; raceCache: Record<number, RaceDetail | undefined>; selectedId: number;
  onSelect: (id: number) => void; search: string; onSearchChange: (v: string) => void; maxHeight?: number;
}) {
  const filtered = races.filter(r => !search || r.office.toLowerCase().includes(search.toLowerCase()) || r.party.toLowerCase().includes(search.toLowerCase()));
  const groups = filtered.reduce<{ office: string; races: FeaturedRace[] }[]>((acc, r) => {
    const last = acc[acc.length - 1];
    if (last && last.office === r.office) last.races.push(r);
    else acc.push({ office: r.office, races: [r] });
    return acc;
  }, []);
  return (
    <>
      <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", background: "var(--background2)", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}>
          <circle cx="6.5" cy="6.5" r="5" stroke="white" strokeWidth="1.5"/>
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input type="text" placeholder="Search races…" value={search} onChange={e => onSearchChange(e.target.value)}
          style={{ flex: 1, background: "none", border: "none", outline: "none", fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 600, letterSpacing: "0.06em", color: "var(--foreground)", caretColor: "var(--purple-soft)" }} />
        {search && <button onClick={() => onSearchChange("")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>}
      </div>
      <div style={{ overflowY: "auto", flex: 1, maxHeight: maxHeight }}>
        {groups.map(({ office, races: groupRaces }) => (
          <div key={office}>
            <div style={{ padding: "4px 10px 2px", fontFamily: "var(--font-body)", fontSize: "6px", fontWeight: 700, letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", borderTop: "1px solid rgba(255,255,255,0.04)", marginTop: 2 }}>{office}</div>
            {groupRaces.map(r => {
              const liveData = raceCache[r.id];
              const winner = liveData?.candidates?.find(c => c.winner);
              const reporting = getRaceReportingPct(liveData);
              const isSelected = r.id === selectedId;
              const partyColor = r.party === "Republican" ? "var(--rep)" : r.party === "Democratic" ? "var(--dem)" : "rgba(255,255,255,0.4)";
              const partyShort = r.party === "Republican" ? "R" : "D";
              const hasForecast = !!RACE_FORECAST_DEFAULTS[r.id];
              return (
                <button key={r.id} onClick={() => onSelect(r.id)} style={{ display: "flex", alignItems: "center", width: "100%", padding: "6px 10px", background: isSelected ? "rgba(124,58,237,0.10)" : "transparent", border: "none", borderLeft: isSelected ? "2px solid var(--purple)" : "2px solid transparent", cursor: "pointer", textAlign: "left", transition: "background 100ms ease" }}>
                  <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 2, background: `${partyColor}22`, border: `1px solid ${partyColor}44`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, fontFamily: "var(--font-body)", fontSize: "6.5px", fontWeight: 900, color: partyColor }}>{partyShort}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "8.5px", fontWeight: isSelected ? 800 : 600, color: isSelected ? "#fff" : "rgba(255,255,255,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.party} Primary</span>
                      {hasForecast && <span style={{ flexShrink: 0, display: "inline-flex", padding: "0px 4px", border: "1px solid rgba(124,58,237,0.45)", background: "rgba(124,58,237,0.10)", fontFamily: "var(--font-body)", fontSize: "5px", fontWeight: 700, letterSpacing: "0.12em", color: "var(--purple-soft)" }}>FORECAST β</span>}
                    </div>
                    <div style={{ height: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${reporting ?? 0}%`, background: winner ? "var(--win)" : partyColor, opacity: 0.75, transition: "width 800ms ease" }} />
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 8 }}>
                    {winner ? <span style={{ fontFamily: "var(--font-body)", fontSize: "6px", fontWeight: 700, color: "var(--win)" }}>✓</span>
                      : <span style={{ fontFamily: "var(--font-body)", fontSize: "7.5px", fontWeight: 700, color: isSelected ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)" }}>{reporting !== null ? `${reporting.toFixed(0)}%` : "—"}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

function RacePickerPanel({ races, raceCache, selectedId, onSelect }: {
  races: FeaturedRace[];
  raceCache: Record<number, RaceDetail | undefined>;
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Group by office
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? races.filter(r => r.office.toLowerCase().includes(q) || r.party.toLowerCase().includes(q) || r.label.toLowerCase().includes(q))
      : races;
    const map = new Map<string, FeaturedRace[]>();
    for (const r of filtered) {
      const g = map.get(r.office) ?? [];
      g.push(r);
      map.set(r.office, g);
    }
    return Array.from(map.entries());
  }, [races, search]);

  // Keyboard shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "var(--panel)", border: "1px solid var(--border)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", background: "var(--background2)", flexShrink: 0 }}>
        <div className="res-panel-tag" style={{ marginBottom: 8 }}>ALL RACES</div>
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", padding: "6px 10px" }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
            <circle cx="6.5" cy="6.5" r="5" stroke="white" strokeWidth="1.5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter races…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 600, letterSpacing: "0.08em", color: "var(--foreground)", caretColor: "var(--purple-soft)" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0, fontSize: 11, lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>

      {/* Race list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {groups.length === 0 && (
          <div style={{ padding: "20px 12px", textAlign: "center" }}>
            <span className="res-note" style={{ color: "rgba(255,255,255,0.2)" }}>NO RACES FOUND</span>
          </div>
        )}
        {groups.map(([office, groupRaces]) => (
          <div key={office} style={{ marginBottom: 2 }}>
            {/* Office group header */}
            <div style={{
              padding: "5px 12px 3px",
              fontFamily: "var(--font-body)",
              fontSize: "6.5px",
              fontWeight: 700,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.18)",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              marginTop: 4,
            }}>
              {office}
            </div>
            {/* Race buttons */}
            {groupRaces.map(r => {
              const liveData = raceCache[r.id];
              const winner = liveData?.candidates?.find(c => c.winner);
              const reporting = getRaceReportingPct(liveData);
              const leader = liveData?.candidates ? [...liveData.candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0] : null;
              const isSelected = r.id === selectedId;
              const isRep = r.party === "Republican";
              const isDem = r.party === "Democratic";
              const partyColor = isRep ? "var(--rep)" : isDem ? "var(--dem)" : "rgba(255,255,255,0.4)";
              const partyShort = isRep ? "R" : isDem ? "D" : "—";

              return (
                <button
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    gap: 0,
                    padding: "7px 12px",
                    background: isSelected ? `rgba(124,58,237,0.10)` : "transparent",
                    border: "none",
                    borderLeft: isSelected ? "2px solid var(--purple)" : "2px solid transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 100ms ease, border-color 100ms ease",
                    position: "relative",
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  {/* Party color pill */}
                  <span style={{
                    flexShrink: 0,
                    width: 18,
                    height: 18,
                    borderRadius: 2,
                    background: partyColor + "22",
                    border: `1px solid ${partyColor}44`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 9,
                    fontFamily: "var(--font-body)",
                    fontSize: "7px",
                    fontWeight: 900,
                    color: partyColor,
                    letterSpacing: 0,
                  }}>{partyShort}</span>

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "9px",
                      fontWeight: isSelected ? 800 : 600,
                      letterSpacing: "0.04em",
                      color: isSelected ? "#fff" : "rgba(255,255,255,0.65)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginBottom: 3,
                    }}>
                      {r.party === "Republican" ? "Republican" : r.party === "Democratic" ? "Democratic" : r.party} Primary
                    </div>
                    {/* Reporting bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden", maxWidth: 60 }}>
                        <div style={{ height: "100%", width: `${reporting ?? 0}%`, background: winner ? "var(--win)" : partyColor, opacity: 0.8, transition: "width 800ms ease" }} />
                      </div>
                      {winner ? (
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "6.5px", fontWeight: 700, color: "var(--win)", letterSpacing: "0.12em" }}>✓ CALLED</span>
                      ) : leader && (reporting ?? 0) > 0 ? (
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "6.5px", fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>
                          {leader.name.split(" ").pop()} {fmtPct(leader.percent)}
                        </span>
                      ) : (
                        <span style={{ fontFamily: "var(--font-body)", fontSize: "6.5px", fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>
                          {reporting !== null ? `${reporting.toFixed(0)}% IN` : "PENDING"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Forecast badge */}
                  {RACE_FORECAST_DEFAULTS[r.id] && (
                    <span style={{
                      flexShrink: 0,
                      marginLeft: 4,
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "1px 5px",
                      border: "1px solid rgba(124,58,237,0.45)",
                      background: "rgba(124,58,237,0.10)",
                      fontFamily: "var(--font-body)",
                      fontSize: "5.5px",
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      color: "var(--purple-soft)",
                      whiteSpace: "nowrap",
                    }}>FORECAST β</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function March3FeaturedClient() {
  const [activeState, setActiveState] = useState<"TX" | "NC" | "AR" | "TEST">("TX");
  const [selectedId, setSelectedId] = useState<number>(44286);
  const [error, setError] = useState<string | null>(null);
  const [loadingMap, setLoadingMap] = useState(false);
  const [raceCache, setRaceCache] = useState<Record<number, RaceDetail | undefined>>({});
  const [mapBlankSvg, setMapBlankSvg] = useState<string | null>(null);
  const [mapLoadPct, setMapLoadPct] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [countyCollapsed, setCountyCollapsed] = useState(false);
  const [scrollWindowSearch, setScrollWindowSearch] = useState("");
  useEffect(() => { setNowMs(Date.now()); }, []);

  const [refreshTick, setRefreshTick] = useState(0);
  const [overlay, setOverlay] = useState<null | { id: number; name: string; prob: number; color: string; reporting: number }>(null);
  const lastProjectedKeyRef = useRef<string>("");

  const featuredByState = useMemo(() => ({
    TX: FEATURED.filter((r) => r.state === "TX"),
    NC: FEATURED.filter((r) => r.state === "NC"),
    AR: FEATURED.filter((r) => r.state === "AR"),
    TEST: FEATURED.filter((r) => r.state === "TEST"),
  }), []);

  const selectedRace = raceCache[selectedId];
  const selectedMeta = useMemo(() => FEATURED.find((r) => r.id === selectedId), [selectedId]);
  const hasForecastForSelected = !!RACE_FORECAST_DEFAULTS[selectedId];

  async function refreshFeatured() {
    try {
      const results = await Promise.all(FEATURED.map((r) => fetchRaceById(r.id).then((d) => [r.id, d] as const)));
      setRaceCache(Object.fromEntries(results));
      setRefreshTick((t) => t + 1);
    } catch (e: any) { setError(e?.message ?? "Error refreshing."); }
  }

  useEffect(() => { refreshFeatured(); const t = setInterval(refreshFeatured, POLL_MS); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setNowMs(Date.now()), 1000); return () => clearInterval(t); }, []);
  useLayoutEffect(() => { setLoadingMap(true); setMapBlankSvg(null); setMapLoadPct(0); }, [selectedId]);

  useEffect(() => {
    let cancelled = false, raf: number | null = null, interval: any = null;
    async function loadMap() {
      const start = performance.now();
      interval = setInterval(() => { const elapsed = performance.now() - start; const eased = Math.min(92, 10 + (elapsed / 1200) * 82); setMapLoadPct((p) => (p < eased ? eased : p)); }, 60);
      const svg = await fetchRaceMapBlankSvg(selectedId);
      if (cancelled) return;
      if (interval) clearInterval(interval);
      setMapBlankSvg(svg); setMapLoadPct(100);
      raf = requestAnimationFrame(() => { if (!cancelled) setLoadingMap(false); });
    }
    loadMap();
    return () => { cancelled = true; if (interval) clearInterval(interval); if (raf) cancelAnimationFrame(raf); };
  }, [selectedId]);

  useEffect(() => {
    const first = featuredByState[activeState]?.[0];
    if (first && !FEATURED.some((r) => r.id === selectedId && r.state === activeState)) setSelectedId(first.id);
  }, [activeState, featuredByState, selectedId]);

  useEffect(() => {
    const race = selectedRace; if (!race?.candidates?.length) return;
    const reporting = race.percent_reporting ?? 0;
    if (race.candidates.find((c) => c.winner)) return; if (reporting < 5) return;
    const ordered = [...race.candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
    if (ordered.length < 2) return;
    const leader = ordered[0], runnerUp = ordered[1];
    const prob = calculateWinProbability(leader.votes, runnerUp.votes, reporting);
    if (prob < 90) return;
    const key = `${selectedId}:${leader.name}:${Math.floor(prob)}:${Math.floor(reporting)}`;
    if (key === lastProjectedKeyRef.current) return;
    lastProjectedKeyRef.current = key;
    setOverlay({ id: selectedId, name: leader.name, prob, color: leader.color || "var(--purple-soft)", reporting });
    const t = setTimeout(() => setOverlay(null), 5200);
    return () => clearTimeout(t);
  }, [selectedRace, selectedId]);

  const stateLabels: Record<string, string> = { TX: "TEXAS", NC: "N. CAROLINA", AR: "ARKANSAS", TEST: "TEST" };
  const racesForState = featuredByState[activeState] ?? [];

  const selectedReporting = selectedRace?.percent_reporting ?? 0;
  const selectedCloseDate = parseIsoDate(selectedRace?.polls_close ?? null);
  const selectedCloseLocal = selectedCloseDate ? formatLocalCloseTime(selectedCloseDate) : "—";
  const selectedMsLeft = selectedCloseDate ? selectedCloseDate.getTime() - nowMs : null;
  const selectedProj = useMemo(() => {
    if (!selectedRace) return null;
    const reporting = selectedRace.percent_reporting ?? 0;
    if (reporting < 5) return null;
    return getRaceProjectionAlways(selectedRace);
  }, [selectedRace]);
  const selectedWinner = selectedRace?.candidates?.find((c) => c.winner);
  const selectedRaceIsMajority = RACE_FORECAST_DEFAULTS[selectedId]?.raceRule === "MAJORITY" || 
    [44285,44286,44287,44288,44289,44290,44291,44292,44293,44295,44344,44729,44730,44209,44208].includes(selectedId);
  const selectedWinners = selectedRace?.candidates?.filter((c) => c.winner) ?? [];
  const isRunoffConfirmed = selectedRaceIsMajority && selectedWinners.length >= 2;
  const [forecastProj, setForecastProj] = useState<{ leader: string; prob: number } | null>(null);
  useEffect(() => { setForecastProj(null); }, [selectedId]);

  const timeStr = nowMs > 0
    ? new Date(nowMs).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";

  return (
    <>
      <style>{`
        .res-root {
          --background: #070709; --background2: #0b0b0f; --panel: #0f0f15; --panel2: #141420;
          --foreground: #f0f0f5; --muted: rgba(240,240,245,0.62); --muted2: rgba(240,240,245,0.40);
          --muted3: rgba(240,240,245,0.22); --border: rgba(255,255,255,0.09); --border2: rgba(255,255,255,0.15);
          --border3: rgba(255,255,255,0.22); --purple: #7c3aed; --purple2: #9d5cf0;
          --purple-soft: #a78bfa; --purple-dim: rgba(124,58,237,0.14); --red: #e63946; --red2: #ff4d5a;
          --blue: #2563eb; --blue2: #3b82f6; --win: #4ade80; --rep: #e63946; --dem: #3b82f6;
          --shadow-md: 0 10px 40px rgba(0,0,0,0.75);
        }
        @keyframes res-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes res-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.35; transform:scale(0.82); } }
        @keyframes county-pop { 0% { filter:brightness(1); } 40% { filter:brightness(2.2) saturate(1.4); } 100% { filter:brightness(1); } }
        @keyframes res-loading-pulse { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
        .county-pop { animation: county-pop 520ms ease-out; }
        @keyframes county-updated { 0% { filter:brightness(1) saturate(1); } 12% { filter:brightness(3.2) saturate(2.0); } 35% { filter:brightness(2.0) saturate(1.4); } 100% { filter:brightness(1) saturate(1); } }
        .county-updated { animation: county-updated 1200ms cubic-bezier(0.22,1,0.36,1); }
        .res-tri-stripe { height:3px; width:100%; background:linear-gradient(90deg,var(--red) 0%,var(--red) 33.33%,var(--purple) 33.33%,var(--purple) 66.66%,var(--blue) 66.66%,var(--blue) 100%); flex-shrink:0; }
        .res-live-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--rep); box-shadow:0 0 8px rgba(230,57,70,0.7); animation:res-pulse 1.8s ease-in-out infinite; flex-shrink:0; }
        .res-eyebrow { display:flex; align-items:center; gap:7px; font-family:var(--font-body); font-size:8.5px; font-weight:700; letter-spacing:0.30em; text-transform:uppercase; color:var(--muted3); }
        .res-note { font-family:var(--font-body); font-size:8.5px; letter-spacing:0.16em; text-transform:uppercase; color:var(--muted3); }
        .res-th { font-family:var(--font-body); font-size:7.5px; font-weight:700; letter-spacing:0.24em; text-transform:uppercase; color:var(--muted3); }
        .res-num { font-family:var(--font-body); font-size:10.5px; color:var(--muted); font-variant-numeric:tabular-nums; }
        .res-pct-big { font-family:var(--font-body); font-size:13px; font-weight:900; color:#fff; font-variant-numeric:tabular-nums; }
        .res-pct-xl { font-family:var(--font-body); font-size:clamp(22px,2.5vw,30px); font-weight:900; color:#fff; font-variant-numeric:tabular-nums; line-height:1; }
        .res-pct-topline { font-family:var(--font-body); font-size:clamp(20px,2.2vw,28px); font-weight:900; color:#fff; font-variant-numeric:tabular-nums; line-height:1; }
        .res-stat-label { font-family:var(--font-body); font-size:7.5px; font-weight:700; letter-spacing:0.26em; text-transform:uppercase; color:var(--muted3); }
        .res-stat-val { font-family:var(--font-body); font-size:10px; font-weight:700; letter-spacing:0.14em; color:var(--muted); }
        .res-stat-row { display:flex; align-items:center; justify-content:space-between; }
        .res-badge { display:inline-flex; align-items:center; gap:4px; padding:2px 6px; font-family:var(--font-body); font-size:7.5px; font-weight:700; letter-spacing:0.20em; text-transform:uppercase; border:1px solid var(--border); background:rgba(255,255,255,0.03); color:var(--muted3); }
        .res-badge-purple { border-color:rgba(124,58,237,0.40); background:rgba(124,58,237,0.08); color:var(--purple-soft); }
        .res-badge-win { border-color:rgba(74,222,128,0.28); background:rgba(74,222,128,0.08); color:var(--win); }
        .res-badge-red { border-color:rgba(230,57,70,0.30); background:rgba(230,57,70,0.08); color:var(--rep); }
        .res-badge-blue { border-color:rgba(59,130,246,0.30); background:rgba(59,130,246,0.08); color:var(--dem); }
        .res-bar-track { width:100%; height:3px; background:rgba(255,255,255,0.08); position:relative; overflow:hidden; }
        .res-bar-fill { position:absolute; top:0; left:0; bottom:0; background:var(--purple); transition:width 600ms cubic-bezier(0.22,1,0.36,1); }
        .res-panel { background:var(--panel); border:1px solid var(--border); overflow:hidden; animation:res-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        .res-panel-header { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--border); background:var(--background2); }
        .res-panel-tag { font-family:var(--font-body); font-size:8px; font-weight:700; letter-spacing:0.28em; text-transform:uppercase; color:var(--purple-soft); }
        .res-stat-block { background:rgba(255,255,255,0.025); border:1px solid var(--border); padding:10px 12px; }
        .res-stat-block-label { font-family:var(--font-body); font-size:7.5px; font-weight:700; letter-spacing:0.26em; text-transform:uppercase; color:var(--muted3); margin-bottom:4px; }
        .res-stat-block-val { font-family:var(--font-body); font-size:clamp(20px,2.5vw,28px); font-weight:900; color:#fff; line-height:1; font-variant-numeric:tabular-nums; }
        .res-btn-primary { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; background:var(--purple); border:1px solid rgba(124,58,237,0.65); color:#fff; font-family:var(--font-body); font-size:9px; font-weight:700; letter-spacing:0.20em; text-transform:uppercase; cursor:pointer; transition:background 140ms ease,transform 140ms ease; }
        .res-btn-primary:hover { background:var(--purple2); transform:translateY(-1px); }
        .res-btn-ghost { display:inline-flex; align-items:center; gap:6px; padding:7px 12px; background:transparent; border:1px solid var(--border); color:var(--muted3); font-family:var(--font-body); font-size:9px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; cursor:pointer; transition:all 140ms ease; }
        .res-btn-ghost:hover { border-color:var(--border2); color:var(--muted); }
        .res-btn-state { display:inline-flex; align-items:center; padding:8px 16px; background:transparent; border:1px solid var(--border); color:var(--muted3); font-family:var(--font-body); font-size:9px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; cursor:pointer; transition:all 120ms ease; position:relative; overflow:hidden; }
        .res-btn-state::before { content:''; position:absolute; bottom:0; left:0; right:0; height:2px; background:var(--purple); transform:scaleX(0); transform-origin:left; transition:transform 200ms ease; }
        .res-btn-state:hover { color:rgba(255,255,255,0.7); border-color:var(--border2); }
        .res-btn-state:hover::before { transform:scaleX(1); }
        .res-btn-state.active { background:rgba(124,58,237,0.10); border-color:rgba(124,58,237,0.40); color:#fff; }
        .res-btn-state.active::before { transform:scaleX(1); }
        .res-close-btn { display:inline-flex; align-items:center; padding:7px 12px; background:rgba(255,255,255,0.04); border:1px solid var(--border); color:var(--muted2); font-family:var(--font-body); font-size:8.5px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; cursor:pointer; flex-shrink:0; transition:all 120ms ease; }
        .res-close-btn:hover { border-color:var(--border2); color:rgba(255,255,255,0.7); }
        .res-overlay-card { background:var(--panel); border:1px solid rgba(124,58,237,0.45); box-shadow:0 0 80px rgba(124,58,237,0.25),0 30px 80px rgba(0,0,0,0.8); }
        .res-overlay-title { font-family:var(--font-body); font-size:clamp(32px,4vw,48px); font-weight:900; text-transform:uppercase; letter-spacing:0.02em; color:#fff; line-height:0.92; }
        .res-overlay-name { font-family:var(--font-body); font-size:clamp(18px,2.5vw,26px); font-weight:700; text-transform:uppercase; letter-spacing:0.06em; }
        .res-map-tooltip { background:rgba(8,8,14,0.96); border:1px solid rgba(124,58,237,0.45); box-shadow:0 20px 60px rgba(0,0,0,0.85); }
        .res-tooltip-title { font-family:var(--font-body); font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; color:#fff; }
        .res-reporting-row { display:flex; align-items:center; justify-content:space-between; }
        .res-candidate-list { border:1px solid var(--border); background:var(--panel); overflow:hidden; }
        .res-candidate-row { display:flex; align-items:center; gap:0; border-bottom:1px solid rgba(255,255,255,0.07); padding:10px 14px; transition:background 120ms ease; position:relative; }
        .res-candidate-row:last-child { border-bottom:none; }
        .res-candidate-row:hover { background:rgba(255,255,255,0.015); }
        .res-cand-bar { width:3px; height:100%; position:absolute; left:0; top:0; bottom:0; opacity:0.7; }
        .res-cand-dot { display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .res-cand-name { font-family:var(--font-body); font-size:10.5px; font-weight:700; letter-spacing:0.08em; color:rgba(255,255,255,0.85); }
        .res-cand-name-lg { font-family:var(--font-body); font-size:11px; font-weight:900; letter-spacing:0.06em; text-transform:uppercase; color:rgba(255,255,255,0.9); }
        .res-cand-party { font-family:var(--font-body); font-size:8px; letter-spacing:0.16em; text-transform:uppercase; color:var(--muted3); margin-top:1px; }
        .res-thead { position:sticky; top:0; background:var(--background2); border-bottom:1px solid var(--border); }
        .res-table-row { border-bottom:1px solid rgba(255,255,255,0.04); transition:background 100ms ease; }
        .res-table-row:hover { background:rgba(255,255,255,0.012); }
        .res-input { width:100%; background:rgba(255,255,255,0.03); border:1px solid var(--border); color:var(--foreground); padding:8px 12px; font-family:var(--font-body); font-size:10px; letter-spacing:0.10em; outline:none; transition:border-color 140ms ease; }
        .res-input:focus { border-color:rgba(124,58,237,0.40); }
        .res-input::placeholder { color:var(--muted3); }
        .res-select { background:rgba(255,255,255,0.03); border:1px solid var(--border); color:var(--muted2); padding:7px 10px; font-family:var(--font-body); font-size:9px; letter-spacing:0.10em; outline:none; }
        .res-error { border:1px solid rgba(230,57,70,0.25); background:rgba(230,57,70,0.06); color:rgba(255,77,90,0.90); padding:12px 16px; font-family:var(--font-body); font-size:10.5px; letter-spacing:0.12em; }
        .res-map-loading { display:flex; align-items:center; justify-content:center; aspect-ratio:4/3; background:rgba(0,0,0,0.30); border:1px solid var(--border); }
        .res-map-wrap { background:rgba(0,0,0,0.20); border:1px solid var(--border); padding:6px; }

        /* ── STATUS BAR ── */
        .res-status-bar { background:var(--background2); border-bottom:1px solid var(--border); padding:7px 0; }
        .res-status-bar-inner { max-width:1800px; margin:0 auto; padding:0 20px; display:flex; align-items:center; justify-content:space-between; gap:12px; }

        /* ── PAGE HEADER ── */
        .res-page-header { border-bottom:1px solid var(--border); background:var(--background2); position:relative; overflow:hidden; }
        .res-page-header::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 40% 80% at 0% 50%,rgba(230,57,70,0.04) 0%,transparent 70%),radial-gradient(ellipse 40% 80% at 100% 50%,rgba(37,99,235,0.05) 0%,transparent 70%); pointer-events:none; }
        .res-page-header-inner { max-width:1800px; margin:0 auto; padding:16px 20px; position:relative; }
        .res-page-title { font-family:var(--font-display); font-size:clamp(22px,2.8vw,44px); font-weight:900; text-transform:uppercase; letter-spacing:0.01em; color:#fff; line-height:0.92; margin:0; }
        .res-page-title em { font-style:normal; background:linear-gradient(100deg,var(--red2) 0%,var(--purple-soft) 50%,var(--blue2) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .res-page-sub { font-family:var(--font-body); font-size:8px; font-weight:700; letter-spacing:0.30em; text-transform:uppercase; color:var(--purple-soft); margin-bottom:8px; }

        /* ════════════════════════════════════════
           LAYOUT — desktop / tablet / mobile
        ════════════════════════════════════════ */

        /* ── MAIN BODY ── */
        .res-body {
          max-width: 1800px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(190px, 22%) 1fr minmax(280px, 22%);
          grid-template-rows: auto;
          align-items: start;
          gap: 8px;
          padding: 8px 10px;
          box-sizing: border-box;
        }

        /* ── LEFT RACE PICKER (desktop only) ── */
        .res-race-picker {
          display: flex;
          flex-direction: column;
          min-height: 0;
          height: 1216px;
          overflow: hidden;
          align-self: start;
        }
        .res-race-picker > .res-panel {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* ── CENTER SPLIT: map + county ── */
        .res-center-split {
          display: flex;
          flex-direction: column;
          height: 1216px;
          min-height: 1216px;
          overflow: hidden;
        }
        .res-center-split > .res-map-panel {
          height: 500px;
          min-height: 500px;
          max-height: 500px;
          flex: none;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .res-center-split > .res-map-panel .res-map-body {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 0 !important;
        }
        .res-map-wrap {
          flex: 1;
          min-height: 0;
          display: flex;
          align-items: stretch;
        }
        .res-map-wrap svg, .res-map-wrap > div {
          width: 100% !important;
          height: 100% !important;
        }
        /* County fills all remaining space below map */
        .res-inline-county {
          flex: 1;
          height: 708px;
          min-height: 708px;
          overflow: hidden;
        }
        .res-inline-county .res-county-table-wrap { max-height: none !important; }
        .res-inline-county > .res-panel { height: 100% !important; display: flex !important; flex-direction: column; overflow: hidden; border-top: 1px solid var(--border); border-radius: 0; }
        .res-inline-county > .res-panel > div:last-child { flex: 1; overflow-y: auto !important; max-height: none !important; min-height: 0; }
        /* ── RIGHT RAIL ── */
        .res-right-rail {
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          height: 1216px;
        }
        /* Race status: fixed 300px */
        .res-right-rail > .res-race-status-panel {
          height: 300px;
          min-height: 300px;
          max-height: 300px;
          flex: none;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        /* Topline: fixed 300px */
        .res-right-rail > .res-topline-panel {
          height: 300px;
          min-height: 300px;
          max-height: 300px;
          flex: none;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        /* Forecast: fixed 600px */
        .res-forecast-wrap {
          height: 600px;
          min-height: 600px;
          max-height: 600px;
          flex: none !important;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .res-forecast-wrap > .res-panel {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .res-forecast-wrap > .res-panel .res-forecast-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }

        /* ── COMPACT RACE SCROLL (tablet only, hidden by default) ── */
        .res-race-scroll-window {
          display: none;
          flex-direction: column;
          background: var(--panel);
          border: 1px solid var(--border);
          overflow: hidden;
          max-height: 240px;
          flex-shrink: 0;
        }

        /* ── MOBILE RACE SELECTOR BAR (hidden by default) ── */
        .res-mobile-race-strip {
          display: none;
          background: var(--background2);
          border-bottom: 1px solid var(--border);
          padding: 8px 14px;
          align-items: center;
          gap: 10px;
        }

        /* ── FULL-WIDTH BOTTOM ── */
        .res-bottom { display: none; }

        /* ── TABLET INLINE COUNTY TABLE ── */
        .res-tablet-county { display: none; }

        /* ════ TABLET ≤768px ════ */
        @media (max-width: 768px) {
          /* Fixed height so both columns end at same line */
          .res-body {
            grid-template-columns: 1fr 300px;
            grid-template-rows: calc(100vh - 120px);
            padding: 10px 14px;
          }
          .res-race-picker { display: none; }
          .res-mobile-race-strip { display: flex; }
          /* Center column: map panel fills height, county scrolls below */
          .res-center-split { flex-direction: column; min-height: 0; height: 100%; }
          .res-center-split > .res-map-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
          .res-center-split > .res-map-panel .res-map-body { flex-shrink: 0; }
          .res-inline-county { max-height: 240px; }
          /* Hide full-width bottom on tablet */
          .res-bottom { display: none; }
          .res-right-rail { height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
          .res-right-rail > .res-race-status-panel { height: 300px; min-height: 300px; max-height: 300px; flex: none; }
          .res-right-rail > .res-topline-panel { height: 300px; min-height: 300px; max-height: 300px; flex: none; }
          .res-forecast-wrap { height: 600px; min-height: 600px; max-height: 600px; flex: none !important; }
          .res-race-scroll-window { display: flex; max-height: 200px; flex-shrink: 0; }
          /* Hide full-width bottom on tablet */
          .res-bottom { display: none; }
        }

        /* ════ MOBILE ≤640px ════ */
        @media (max-width: 640px) {
          .res-root { display: flex; flex-direction: column; }
          .res-body {
            order: 2;
            display: flex !important;
            flex-direction: column;
            grid-template-columns: unset;
            grid-template-rows: unset;
            height: auto !important;
            min-height: unset !important;
            padding: 8px 10px;
            gap: 10px;
          }
          /* Reset all fixed desktop heights */
          .res-race-picker { display: none !important; }
          .res-right-rail {
            order: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
            height: auto !important;
            min-height: unset !important;
            overflow: visible;
            width: 100%;
          }
          .res-right-rail > .res-race-scroll-window { display: none !important; }
          .res-right-rail > .res-race-status-panel { height: auto !important; min-height: unset !important; max-height: unset !important; overflow: visible !important; flex: none; width: 100%; box-sizing: border-box; }
          .res-right-rail > .res-topline-panel { height: auto !important; min-height: unset !important; max-height: unset !important; overflow: visible !important; flex: none; width: 100%; box-sizing: border-box; }
          .res-forecast-wrap { order: 3; height: auto !important; min-height: unset !important; max-height: unset !important; flex: none !important; overflow: visible; width: 100%; box-sizing: border-box; }
          .res-forecast-wrap > .res-panel { overflow: visible; height: auto !important; width: 100%; }
          .res-forecast-wrap > .res-panel .res-forecast-body { overflow-y: visible; max-height: none; height: auto !important; }
          .res-race-status-panel { flex: none !important; overflow: visible !important; }
          /* Center: map auto height, county hidden (res-bottom used instead) */
          .res-center-split { order: 2; height: auto !important; min-height: unset !important; overflow: visible; width: 100%; }
          .res-center-split > .res-map-panel { height: auto !important; min-height: unset !important; max-height: unset !important; overflow: visible; width: 100%; box-sizing: border-box; }
          .res-center-split > .res-map-panel .res-map-body { flex: none; padding: 6px 10px !important; }
          .res-map-wrap { height: auto !important; width: 100%; }
          .res-map-wrap svg, .res-map-wrap > div { width: 100% !important; height: auto !important; }
          .res-inline-county { display: none; }
          /* County at bottom via res-bottom */
          .res-bottom { order: 4; display: block; padding: 0 10px 16px; }
          .res-race-scroll-window { display: flex; max-height: 190px; flex-shrink: 0; }
          .res-mobile-race-search { order: 1; }
        }

        /* ── TABLET RACE SEARCH (top of right rail, tablet only) ── */
        .res-tablet-race-search { display: none !important; }

        /* ── MOBILE RACE LIST (phones only, above map) ── */
        .res-mobile-race-search { display: none; }
        @media (max-width: 640px) {
          .res-mobile-race-search { display: block; }
          .res-mobile-race-search .res-race-scroll-window { display: flex !important; margin: 8px 10px 0; }
        }


        .res-race-select {
          flex: 1; appearance: none; -webkit-appearance: none;
          background: var(--panel); border: 1px solid var(--border); color: var(--foreground);
          padding: 8px 32px 8px 12px; font-family: var(--font-body); font-size: 10px;
          font-weight: 700; letter-spacing: 0.06em; outline: none; cursor: pointer;
          transition: border-color 140ms ease; min-width: 0;
          background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='rgba(255,255,255,0.35)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center;
        }
        .res-race-select:focus { border-color: rgba(124,58,237,0.5); }
        .res-race-select option { background: #0f0f15; color: #f0f0f5; font-weight: 600; }
        .res-race-select optgroup { color: rgba(255,255,255,0.35); font-size: 9px; }

        * { scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.10) transparent; }
        *::-webkit-scrollbar { width:3px; height:3px; }
        *::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.10); }
        *::-webkit-scrollbar-thumb:hover { background:rgba(124,58,237,0.4); }
        @media (prefers-reduced-motion:reduce) { .res-bar-fill,.res-btn-primary,.res-btn-ghost,.res-btn-state { transition:none !important; } .res-live-dot { animation:none !important; } }
        input[type=range] { height:4px; cursor:pointer; }
      `}</style>

      <main className="res-root" style={{ minHeight: "100vh", background: "transparent", color: "var(--foreground)" }}>
        {overlay && <ProjectedWinnerOverlay show={!!overlay} candidate={overlay.name} prob={overlay.prob} color={overlay.color} reporting={overlay.reporting} onDismiss={() => setOverlay(null)} />}

        <div className="res-tri-stripe" />

        {/* STATUS BAR */}
        <div className="res-status-bar">
          <div className="res-status-bar-inner">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="res-live-dot" />
              <span className="res-eyebrow" style={{ color: "rgba(255,255,255,0.40)" }}>LIVE ELECTION RESULTS<span style={{ color: "var(--border3)", margin: "0 4px" }}>·</span>POWERED BY CIVICAPI.ORG</span>
            </div>
            <div className="res-note" style={{ letterSpacing: "0.22em", color: "rgba(255,255,255,0.22)" }} suppressHydrationWarning>{timeStr}</div>
          </div>
        </div>

        {/* PAGE HEADER */}
        <div className="res-page-header">
          <div className="res-page-header-inner">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div>
                <div className="res-page-sub">MARCH 3RD PRIMARY ELECTIONS · 2026</div>
                <h1 className="res-page-title">Election <em>Night</em></h1>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                  <span className="res-badge res-badge-red"><span className="res-live-dot" style={{ background: "var(--rep)" }} />LIVE</span>
                  <span className="res-badge res-badge-purple">RESULTS + FORECAST / 30s</span>
                  {selectedRace?.last_updated && <span className="res-badge">UPDATED {prettyTime(selectedRace.last_updated)}</span>}
                </div>
                {/* State switcher */}
                <div style={{ display: "flex", gap: "1px" }}>
                  {(["TX", "NC", "AR"] as const).map((st) => (
                    <button key={st} className={`res-btn-state ${activeState === st ? "active" : ""}`} onClick={() => setActiveState(st)}>{stateLabels[st]}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── MOBILE RACE SELECTOR (visible below 768px) ── */}
        <div className="res-mobile-race-strip">
          {/* Live indicator */}
          <span className="res-live-dot" style={{ flexShrink: 0 }} />
          {/* Dropdown */}
          <select
            className="res-race-select"
            value={selectedId}
            onChange={e => setSelectedId(Number(e.target.value))}
          >
            {racesForState.reduce<{ office: string; races: FeaturedRace[] }[]>((groups, r) => {
              const last = groups[groups.length - 1];
              if (last && last.office === r.office) { last.races.push(r); }
              else { groups.push({ office: r.office, races: [r] }); }
              return groups;
            }, []).map(({ office, races }) => (
              <optgroup key={office} label={`── ${office.toUpperCase()} ──`}>
                {races.map(r => {
                  const liveData = raceCache[r.id];
                  const winner = liveData?.candidates?.find(c => c.winner);
                  const reporting = getRaceReportingPct(liveData);
                  const partyShort = r.party === "Republican" ? "R" : r.party === "Democratic" ? "D" : "—";
                  const statusStr = winner ? " ✓ CALLED" : reporting !== null && reporting > 0 ? ` · ${reporting.toFixed(0)}% IN` : "";
                  return (
                    <option key={r.id} value={r.id}>
                      [{partyShort}] {r.office}{statusStr}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          {/* Selected race quick-status */}
          {(() => {
            const meta = FEATURED.find(r => r.id === selectedId);
            const liveData = raceCache[selectedId];
            const winner = liveData?.candidates?.find(c => c.winner);
            const reporting = getRaceReportingPct(liveData);
            const partyColor = meta?.party === "Republican" ? "var(--rep)" : meta?.party === "Democratic" ? "var(--dem)" : "rgba(255,255,255,0.4)";
            return (
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                {winner
                  ? <span className="res-badge res-badge-win" style={{ fontSize: "7px" }}>✓ CALLED</span>
                  : <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, color: partyColor }}>{reporting !== null ? `${reporting.toFixed(0)}%` : "—"}</span>
                }
              </div>
            );
          })()}
        </div>


        {/* ── MOBILE RACE LIST — phones only, above map ── */}
        <div className="res-mobile-race-search">
          <div style={{ margin: "8px 10px 0", border: "1px solid var(--border)" }}>
            <RaceScrollWindow races={racesForState} raceCache={raceCache} selectedId={selectedId} onSelect={setSelectedId} search={scrollWindowSearch} onSearchChange={setScrollWindowSearch} maxHeight={200} />
          </div>
        </div>


        {/* ── MAIN BODY ── */}
        <div className="res-body">

          {/* LEFT: Race Picker Panel */}
          <div className="res-race-picker">
            <RacePickerPanel
              races={racesForState}
              raceCache={raceCache}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          {/* CENTER SPLIT: map (left) + right column (race-scroll + forecast stacked) */}
          <div className={`res-center-split${hasForecastForSelected ? "" : " no-forecast"}`}>

            {/* MAP PANEL */}
            <div className="res-panel res-map-panel">
              <div className="res-tri-stripe" />
              <div className="res-panel-header" style={{ flexWrap: "wrap", gap: "8px" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="res-panel-tag">{selectedMeta?.label ?? "—"}</div>
                  <div className="res-note" style={{ marginTop: "2px" }}>{selectedRace?.percent_reporting?.toFixed(1)}% REPORTING · {prettyTime(selectedRace?.last_updated)}</div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
                  <span className="res-badge">{selectedCloseLocal}</span>
                  <span className={`res-badge ${selectedMsLeft && selectedMsLeft > 0 ? "" : "res-badge-red"}`}>{selectedMsLeft === null ? "—" : formatCountdown(selectedMsLeft)}</span>
                  <span className="res-badge res-badge-purple">{loadingMap ? `SYNCING ${Math.round(mapLoadPct)}%` : "● LIVE"}</span>
                </div>
              </div>
              <div className="res-map-body" style={{ padding: "6px 10px 0", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "6px", flexShrink: 0 }}>
                  <Legend />
                  <span className="res-note" style={{ color: "rgba(255,255,255,0.2)" }}>HOVER COUNTIES</span>
                </div>
                {loadingMap ? (
                  <div className="res-map-loading" style={{ flex: 1 }}>
                    <div style={{ width: "min(300px, 90%)" }}>
                      <div className="res-note" style={{ textAlign: "center", marginBottom: "8px", color: "rgba(255,255,255,0.35)" }}>LOADING MAP</div>
                      <div className="res-bar-track"><div className="res-bar-fill" style={{ width: `${mapLoadPct}%`, background: "linear-gradient(90deg,var(--purple),var(--blue2))" }} /></div>
                      <div className="res-note" style={{ textAlign: "center", marginTop: "6px", color: "var(--purple-soft)", fontWeight: 700 }}>{Math.round(mapLoadPct)}%</div>
                    </div>
                  </div>
                ) : mapBlankSvg ? (
                  <div className="res-map-wrap" style={{ flex: 1, minHeight: 0 }}>
                    <MapWithCountyTooltip svgText={mapBlankSvg} regionResults={selectedRace?.region_results ?? []} />
                  </div>
                ) : (
                  <div className="res-map-loading" style={{ flex: 1 }}><span className="res-note" style={{ color: "var(--muted3)" }}>NO MAP DATA</span></div>
                )}
              </div>
            </div>{/* end map panel */}

            {/* COUNTY TABLE — sibling below map panel */}
            <div className="res-inline-county">
              <CountyTotalsTable
                regionResults={selectedRace?.region_results ?? []}
                collapsed={countyCollapsed}
                onToggle={() => setCountyCollapsed(v => !v)}
                maxHeight="9999px"
              />
            </div>

          </div>{/* end res-center-split */}

          {/* RIGHT RAIL: Topline + Race Status + Forecast stacked */}
          <aside className="res-right-rail">

            {/* TABLET RACE SCROLL — hidden on desktop, shown on tablet */}
            <div className="res-race-scroll-window">
              <RaceScrollWindow races={racesForState} raceCache={raceCache} selectedId={selectedId} onSelect={setSelectedId} search={scrollWindowSearch} onSearchChange={setScrollWindowSearch} />
            </div>

            {/* RACE STATUS — top */}
            <div className="res-panel res-race-status-panel" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div className="res-panel-header" style={{ flexShrink: 0 }}><span className="res-panel-tag">RACE STATUS</span></div>
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", flex: 1, minHeight: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div className="res-stat-block">
                    <div className="res-stat-block-label">REPORTING</div>
                    <div className="res-stat-block-val">{selectedReporting.toFixed(1)}%</div>
                    <div className="res-bar-track" style={{ marginTop: "6px" }}><div className="res-bar-fill" style={{ width: `${selectedReporting}%`, background: "var(--purple)" }} /></div>
                  </div>
                  <div className="res-stat-block">
                    <div className="res-stat-block-label">CLOSES</div>
                    <div className="res-stat-block-val" style={{ fontSize: "clamp(16px,2vw,22px)" }}>{selectedCloseLocal}</div>
                    <div className="res-note" style={{ marginTop: "5px", color: selectedMsLeft && selectedMsLeft > 0 ? "var(--muted3)" : "var(--rep)", fontWeight: 700 }}>{selectedMsLeft === null ? "—" : formatCountdown(selectedMsLeft)}</div>
                  </div>
                </div>
                <div className="res-stat-block">
                  <div className="res-stat-row" style={{ marginBottom: "5px" }}>
                    <span className="res-stat-block-label">PROJECTION</span>
                    <span className="res-note" style={{ color: isRunoffConfirmed ? "#f59e0b" : selectedWinner ? "var(--win)" : forecastProj ? "var(--purple-soft)" : "var(--muted3)", fontWeight: 700 }}>
                      {isRunoffConfirmed ? "CONFIRMED" : selectedWinner ? "OFFICIAL" : forecastProj ? `${forecastProj.prob.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isRunoffConfirmed ? "#f59e0b" : "rgba(255,255,255,0.88)" }}>
                    {isRunoffConfirmed ? "⚡ RUNOFF NEEDED" : selectedWinner ? `✓ ${selectedWinner.name}` : forecastProj ? forecastProj.leader : "No projection yet"}
                  </div>
                  {isRunoffConfirmed && (
                    <div className="res-note" style={{ marginTop: 4, color: "rgba(255,255,255,0.4)" }}>
                      {selectedWinners.map(w => w.name.split(" ").pop()).join(" vs ")} advance
                    </div>
                  )}
                  {forecastProj && !selectedWinner && !isRunoffConfirmed && (
                    <div className="res-bar-track" style={{ marginTop: "7px" }}><div className="res-bar-fill" style={{ width: `${Math.max(0, Math.min(100, forecastProj.prob))}%`, background: "linear-gradient(90deg,var(--purple),var(--blue2))" }} /></div>
                  )}
                </div>
                {selectedRace?.candidates && selectedRace.candidates.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <div className="res-note" style={{ marginBottom: 8 }}>VOTE SHARE</div>
                    {[...selectedRace.candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0)).slice(0, 4).map((c) => (
                      <div key={c.name} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontFamily: "var(--font-body)", fontSize: "8.5px", fontWeight: 700, letterSpacing: "0.06em", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.color, display: "inline-block", flexShrink: 0 }} />
                            {c.name.split(" ").pop()}
                          </span>
                          <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 900, color: c.color }}>{fmtPct(c.percent)}</span>
                        </div>
                        <div style={{ height: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${c.percent ?? 0}%`, background: c.color, transition: "width 600ms ease" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* TOPLINE — second */}
            <div className="res-panel res-topline-panel" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div className="res-tri-stripe" />
              <div className="res-panel-header" style={{ flexShrink: 0 }}>
                <span className="res-panel-tag">TOPLINE RESULTS</span>
                {selectedRace?.percent_reporting !== undefined && (
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.10em" }}>{selectedRace.percent_reporting.toFixed(1)}% IN</span>
                )}
              </div>
              <div style={{ padding: "12px 14px", overflowY: "auto", flex: 1, minHeight: 0 }}>
                {selectedRace?.candidates
                  ? <CandidateList candidates={selectedRace.candidates} reporting={selectedRace.percent_reporting ?? 0} raceId={selectedId} isMajorityRunoff={isRunoffConfirmed} />
                  : <div style={{ padding: "32px 0", textAlign: "center" }} className="res-note">LOADING…</div>
                }
              </div>
            </div>

            {/* FORECAST */}
            {hasForecastForSelected ? (
              <div className="res-forecast-wrap">
                <ForecastPanel key={selectedId} raceId={selectedId} refreshTick={refreshTick} raceData={selectedRace} onForecastUpdate={(leader, prob) => setForecastProj({ leader, prob })} />
              </div>
            ) : (
              <div className="res-panel" style={{ display: "flex", flexDirection: "column" }}>
                <div className="res-tri-stripe" />
                <div className="res-panel-header">
                  <span className="res-panel-tag">FORECAST MODEL</span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,0.18)", textTransform: "uppercase" }}>NOT AVAILABLE</span>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "20px 18px 18px" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 10, lineHeight: 1.4 }}>No Forecast<br />for This Race</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "8.5px", fontWeight: 500, color: "rgba(255,255,255,0.22)", lineHeight: 1.7, letterSpacing: "0.04em" }}>Our forecast model requires reliable poll averages and turnout baselines. For this race, we don't have enough data to model outcomes responsibly.</div>
                  </div>
                  <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.15)", marginBottom: 8 }}>WHAT WE'RE WATCHING</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "8px", color: "rgba(255,255,255,0.28)", lineHeight: 1.6 }}>Live results and county-level returns will update automatically.</div>
                  </div>
                </div>
              </div>
            )}

          </aside>
        </div>

        {/* ── FULL-WIDTH COUNTY BREAKDOWN — hidden on tablet, shown on desktop + mobile ── */}
        <div className="res-bottom">
          <CountyTotalsTable
            regionResults={selectedRace?.region_results ?? []}
            collapsed={countyCollapsed}
            onToggle={() => setCountyCollapsed(v => !v)}
          />
          {error && <div className="res-error" style={{ marginTop: 10 }}>ERROR: {error}</div>}
        </div>
      </main>
    </>
  );
}