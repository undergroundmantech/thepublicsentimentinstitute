"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ForecastOutput, RaceRule } from "@/app/lib/electoralModel";

const CIVIC_BASE = "https://civicapi.org";
const POLL_MS = 30_000;

// --- PREDICTIVE LOGIC HELPER ---
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

// ─── RACE FORECAST DEFAULTS ──────────────────────────────────────────────────
// Only races listed here will show the ForecastPanel. Others are hidden.
// expectedTurnout sourced from Kalshi prediction markets.
const RACE_FORECAST_DEFAULTS: Partial<Record<number, {
  raceRule: RaceRule;
  expectedTurnout?: number;
  pollAvg?: Record<string, number>;
}>> = {
  // TX US Senate — Democratic Primary (Kalshi: 2.66M forecast)
  44286: {
    raceRule: "MAJORITY",
    expectedTurnout: 2_660_000,
    pollAvg: { "Talarico": 46.0, "Crockett": 44.5, "Hassan": 0.3 },
  },
  // TX US Senate — Republican Primary (Kalshi: 2.39M forecast)
  44285: {
    raceRule: "MAJORITY",
    expectedTurnout: 2_390_000,
    pollAvg: { "Paxton": 37.2, "Cornyn": 32.7, "Hunt": 18.7 },
  },
  44287: {  // Gov Rep
    raceRule: "MAJORITY",
    expectedTurnout: 2_190_000,  // same as Senate or adjust
    pollAvg: { "Abbott": 91.0 /* add challengers if needed */ },
  },
  44288: {  // Gov Dem
    raceRule: "MAJORITY",
    expectedTurnout: 2_660_000,
    pollAvg: { "Hinojosa": 65.0, "Bell": 15.0 /* etc. */ },
  },
};

