"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const CIVIC_BASE = "https://civicapi.org";
const POLL_MS = 15_000;

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

type RaceCandidate = {
  name: string;
  party: string;
  votes: number;
  percent: number;
  winner: boolean;
  incumbent?: boolean;
  major_candidate?: boolean;
  color: string;
};

type RegionCandidate = {
  name: string;
  party: string;
  votes: string | number;
  percent: string | number;
  winner: boolean;
  color: string;
  incumbent?: boolean;
  major_candidate?: boolean;
};

type RegionResult = {
  region: {
    name: string;
    type: string;
    fill?: string;
    percent_reporting?: number;
  };
  candidates: RegionCandidate[];
};

type RaceDetail = {
  election_name: string;
  election_type: string;
  election_scope: string;
  election_date: string;
  country: string;
  province: string | null;
  district: string | null;
  municipality: string | null;
  polls_open: string | null;
  polls_close: string | null;
  last_updated: string | null;
  percent_reporting?: number;
  candidates: RaceCandidate[];
  region_results?: RegionResult[] | Record<string, RegionResult>;
};

type FeaturedRace = {
  id: number;
  state: "TX" | "NC" | "AR" | "TEST";
  office:
    | "US Senate"
    | "Governor"
    | "Lieutenant Governor"
    | "Attorney General"
    | "Comptroller"
    | "Agriculture Commissioner"
    | "Land Commissioner"
    | "Railroad Commissioner"
    | "Secretary of State"
    | "Treasurer"
    | "US House 23"
    | "Test Map";
  party: "Democratic" | "Republican" | "N/A";
  label: string;
};

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

function fmtPct(x?: number) {
  if (typeof x !== "number") return "—";
  return `${x.toFixed(1)}%`;
}

function getRaceReportingPct(race?: RaceDetail) {
  const v = race?.percent_reporting;
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null;
}

function getRaceProjectionAlways(race?: RaceDetail): { leaderName: string; prob: number } | null {
  if (!race?.candidates?.length) return null;

  const reporting = typeof race.percent_reporting === "number" ? race.percent_reporting : 0;

  const officialWinner = race.candidates.find((c) => c.winner);
  if (officialWinner) return { leaderName: officialWinner.name, prob: 100 };

  const ordered = [...race.candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  const leader = ordered[0];
  const runnerUp = ordered[1];

  // If we don't even have 2 candidates, still show something
  if (!leader || !runnerUp) return { leaderName: leader?.name ?? "—", prob: 50 };

  // Your model already returns 50 if reporting <= 0, so this is safe
  const prob = calculateWinProbability(leader.votes, runnerUp.votes, reporting);
  return { leaderName: leader.name, prob };
}

function prettyTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function parseIsoDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso); // ISO with Z auto converts to local time internally
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "Polls closed";

  const totalSec = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatLocalCloseTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="text-xs rounded-full border border-white/10 bg-white/5 px-2 py-0.5 opacity-90">{children}</span>;
}

