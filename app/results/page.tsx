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
type RaceType = "Democratic Primary" | "Republican Primary" | "Special Election" | "General Election";
type FeaturedRace = { id: number; state: "IL" | "TEST"; office: string; raceType: RaceType; label: string; };

function getRaceTypeColor(raceType: RaceType): string {
  if (raceType === "Republican Primary") return "#d45b5b";
  if (raceType === "Democratic Primary") return "#5b8fd4";
  if (raceType === "General Election") return "#c5a55a";
  return "#888";
}

function getRaceTypeShort(raceType: RaceType): string {
  if (raceType === "Republican Primary") return "R";
  if (raceType === "Democratic Primary") return "D";
  if (raceType === "General Election") return "G";
  return "S";
}

const FEATURED: FeaturedRace[] = [
  { id: 55550, state: "IL", office: "US Senate", raceType: "Democratic Primary", label: "IL US Senate — Democratic Primary" },
  { id: 55551, state: "IL", office: "US Senate", raceType: "Republican Primary", label: "IL US Senate — Republican Primary" },
  { id: 55552, state: "IL", office: "Governor", raceType: "Democratic Primary", label: "IL Governor — Democratic Primary" },
  { id: 55553, state: "IL", office: "Governor", raceType: "Republican Primary", label: "IL Governor — Republican Primary" },
  { id: 55554, state: "IL", office: "Secretary of State", raceType: "Democratic Primary", label: "IL Secretary of State — Democratic Primary" },
  { id: 55555, state: "IL", office: "Secretary of State", raceType: "Republican Primary", label: "IL Secretary of State — Republican Primary" },
  { id: 55556, state: "IL", office: "Attorney General", raceType: "Democratic Primary", label: "IL Attorney General — Democratic Primary" },
  { id: 55557, state: "IL", office: "Attorney General", raceType: "Republican Primary", label: "IL Attorney General — Republican Primary" },
  { id: 55558, state: "IL", office: "Comptroller", raceType: "Democratic Primary", label: "IL Comptroller — Democratic Primary" },
  { id: 55559, state: "IL", office: "Comptroller", raceType: "Republican Primary", label: "IL Comptroller — Republican Primary" },
  { id: 55560, state: "IL", office: "Treasurer", raceType: "Republican Primary", label: "IL Treasurer — Republican Primary" },
  { id: 55561, state: "IL", office: "Treasurer", raceType: "Democratic Primary", label: "IL Treasurer — Democratic Primary" },
  { id: 55562, state: "IL", office: "US House 1", raceType: "Democratic Primary", label: "IL District 1 — Democratic Primary" },
  { id: 55563, state: "IL", office: "US House 1", raceType: "Republican Primary", label: "IL District 1 — Republican Primary" },
];