// ─── POLL-ORDERED CANDIDATE SORT ─────────────────────────────────────────────
// Sorts by pollAvg match (descending), then live vote percent, then alpha.
// Ensures top-3 are electorally relevant — NOT alphabetical.
function sortCandidatesByPollData(
  candidates: RaceCandidate[],
  pollAvg?: Record<string, number>
): RaceCandidate[] {
  if (!pollAvg || Object.keys(pollAvg).length === 0) {
    return [...candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  }
  return [...candidates].sort((a, b) => {
    const getPollScore = (name: string): number => {
      const lower = name.toLowerCase();
      for (const [key, score] of Object.entries(pollAvg)) {
        if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return score;
      }
      return -1;
    };
    const sa = getPollScore(a.name), sb = getPollScore(b.name);
    if (sa >= 0 && sb >= 0) return sb - sa;
    if (sa >= 0) return -1;
    if (sb >= 0) return 1;
    return (b.percent ?? 0) - (a.percent ?? 0);
  });
}

function getTopCandidatesByPoll(candidates: RaceCandidate[], raceId: number): RaceCandidate[] {
  const defaults = RACE_FORECAST_DEFAULTS[raceId];
  return sortCandidatesByPollData(candidates, defaults?.pollAvg).slice(0, 3);
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
  let r = 0, g = 0, b = 0;
  const h = hex.replace("#", "");
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
              <div className="res-eyebrow" style={{ color: "var(--rep)" }}>
                <span className="res-live-dot" style={{ background: "var(--rep)" }} />
                PROJECTION ALERT
              </div>
              <div className="res-overlay-title mt-3">Projected<br />Winner</div>
              <div className="res-overlay-name mt-2" style={{ color: color || "var(--purple-soft)" }}>{candidate}</div>
            </div>
            <button onClick={onDismiss} className="res-close-btn">CLOSE ✕</button>
          </div>
          <div className="mt-6">
            <div className="res-stat-row mb-2">
              <span className="res-stat-label">WIN CONFIDENCE</span>
              <span className="res-stat-val" style={{ color: "var(--purple-soft)" }}>{prob.toFixed(1)}%</span>
            </div>
            <div className="res-bar-track">
              <div className="res-bar-fill" style={{ width: `${Math.max(0, Math.min(100, prob))}%`, background: "linear-gradient(90deg, var(--purple), var(--purple2))", boxShadow: "0 0 20px rgba(124,58,237,0.5)" }} />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {[["STATUS", "PROJECTED"], ["CONFIDENCE", `${prob.toFixed(1)}%`], ["REPORTING", `${reporting.toFixed(1)}%`]].map(([label, val]) => (
              <div key={label} className="res-stat-block">
                <div className="res-stat-block-label">{label}</div>
                <div className="res-stat-block-val">{val}</div>
              </div>
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
function MapWithCountyTooltip({ svgText, regionResults }: { svgText: string; regionResults: RegionResult[] | Record<string, RegionResult> }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, x: 0, y: 0, title: "", reporting: null, reportingPct: null, lines: [] });
  const countyFingerprintsRef = useRef<Map<string, string>>(new Map());

  const regionResultsArr = useMemo(() => coerceRegionResults(regionResults), [regionResults]);
  const regionMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const rr of regionResultsArr as any[]) { const k = normalizeRegionName(String(rr?.region?.name ?? rr?.name ?? "")); if (!k) continue; m.set(k, rr); }
    return m;
  }, [regionResultsArr]);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;
    host.innerHTML = svgText;
    const svg = host.querySelector("svg");
    if (!svg) return;
    countyFingerprintsRef.current = new Map();
    const shapes = Array.from(svg.querySelectorAll("path, polygon")) as SVGGraphicsElement[];
    shapes.forEach((shape) => {
      const key = getRegionKeyFromElement(shape);
      if (!key) return;
      const prettyKey = titleCaseKey(key);
      shape.style.pointerEvents = "all";
      shape.style.cursor = "crosshair";
      shape.style.stroke = "rgba(255,255,255,0.08)";
      shape.style.strokeWidth = "0.8";
      shape.style.transition = "fill 420ms ease, filter 300ms ease, stroke 200ms ease, stroke-width 200ms ease";

      const onMove = (ev: PointerEvent) => {
        const currentRR = regionMap.get(key);
        const tw = 320, th = 260, p = 12, offset = 14;
        const rect = host.getBoundingClientRect();
        const px = ev.clientX - rect.left;
        const py = ev.clientY - rect.top;
        let x = px + offset;
        let y = py + offset;
        if (x + tw > rect.width - p) x = px - tw - offset;
        if (y + th > rect.height - p) y = py - th - offset;
        x = Math.max(p, Math.min(rect.width - tw - p, x));
        y = Math.max(p, Math.min(rect.height - th - p, y));
        const pct = typeof currentRR?.region?.percent_reporting === "number" ? currentRR.region.percent_reporting : typeof currentRR?.percent_reporting === "number" ? currentRR.percent_reporting : null;
        setTooltip({ show: true, x, y, title: currentRR?.region?.name ?? (currentRR?.name ? titleCaseKey(currentRR.name) : prettyKey), reporting: pct !== null ? `${pct.toFixed(1)}% REPORTING` : "0% REPORTING", reportingPct: pct ?? 0, lines: currentRR ? buildTooltipLines(currentRR) : [] });
      };
      const onEnter = (ev: PointerEvent) => { shape.style.stroke = "rgba(255,255,255,0.9)"; shape.style.strokeWidth = "2.0"; shape.style.filter = "brightness(1.22) saturate(1.1)"; onMove(ev); };
      const onLeave = () => { shape.style.stroke = "rgba(255,255,255,0.08)"; shape.style.strokeWidth = "0.8"; shape.style.filter = ""; setTooltip((t) => ({ ...t, show: false })); };
      shape.addEventListener("pointerenter", onEnter);
      shape.addEventListener("pointermove", onMove);
      shape.addEventListener("pointerleave", onLeave);

      const currentRR = regionMap.get(key);
      const hasData = !!currentRR;
      const fill = hasData ? countyFill(currentRR) : "rgba(255,255,255,0.04)";
      shape.style.opacity = "0";
      requestAnimationFrame(() => {
        shape.style.fill = fill || "rgba(255,255,255,0.04)";
        shape.style.opacity = "1";
        if (hasData) {
          const fp = countyFingerprint(currentRR);
          const prevFp = countyFingerprintsRef.current.get(key);
          if (prevFp === undefined) { shape.classList.add("county-pop"); setTimeout(() => shape.classList.remove("county-pop"), 520); }
          countyFingerprintsRef.current.set(key, fp);
        }
      });
    });
  }, [svgText, regionMap]);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;
    const svg = host.querySelector("svg");
    if (!svg) return;
    const shapes = Array.from(svg.querySelectorAll("path, polygon")) as SVGGraphicsElement[];
    shapes.forEach((shape) => {
      const key = getRegionKeyFromElement(shape);
      if (!key) return;
      const currentRR = regionMap.get(key);
      if (!currentRR) return;
      const fp = countyFingerprint(currentRR);
      const prevFp = countyFingerprintsRef.current.get(key);
      const fill = countyFill(currentRR);
      if (fill) shape.style.fill = fill;
      if (prevFp !== undefined && fp !== prevFp) { shape.classList.add("county-pop"); setTimeout(() => shape.classList.remove("county-pop"), 520); }
      countyFingerprintsRef.current.set(key, fp);
    });
  }, [regionMap]);

  return (
    <div className="relative">
      <div ref={wrapRef} className="w-full overflow-hidden [&_svg]:h-auto [&_svg]:w-full" />
      {tooltip.show && (
        <div className="res-map-tooltip absolute z-50 pointer-events-none w-[320px]" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="res-tri-stripe" style={{ height: "2px" }} />
          <div className="p-3">
            <div className="flex items-baseline justify-between mb-1">
              <div className="res-tooltip-title">{tooltip.title}</div>
              <div className="res-badge res-badge-purple">COUNTY</div>
            </div>
            <div className="res-reporting-row">
              <span className="res-note">{tooltip.reporting}</span>
            </div>
            <div className="res-bar-track mt-1" style={{ height: "2px" }}>
              <div className="res-bar-fill" style={{ width: `${tooltip.reportingPct}%`, background: "var(--purple)", height: "2px" }} />
            </div>
            <div className="mt-3 border-t pt-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="grid grid-cols-[1fr_72px_52px] gap-1 pb-1 mb-1 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                {["CANDIDATE", "VOTES", "PCT"].map((h) => (
                  <div key={h} className={`res-th ${h !== "CANDIDATE" ? "text-right" : ""}`}>{h}</div>
                ))}
              </div>
              {tooltip.lines.length > 0 ? tooltip.lines.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_72px_52px] items-center gap-1 py-1.5 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: c.color || "rgba(255,255,255,0.35)" }} />
                    <div className="min-w-0">
                      <div className="res-cand-name truncate">{c.name}{c.winner ? " ✓" : ""}</div>
                      <div className="res-cand-party">{c.party}</div>
                    </div>
                  </div>
                  <div className="text-right res-num">{c.votes?.toLocaleString() ?? "—"}</div>
                  <div className="text-right res-pct-big">{c.pct !== null ? `${c.pct.toFixed(1)}%` : "—"}</div>
                </div>
              )) : (
                <div className="py-4 text-center res-note">NO DATA YET</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CANDIDATE LIST ──────────────────────────────────────────────────────────
function CandidateList({ candidates, reporting, raceId }: { candidates: RaceCandidate[]; reporting: number; raceId?: number }) {
  const defaults = raceId ? RACE_FORECAST_DEFAULTS[raceId] : undefined;
  const ordered = useMemo(() => sortCandidatesByPollData(candidates, defaults?.pollAvg), [candidates, defaults?.pollAvg]);

  const winProb = useMemo(() => {
    if (ordered.length < 2 || reporting < 1) return null;
    return calculateWinProbability(ordered[0].votes, ordered[1].votes, reporting);
  }, [ordered, reporting]);

  return (
    <div className="space-y-2">
      {winProb !== null && !ordered[0].winner && reporting > 5 && (
        <div className="res-stat-block mb-3">
          <div className="res-stat-row mb-2">
            <span className="res-stat-label">PROJECTED WIN CHANCE</span>
            <span style={{ color: "var(--purple-soft)", fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em" }}>{winProb.toFixed(1)}%</span>
          </div>
          <div className="res-bar-track">
            <div className="res-bar-fill" style={{ width: `${Math.max(0, Math.min(100, winProb))}%`, background: "linear-gradient(90deg,var(--purple),var(--purple2))", transition: "width 700ms ease" }} />
          </div>
        </div>
      )}
      <div className="res-candidate-list">
        {ordered.map((c, idx) => {
          const isLeading = idx === 0 && !c.winner && winProb && winProb > 75;
          return (
            <div key={`${c.name}-${c.party}`} className="res-candidate-row">
              <div className="res-cand-bar" style={{ background: c.color || "rgba(255,255,255,0.2)" }} />
              <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="res-cand-dot" style={{ background: c.color || "rgba(255,255,255,0.35)", boxShadow: `0 0 10px ${c.color || "rgba(255,255,255,0.2)"}40` }} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="res-cand-name-lg">{c.name}</span>
                      {c.winner && <span className="res-badge res-badge-win">✓ WINNER</span>}
                      {isLeading && <span className="res-badge res-badge-purple">LEADING</span>}
                    </div>
                    <div className="res-cand-party">{c.party} · {c.votes.toLocaleString()} votes</div>
                  </div>
                </div>
                <div className="res-pct-xl shrink-0">{fmtPct(c.percent)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── COUNTY TABLE ────────────────────────────────────────────────────────────
function CountyTotalsTable({ regionResults }: { regionResults: RegionResult[] | Record<string, RegionResult> }) {
  const data = useMemo(() => {
    return coerceRegionResults(regionResults).map((rr) => {
      const candidates = buildTooltipLines(rr);
      const { absMargin } = computeCountyMargin(rr);
      const rawName = (rr as any)?.region?.name || (rr as any)?.name || "Unknown";
      return { name: titleCaseKey(rawName), reporting: rr?.region?.percent_reporting ?? (rr as any)?.percent_reporting ?? 0, candidates, margin: absMargin };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [regionResults]);

  if (!data.length) return null;

  return (
    <div className="res-panel">
      <div className="res-panel-header">
        <span className="res-panel-tag">COUNTY BREAKDOWN</span>
        <span className="res-note">{data.length} REGIONS</span>
      </div>
      <div style={{ maxHeight: "580px", overflowY: "auto" }}>
        <table className="w-full border-collapse">
          <thead className="res-thead">
            <tr>
              {["COUNTY / RPT", "CANDIDATES", "MARGIN"].map((h, i) => (
                <th key={h} className={`res-th px-4 py-2.5 ${i === 2 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="res-table-row">
                <td className="px-4 py-3 align-top" style={{ width: "160px" }}>
                  <div className="res-cand-name-lg">{row.name}</div>
                  <div className="res-bar-track mt-2" style={{ width: "80px", height: "2px" }}>
                    <div className="res-bar-fill" style={{ width: `${row.reporting}%`, background: "var(--purple)", height: "2px" }} />
                  </div>
                  <div className="res-note mt-1">{row.reporting.toFixed(1)}% RPT</div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                    {row.candidates.length > 0 ? row.candidates.slice(0, 4).map((cand, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 py-1 border-b" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: cand.color || "rgba(255,255,255,0.35)" }} />
                          <span className="res-note truncate">{cand.name}</span>
                        </div>
                        <span className="res-cand-name shrink-0">{cand.pct !== null ? `${cand.pct.toFixed(1)}%` : "—"}</span>
                      </div>
                    )) : <span className="res-note italic">Awaiting…</span>}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-right">
                  {row.margin !== null ? (
                    <>
                      <div className="res-pct-xl">{row.margin >= 0 ? "+" : ""}{row.margin.toFixed(1)}%</div>
                      <div className="res-note">SPREAD</div>
                    </>
                  ) : <span className="res-note">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      {stops.map(([label]) => (
        <span key={label} className="res-badge">{label}</span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── FORECAST PANEL ───────────────────────────────────────────────────────────
// Auto-runs on mount and re-runs automatically every 30s alongside results.
// Manual "RERUN" button still available in options panel.
// ═══════════════════════════════════════════════════════════════════════════════

interface ForecastCivicCandidate {
  name: string; party: string; color: string; votes: number; percent: number; winner: boolean;
}
interface ForecastHistoryTimestamp { timestamp: string; }
interface ForecastHistoryList { id: number; count: number; timestamps: ForecastHistoryTimestamp[]; }
interface ForecastResponse {
  forecast: ForecastOutput;
  race: { election_name: string; election_date: string; percent_reporting: number; candidates: ForecastCivicCandidate[]; };
}

const FORECAST_CANDIDATE_KEYS = ["Candidate1", "Candidate2", "Candidate3", "Others"] as const;
type FCKey = (typeof FORECAST_CANDIDATE_KEYS)[number];

function fcastPct(n: number, decimals = 1) { return (n * 100).toFixed(decimals) + "%"; }
function fcastFmt(n: number) { return n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }
function fcastShortDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function FcastProbBar({ label, value, color }: { label: string; value: number; color: string; }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(240,240,245,0.75)", fontFamily: "var(--font-body)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, fontFamily: "var(--font-body)" }}>{fcastPct(value)}</span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: fcastPct(Math.min(value, 1)), background: color, borderRadius: 99, transition: "width 0.6s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}

// The ForecastPanel now accepts a `refreshTick` prop — an incrementing number
// that the parent bumps every 30s alongside the results refresh. This triggers
// an automatic re-run of the live forecast without any user interaction.
function ForecastPanel({ raceId, refreshTick }: { raceId: number; refreshTick: number }) {
  const defaults = RACE_FORECAST_DEFAULTS[raceId];

  const [raceRule, setRaceRule] = useState<RaceRule>(() => {
  // Force MAJORITY for all Texas races (check raceId or add logic for state)
  const isTexas = raceId && [44285, 44286, 44287, 44288, 44289, 44290, 44291, 44292, 44293, 44294, 44295 /* add any other TX IDs */].includes(raceId);
  return isTexas ? "MAJORITY" : (defaults?.raceRule ?? "PLURALITY");
});
  const [expectedTurnoutOverride, setExpectedTurnoutOverride] = useState(
    defaults?.expectedTurnout ? String(defaults.expectedTurnout) : ""
  );
  const [historyList, setHistoryList] = useState<ForecastHistoryList | null>(null);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRaceIdRef = useRef<number | null>(null);

  // Track the raceRule/turnout in refs so the auto-refresh effect always uses current values
  const raceRuleRef = useRef(raceRule);
  const turnoutRef = useRef(expectedTurnoutOverride);
  useEffect(() => { raceRuleRef.current = raceRule; }, [raceRule]);
  useEffect(() => { turnoutRef.current = expectedTurnoutOverride; }, [expectedTurnoutOverride]);

  const timestamps = useMemo(() => historyList?.timestamps?.map((t) => t.timestamp) ?? [], [historyList]);

  // Auto-re-run forecast when raceRule or expectedTurnoutOverride changes
  useEffect(() => {
    if (!raceId) return;

    const timer = setTimeout(() => {
      if (timestamps.length > 0 && historyList) {
        runForecastAtIndex(raceId, historyList.timestamps, historyIndex, raceRule, expectedTurnoutOverride);
      } else {
        runForecastLive(raceId, raceRule, expectedTurnoutOverride);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [raceRule, expectedTurnoutOverride, raceId, timestamps, historyList, historyIndex]);


  async function runForecastAtIndex(id: number, tsList: ForecastHistoryTimestamp[], idx: number, rule?: RaceRule, turnout?: string) {
  setLoadingForecast(true);
  setError(null);
  try {
    const timestamp = tsList[idx].timestamp;
    const priorTimestamp = idx > 0 ? tsList[0].timestamp : undefined;
    const res = await fetch("/api/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "civic_history",
        raceId: String(id),
        timestamp,
        priorTimestamp,
        race_rule: rule ?? raceRuleRef.current,
        expected_turnout: (turnout ?? turnoutRef.current) ? Number(turnout ?? turnoutRef.current) : undefined,
        poll_avg: RACE_FORECAST_DEFAULTS[id]?.pollAvg,  // ← add this
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.details ?? data.error);
    setForecast(data);
  } catch (e: any) { setError(e.message); }
  finally { setLoadingForecast(false); }
  }

  async function runForecastLive(id: number, rule?: RaceRule, turnout?: string) {
  setLoadingForecast(true);
  setError(null);
  try {
    const res = await fetch("/api/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "civic",
        raceId: String(id),
        race_rule: rule ?? raceRuleRef.current,
        expected_turnout: (turnout ?? turnoutRef.current) ? Number(turnout ?? turnoutRef.current) : undefined,
        poll_avg: RACE_FORECAST_DEFAULTS[id]?.pollAvg,  // ← add this
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.details ?? data.error);
    setForecast(data);
  } catch (e: any) { setError(e.message); }
  finally { setLoadingForecast(false); }
  }

  // ── Initial load + race switch ───────────────────────────────────────────
  useEffect(() => {
    if (prevRaceIdRef.current === raceId) return;
    prevRaceIdRef.current = raceId;

    // Reset to race-specific defaults whenever race changes
    const d = RACE_FORECAST_DEFAULTS[raceId];
    const newRule = d?.raceRule ?? "PLURALITY";
    const newTurnout = d?.expectedTurnout ? String(d.expectedTurnout) : "";
    setRaceRule(newRule);
    setExpectedTurnoutOverride(newTurnout);
    raceRuleRef.current = newRule;
    turnoutRef.current = newTurnout;

    setForecast(null);
    setHistoryList(null);
    setHistoryIndex(0);
    setPlaying(false);
    setError(null);
    setLoadingHistory(true);

    (async () => {
      try {
        const res = await fetch(`/api/forecast?action=timestamps&raceId=${raceId}`);
        const data: ForecastHistoryList = await res.json();
        setHistoryList(data);
        if (data.timestamps?.length > 0) {
          const last = data.timestamps.length - 1;
          setHistoryIndex(last);
          await runForecastAtIndex(raceId, data.timestamps, last, newRule, newTurnout);
        } else {
          await runForecastLive(raceId, newRule, newTurnout);
        }
      } catch (e: any) { setError(e.message); }
      finally { setLoadingHistory(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId]);

  // ── Auto-refresh every 30s in sync with results poll ────────────────────
  // refreshTick is bumped by the parent each time results are refreshed.
  // We skip tick=0 (handled by the initial load above).
  const prevTickRef = useRef(0);
  useEffect(() => {
    if (refreshTick === 0) return;
    if (refreshTick === prevTickRef.current) return;
    prevTickRef.current = refreshTick;

    // Don't auto-refresh if user is in historical playback mode
    if (playing) return;

    // Re-run the live forecast (not historical) to pick up latest vote data
    runForecastLive(raceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  // ── Autoplay ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (playing && timestamps.length > 1) {
      playRef.current = setInterval(() => {
        setHistoryIndex((prev) => {
          const next = prev + 1;
          if (next >= timestamps.length) { setPlaying(false); return prev; }
          if (historyList) runForecastAtIndex(raceId, historyList.timestamps, next);
          return next;
        });
      }, 1800);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, timestamps.length, historyList, raceId]);

  const candidateLabels: Record<FCKey, string> = useMemo(() => {
    const names = forecast?.forecast.candidate_names ?? ["Candidate 1", "Candidate 2", "Candidate 3", "Others"];
    return { Candidate1: names[0], Candidate2: names[1], Candidate3: names[2], Others: names[3] };
  }, [forecast]);

  const candidateColors: Record<FCKey, string> = useMemo(() => {
    const colors = forecast?.forecast.candidate_colors ?? ["#3b82f6", "#ef4444", "#22c55e", "#94a3b8"];
    return { Candidate1: colors[0], Candidate2: colors[1], Candidate3: colors[2], Others: colors[3] };
  }, [forecast]);

  const isLoading = loadingHistory || loadingForecast;

  return (
    <div className="res-panel" style={{ padding: 0 }}>
      {/* Header */}
      <div className="res-tri-stripe" />
      <div className="res-panel-header" style={{ flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="res-panel-tag">FORECAST MODEL</span>
          {isLoading && (
            <span className="res-badge res-badge-purple" style={{ fontSize: "7px" }}>
              <span className="res-live-dot" style={{ background: "var(--purple)", width: 4, height: 4 }} />
              UPDATING
            </span>
          )}
          {!isLoading && forecast && (
            <span className="res-badge" style={{ fontSize: "7px", color: "rgba(255,255,255,0.25)" }}>AUTO / 30s</span>
          )}
        </div>
        <button
          className="res-btn-ghost"
          style={{ padding: "4px 10px", fontSize: "8px" }}
          onClick={() => setShowOptions((v) => !v)}
        >
          {showOptions ? "HIDE OPTIONS" : "OPTIONS ⚙"}
        </button>
      </div>

      {/* Collapsible options */}
      {showOptions && (
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", background: "var(--background2)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <div className="res-note" style={{ marginBottom: 4 }}>RACE RULE</div>
            <select
              value={raceRule}
              onChange={(e) => setRaceRule(e.target.value as RaceRule)}
              className="res-select"
              style={{ width: "100%" }}
            >
              <option value="PLURALITY">Plurality</option>
              <option value="MAJORITY">Majority / Runoff</option>
            </select>
          </div>
          <div>
            <div className="res-note" style={{ marginBottom: 4 }}>EXPECTED TURNOUT (OPTIONAL)</div>
            <input
              type="number"
              placeholder="e.g. 5000000"
              value={expectedTurnoutOverride}
              onChange={(e) => setExpectedTurnoutOverride(e.target.value)}
              className="res-input"
            />
          </div>
          <button
            className="res-btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={isLoading}
            onClick={() => {
              if (timestamps.length > 0 && historyList) {
                runForecastAtIndex(raceId, historyList.timestamps, historyIndex);
              } else {
                runForecastLive(raceId);
              }
            }}
          >
            {isLoading ? "RUNNING…" : "RERUN FORECAST"}
          </button>
        </div>
      )}

      <div style={{ padding: "12px" }}>
        {error && (
          <div style={{ border: "1px solid rgba(230,57,70,0.25)", background: "rgba(230,57,70,0.06)", color: "rgba(255,77,90,0.90)", padding: "8px 10px", fontFamily: "var(--font-body)", fontSize: "9.5px", letterSpacing: "0.10em", marginBottom: 10 }}>
            ⚠ {error}
          </div>
        )}

        {isLoading && !forecast && (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div className="res-note" style={{ color: "var(--purple-soft)", marginBottom: 10 }}>RUNNING FORECAST MODEL…</div>
            <div className="res-bar-track" style={{ width: "80%", margin: "0 auto" }}>
              <div className="res-bar-fill" style={{ width: "60%", background: "linear-gradient(90deg,var(--purple),var(--blue2))", animation: "res-loading-pulse 1.4s ease-in-out infinite" }} />
            </div>
          </div>
        )}

        {forecast && (
          <>
            {/* Mode trigger badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span className="res-note" style={{ color: "rgba(255,255,255,0.35)" }}>
                {forecast.race.percent_reporting}% REPORTING
              </span>
              <span className={`res-badge ${forecast.forecast.mode_trigger === "RUNOFF" ? "res-badge-red" : "res-badge-purple"}`}>
                {forecast.forecast.mode_trigger}
              </span>
            </div>

            {/* Candidate vote share cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              {(["Candidate1", "Candidate2"] as const).map((key) => {
                const color = candidateColors[key];
                const name = candidateLabels[key];
                const share = forecast.forecast.modeled_share[key];
                const votes = forecast.forecast.modeled_votes[key];
                const isLeader = forecast.forecast.leader === key;
                return (
                  <div key={key} className="res-stat-block" style={{ borderColor: isLeader ? color + "55" : "var(--border)", position: "relative" }}>
                    {isLeader && (
                      <div style={{ position: "absolute", top: 6, right: 8, fontSize: 7, color, fontWeight: 700, fontFamily: "var(--font-body)", letterSpacing: "0.16em" }}>
                        LEADER
                      </div>
                    )}
                    <div className="res-stat-block-label" style={{ color: color + "cc" }}>{name}</div>
                    <div className="res-stat-block-val" style={{ color, fontSize: "clamp(18px, 1.8vw, 24px)" }}>{fcastPct(share)}</div>
                    <div className="res-note" style={{ marginTop: 2 }}>{fcastFmt(votes)} PROJ</div>
                  </div>
                );
              })}
            </div>

            {/* If 3+ candidates */}
            {forecast.forecast.modeled_share["Candidate3"] > 0.005 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                {(["Candidate3", "Others"] as const).map((key) => {
                  const color = candidateColors[key];
                  const name = candidateLabels[key];
                  const share = key === "Others"
                    ? Math.max(0,
                        1 -
                        forecast.forecast.modeled_share["Candidate1"] -
                        forecast.forecast.modeled_share["Candidate2"] -
                        forecast.forecast.modeled_share["Candidate3"]
                      )
                    : forecast.forecast.modeled_share[key];

                  const votes = key === "Others"
                    ? Math.max(0,
                        forecast.forecast.modeled_total_vote -
                        forecast.forecast.modeled_votes["Candidate1"] -
                        forecast.forecast.modeled_votes["Candidate2"] -
                        forecast.forecast.modeled_votes["Candidate3"]
                      )
                    : forecast.forecast.modeled_votes[key];

                  
                  return (
                    <div key={key} className="res-stat-block">
                      <div className="res-stat-block-label" style={{ color: color + "cc" }}>{name}</div>
                      <div className="res-stat-block-val" style={{ color, fontSize: "clamp(14px, 1.4vw, 18px)" }}>{fcastPct(share)}</div>
                      <div className="res-note" style={{ marginTop: 2 }}>{fcastFmt(votes)} PROJ</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Win probability bars – now conditional on raceRule */}
            <div className="res-stat-block" style={{ marginBottom: 10 }}>
              <div className="res-stat-block-label" style={{ marginBottom: 8 }}>
                {raceRule === "PLURALITY" ? "WIN PROBABILITY (Most Votes)" : "MAJORITY WIN PROBABILITY (≥50%)"}
              </div>

              {FORECAST_CANDIDATE_KEYS.slice(0, 3).map((k) => {  // exclude Others
                // Pick the correct field based on current dropdown selection
                const probValue = raceRule === "PLURALITY"
                  ? forecast.forecast.plurality_odds_to_win[k]
                  : forecast.forecast.majority_win_prob[k];

                return (
                  probValue > 0.005 && (
                    <FcastProbBar
                      key={`${k}-${raceRule}`}  // force re-render on rule change
                      label={candidateLabels[k]}
                      value={probValue}
                      color={candidateColors[k]}
                    />
                  )
                );
              })}

              {/* Runoff Needed – only in majority */}
              {raceRule === "MAJORITY" && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                  <FcastProbBar
                    label="Runoff Needed"
                    value={forecast.forecast.runoff_needed_prob}
                    color="#f59e0b"
                  />
                </div>
              )}
            </div>

            {/* Runoff prob if majority rule */}
            {forecast.forecast.race_rule === "MAJORITY" && (
              <div className="res-stat-block" style={{ marginBottom: 10 }}>
                <div className="res-stat-block-label" style={{ marginBottom: 8 }}>RUNOFF PROBABILITY</div>
                {FORECAST_CANDIDATE_KEYS.map((k) => (
                  forecast.forecast.runoff_prob[k] > 0.005 && (
                    <FcastProbBar
                      key={k}
                      label={candidateLabels[k]}
                      value={forecast.forecast.runoff_prob[k]}
                      color={candidateColors[k]}
                    />
                  )
                ))}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                  <FcastProbBar label="Runoff Needed" value={forecast.forecast.runoff_needed_prob} color="#f59e0b" />
                </div>
              </div>
            )}

            {/* Key stats */}
            <div className="res-stat-block" style={{ marginBottom: 10 }}>
              <div className="res-stat-block-label" style={{ marginBottom: 8 }}>MODEL STATISTICS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  ["MODELED TOTAL", fcastFmt(forecast.forecast.modeled_total_vote)],
                  ["VOTES REMAINING", fcastFmt(forecast.forecast.modeled_vote_remaining)],
                  ["PROJ MARGIN", `${fcastFmt(forecast.forecast.projected_margin_votes)} (${fcastPct(forecast.forecast.projected_margin_pct)})`],
                  ["STD DEV", fcastFmt(forecast.forecast.sd_race)],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 3, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="res-note">{label}</span>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Historical playback slider */}
            {timestamps.length > 1 && (
              <div className="res-stat-block">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div className="res-stat-block-label">HISTORICAL PLAYBACK</div>
                  <button
                    className="res-btn-ghost"
                    style={{ padding: "4px 10px", fontSize: "8px" }}
                    onClick={() => {
                      if (playing) { setPlaying(false); return; }
                      if (historyIndex >= timestamps.length - 1) setHistoryIndex(0);
                      setPlaying(true);
                    }}
                  >
                    {playing ? "⏹ STOP" : "▶ PLAY"}
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span className="res-note">{fcastShortDate(timestamps[0])}</span>
                  <span className="res-note">{fcastShortDate(timestamps[timestamps.length - 1])}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={timestamps.length - 1}
                  value={historyIndex}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setHistoryIndex(idx);
                    if (historyList) runForecastAtIndex(raceId, historyList.timestamps, idx);
                  }}
                  style={{ width: "100%", accentColor: "var(--purple)", height: "4px", cursor: "pointer" }}
                />
                <div className="res-note" style={{ textAlign: "center", marginTop: 5, color: "var(--purple-soft)" }}>
                  {fcastShortDate(timestamps[historyIndex])} &nbsp;·&nbsp; {historyIndex + 1}/{timestamps.length}
                </div>
              </div>
            )}

            {timestamps.length === 0 && (
              <div className="res-note" style={{ textAlign: "center", fontStyle: "italic", paddingTop: 4 }}>
                No history snapshots available
              </div>
            )}
          </>
        )}
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
  useEffect(() => { setNowMs(Date.now()); }, []);

  // ── refreshTick: incremented every time results are refreshed.
  // Passed to ForecastPanel so it auto-reruns in sync. ──────────────────────
  const [refreshTick, setRefreshTick] = useState(0);

  const [overlay, setOverlay] = useState<null | { id: number; name: string; prob: number; color: string; reporting: number }>(null);
  const lastProjectedKeyRef = useRef<string>("");
  const [raceSearch, setRaceSearch] = useState("");
  const [raceSort, setRaceSort] = useState<"label" | "reporting" | "close">("reporting");

  const featuredByState = useMemo(() => ({
    TX: FEATURED.filter((r) => r.state === "TX"),
    NC: FEATURED.filter((r) => r.state === "NC"),
    AR: FEATURED.filter((r) => r.state === "AR"),
    TEST: FEATURED.filter((r) => r.state === "TEST"),
  }), []);

  const selectedRace = raceCache[selectedId];
  const selectedMeta = useMemo(() => FEATURED.find((r) => r.id === selectedId), [selectedId]);

  async function refreshFeatured() {
    try {
      const results = await Promise.all(FEATURED.map((r) => fetchRaceById(r.id).then((d) => [r.id, d] as const)));
      setRaceCache(Object.fromEntries(results));
      // Bump the tick so ForecastPanel knows to re-run
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

  useEffect(() => { const first = featuredByState[activeState]?.[0]; if (first && !FEATURED.some((r) => r.id === selectedId && r.state === activeState)) setSelectedId(first.id); }, [activeState, featuredByState, selectedId]);

  useEffect(() => {
    const race = selectedRace;
    if (!race?.candidates?.length) return;
    const reporting = race.percent_reporting ?? 0;
    if (race.candidates.find((c) => c.winner)) return;
    if (reporting < 5) return;
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

  const racesForState = useMemo(() => {
    const base = featuredByState[activeState] ?? [];
    const filtered = raceSearch.trim() ? base.filter((r) => r.label.toLowerCase().includes(raceSearch.trim().toLowerCase())) : base;
    return [...filtered].sort((a, b) => {
      const ra = raceCache[a.id], rb = raceCache[b.id];
      if (raceSort === "label") return a.label.localeCompare(b.label);
      if (raceSort === "close") { const da = parseIsoDate(ra?.polls_close ?? null)?.getTime() ?? Infinity; const db = parseIsoDate(rb?.polls_close ?? null)?.getTime() ?? Infinity; return da - db; }
      return (getRaceReportingPct(rb) ?? -1) - (getRaceReportingPct(ra) ?? -1);
    });
  }, [activeState, featuredByState, raceSearch, raceSort, raceCache]);

  const selectedReporting = selectedRace?.percent_reporting ?? 0;
  const selectedCloseDate = parseIsoDate(selectedRace?.polls_close ?? null);
  const selectedCloseLocal = selectedCloseDate ? formatLocalCloseTime(selectedCloseDate) : "—";
  const selectedMsLeft = selectedCloseDate ? selectedCloseDate.getTime() - nowMs : null;
  const selectedProj = useMemo(() => getRaceProjectionAlways(selectedRace), [selectedRace]);
  const selectedWinner = selectedRace?.candidates?.find((c) => c.winner);

  const timeStr = nowMs > 0
    ? new Date(nowMs).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";

  return (
    <>
      <style>{`
        /* ── PSI Design Tokens ── */
        .res-root {
          --background:  #070709;
          --background2: #0b0b0f;
          --panel:       #0f0f15;
          --panel2:      #141420;
          --foreground:  #f0f0f5;
          --muted:       rgba(240,240,245,0.62);
          --muted2:      rgba(240,240,245,0.40);
          --muted3:      rgba(240,240,245,0.22);
          --border:      rgba(255,255,255,0.09);
          --border2:     rgba(255,255,255,0.15);
          --border3:     rgba(255,255,255,0.22);
          --purple:      #7c3aed;
          --purple2:     #9d5cf0;
          --purple-soft: #a78bfa;
          --purple-dim:  rgba(124,58,237,0.14);
          --red:         #e63946;
          --red2:        #ff4d5a;
          --blue:        #2563eb;
          --blue2:       #3b82f6;
          --win:         #4ade80;
          --rep:         #e63946;
          --dem:         #3b82f6;
          --shadow-md:   0 10px 40px rgba(0,0,0,0.75);
        }

        @keyframes res-fade-up {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes res-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.35; transform:scale(0.82); }
        }
        @keyframes county-pop {
          0%   { filter: brightness(1); }
          40%  { filter: brightness(2.2) saturate(1.4); }
          100% { filter: brightness(1); }
        }
        @keyframes res-loading-pulse {
          0%,100% { opacity: 0.4; }
          50%     { opacity: 1; }
        }
        .county-pop { animation: county-pop 520ms ease-out; }

        .res-tri-stripe {
          height: 3px; width: 100%;
          background: linear-gradient(90deg, var(--red) 0%, var(--red) 33.33%, var(--purple) 33.33%, var(--purple) 66.66%, var(--blue) 66.66%, var(--blue) 100%);
          flex-shrink: 0;
        }
        .res-live-dot {
          display: inline-block; width: 6px; height: 6px; border-radius: 50%;
          background: var(--rep); box-shadow: 0 0 8px rgba(230,57,70,0.7);
          animation: res-pulse 1.8s ease-in-out infinite; flex-shrink: 0;
        }
        .res-eyebrow {
          display: flex; align-items: center; gap: 7px;
          font-family: var(--font-body); font-size: 8.5px;
          font-weight: 700; letter-spacing: 0.30em; text-transform: uppercase; color: var(--muted3);
        }
        .res-note {
          font-family: var(--font-body); font-size: 8.5px;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted3);
        }
        .res-th {
          font-family: var(--font-body); font-size: 7.5px; font-weight: 700;
          letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted3);
        }
        .res-num { font-family: var(--font-body); font-size: 10.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .res-pct-big { font-family: var(--font-body); font-size: 13px; font-weight: 900; color: #fff; font-variant-numeric: tabular-nums; }
        .res-pct-xl { font-family: var(--font-body); font-size: clamp(22px, 2.5vw, 30px); font-weight: 900; color: #fff; font-variant-numeric: tabular-nums; line-height: 1; }
        .res-stat-label { font-family: var(--font-body); font-size: 7.5px; font-weight: 700; letter-spacing: 0.26em; text-transform: uppercase; color: var(--muted3); }
        .res-stat-val { font-family: var(--font-body); font-size: 10px; font-weight: 700; letter-spacing: 0.14em; color: var(--muted); }
        .res-stat-row { display: flex; align-items: center; justify-content: space-between; }

        .res-badge {
          display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px;
          font-family: var(--font-body); font-size: 7.5px; font-weight: 700;
          letter-spacing: 0.20em; text-transform: uppercase;
          border: 1px solid var(--border); background: rgba(255,255,255,0.03); color: var(--muted3);
        }
        .res-badge-purple { border-color: rgba(124,58,237,0.40); background: rgba(124,58,237,0.08); color: var(--purple-soft); }
        .res-badge-win { border-color: rgba(74,222,128,0.28); background: rgba(74,222,128,0.08); color: var(--win); }
        .res-badge-red { border-color: rgba(230,57,70,0.30); background: rgba(230,57,70,0.08); color: var(--rep); }
        .res-badge-blue { border-color: rgba(59,130,246,0.30); background: rgba(59,130,246,0.08); color: var(--dem); }

        .res-bar-track { width: 100%; height: 3px; background: rgba(255,255,255,0.08); position: relative; overflow: hidden; }
        .res-bar-fill { position: absolute; top:0; left:0; bottom:0; background: var(--purple); transition: width 600ms cubic-bezier(0.22,1,0.36,1); }

        .res-panel { background: var(--panel); border: 1px solid var(--border); overflow: hidden; animation: res-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        .res-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--background2); }
        .res-panel-tag { font-family: var(--font-body); font-size: 8px; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase; color: var(--purple-soft); }

        .res-stat-block { background: rgba(255,255,255,0.025); border: 1px solid var(--border); padding: 12px 14px; }
        .res-stat-block-label { font-family: var(--font-body); font-size: 7.5px; font-weight: 700; letter-spacing: 0.26em; text-transform: uppercase; color: var(--muted3); margin-bottom: 4px; }
        .res-stat-block-val { font-family: var(--font-body); font-size: clamp(20px, 2.5vw, 28px); font-weight: 900; color: #fff; line-height: 1; font-variant-numeric: tabular-nums; }

        .res-btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: var(--purple); border: 1px solid rgba(124,58,237,0.65); color: #fff; font-family: var(--font-body); font-size: 9.5px; font-weight: 700; letter-spacing: 0.20em; text-transform: uppercase; cursor: pointer; transition: background 140ms ease, transform 140ms ease; }
        .res-btn-primary:hover { background: var(--purple2); transform: translateY(-1px); }
        .res-btn-ghost { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: transparent; border: 1px solid var(--border); color: var(--muted3); font-family: var(--font-body); font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; transition: all 140ms ease; }
        .res-btn-ghost:hover { border-color: var(--border2); color: var(--muted); }
        .res-btn-state { display: inline-flex; align-items: center; padding: 8px 16px; background: transparent; border: 1px solid var(--border); color: var(--muted3); font-family: var(--font-body); font-size: 9px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; cursor: pointer; transition: all 120ms ease; position: relative; overflow: hidden; }
        .res-btn-state::before { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: var(--purple); transform: scaleX(0); transform-origin: left; transition: transform 200ms ease; }
        .res-btn-state:hover { color: rgba(255,255,255,0.7); border-color: var(--border2); }
        .res-btn-state:hover::before { transform: scaleX(1); }
        .res-btn-state.active { background: rgba(124,58,237,0.10); border-color: rgba(124,58,237,0.40); color: #fff; }
        .res-btn-state.active::before { transform: scaleX(1); }
        .res-close-btn { display: inline-flex; align-items: center; padding: 7px 12px; background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: var(--muted2); font-family: var(--font-body); font-size: 8.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; cursor: pointer; flex-shrink: 0; transition: all 120ms ease; }
        .res-close-btn:hover { border-color: var(--border2); color: rgba(255,255,255,0.7); }

        .res-overlay-card { background: var(--panel); border: 1px solid rgba(124,58,237,0.45); box-shadow: 0 0 80px rgba(124,58,237,0.25), 0 30px 80px rgba(0,0,0,0.8); }
        .res-overlay-title { font-family: var(--font-body); font-size: clamp(32px, 4vw, 48px); font-weight: 900; text-transform: uppercase; letter-spacing: 0.02em; color: #fff; line-height: 0.92; }
        .res-overlay-name { font-family: var(--font-body); font-size: clamp(18px, 2.5vw, 26px); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }

        .res-map-tooltip { background: rgba(8,8,14,0.96); border: 1px solid rgba(124,58,237,0.45); box-shadow: 0 20px 60px rgba(0,0,0,0.85); }
        .res-tooltip-title { font-family: var(--font-body); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: #fff; }
        .res-reporting-row { display: flex; align-items: center; justify-content: space-between; }

        .res-candidate-list { border: 1px solid var(--border); background: var(--panel); overflow: hidden; }
        .res-candidate-row { display: flex; align-items: center; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.07); padding: 14px 16px; transition: background 120ms ease; position: relative; }
        .res-candidate-row:last-child { border-bottom: none; }
        .res-candidate-row:hover { background: rgba(255,255,255,0.015); }
        .res-cand-bar { width: 3px; height: 100%; position: absolute; left: 0; top: 0; bottom: 0; opacity: 0.7; }
        .res-cand-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .res-cand-name { font-family: var(--font-body); font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; color: rgba(255,255,255,0.85); }
        .res-cand-name-lg { font-family: var(--font-body); font-size: 12px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.9); }
        .res-cand-party { font-family: var(--font-body); font-size: 8px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted3); margin-top: 1px; }

        .res-thead { position: sticky; top: 0; background: var(--background2); border-bottom: 1px solid var(--border); }
        .res-table-row { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 100ms ease; }
        .res-table-row:hover { background: rgba(255,255,255,0.012); }

        .res-race-item { display: block; width: 100%; text-align: left; padding: 12px 14px; border: 1px solid var(--border); background: transparent; cursor: pointer; transition: all 140ms ease; position: relative; overflow: hidden; }
        .res-race-item::before { content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: 2px; background: var(--purple); transform: scaleY(0); transform-origin: top; transition: transform 200ms ease; }
        .res-race-item:hover { background: rgba(255,255,255,0.02); border-color: var(--border2); }
        .res-race-item:hover::before { transform: scaleY(1); }
        .res-race-item.active { background: rgba(124,58,237,0.07); border-color: rgba(124,58,237,0.35); }
        .res-race-item.active::before { transform: scaleY(1); }
        .res-race-label { font-family: var(--font-body); font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.88); display: block; margin-bottom: 4px; line-height: 1.3; }
        .res-race-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .res-race-party-rep { color: var(--rep); }
        .res-race-party-dem { color: var(--dem); }
        .res-reporting-mini { height: 2px; background: rgba(255,255,255,0.08); margin-top: 8px; overflow: hidden; }
        .res-reporting-mini-fill { height: 100%; background: rgba(255,255,255,0.20); transition: width 800ms ease; }
        .res-proj-chip { border: 1px solid rgba(124,58,237,0.20); background: rgba(124,58,237,0.05); padding: 6px 10px; margin-top: 8px; }
        .res-win-chip { border: 1px solid rgba(74,222,128,0.20); background: rgba(74,222,128,0.05); padding: 6px 10px; margin-top: 8px; }

        .res-input { width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border); color: var(--foreground); padding: 8px 12px; font-family: var(--font-body); font-size: 10px; letter-spacing: 0.10em; outline: none; transition: border-color 140ms ease; }
        .res-input:focus { border-color: rgba(124,58,237,0.40); }
        .res-input::placeholder { color: var(--muted3); }
        .res-select { background: rgba(255,255,255,0.03); border: 1px solid var(--border); color: var(--muted2); padding: 8px 10px; font-family: var(--font-body); font-size: 9px; letter-spacing: 0.10em; outline: none; }

        .res-status-bar { background: var(--background2); border-bottom: 1px solid var(--border); padding: 8px 0; }
        .res-status-bar-inner { max-width: 1720px; margin: 0 auto; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }

        .res-page-header { border-bottom: 1px solid var(--border); background: var(--background2); position: relative; overflow: hidden; }
        .res-page-header::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 40% 80% at 0% 50%, rgba(230,57,70,0.04) 0%, transparent 70%), radial-gradient(ellipse 40% 80% at 100% 50%, rgba(37,99,235,0.05) 0%, transparent 70%); pointer-events: none; }
        .res-page-header-inner { max-width: 1720px; margin: 0 auto; padding: 24px 20px 20px; position: relative; }
        .res-page-title { font-family: var(--font-display); font-size: clamp(28px, 4vw, 58px); font-weight: 900; text-transform: uppercase; letter-spacing: 0.01em; color: #fff; line-height: 0.92; margin: 0; }
        .res-page-title em { font-style: normal; background: linear-gradient(100deg, var(--red2) 0%, var(--purple-soft) 50%, var(--blue2) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .res-page-sub { font-family: var(--font-body); font-size: 8.5px; font-weight: 700; letter-spacing: 0.30em; text-transform: uppercase; color: var(--purple-soft); margin-bottom: 12px; }

        .res-map-loading { display: flex; align-items: center; justify-content: center; aspect-ratio: 16/9; background: rgba(0,0,0,0.30); border: 1px solid var(--border); }
        .res-map-wrap { background: rgba(0,0,0,0.20); border: 1px solid var(--border); padding: 8px; }
        .res-error { border: 1px solid rgba(230,57,70,0.25); background: rgba(230,57,70,0.06); color: rgba(255,77,90,0.90); padding: 12px 16px; font-family: var(--font-body); font-size: 10.5px; letter-spacing: 0.12em; }

        .res-layout { max-width: 1720px; margin: 0 auto; display: grid; grid-template-columns: 320px 1fr 320px; gap: 16px; padding: 20px; align-items: stretch; }
        @media (max-width: 1200px) {
          .res-layout { grid-template-columns: 280px 1fr; }
          .res-right-rail { display: none; }
        }
        @media (max-width: 860px) {
          .res-layout { grid-template-columns: 1fr; padding: 12px; gap: 12px; }
        }
        .res-left-rail { overflow: hidden; }
        .res-center { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
        .res-right-rail { position: sticky; top: 72px; display: flex; flex-direction: column; gap: 14px; }

        * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.10) transparent; }
        *::-webkit-scrollbar { width: 3px; height: 3px; }
        *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); }
        *::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.4); }

        @media (prefers-reduced-motion: reduce) {
          .res-bar-fill, .res-btn-primary, .res-btn-ghost, .res-btn-state { transition: none !important; }
          .res-live-dot { animation: none !important; }
        }
        input[type=range] { height: 4px; cursor: pointer; }
      `}</style>

      <main className="res-root" style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>

        {overlay && (
          <ProjectedWinnerOverlay show={!!overlay} candidate={overlay.name} prob={overlay.prob} color={overlay.color} reporting={overlay.reporting} onDismiss={() => setOverlay(null)} />
        )}

        <div className="res-tri-stripe" />
        <div className="res-status-bar">
          <div className="res-status-bar-inner">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="res-live-dot" />
              <span className="res-eyebrow" style={{ color: "rgba(255,255,255,0.40)" }}>
                LIVE ELECTION RESULTS
                <span style={{ color: "var(--border3)", margin: "0 4px" }}>·</span>
                POWERED BY CIVICAPI.ORG
              </span>
            </div>
            <div className="res-note" style={{ letterSpacing: "0.22em", color: "rgba(255,255,255,0.22)" }} suppressHydrationWarning>{timeStr}</div>
          </div>
        </div>

        <div className="res-page-header">
          <div className="res-page-header-inner">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "16px" }}>
              <div>
                <div className="res-page-sub">MARCH 3RD PRIMARY ELECTIONS · 2026</div>
                <h1 className="res-page-title">Election <em>Night</em></h1>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "14px" }}>
                  <span className="res-badge res-badge-red">
                    <span className="res-live-dot" style={{ background: "var(--rep)" }} />
                    LIVE
                  </span>
                  <span className="res-badge res-badge-purple">RESULTS + FORECAST / 30s</span>
                  {selectedRace?.last_updated && (
                    <span className="res-badge">UPDATED {prettyTime(selectedRace.last_updated)}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: "1px" }}>
                {(["TX", "NC", "AR"] as const).map((st) => (
                  <button key={st} className={`res-btn-state ${activeState === st ? "active" : ""}`} onClick={() => setActiveState(st)}>
                    {stateLabels[st]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="res-layout">

          {/* LEFT RAIL */}
          <aside className="res-left-rail res-panel">
            <div className="res-panel-header">
              <span className="res-panel-tag">RACES</span>
              <span className="res-note">{racesForState.length} CONTESTS</span>
            </div>
            <div style={{ padding: "10px", borderBottom: "1px solid var(--border)", display: "flex", gap: "6px", background: "var(--background2)" }}>
              <input className="res-input" value={raceSearch} onChange={(e) => setRaceSearch(e.target.value)} placeholder="SEARCH RACES…" />
              <select className="res-select" value={raceSort} onChange={(e) => setRaceSort(e.target.value as any)}>
                <option value="reporting">RPT</option>
                <option value="close">CLOSE</option>
                <option value="label">A–Z</option>
              </select>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
              {racesForState.map((fr) => {
                const liveData = raceCache[fr.id];
                const winner = liveData?.candidates?.find((c) => c.winner);
                const reporting = getRaceReportingPct(liveData);
                const projection = getRaceProjectionAlways(liveData);
                const closeDate = parseIsoDate(liveData?.polls_close ?? null);
                const closeTimeLocal = closeDate ? formatLocalCloseTime(closeDate) : "—";
                const msLeft = closeDate ? closeDate.getTime() - nowMs : null;
                const countdownLabel = msLeft === null ? "—" : formatCountdown(msLeft);
                const isSelected = fr.id === selectedId;
                const partyClass = fr.party === "Republican" ? "res-race-party-rep" : fr.party === "Democratic" ? "res-race-party-dem" : "";
                const hasForecast = !!RACE_FORECAST_DEFAULTS[fr.id];

                return (
                  <button key={fr.id} className={`res-race-item ${isSelected ? "active" : ""}`} onClick={() => setSelectedId(fr.id)}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span className="res-race-label" style={{ margin: 0 }}>{fr.label}</span>
                      {hasForecast && (
                        <span className="res-badge res-badge-purple" style={{ fontSize: "6.5px", flexShrink: 0, marginLeft: 4 }}>FORECAST</span>
                      )}
                    </div>
                    <div className="res-race-meta">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className={`res-note ${partyClass}`} style={{ fontWeight: 700 }}>{fr.party.toUpperCase()}</span>
                        <span className="res-note">· {closeTimeLocal}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="res-note" style={{ color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>{reporting !== null ? `${reporting.toFixed(1)}%` : "—"}</div>
                        <div className="res-note" style={{ color: msLeft && msLeft > 0 ? "var(--muted3)" : "var(--rep)", fontWeight: 700 }}>{countdownLabel}</div>
                      </div>
                    </div>
                    {!winner && (
                      <div className="res-reporting-mini">
                        <div className="res-reporting-mini-fill" style={{ width: `${reporting ?? 0}%` }} />
                      </div>
                    )}
                    {!winner && projection && projection.prob > 50 && (
                      <div className="res-proj-chip">
                        <div className="res-stat-row" style={{ marginBottom: "4px" }}>
                          <span className="res-note" style={{ color: "var(--purple-soft)", fontWeight: 700 }}>PROJ WIN</span>
                          <span className="res-note" style={{ color: "var(--purple-soft)", fontWeight: 700 }}>{projection.prob.toFixed(0)}%</span>
                        </div>
                        <div className="res-bar-track" style={{ height: "2px" }}>
                          <div className="res-bar-fill" style={{ width: `${Math.max(0, Math.min(100, projection.prob))}%`, height: "2px" }} />
                        </div>
                        <div className="res-note" style={{ marginTop: "4px" }}>{projection.leaderName}</div>
                      </div>
                    )}
                    {winner && (
                      <div className="res-win-chip">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--win)", display: "inline-block", flexShrink: 0 }} />
                          <span className="res-note" style={{ color: "var(--win)", fontWeight: 700 }}>WINNER: {winner.name.toUpperCase()}</span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* CENTER */}
          <section className="res-center">
            <div className="res-panel">
              <div className="res-tri-stripe" />
              <div className="res-panel-header" style={{ flexWrap: "wrap", gap: "10px" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="res-panel-tag">{selectedMeta?.label ?? "—"}</div>
                  <div className="res-note" style={{ marginTop: "3px" }}>
                    {selectedRace?.percent_reporting?.toFixed(1)}% REPORTING · {prettyTime(selectedRace?.last_updated)}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                  <span className="res-badge">{selectedCloseLocal}</span>
                  <span className={`res-badge ${selectedMsLeft && selectedMsLeft > 0 ? "" : "res-badge-red"}`}>
                    {selectedMsLeft === null ? "—" : formatCountdown(selectedMsLeft)}
                  </span>
                  <span className="res-badge res-badge-purple">
                    {loadingMap ? `SYNCING ${Math.round(mapLoadPct)}%` : "● LIVE"}
                  </span>
                </div>
              </div>
              <div style={{ padding: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <Legend />
                  <span className="res-note">HOVER COUNTIES FOR DETAILS</span>
                </div>
                {loadingMap ? (
                  <div className="res-map-loading">
                    <div style={{ width: "min(380px, 90%)" }}>
                      <div className="res-note" style={{ textAlign: "center", marginBottom: "10px", color: "rgba(255,255,255,0.4)" }}>LOADING MAP</div>
                      <div className="res-bar-track">
                        <div className="res-bar-fill" style={{ width: `${mapLoadPct}%`, background: "linear-gradient(90deg,var(--purple),var(--blue2))" }} />
                      </div>
                      <div className="res-note" style={{ textAlign: "center", marginTop: "8px", color: "var(--purple-soft)", fontWeight: 700 }}>{Math.round(mapLoadPct)}%</div>
                    </div>
                  </div>
                ) : mapBlankSvg ? (
                  <div className="res-map-wrap">
                    <MapWithCountyTooltip svgText={mapBlankSvg} regionResults={selectedRace?.region_results ?? []} />
                  </div>
                ) : (
                  <div className="res-map-loading">
                    <span className="res-note" style={{ color: "var(--muted3)" }}>NO MAP DATA</span>
                  </div>
                )}
              </div>
            </div>

            <CountyTotalsTable regionResults={selectedRace?.region_results ?? []} />
            {error && <div className="res-error">ERROR: {error}</div>}
          </section>

          {/* RIGHT RAIL */}
          <aside className="res-right-rail">

            {/* Topline */}
            <div className="res-panel">
              <div className="res-tri-stripe" />
              <div className="res-panel-header">
                <span className="res-panel-tag">TOPLINE</span>
                {selectedRace?.percent_reporting !== undefined && (
                  <span className="res-note" style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{selectedRace.percent_reporting.toFixed(1)}% IN</span>
                )}
              </div>
              <div style={{ padding: "12px" }}>
                {selectedRace?.candidates
                  ? <CandidateList candidates={selectedRace.candidates} reporting={selectedRace.percent_reporting ?? 0} raceId={selectedId} />
                  : <div style={{ padding: "40px 0", textAlign: "center" }} className="res-note">LOADING…</div>
                }
              </div>
            </div>

            {/* Status */}
            <div className="res-panel" style={{ padding: "0" }}>
              <div className="res-panel-header">
                <span className="res-panel-tag">RACE STATUS</span>
              </div>
              <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div className="res-stat-block">
                    <div className="res-stat-block-label">REPORTING</div>
                    <div className="res-stat-block-val">{selectedReporting.toFixed(1)}%</div>
                    <div className="res-bar-track" style={{ marginTop: "8px" }}>
                      <div className="res-bar-fill" style={{ width: `${selectedReporting}%`, background: "var(--purple)" }} />
                    </div>
                  </div>
                  <div className="res-stat-block">
                    <div className="res-stat-block-label">CLOSES</div>
                    <div className="res-stat-block-val">{selectedCloseLocal}</div>
                    <div className="res-note" style={{ marginTop: "6px", color: selectedMsLeft && selectedMsLeft > 0 ? "var(--muted3)" : "var(--rep)", fontWeight: 700 }}>
                      {selectedMsLeft === null ? "—" : formatCountdown(selectedMsLeft)}
                    </div>
                  </div>
                </div>
                <div className="res-stat-block">
                  <div className="res-stat-row" style={{ marginBottom: "6px" }}>
                    <span className="res-stat-block-label">PROJECTION</span>
                    <span className="res-note" style={{ color: selectedWinner ? "var(--win)" : "var(--purple-soft)", fontWeight: 700 }}>
                      {selectedWinner ? "OFFICIAL" : selectedProj ? `${selectedProj.prob.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.88)" }}>
                    {selectedWinner ? `✓ ${selectedWinner.name}` : selectedProj ? selectedProj.leaderName : "No projection yet"}
                  </div>
                  {selectedProj && !selectedWinner && (
                    <div className="res-bar-track" style={{ marginTop: "8px" }}>
                      <div className="res-bar-fill" style={{ width: `${Math.max(0, Math.min(100, selectedProj.prob))}%`, background: "linear-gradient(90deg,var(--purple),var(--blue2))" }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Forecast — only for races with known predictions, auto-updates every 30s */}
            {RACE_FORECAST_DEFAULTS[selectedId] && (
              <ForecastPanel raceId={selectedId} refreshTick={refreshTick} />
            )}

          </aside>
        </div>
      </main>
    </>
  );
}