function normalizeRegionName(s: string) {
  return s
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[’'"]/g, "")
    .replace(/\./g, "")
    .replace(/\s+county$/i, "")
    .replace(/\s+parish$/i, "")
    .replace(/\s+borough$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseKey(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getRegionKeyFromElement(el: Element): string | null {
  const attrs = ["data-name", "data-county", "name", "aria-label", "id"];
  for (const a of attrs) {
    const v = el.getAttribute(a);
    if (v && v.trim()) return normalizeRegionName(v.trim());
  }
  const title = el.querySelector?.("title")?.textContent?.trim();
  if (title) return normalizeRegionName(title);
  return null;
}

function coerceRegionResults(input: unknown): RegionResult[] {
  if (Array.isArray(input)) return input as RegionResult[];
  if (input && typeof input === "object") return Object.values(input as Record<string, RegionResult>);
  return [];
}

type TooltipLine = {
  name: string;
  party: string;
  votes: number | null;
  pct: number | null;
  winner: boolean;
  color?: string;
};

type TooltipState = {
  show: boolean;
  x: number;
  y: number;
  title: string;
  reporting: string | null;
  reportingPct: number | null;
  lines: TooltipLine[];
};

function safeNum(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = Number(x.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function safePct(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = parseFloat(x.replace("%", "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getCandidatesFromRR(rr: any): RegionCandidate[] {
  const c1 = rr?.candidates;
  const c2 = rr?.region?.candidates;
  const c3 = rr?.data?.candidates;
  const found = (Array.isArray(c1) ? c1 : null) ?? (Array.isArray(c2) ? c2 : null) ?? (Array.isArray(c3) ? c3 : null);
  return (found ?? []) as RegionCandidate[];
}

function buildTooltipLines(rr: any): TooltipLine[] {
  const candidates = getCandidatesFromRR(rr);
  return [...candidates]
    .map((c) => ({
      name: String(c?.name ?? ""),
      party: String(c?.party ?? ""),
      votes: safeNum(c?.votes),
      pct: safePct(c?.percent),
      winner: !!c?.winner,
      color: c?.color,
    }))
    .filter((x) => x.name)
    .sort((a, b) => {
      const av = a.votes ?? -1;
      const bv = b.votes ?? -1;
      if (bv !== av) return bv - av;
      return (b.pct ?? -1) - (a.pct ?? -1);
    });
}

type MarginBucket = "tilt" | "lean" | "likely" | "safe" | "tied";

function marginBucket(absMargin: number): MarginBucket {
  if (absMargin < 0.0001) return "tied";
  if (absMargin < 2) return "tilt";
  if (absMargin < 6) return "lean";
  if (absMargin < 12) return "likely";
  return "safe";
}

function toShaded(hex: string, bucket: MarginBucket) {
  let r = 0,
    g = 0,
    b = 0;
  const h = hex.replace("#", "");
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  }
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let hue = 0,
    saturation = 0,
    lightness = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    saturation = lightness > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / d + 2;
        break;
      case b:
        hue = (r - g) / d + 4;
        break;
    }
    hue /= 6;
  }
  let l = 0.5;
  switch (bucket) {
    case "safe":
      l = 0.5;
      break;
    case "likely":
      l = 0.65;
      break;
    case "lean":
      l = 0.8;
      break;
    case "tilt":
      l = 0.95;
      break;
    case "tied":
      l = 1.0;
      break;
    default:
      l = 0.5;
  }
  return `hsl(${hue * 360}, ${saturation * 100}%, ${l * 100}%)`;
}

function computeCountyMargin(rr: any): { leaderName: string | null; leaderColor: string | null; absMargin: number | null; bucket: MarginBucket | null } {
  const candidates = getCandidatesFromRR(rr);
  if (!candidates.length) return { leaderName: null, leaderColor: null, absMargin: null, bucket: null };
  const rows = candidates
    .map((c) => ({ name: c.name, color: typeof c?.color === "string" ? c.color : null, pct: safePct(c?.percent), votes: safeNum(c?.votes) }))
    .filter((r) => r.color);
  if (!rows.length) return { leaderName: null, leaderColor: null, absMargin: null, bucket: null };
  const hasPct = rows.some((r) => typeof r.pct === "number");
  const metric = (r: any) => (hasPct ? (r.pct ?? -1) : (r.votes ?? -1));
  rows.sort((a, b) => metric(b) - metric(a));
  const leader = rows[0];
  const runnerUp = rows[1];
  if (!runnerUp) return { leaderName: leader.name, leaderColor: leader.color, absMargin: 100, bucket: "safe" };
  const m = Math.abs(metric(leader) - metric(runnerUp));
  return { leaderName: leader.name, leaderColor: leader.color, absMargin: m, bucket: marginBucket(m) };
}

function countyFill(rr: any): string | null {
  const apiFill = rr?.region?.fill;
  if (typeof apiFill === "string" && apiFill.trim()) return apiFill;
  const { leaderColor, bucket } = computeCountyMargin(rr);
  if (!leaderColor || !bucket) return null;
  return toShaded(leaderColor, bucket);
}

/** ✅ NEW: full-screen projected winner popup */
function ProjectedWinnerOverlay({
  show,
  candidate,
  prob,
  color,
  reporting,
  onDismiss,
}: {
  show: boolean;
  candidate: string;
  prob: number;
  color: string;
  reporting: number;
  onDismiss: () => void;
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_220ms_ease-out]" onClick={onDismiss} />
      <div className="relative w-[min(720px,92vw)] rounded-[28px] border border-white/15 bg-[#0b0f17]/95 shadow-[0_25px_120px_rgba(0,0,0,0.75)] overflow-hidden animate-[popIn_520ms_cubic-bezier(.2,.9,.2,1)]">
        <div
          className="absolute inset-x-0 -top-24 h-48 blur-3xl opacity-50"
          style={{ background: `radial-gradient(closest-side, ${color}55, transparent 70%)` }}
        />

        <div className="p-7 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] opacity-55">Projection Alert</div>
              <div className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
                Projected Winner:
                <span className="ml-2" style={{ color }}>
                  {candidate}
                </span>
              </div>
              <div className="mt-2 text-sm opacity-55 font-medium">
                Confidence <span className="font-black tabular-nums opacity-90">{prob.toFixed(1)}%</span> •{" "}
                <span className="tabular-nums">{reporting.toFixed(1)}%</span> reporting
              </div>
            </div>

            <button
              onClick={onDismiss}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest opacity-75 hover:opacity-100 hover:bg-white/10 transition"
            >
              Close
            </button>
          </div>

          <div className="mt-6">
            <div className="h-3.5 w-full rounded-full bg-white/10 overflow-hidden shadow-inner">
              <div
                className="h-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max(0, Math.min(100, prob))}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 18px ${color}66`,
                }}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] uppercase tracking-widest font-black opacity-45">Status</div>
              <div className="mt-1 font-black">Projected</div>
              <div className="mt-1 text-[11px] opacity-45">Not official until called.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] uppercase tracking-widest font-black opacity-45">Confidence</div>
              <div className="mt-1 font-black tabular-nums">{prob.toFixed(1)}%</div>
              <div className="mt-1 text-[11px] opacity-45">Based on current returns.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-[10px] uppercase tracking-widest font-black opacity-45">Reporting</div>
              <div className="mt-1 font-black tabular-nums">{reporting.toFixed(1)}%</div>
              <div className="mt-1 text-[11px] opacity-45">Updated on refresh.</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="text-[11px] opacity-45">Tip: Click anywhere outside the card to dismiss.</div>
            <button
              onClick={onDismiss}
              className="rounded-xl bg-white text-black px-4 py-2 text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition"
            >
              Continue
            </button>
          </div>
        </div>

        <style jsx global>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          @keyframes popIn {
            0% {
              transform: translateY(18px) scale(0.92);
              opacity: 0;
            }
            55% {
              transform: translateY(-6px) scale(1.02);
              opacity: 1;
            }
            100% {
              transform: translateY(0px) scale(1);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

function MapWithCountyTooltip({ svgText, regionResults }: { svgText: string; regionResults: RegionResult[] | Record<string, RegionResult> }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, x: 0, y: 0, title: "", reporting: null, reportingPct: null, lines: [] });

  const regionResultsArr = useMemo(() => coerceRegionResults(regionResults), [regionResults]);
  const regionMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const rr of regionResultsArr as any[]) {
      const k = normalizeRegionName(String(rr?.region?.name ?? rr?.name ?? ""));
      if (!k) continue;
      m.set(k, rr);
    }
    return m;
  }, [regionResultsArr]);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;

    host.innerHTML = svgText;
    const svg = host.querySelector("svg");
    if (!svg) return;

    const shapes = Array.from(svg.querySelectorAll("path, polygon")) as SVGGraphicsElement[];

    shapes.forEach((shape) => {
      const key = getRegionKeyFromElement(shape);
      if (!key) return;

      const prettyKey = titleCaseKey(key);

      shape.style.pointerEvents = "all";
      shape.style.cursor = "pointer";
      shape.style.stroke = "rgba(255,255,255,0.2)";
      shape.style.strokeWidth = "2.0";
      shape.style.transition = "fill 420ms ease, filter 420ms ease, opacity 420ms ease";

      const onMove = (ev: PointerEvent) => {
        const currentRR = regionMap.get(key);
        const tooltipWidth = 360;
        const tooltipHeight = 280;
        const padding = 20;

        let x = ev.clientX + 14;
        if (x + tooltipWidth > window.innerWidth) x = ev.clientX - tooltipWidth - 14;

        let y = ev.clientY + 14;
        if (y + tooltipHeight > window.innerHeight) y = ev.clientY - tooltipHeight - 14;

        x = Math.max(padding, x);
        y = Math.max(padding, y);

        const pct =
          typeof currentRR?.region?.percent_reporting === "number"
            ? currentRR.region.percent_reporting
            : typeof currentRR?.percent_reporting === "number"
              ? currentRR.percent_reporting
              : null;

        setTooltip({
          show: true,
          x,
          y,
          title: currentRR?.region?.name ?? (currentRR?.name ? titleCaseKey(currentRR.name) : prettyKey),
          reporting: pct !== null ? `${pct.toFixed(1)}% reporting` : "0% reporting",
          reportingPct: pct ?? 0,
          lines: currentRR ? buildTooltipLines(currentRR) : [],
        });
      };

      const onEnter = (ev: PointerEvent) => {
        shape.style.stroke = "#ffffff";
        shape.style.strokeWidth = "2.5";
        shape.style.filter = "brightness(1.2)";
        onMove(ev);
      };

      const onLeave = () => {
        shape.style.stroke = "rgba(255,255,255,0.2)";
        shape.style.strokeWidth = "2.0";
        shape.style.filter = "";
        setTooltip((t) => ({ ...t, show: false }));
      };

      shape.addEventListener("pointerenter", onEnter);
      shape.addEventListener("pointermove", onMove);
      shape.addEventListener("pointerleave", onLeave);

      const currentRR = regionMap.get(key);
      const hasData = !!currentRR;
      const fill = hasData ? countyFill(currentRR) : "rgba(255,255,255,0.04)";

      shape.style.opacity = hasData ? "0.0" : "1";
      requestAnimationFrame(() => {
        shape.style.fill = fill || "rgba(255,255,255,0.04)";
        shape.style.opacity = "1";
        if (hasData) {
          shape.classList.add("county-pop");
          setTimeout(() => shape.classList.remove("county-pop"), 520);
        }
      });
    });

    return () => {};
  }, [svgText, regionMap]);

  return (
    <div className="relative">
      <div ref={wrapRef} className="w-full overflow-hidden [&_svg]:w-full [&_svg]:h-auto" />

      {tooltip.show && (
        <div
          className="fixed z-50 min-w-[360px] w-max max-w-[95vw] rounded-xl border border-white/15 bg-[#0b0f17]/98 p-4 text-xs shadow-2xl backdrop-blur-md pointer-events-none transition-[left,top] duration-75 ease-out"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="flex items-start justify-between gap-6 mb-3">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm truncate">{tooltip.title}</div>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] uppercase tracking-wider opacity-60 font-semibold mb-1">
                  <span>{tooltip.reporting}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden shadow-inner">
                  <div className="h-full bg-blue-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.3)]" style={{ width: `${tooltip.reportingPct}%` }} />
                </div>
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-widest opacity-40 font-bold pt-1">County</div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_60px] gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold opacity-50 border-b border-white/10 bg-white/5">
              <div>Candidate</div>
              <div className="text-right">Votes</div>
              <div className="text-right">%</div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {tooltip.lines.length > 0 ? (
                tooltip.lines.map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_60px] gap-2 px-3 py-2 border-b border-white/5 last:border-b-0 items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color || "#666" }} />
                      <div className="truncate">
                        <div className="font-bold truncate text-[11px] leading-tight">
                          {c.name}
                          {c.winner && " ✓"}
                        </div>
                        <div className="text-[10px] opacity-50 truncate leading-tight uppercase">{c.party}</div>
                      </div>
                    </div>
                    <div className="text-right tabular-nums font-medium">{c.votes?.toLocaleString() ?? "—"}</div>
                    <div className="text-right tabular-nums font-bold">{c.pct !== null ? `${c.pct.toFixed(1)}%` : "—"}</div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center opacity-30 italic">No data reported yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .county-pop {
          animation: countyPop 520ms ease-out;
        }
        @keyframes countyPop {
          0% {
            filter: drop-shadow(0 0 0px rgba(255, 255, 255, 0));
            transform: scale(1);
          }
          45% {
            filter: drop-shadow(0 0 14px rgba(255, 255, 255, 0.18));
            transform: scale(1.003);
          }
          100% {
            filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.10));
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

// --- UPDATED CANDIDATE LIST WITH PROBABILITY ---
function CandidateList({ candidates, reporting }: { candidates: RaceCandidate[]; reporting: number }) {
  const ordered = [...candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));

  const winProb = useMemo(() => {
    if (ordered.length < 2 || reporting < 1) return null;
    return calculateWinProbability(ordered[0].votes, ordered[1].votes, reporting);
  }, [ordered, reporting]);

  return (
    <div className="divide-y divide-white/10">
      {winProb !== null && !ordered[0].winner && reporting > 5 && (
        <div className="pb-4 pt-2">
          <div className="flex justify-between items-end mb-1">
            <span className="text-[10px] uppercase font-black text-blue-400">Projected Win Chance</span>
            <span className="text-sm font-black text-white">{winProb.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${winProb}%` }} />
          </div>
        </div>
      )}

      {ordered.map((c, idx) => (
        <div key={`${c.name}-${c.party}`} className="py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color || "#666" }} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold truncate">{c.name}</span>
                {c.winner && <span className="text-[10px] font-bold uppercase rounded bg-green-500/20 text-green-400 px-1.5 py-0.5 border border-green-500/30">Winner</span>}
                {idx === 0 && !c.winner && winProb && winProb > 75 && <span className="text-[9px] font-bold uppercase text-blue-400 bg-blue-500/10 px-1 rounded">Likely</span>}
              </div>
              <div className="text-[11px] opacity-50 uppercase tracking-tighter">
                {c.party} • {c.votes.toLocaleString()} votes
              </div>
            </div>
          </div>
          <div className="font-black text-lg tabular-nums">{fmtPct(c.percent)}</div>
        </div>
      ))}
    </div>
  );
}

function CountyTotalsTable({ regionResults }: { regionResults: RegionResult[] | Record<string, RegionResult> }) {
  const data = useMemo(() => {
    const arr = coerceRegionResults(regionResults);
    return arr
      .map((rr) => {
        const candidates = buildTooltipLines(rr);
        const { absMargin } = computeCountyMargin(rr);
        const rawName = (rr as any)?.region?.name || (rr as any)?.name || (rr as any)?.region_name || "Unknown";
        return {
          name: titleCaseKey(rawName),
          reporting: rr?.region?.percent_reporting ?? (rr as any)?.percent_reporting ?? 0,
          candidates: candidates,
          margin: absMargin,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [regionResults]);

  if (!data.length) return null;

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="p-6 border-b border-white/10 flex justify-between items-center">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">County Breakdown</h3>
        <span className="text-[10px] opacity-30 font-bold uppercase">{data.length} Regions</span>
      </div>
      <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#0d121f] text-[10px] uppercase tracking-widest font-bold opacity-50 z-10">
            <tr>
              <th className="px-6 py-4 border-b border-white/10 w-[20%]">County / Reporting</th>
              <th className="px-6 py-4 border-b border-white/10 w-[65%]">Candidate Results</th>
              <th className="px-6 py-4 border-b border-white/10 text-right w-[15%]">Margin</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-white/5">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-white/[0.01] transition-colors group align-top">
                <td className="px-6 py-4">
                  <div className="font-bold text-white/90 group-hover:text-white text-sm mb-2">{row.name}</div>
                  <div className="flex flex-col gap-1.5">
                    <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.1)]" style={{ width: `${row.reporting}%` }} />
                    </div>
                    <span className="text-[10px] opacity-40 tabular-nums font-bold">{row.reporting.toFixed(1)}% Reported</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {row.candidates.length > 0 ? (
                      row.candidates.slice(0, 4).map((cand, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4 border-b border-white/5 pb-1 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cand.color || "#666" }} />
                            <span className="truncate opacity-80">{cand.name}</span>
                          </div>
                          <div className="flex gap-3 shrink-0 tabular-nums font-medium">
                            <span className="w-10 text-right">{cand.pct !== null ? `${cand.pct.toFixed(1)}%` : "—"}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="opacity-20 italic">Awaiting data...</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right tabular-nums">
                  {row.margin !== null ? (
                    <div className="flex flex-col items-end">
                      <span className={`font-black text-sm ${row.margin > 15 ? "text-white" : "text-white/70"}`}>+{row.margin.toFixed(1)}%</span>
                      <span className="text-[9px] opacity-30 uppercase font-black tracking-tighter">Spread</span>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function March3FeaturedClient() {
  const [activeState, setActiveState] = useState<"TX" | "NC" | "AR" | "TEST">("TX");
  const [selectedId, setSelectedId] = useState<number>(44286);
  const [error, setError] = useState<string | null>(null);
  const [loadingMap, setLoadingMap] = useState(false);
  const [raceCache, setRaceCache] = useState<Record<number, RaceDetail | undefined>>({});
  const [mapBlankSvg, setMapBlankSvg] = useState<string | null>(null);
  const [mapLoadPct, setMapLoadPct] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // ✅ NEW: overlay state (top of whole screen)
  const [overlay, setOverlay] = useState<null | { id: number; name: string; prob: number; color: string; reporting: number }>(null);
  const lastProjectedKeyRef = useRef<string>("");

  const featuredByState = useMemo(
    () => ({
      TX: FEATURED.filter((r) => r.state === "TX"),
      NC: FEATURED.filter((r) => r.state === "NC"),
      AR: FEATURED.filter((r) => r.state === "AR"),
      TEST: FEATURED.filter((r) => r.state === "TEST"),
    }),
    []
  );

  const selectedRace = raceCache[selectedId];
  const selectedMeta = useMemo(() => FEATURED.find((r) => r.id === selectedId), [selectedId]);

  async function refreshFeatured() {
    try {
      const results = await Promise.all(FEATURED.map((r) => fetchRaceById(r.id).then((d) => [r.id, d] as const)));
      setRaceCache(Object.fromEntries(results));
    } catch (e: any) {
      setError(e?.message ?? "Error refreshing.");
    }
  }

  useEffect(() => {
    refreshFeatured();
    const t = setInterval(refreshFeatured, POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
  const t = setInterval(() => setNowMs(Date.now()), 1000);
  return () => clearInterval(t);
}, []);

  // ✅ IMPORTANT: hard-hide SVG BEFORE the browser paints when the race changes
  useLayoutEffect(() => {
    setLoadingMap(true);
    setMapBlankSvg(null);
    setMapLoadPct(0);
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    let raf: number | null = null;
    let interval: any = null;

    async function loadMap() {
      // (loadingMap + blank svg already set in useLayoutEffect)

      const start = performance.now();
      interval = setInterval(() => {
        const elapsed = performance.now() - start;
        const eased = Math.min(92, 10 + (elapsed / 1200) * 82);
        setMapLoadPct((p) => (p < eased ? eased : p));
      }, 60);

      const svg = await fetchRaceMapBlankSvg(selectedId);
      if (cancelled) return;

      if (interval) clearInterval(interval);
      setMapBlankSvg(svg);
      setMapLoadPct(100);

      raf = requestAnimationFrame(() => {
        if (!cancelled) setLoadingMap(false);
      });
    }

    loadMap();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [selectedId]);

  useEffect(() => {
    const first = featuredByState[activeState]?.[0];
    if (first && !FEATURED.some((r) => r.id === selectedId && r.state === activeState)) setSelectedId(first.id);
  }, [activeState, featuredByState, selectedId]);

  // ✅ NEW: run projection check right after selectedRace updates (i.e. after refresh)
  useEffect(() => {
    const race = selectedRace;
    if (!race?.candidates?.length) return;

    const reporting = race.percent_reporting ?? 0;
    const officialWinner = race.candidates.find((c) => c.winner);
    if (officialWinner) return;

    if (reporting < 5) return;

    const ordered = [...race.candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
    if (ordered.length < 2) return;

    const leader = ordered[0];
    const runnerUp = ordered[1];
    const prob = calculateWinProbability(leader.votes, runnerUp.votes, reporting);

    if (prob < 90) return;

    const key = `${selectedId}:${leader.name}:${Math.floor(prob)}:${Math.floor(reporting)}`;
    if (key === lastProjectedKeyRef.current) return;
    lastProjectedKeyRef.current = key;

    setOverlay({
      id: selectedId,
      name: leader.name,
      prob,
      color: leader.color || "#60a5fa",
      reporting,
    });

    const t = setTimeout(() => setOverlay(null), 5200);
    return () => clearTimeout(t);
  }, [selectedRace, selectedId]);

  return (
    <main className="min-h-screen bg-[#0b0f17] text-white selection:bg-white/20">
      {overlay && (
        <ProjectedWinnerOverlay
          show={!!overlay}
          candidate={overlay.name}
          prob={overlay.prob}
          color={overlay.color}
          reporting={overlay.reporting}
          onDismiss={() => setOverlay(null)}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Live Election Results</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter">MARCH 3RD PRIMARIES</h1>
            <p className="text-1xl md:text-1xl font-black tracking-tighter">Powered by CivicAPI.org</p>
          </div>
        </header>

        <div className="flex gap-2 border-b border-white/5 pb-4 overflow-x-auto no-scrollbar">
          {(["TX", "NC", "AR"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setActiveState(st)}
              className={[
                "px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                st === activeState ? "bg-white text-black" : "bg-white/5 text-white/40 hover:bg-white/10",
              ].join(" ")}
            >
              {st === "TX" ? "Texas" : st === "NC" ? "North Carolina" : st === "AR" ? "Arkansas" : "Test"}
            </button>
          ))}
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {featuredByState[activeState].map((fr) => {
    const liveData = raceCache[fr.id];
    const winner = liveData?.candidates?.find((c) => c.winner);

    const reporting = getRaceReportingPct(liveData);
    const reportingLabel =
      reporting === null ? "—" : `${reporting.toFixed(1)}% reporting`;

    const projection = getRaceProjectionAlways(liveData);
    const hasWinner = !!winner || projection?.prob === 100;
    const showProjection = !hasWinner && !!projection;

    // ✅ Poll Close Timer Logic
    const closeDate = parseIsoDate(liveData?.polls_close ?? null);
    const closeTimeLocal = closeDate
      ? formatLocalCloseTime(closeDate)
      : "—";

    const msLeft = closeDate
      ? closeDate.getTime() - nowMs
      : null;

    const countdownLabel =
      msLeft === null ? "—" : formatCountdown(msLeft);

    return (
      <button
        key={fr.id}
        onClick={() => setSelectedId(fr.id)}
        className={[
          "w-full text-left p-4 rounded-2xl border transition-all flex flex-col",
          hasWinner ? "min-h-[100px] py-3" : "min-h-[160px]",
          fr.id === selectedId
            ? "bg-white/10 border-white/20 ring-1 ring-white/20"
            : "bg-white/5 border-transparent hover:bg-white/10",
        ].join(" ")}
      >
        <div>
          <div className="font-bold text-[13px] leading-tight mb-1">
            {fr.label}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-[9px] opacity-40 uppercase font-black tracking-widest">
              {fr.party} Primary
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest tabular-nums opacity-55">
              {reportingLabel}
            </div>
          </div>

          {!hasWinner && (
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white/40 transition-all duration-700 ease-out"
                style={{ width: `${reporting ?? 0}%` }}
              />
            </div>
          )}

          {/* ✅ NEW — Poll Closing Timer */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[9px] uppercase font-black tracking-widest opacity-50">
              Closes {closeTimeLocal}
            </span>
            <span
              className={`text-[10px] font-black tabular-nums ${
                msLeft && msLeft > 0
                  ? "text-white"
                  : "text-red-400"
              }`}
            >
              {countdownLabel}
            </span>
          </div>

          {showProjection && (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                  Projected Win
                </span>
                <span className="text-[10px] font-black tabular-nums">
                  {projection!.prob.toFixed(0)}%
                </span>
              </div>

              <div className="mt-1 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, projection!.prob)
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-1 text-[9px] opacity-40 font-bold truncate">
                Leader: {projection!.leaderName}
              </div>
            </div>
          )}
        </div>

        <div className={hasWinner ? "mt-2" : "mt-3"}>
          {winner ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]" />
                <span className="text-[10px] font-black text-green-400 uppercase tracking-tighter">
                  Winner: {winner.name}
                </span>
              </div>
            </div>
          ) : (reporting ?? 0) > 0 ? (
            <div className="text-[9px] font-bold opacity-30 uppercase tracking-tight italic">
              Results coming in...
            </div>
          ) : (
            <div className="text-[9px] font-bold opacity-20 uppercase tracking-tight italic">
              Waiting for polls
            </div>
          )}
        </div>
      </button>
    );
  })}
</section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-8">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-black tracking-tight">{selectedMeta?.label}</h2>
                  <p className="text-xs opacity-50 font-medium">
                    {selectedRace?.percent_reporting?.toFixed(1)}% Reporting • {prettyTime(selectedRace?.last_updated)}
                  </p>
                </div>
                <div className="flex gap-2">{loadingMap ? <Pill>Syncing Map • {Math.round(mapLoadPct)}%</Pill> : <Pill>Interactive</Pill>}</div>
              </div>

              {/* ✅ HARD GATE: NEVER render SVG while syncing */}
              {loadingMap ? (
                <div className="aspect-video flex flex-col justify-center rounded-2xl bg-black/20 border border-white/5 px-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-black uppercase tracking-widest opacity-40">Syncing Map</div>
                    <div className="text-xs font-black tabular-nums opacity-60">{Math.round(mapLoadPct)}%</div>
                  </div>

                  <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden shadow-inner">
                    <div className="h-full bg-blue-500 transition-all duration-150 ease-out" style={{ width: `${mapLoadPct}%` }} />
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3 opacity-25">
                    <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                    <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                    <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                    <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                    <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                    <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                  </div>
                </div>
              ) : mapBlankSvg ? (
                <MapWithCountyTooltip svgText={mapBlankSvg} regionResults={selectedRace?.region_results ?? []} />
              ) : (
                <div className="aspect-video flex items-center justify-center rounded-2xl bg-black/20 border border-white/5 text-xs opacity-40 uppercase tracking-widest">No Map Data</div>
              )}
            </div>

            <CountyTotalsTable regionResults={selectedRace?.region_results ?? []} />
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-40 mb-4">Topline Results</h3>
              {selectedRace?.candidates ? (
                <CandidateList candidates={selectedRace.candidates} reporting={selectedRace.percent_reporting ?? 0} />
              ) : (
                <div className="py-20 text-center opacity-20 font-bold uppercase tracking-widest text-xs">Loading...</div>
              )}
            </div>
          </div>
        </section>

        {error && <div className="text-xs opacity-60">{error}</div>}
      </div>
    </main>
  );
}