const RACE_FORECAST_DEFAULTS: Partial<Record<number, { raceRule: RaceRule; expectedTurnout?: number; pollAvg?: Record<string, number>; }>> = {
  55550: { raceRule: "PLURALITY", expectedTurnout: 850_000, pollAvg: { "Krishnamoorthi": 31.6, "Stratton": 29.4, "Kelly": 13.6, "Bustos": 3.0, "Others": 22.4 } },
  55551: { raceRule: "PLURALITY", expectedTurnout: 700_000, pollAvg: { "Tracy": 45.0, "Evans": 32.0, "Chlebek": 13.0, "Others": 10.0 } },
  55552: { raceRule: "PLURALITY", expectedTurnout: 900_000, pollAvg: { "Pritzker": 100.0 } },
  55553: { raceRule: "PLURALITY", expectedTurnout: 700_000, pollAvg: { "Bailey": 38.0, "Dabrowski": 28.0, "Heidner": 20.0, "Mendrick": 14.0 } },
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
function prettyTime(iso?: string | null) { if (!iso) return "—"; return new Date(iso).toLocaleString(); }
function parseIsoDate(iso?: string | null): Date | null { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d; }
function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "Closed";
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
  switch (bucket) { case "safe": l = 0.5; break; case "likely": l = 0.65; break; case "lean": l = 0.8; break; case "tilt": l = 0.92; break; case "tied": l = 0.96; break; }
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
function countyTotalVotes(rr: any): number { return getCandidatesFromRR(rr).reduce((sum, c) => sum + (safeNum(c?.votes) ?? 0), 0); }

// ─── MAP ──────────────────────────────────────────────────────────────────────
function MapWithCountyTooltip({ svgText, regionResults }: { svgText: string; regionResults: RegionResult[] | Record<string, RegionResult> }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, x: 0, y: 0, title: "", reporting: null, reportingPct: null, lines: [] });
  const countyFingerprintsRef = useRef<Map<string, string>>(new Map());
  const countyVoteTotalsRef = useRef<Map<string, number>>(new Map());
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, tx: 0, ty: 0 });
  const [scale, setScale] = useState(1);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const toggleLock = useCallback(() => { lockedRef.current = !lockedRef.current; setLocked(lockedRef.current); }, []);
  const regionResultsArr = useMemo(() => coerceRegionResults(regionResults), [regionResults]);
  const regionMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const rr of regionResultsArr as any[]) { const k = normalizeRegionName(String(rr?.region?.name ?? rr?.name ?? "")); if (!k) continue; m.set(k, rr); }
    return m;
  }, [regionResultsArr]);
  const flashCounty = useCallback((shape: SVGGraphicsElement) => { shape.classList.remove("er-county-update"); void (shape as any).offsetWidth; shape.classList.add("er-county-update"); setTimeout(() => shape.classList.remove("er-county-update"), 1200); }, []);
  const applyTransform = useCallback(() => { const host = wrapRef.current; if (!host) return; const svg = host.querySelector("svg"); if (!svg) return; const { scale, x, y } = transformRef.current; svg.style.transform = `translate(${x}px, ${y}px) scale(${scale})`; svg.style.transformOrigin = "0 0"; }, []);
  const resetZoom = useCallback(() => { transformRef.current = { scale: 1, x: 0, y: 0 }; setScale(1); applyTransform(); }, [applyTransform]);

  useEffect(() => {
    const host = wrapRef.current; if (!host) return;
    const onWheel = (e: WheelEvent) => { if (lockedRef.current) return; e.preventDefault(); const rect = host.getBoundingClientRect(); const mx = e.clientX - rect.left, my = e.clientY - rect.top; const { scale: s, x, y } = transformRef.current; const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15; const newScale = Math.min(8, Math.max(1, s * delta)); const newX = mx - (mx - x) * (newScale / s), newY = my - (my - y) * (newScale / s); transformRef.current = { scale: newScale, x: newX, y: newY }; setScale(newScale); applyTransform(); };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [applyTransform]);

  useEffect(() => {
    const host = wrapRef.current; if (!host) return;
    let capturedId: number | null = null;
    const onDown = (e: PointerEvent) => { isPanningRef.current = false; capturedId = e.pointerId; panStartRef.current = { mx: e.clientX, my: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y }; };
    const onMove = (e: PointerEvent) => { if (e.buttons === 0) return; const dx = e.clientX - panStartRef.current.mx, dy = e.clientY - panStartRef.current.my; if (!isPanningRef.current && Math.sqrt(dx * dx + dy * dy) > 4) { isPanningRef.current = true; setTooltip((t) => ({ ...t, show: false })); if (capturedId !== null) { try { host.setPointerCapture(capturedId); } catch {} } host.style.cursor = "grabbing"; } if (!isPanningRef.current) return; transformRef.current.x = panStartRef.current.tx + dx; transformRef.current.y = panStartRef.current.ty + dy; applyTransform(); };
    const onUp = () => { isPanningRef.current = false; capturedId = null; host.style.cursor = "crosshair"; };
    host.addEventListener("pointerdown", onDown); host.addEventListener("pointermove", onMove); host.addEventListener("pointerup", onUp);
    return () => { host.removeEventListener("pointerdown", onDown); host.removeEventListener("pointermove", onMove); host.removeEventListener("pointerup", onUp); };
  }, [applyTransform]);

  useEffect(() => {
    const host = wrapRef.current; if (!host) return;
    host.innerHTML = svgText;
    const svg = host.querySelector("svg"); if (!svg) return;
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%"; svg.style.height = "100%"; svg.style.display = "block"; svg.style.transformOrigin = "0 0";
    countyFingerprintsRef.current = new Map();
    const shapes = Array.from(svg.querySelectorAll("path, polygon")) as SVGGraphicsElement[];
    shapes.forEach((shape) => {
      const key = getRegionKeyFromElement(shape); if (!key) return;
      const prettyKey = titleCaseKey(key);
      shape.style.pointerEvents = "all"; shape.style.cursor = "crosshair";
      shape.style.stroke = "rgba(255,255,255,0.12)"; shape.style.strokeWidth = "0.6";
      shape.style.transition = "fill 420ms ease, filter 300ms ease";
      const onMove = (ev: PointerEvent) => {
        if (isPanningRef.current) return;
        const currentRR = regionMap.get(key);
        const tw = 280, th = 240, p = 10, offset = 12;
        const rect = host.getBoundingClientRect();
        const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
        let x = px + offset, y = py + offset;
        if (x + tw > rect.width - p) x = px - tw - offset;
        if (y + th > rect.height - p) y = py - th - offset;
        x = Math.max(p, Math.min(rect.width - tw - p, x)); y = Math.max(p, Math.min(rect.height - th - p, y));
        const pct = typeof currentRR?.region?.percent_reporting === "number" ? currentRR.region.percent_reporting : typeof currentRR?.percent_reporting === "number" ? currentRR.percent_reporting : null;
        const lines = currentRR ? buildTooltipLines(currentRR) : [];
        const hasVotes = lines.some((l) => l.votes !== null && l.votes > 0);
        setTooltip({ show: true, x, y, title: currentRR?.region?.name ?? (currentRR?.name ? titleCaseKey(currentRR.name) : prettyKey), reporting: pct !== null ? `${pct.toFixed(1)}% reporting` : "0% reporting", reportingPct: pct ?? 0, lines: hasVotes ? lines : [] });
      };
      const onEnter = (ev: PointerEvent) => { if (isPanningRef.current) return; shape.style.stroke = "rgba(255,255,255,0.5)"; shape.style.strokeWidth = "1.5"; shape.style.filter = "brightness(1.15)"; onMove(ev); };
      const onLeave = () => { shape.style.stroke = "rgba(255,255,255,0.12)"; shape.style.strokeWidth = "0.6"; shape.style.filter = ""; setTooltip((t) => ({ ...t, show: false })); };
      shape.addEventListener("pointerenter", onEnter); shape.addEventListener("pointermove", onMove); shape.addEventListener("pointerleave", onLeave);
      const currentRR = regionMap.get(key);
      const fill = currentRR ? countyFill(currentRR) : null;
      shape.style.opacity = "0";
      requestAnimationFrame(() => { shape.style.fill = fill || "#1e2028"; shape.style.opacity = "1"; if (currentRR) { const fp = countyFingerprint(currentRR); countyFingerprintsRef.current.set(key, fp); countyVoteTotalsRef.current.set(key, countyTotalVotes(currentRR)); } });
    });
  }, [svgText, regionMap]);

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
      const newTotal = countyTotalVotes(currentRR), prevTotal = countyVoteTotalsRef.current.get(key) ?? 0;
      if (prevFp !== undefined && fp !== prevFp) { if (newTotal > prevTotal) { flashCounty(shape); } }
      countyFingerprintsRef.current.set(key, fp); countyVoteTotalsRef.current.set(key, newTotal);
    });
  }, [regionMap, flashCounty]);

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden", background: "#0d0d0b", borderRadius: 1 }}>
      <div ref={wrapRef} style={{ width: "100%", height: "100%", display: "flex", alignItems: "stretch", cursor: "crosshair" }} />
      <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", flexDirection: "column", gap: 3, zIndex: 40 }}>
        {[
          { label: locked ? "🔒" : "🔓", onClick: toggleLock, active: locked },
          ...(!locked ? [
            { label: "+", onClick: () => { const h = wrapRef.current; if (!h) return; const r = h.getBoundingClientRect(); const cx = r.width / 2, cy = r.height / 2; const { scale: s, x, y } = transformRef.current; const ns = Math.min(8, s * 1.4); transformRef.current = { scale: ns, x: cx - (cx - x) * (ns / s), y: cy - (cy - y) * (ns / s) }; setScale(ns); applyTransform(); }, active: false },
            { label: "−", onClick: () => { const h = wrapRef.current; if (!h) return; const r = h.getBoundingClientRect(); const cx = r.width / 2, cy = r.height / 2; const { scale: s, x, y } = transformRef.current; const ns = Math.max(1, s / 1.4); if (ns <= 1) { resetZoom(); return; } transformRef.current = { scale: ns, x: cx - (cx - x) * (ns / s), y: cy - (cy - y) * (ns / s) }; setScale(ns); applyTransform(); }, active: false },
            ...(scale > 1 ? [{ label: "⌂", onClick: resetZoom, active: false }] : []),
          ] : []),
        ].map((btn, i) => (
          <button key={i} onClick={btn.onClick} style={{ width: 26, height: 26, background: btn.active ? "rgba(197,165,90,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${btn.active ? "rgba(197,165,90,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 1, color: btn.active ? "#c5a55a" : "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace" }}>
            {btn.label}
          </button>
        ))}
      </div>
      {tooltip.show && (
        <div style={{ position: "absolute", left: tooltip.x, top: tooltip.y, width: 260, background: "#141412", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 1, boxShadow: "0 8px 32px rgba(0,0,0,0.7)", pointerEvents: "none", zIndex: 50, overflow: "hidden", fontFamily: "'DM Mono', monospace" }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)", marginBottom: 4, letterSpacing: "0.04em" }}>{tooltip.title}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{tooltip.reporting}</div>
            <div style={{ height: 2, background: "rgba(255,255,255,0.06)", marginTop: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${tooltip.reportingPct}%`, background: "rgba(197,165,90,0.6)" }} />
            </div>
          </div>
          <div style={{ padding: "8px 12px" }}>
            {tooltip.lines.length > 0 ? tooltip.lines.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderBottom: i < tooltip.lines.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color || "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{c.name}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: c.color || "rgba(255,255,255,0.7)" }}>{c.pct !== null ? `${c.pct.toFixed(1)}%` : "—"}</span>
              </div>
            )) : (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em", padding: "6px 0" }}>No results yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CANDIDATE RESULTS TABLE (CNN-style: compact, scannable) ──────────────────
function CandidateResultsTable({ candidates, raceId }: { candidates: RaceCandidate[]; raceId?: number }) {
  const defaults = raceId ? RACE_FORECAST_DEFAULTS[raceId] : undefined;
  const ordered = useMemo(() => sortCandidatesByPollData(candidates, defaults?.pollAvg), [candidates, defaults?.pollAvg]);
  const leader = ordered[0];
  const maxPct = Math.max(...ordered.map(c => c.percent ?? 0), 1);

  return (
    <div>
      {ordered.map((c, idx) => {
        const isLeading = idx === 0 && !c.winner && (c.percent ?? 0) > 0;
        const barWidth = ((c.percent ?? 0) / maxPct) * 100;
        return (
          <div key={`${c.name}-${c.party}`} style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: "0 12px",
            padding: "10px 0",
            borderBottom: idx < ordered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
          }}>
            {/* Color dot + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color || "rgba(255,255,255,0.3)", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.winner ? "#c5a55a" : isLeading ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                  {c.name}
                  {c.winner && <span style={{ marginLeft: 8, fontSize: 8, color: "#c5a55a", background: "rgba(197,165,90,0.15)", padding: "1px 6px", border: "1px solid rgba(197,165,90,0.3)", letterSpacing: "0.14em" }}>WINNER</span>}
                  {isLeading && !c.winner && <span style={{ marginLeft: 8, fontSize: 8, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", padding: "1px 6px", letterSpacing: "0.12em" }}>LEADING</span>}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>
                  {(c.votes ?? 0).toLocaleString()} votes
                </div>
              </div>
            </div>
            {/* Bar */}
            <div style={{ height: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${barWidth}%`, background: c.color || "rgba(255,255,255,0.3)", transition: "width 600ms ease" }} />
            </div>
            {/* Percent */}
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: c.color || "rgba(255,255,255,0.8)", letterSpacing: "0.05em", textAlign: "right", minWidth: 54 }}>
              {fmtPct(c.percent)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── RACE PICKER TABS (horizontal tabs, not sidebar list) ─────────────────────
function RaceTabPicker({ races, raceCache, selectedId, onSelect }: { races: FeaturedRace[]; raceCache: Record<number, RaceDetail | undefined>; selectedId: number; onSelect: (id: number) => void; }) {
  // Group by office
  const groups = useMemo(() => {
    const map = new Map<string, FeaturedRace[]>();
    for (const r of races) { const g = map.get(r.office) ?? []; g.push(r); map.set(r.office, g); }
    return Array.from(map.entries());
  }, [races]);

  const selectedMeta = useMemo(() => races.find(r => r.id === selectedId), [races, selectedId]);

  return (
    <div style={{ background: "#0f0f0d", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      {/* Office groups as scroll tabs */}
      <div style={{ overflowX: "auto", display: "flex", gap: 0, padding: "0 20px" }}>
        {groups.map(([office, groupRaces]) => {
          const isGroupSelected = groupRaces.some(r => r.id === selectedId);
          return (
            <div key={office} style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
                color: isGroupSelected ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
                padding: "10px 14px 4px",
                borderBottom: isGroupSelected ? "2px solid #c5a55a" : "2px solid transparent",
                transition: "color 120ms",
                whiteSpace: "nowrap",
                fontFamily: "'DM Mono', monospace",
              }}>{office}</div>
              <div style={{ display: "flex", gap: 4, padding: "4px 14px 10px" }}>
                {groupRaces.map(r => {
                  const isSelected = r.id === selectedId;
                  const color = getRaceTypeColor(r.raceType);
                  const short = getRaceTypeShort(r.raceType);
                  const liveData = raceCache[r.id];
                  const winner = liveData?.candidates?.find(c => c.winner);
                  const reporting = getRaceReportingPct(liveData) ?? 0;
                  return (
                    <button key={r.id} onClick={() => onSelect(r.id)} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 10px",
                      background: isSelected ? `${color}18` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isSelected ? `${color}55` : "rgba(255,255,255,0.07)"}`,
                      cursor: "pointer", transition: "all 100ms ease",
                      fontFamily: "'DM Mono', monospace",
                    }}>
                      <span style={{ fontSize: 8, fontWeight: 900, color: isSelected ? color : "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>{short}</span>
                      {winner && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#c5a55a", display: "inline-block" }} />}
                      {!winner && reporting > 0 && <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.04em" }}>{reporting.toFixed(0)}%</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── FORECAST PANEL ───────────────────────────────────────────────────────────
function ForecastPanel({ raceId, refreshTick, raceData }: { raceId: number; refreshTick: number; raceData?: RaceDetail }) {
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaults = RACE_FORECAST_DEFAULTS[raceId];

  useEffect(() => {
    let cancelled = false;
    setForecast(null); setError(null);
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(raceData ? { type: "civic_raw", raceData } : { type: "civic", raceId: String(raceId) }), race_rule: defaults?.raceRule ?? "PLURALITY", expected_turnout: defaults?.expectedTurnout, poll_avg: defaults?.pollAvg }) });
        const data = await res.json();
        if (!cancelled) { if (data.error) throw new Error(data.details ?? data.error); setForecast(data); }
      } catch (e: any) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [raceId, refreshTick]);

  const names = forecast?.forecast?.candidate_names ?? [];
  const colors = forecast?.forecast?.candidate_colors ?? ["#5b8fd4", "#d45b5b", "#c5a55a"];

  if (error) return <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#d45b5b", padding: "12px 0", letterSpacing: "0.06em" }}>⚠ Forecast unavailable</div>;

  if (loading && !forecast) return (
    <div style={{ padding: "20px 0", textAlign: "center" }}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Running model…</div>
      <div style={{ height: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden", maxWidth: 100, margin: "0 auto" }}>
        <div style={{ height: "100%", width: "60%", background: "#c5a55a", animation: "er-loading 1.4s ease-in-out infinite" }} />
      </div>
    </div>
  );

  if (!forecast) return null;

  return (
    <div>
      {names.slice(0, 3).map((name: string, i: number) => {
        const prob = (forecast.forecast.plurality_odds_to_win?.[`Candidate${i + 1}`] ?? 0) * 100;
        return (
          <div key={name} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{name}</div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, prob)}%`, background: colors[i], transition: "width 600ms ease" }} />
              </div>
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: colors[i], letterSpacing: "0.05em", minWidth: 44, textAlign: "right" }}>{prob.toFixed(0)}%</div>
          </div>
        );
      })}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 16 }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Projected total</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.5)" }}>{(forecast.forecast.modeled_total_vote ?? 0).toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Votes remaining</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.5)" }}>{(forecast.forecast.modeled_vote_remaining ?? 0).toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

// ─── PROJECTED WINNER OVERLAY ─────────────────────────────────────────────────
function ProjectedWinnerOverlay({ show, candidate, prob, color, reporting, onDismiss }: { show: boolean; candidate: string; prob: number; color: string; reporting: number; onDismiss: () => void; }) {
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)" }} onClick={onDismiss} />
      <div style={{ position: "relative", width: "min(480px, 92vw)", background: "#0f0f0d", border: "1px solid rgba(197,165,90,0.3)", overflow: "hidden" }}>
        <div style={{ height: 2, background: "linear-gradient(90deg, #5b8fd4 50%, #d45b5b 50%)" }} />
        <div style={{ padding: "28px 32px" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#d45b5b", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#d45b5b", animation: "er-pulse 1.8s ease-in-out infinite", display: "inline-block" }} />
            Projection Alert
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>Projected Winner</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, letterSpacing: "0.04em", color: color || "#5b8fd4", lineHeight: 1, marginBottom: 24 }}>{candidate}</div>
          <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Confidence</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, color: color || "#5b8fd4" }}>{prob.toFixed(1)}%</span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", marginBottom: 24 }}>
            <div style={{ height: "100%", width: `${Math.min(100, prob)}%`, background: color || "#5b8fd4", transition: "width 600ms ease" }} />
          </div>
          <button onClick={onDismiss} style={{ width: "100%", padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer" }}>
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── COUNTY TABLE ─────────────────────────────────────────────────────────────
function CountyTable({ countyData }: { countyData: { name: string; reporting: number; candidates: TooltipLine[]; margin: number | null }[] }) {
  const [collapsed, setCollapsed] = useState(true);
  const reporting = countyData.filter(d => d.reporting > 0).length;

  return (
    <div style={{ background: "#0f0f0d", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <button onClick={() => setCollapsed(v => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", background: "transparent", border: "none", borderBottom: collapsed ? "none" : "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>Results by County</span>
          {countyData.length > 0 && <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em" }}>{reporting}/{countyData.length} reporting</span>}
        </div>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, transform: collapsed ? "rotate(0)" : "rotate(180deg)", transition: "transform 240ms ease", display: "inline-block" }}>▾</span>
      </button>
      {!collapsed && (
        <div style={{ maxHeight: 340, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0d0d0b", position: "sticky", top: 0 }}>
                {[{ h: "County", align: "left" }, { h: "Reporting", align: "left" }, { h: "Leader", align: "left" }, { h: "2nd", align: "left" }, { h: "Margin", align: "right" }].map(col => (
                  <th key={col.h} style={{ textAlign: col.align as any, fontSize: 8, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", fontFamily: "'DM Mono', monospace" }}>{col.h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {countyData.map((row, i) => {
                const leader = row.candidates[0];
                const second = row.candidates[1];
                return (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "9px 14px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{row.name}</td>
                    <td style={{ padding: "9px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 40, height: 2, background: "rgba(255,255,255,0.06)" }}>
                          <div style={{ height: "100%", width: `${row.reporting}%`, background: "#c5a55a" }} />
                        </div>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{row.reporting.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      {leader ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: leader.color || "#fff", flexShrink: 0 }} />
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{leader.name.split(" ").pop()}</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, color: leader.color || "rgba(255,255,255,0.7)" }}>{leader.pct !== null ? `${leader.pct.toFixed(1)}%` : "—"}</span>
                      </div> : <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 9 }}>—</span>}
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      {second ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: second.color || "#fff", flexShrink: 0 }} />
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{second.name.split(" ").pop()}</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{second.pct !== null ? `${second.pct.toFixed(1)}%` : "—"}</span>
                      </div> : <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 9 }}>—</span>}
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right" }}>
                      {row.margin !== null ? <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: "rgba(255,255,255,0.4)" }}>+{row.margin.toFixed(1)}%</span> : <span style={{ color: "rgba(255,255,255,0.15)" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function March17FeaturedClient() {
  const [selectedId, setSelectedId] = useState<number>(55550);
  const [error, setError] = useState<string | null>(null);
  const [loadingMap, setLoadingMap] = useState(false);
  const [raceCache, setRaceCache] = useState<Record<number, RaceDetail | undefined>>({});
  const [mapBlankSvg, setMapBlankSvg] = useState<string | null>(null);
  const [mapLoadPct, setMapLoadPct] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);
  const [overlay, setOverlay] = useState<null | { id: number; name: string; prob: number; color: string; reporting: number }>(null);
  const lastProjectedKeyRef = useRef<string>("");

  useEffect(() => { setNowMs(Date.now()); }, []);
  const racesForState = useMemo(() => FEATURED.filter(r => r.state === "IL"), []);
  const selectedRace = raceCache[selectedId];
  const selectedMeta = useMemo(() => FEATURED.find(r => r.id === selectedId), [selectedId]);
  const hasForecastForSelected = !!RACE_FORECAST_DEFAULTS[selectedId];

  async function refreshFeatured() {
    try {
      const results = await Promise.all(FEATURED.map(r => fetchRaceById(r.id).then(d => [r.id, d] as const)));
      setRaceCache(Object.fromEntries(results));
      setRefreshTick(t => t + 1);
    } catch (e: any) { setError(e?.message ?? "Error refreshing."); }
  }

  useEffect(() => { refreshFeatured(); const t = setInterval(refreshFeatured, POLL_MS); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setNowMs(Date.now()), 1000); return () => clearInterval(t); }, []);
  useLayoutEffect(() => { setLoadingMap(true); setMapBlankSvg(null); setMapLoadPct(0); }, [selectedId]);

  useEffect(() => {
    let cancelled = false, interval: any = null;
    async function loadMap() {
      const start = performance.now();
      interval = setInterval(() => { const elapsed = performance.now() - start; const eased = Math.min(92, 10 + (elapsed / 1200) * 82); setMapLoadPct(p => p < eased ? eased : p); }, 60);
      const svg = await fetchRaceMapBlankSvg(selectedId);
      if (cancelled) return;
      clearInterval(interval); setMapBlankSvg(svg); setMapLoadPct(100);
      requestAnimationFrame(() => { if (!cancelled) setLoadingMap(false); });
    }
    loadMap();
    return () => { cancelled = true; if (interval) clearInterval(interval); };
  }, [selectedId]);

  useEffect(() => {
    const race = selectedRace; if (!race?.candidates?.length) return;
    const reporting = race.percent_reporting ?? 0;
    if (race.candidates.find(c => c.winner)) return; if (reporting < 5) return;
    const ordered = [...race.candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
    if (ordered.length < 2) return;
    const leader = ordered[0], runnerUp = ordered[1];
    const prob = calculateWinProbability(leader.votes, runnerUp.votes, reporting);
    if (prob < 90) return;
    const key = `${selectedId}:${leader.name}:${Math.floor(prob)}:${Math.floor(reporting)}`;
    if (key === lastProjectedKeyRef.current) return;
    lastProjectedKeyRef.current = key;
    setOverlay({ id: selectedId, name: leader.name, prob, color: leader.color || "#5b8fd4", reporting });
    const t = setTimeout(() => setOverlay(null), 5200);
    return () => clearTimeout(t);
  }, [selectedRace, selectedId]);

  const selectedReporting = selectedRace?.percent_reporting ?? 0;
  const selectedCloseDate = parseIsoDate(selectedRace?.polls_close ?? null);
  const selectedCloseLocal = selectedCloseDate ? formatLocalCloseTime(selectedCloseDate) : "—";
  const selectedMsLeft = selectedCloseDate ? selectedCloseDate.getTime() - nowMs : null;
  const selectedWinner = selectedRace?.candidates?.find(c => c.winner);
  const timeStr = nowMs > 0 ? new Date(nowMs).toLocaleTimeString("en-US", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--";
  const raceTypeColor = getRaceTypeColor(selectedMeta?.raceType ?? "General Election");

  const countyData = useMemo(() => {
    return coerceRegionResults(selectedRace?.region_results ?? []).map((rr) => {
      const candidates = buildTooltipLines(rr);
      const { absMargin } = computeCountyMargin(rr);
      const rawName = (rr as any)?.region?.name || (rr as any)?.name || "Unknown";
      return { name: titleCaseKey(rawName), reporting: rr?.region?.percent_reporting ?? (rr as any)?.percent_reporting ?? 0, candidates, margin: absMargin };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedRace]);

  // Sort candidates for top display
  const topCandidates = useMemo(() => {
    if (!selectedRace?.candidates?.length) return [];
    const defaults = RACE_FORECAST_DEFAULTS[selectedId];
    return sortCandidatesByPollData(selectedRace.candidates, defaults?.pollAvg);
  }, [selectedRace, selectedId]);

  const leader = topCandidates[0];
  const runnerUp = topCandidates[1];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
        body { background: #0a0a08 !important; }
        @keyframes er-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes er-county-update { 0%{filter:brightness(1)} 12%{filter:brightness(2) saturate(1.8)} 100%{filter:brightness(1)} }
        @keyframes er-loading { 0%,100%{opacity:0.3} 50%{opacity:1} }
        .er-county-update { animation: er-county-update 1200ms ease-out; }
        * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }
        *::-webkit-scrollbar { width: 3px; height: 3px; }
        *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
      `}</style>

      {overlay && <ProjectedWinnerOverlay show={!!overlay} candidate={overlay.name} prob={overlay.prob} color={overlay.color} reporting={overlay.reporting} onDismiss={() => setOverlay(null)} />}

      <div style={{ background: "#0a0a08", minHeight: "100vh", fontFamily: "'DM Mono', monospace" }}>

        {/* ── HEADER ── */}
        <div style={{ background: "#0f0f0d", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#c5a55a", marginBottom: 4 }}>March 17, 2026 Primary Elections · Illinois</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(24px, 4vw, 40px)", letterSpacing: "0.04em", color: "#fff", lineHeight: 1 }}>
                Election Night <span style={{ color: "#5b8fd4" }}>Results</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d45b5b", animation: "er-pulse 1.8s ease-in-out infinite", display: "inline-block" }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase" }}>Live · 30s refresh</span>
              </div>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em" }} suppressHydrationWarning>{timeStr}</span>
            </div>
          </div>
        </div>

        {/* ── RACE TABS ── */}
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <RaceTabPicker races={racesForState} raceCache={raceCache} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        {/* ── RACE HERO: selected race summary ── */}
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ background: "#0f0f0d", borderBottom: `3px solid ${raceTypeColor}`, padding: "20px 24px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>

              {/* Race title + status */}
              <div style={{ flex: "1 1 260px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: raceTypeColor, background: `${raceTypeColor}18`, border: `1px solid ${raceTypeColor}44`, padding: "3px 8px", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                    {selectedMeta?.raceType ?? "—"}
                  </span>
                  {selectedWinner && <span style={{ fontSize: 8, fontWeight: 700, color: "#c5a55a", background: "rgba(197,165,90,0.12)", border: "1px solid rgba(197,165,90,0.3)", padding: "3px 8px", letterSpacing: "0.14em" }}>RACE CALLED</span>}
                </div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(20px, 3vw, 30px)", letterSpacing: "0.04em", color: "#fff", lineHeight: 1, marginBottom: 8 }}>
                  {selectedMeta?.office ?? "—"}
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>
                    {selectedReporting.toFixed(1)}% precincts reporting
                  </span>
                  {selectedMsLeft !== null && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: selectedMsLeft > 0 ? "rgba(255,255,255,0.3)" : "#d45b5b", letterSpacing: "0.08em" }}>
                      Polls {selectedMsLeft > 0 ? `close ${selectedCloseLocal}` : "closed"} · {formatCountdown(selectedMsLeft)}
                    </span>
                  )}
                  {selectedRace?.last_updated && (
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.18)" }}>Updated {prettyTime(selectedRace.last_updated)}</span>
                  )}
                </div>
              </div>

              {/* Top 2 candidate summary */}
              {leader && runnerUp && (selectedReporting > 0) && (
                <div style={{ display: "flex", gap: 12, flex: "0 1 auto" }}>
                  {[leader, runnerUp].map((c, i) => (
                    <div key={c.name} style={{
                      padding: "12px 16px",
                      background: c.winner ? `${c.color}12` : i === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${c.winner ? `${c.color}44` : i === 0 ? `${c.color}22` : "rgba(255,255,255,0.06)"}`,
                      minWidth: 110, textAlign: "center",
                    }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 4, letterSpacing: "0.06em", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 110 }}>{c.name}</div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: c.color, letterSpacing: "0.04em", lineHeight: 1 }}>{fmtPct(c.percent)}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>{(c.votes ?? 0).toLocaleString()} votes</div>
                      {c.winner && <div style={{ marginTop: 6, fontFamily: "'DM Mono', monospace", fontSize: 7, fontWeight: 700, color: "#c5a55a", letterSpacing: "0.14em" }}>✓ WINNER</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* Reporting progress */}
              <div style={{ alignSelf: "flex-end", flex: "0 0 auto" }}>
                <div style={{ width: 120 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Precincts in</span>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: "#c5a55a", letterSpacing: "0.04em" }}>{selectedReporting.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${selectedReporting}%`, background: "#c5a55a", transition: "width 800ms ease" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>

            {/* LEFT: Map + County table */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>

              {/* Map */}
              <div style={{ background: "#0f0f0d", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>County Map</span>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {[["Safe", "rgba(91,143,212,0.8)"], ["Likely", "rgba(91,143,212,0.55)"], ["Lean", "rgba(91,143,212,0.35)"], ["Tilt", "rgba(91,143,212,0.15)"]].map(([label, color]) => (
                      <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 8, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        <span style={{ width: 7, height: 7, background: color, display: "inline-block" }} />{label}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ height: 440, padding: 8 }}>
                  {loadingMap ? (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0d0b" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>Loading map…</div>
                        <div style={{ height: 2, background: "rgba(255,255,255,0.05)", width: 160, overflow: "hidden", margin: "0 auto" }}>
                          <div style={{ height: "100%", width: `${mapLoadPct}%`, background: "#c5a55a", transition: "width 200ms ease" }} />
                        </div>
                      </div>
                    </div>
                  ) : mapBlankSvg ? (
                    <MapWithCountyTooltip svgText={mapBlankSvg} regionResults={selectedRace?.region_results ?? []} />
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0d0b", color: "rgba(255,255,255,0.15)", fontSize: 11 }}>No map data</div>
                  )}
                </div>
              </div>

              {/* County table */}
              <CountyTable countyData={countyData} />

              {error && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#d45b5b", padding: "10px 14px", border: "1px solid rgba(212,91,91,0.2)", background: "rgba(212,91,91,0.05)", letterSpacing: "0.06em" }}>Error: {error}</div>}
            </div>

            {/* RIGHT: Results + Forecast */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Full candidate results */}
              <div style={{ background: "#0f0f0d", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Results</span>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>{selectedReporting.toFixed(1)}% in</span>
                </div>
                <div style={{ padding: "0 16px" }}>
                  {selectedRace?.candidates
                    ? <CandidateResultsTable candidates={selectedRace.candidates} raceId={selectedId} />
                    : <div style={{ padding: "28px 0", textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>Loading…</div>}
                </div>
              </div>

              {/* Forecast */}
              <div style={{ background: "#0f0f0d", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ padding: "11px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>Forecast Model</span>
                  <span style={{ fontSize: 8, color: "#c5a55a", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>Beta</span>
                </div>
                <div style={{ padding: "14px 16px" }}>
                  {hasForecastForSelected
                    ? <ForecastPanel key={selectedId} raceId={selectedId} refreshTick={refreshTick} raceData={selectedRace} />
                    : <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", lineHeight: 1.7, letterSpacing: "0.03em" }}>No forecast available — insufficient poll baseline for this race.</div>
                  }
                </div>
              </div>

              {/* Poll close countdown */}
              {selectedMsLeft !== null && selectedMsLeft > 0 && (
                <div style={{ background: "#0f0f0d", border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8 }}>Polls close in</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em", lineHeight: 1 }} suppressHydrationWarning>
                    {formatCountdown(selectedMsLeft)}
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>{selectedCloseLocal}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}