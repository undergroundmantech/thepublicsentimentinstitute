"use client";

import React, { useMemo } from "react";
import { createPortal } from "react-dom";

// ✅ topojson + d3-geo (for map)
import { feature } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";

// ✅ topojson data
import usStates from "@/public/us-states.json";

// ✅ state polling modules
import * as SenateMichigan from "@/app/polling/senatepolling/michigan";
import * as SenateGeorgia from "@/app/polling/senatepolling/georgia";
import * as SenateNorthCarolina from "@/app/polling/senatepolling/northcarolina";
import * as SenateMaine from "@/app/polling/senatepolling/maine";
import * as SenateNewHampshire from "@/app/polling/senatepolling/newhampshire";
import * as SenateTexas from "@/app/polling/senatepolling/texas";
import * as SenateOhio from "@/app/polling/senatepolling/ohio";
import * as SenateNebraska from "@/app/polling/senatepolling/nebraska";
import * as SenateAlaska from "@/app/polling/senatepolling/alaska";
import * as SenateSouthCarolina from "@/app/polling/senatepolling/southcarolina";
import * as SenateFlorida from "@/app/polling/senatepolling/florida";

// ✅ shared daily model (KEY CHANGE)
import {
  Poll,
  SampleType,
  getCandidateList,
  getDateRange,
  buildDailyWeightedSeries,
} from "@/app/polling/lib/buildDailyModel";

/**
 * 2026 seats (Class II) + specials per your notes: FL(sp.), OH(sp.)
 */
const SENATE_2026_ACTIVE: {
  abbr: string;
  name: string;
  seatType?: "Class II" | "Special";
}[] = [
  { abbr: "AL", name: "Alabama", seatType: "Class II" },
  { abbr: "AK", name: "Alaska", seatType: "Class II" },
  { abbr: "AR", name: "Arkansas", seatType: "Class II" },
  { abbr: "CO", name: "Colorado", seatType: "Class II" },
  { abbr: "DE", name: "Delaware", seatType: "Class II" },
  { abbr: "FL", name: "Florida", seatType: "Special" },
  { abbr: "GA", name: "Georgia", seatType: "Class II" },
  { abbr: "ID", name: "Idaho", seatType: "Class II" },
  { abbr: "IL", name: "Illinois", seatType: "Class II" },
  { abbr: "IA", name: "Iowa", seatType: "Class II" },
  { abbr: "KS", name: "Kansas", seatType: "Class II" },
  { abbr: "KY", name: "Kentucky", seatType: "Class II" },
  { abbr: "LA", name: "Louisiana", seatType: "Class II" },
  { abbr: "ME", name: "Maine", seatType: "Class II" },
  { abbr: "MA", name: "Massachusetts", seatType: "Class II" },
  { abbr: "MI", name: "Michigan", seatType: "Class II" },
  { abbr: "MN", name: "Minnesota", seatType: "Class II" },
  { abbr: "MS", name: "Mississippi", seatType: "Class II" },
  { abbr: "MT", name: "Montana", seatType: "Class II" },
  { abbr: "NE", name: "Nebraska", seatType: "Class II" },
  { abbr: "NH", name: "New Hampshire", seatType: "Class II" },
  { abbr: "NJ", name: "New Jersey", seatType: "Class II" },
  { abbr: "NM", name: "New Mexico", seatType: "Class II" },
  { abbr: "NC", name: "North Carolina", seatType: "Class II" },
  { abbr: "OH", name: "Ohio", seatType: "Special" },
  { abbr: "OK", name: "Oklahoma", seatType: "Class II" },
  { abbr: "OR", name: "Oregon", seatType: "Class II" },
  { abbr: "RI", name: "Rhode Island", seatType: "Class II" },
  { abbr: "SC", name: "South Carolina", seatType: "Class II" },
  { abbr: "SD", name: "South Dakota", seatType: "Class II" },
  { abbr: "TN", name: "Tennessee", seatType: "Class II" },
  { abbr: "TX", name: "Texas", seatType: "Class II" },
  { abbr: "WV", name: "West Virginia", seatType: "Class II" },
  { abbr: "WY", name: "Wyoming", seatType: "Class II" },
];

const SEAT_PARTY: Record<string, "R" | "D"> = {
  AL: "R",
  AK: "R",
  AR: "R",
  CO: "D",
  DE: "D",
  FL: "R",
  GA: "D",
  ID: "R",
  IL: "D",
  IA: "R",
  KS: "R",
  KY: "R",
  LA: "R",
  ME: "R",
  MA: "D",
  MI: "D",
  MN: "D",
  MS: "R",
  MT: "R",
  NE: "R",
  NH: "D",
  NJ: "D",
  NM: "D",
  NC: "R",
  OH: "R",
  OK: "R",
  OR: "D",
  RI: "D",
  SC: "R",
  SD: "R",
  TN: "R",
  TX: "R",
  WV: "R",
  WY: "R",
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function fmtMargin(m: number) {
  if (!Number.isFinite(m)) return "—";
  if (m === 0) return "0.0";
  return m > 0 ? `+${m.toFixed(1)}` : `${m.toFixed(1)}`;
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="psi-chip">{children}</span>;
}
function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="psi-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white/90">
        {value}
      </div>
      {sub ? <div className="mt-1 text-sm text-white/60">{sub}</div> : null}
    </div>
  );
}

/* =========================
   Summary types
========================= */
type LeaderSummary = {
  leaderName: string;
  leaderPct: number;
  runnerUpName?: string;
  runnerUpPct?: number;
  margin?: number;
  lastDate?: string;
  pollsUsed?: number;
};

/* =========================
   Normalize poll -> buildDailyModel Poll
========================= */
function toDailyModelPoll(p: any): (Poll & { raceId?: string }) | null {
  const endDate = String(p?.endDate ?? p?.end ?? "").trim();
  if (!endDate) return null;

  const sampleSize = Number(p?.sampleSize ?? 0);
  const results = (p?.results ?? {}) as Record<string, number>;

  const pop = String(p?.sampleType ?? p?.population ?? "RV").toUpperCase();
  const sampleType: SampleType =
    pop === "LV" ? "LV" : pop === "RV" ? "RV" : "A";

  return {
    pollster: String(p?.pollster ?? ""),
    endDate,
    sampleSize: Number.isFinite(sampleSize) ? sampleSize : 0,
    sampleType,
    results,
    raceId: String(p?.raceId ?? "").trim() || undefined,
  };
}

/* =========================
   ✅ DAILY MODEL summary (latest point)
   - Groups by raceId (matchup)
   - Picks matchup with most recent poll
   - Builds daily series and uses LAST row as displayed value
========================= */
function computeLeaderFromPollsUsingDailyModel(rawPolls: any[]): LeaderSummary | null {
  if (!rawPolls?.length) return null;

  const polls = rawPolls
    .map(toDailyModelPoll)
    .filter(Boolean) as (Poll & { raceId?: string })[];

  if (!polls.length) return null;

  // group by matchup (raceId)
  const groups = new Map<string, (Poll & { raceId?: string })[]>();
  for (const p of polls) {
    const key = p.raceId ?? "__default__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  // choose matchup whose latest poll is most recent
  const groupList = [...groups.values()];
  groupList.sort((a, b) => {
    const aLast = a.map((p) => p.endDate).sort().slice(-1)[0] ?? "";
    const bLast = b.map((p) => p.endDate).sort().slice(-1)[0] ?? "";
    return aLast < bLast ? 1 : -1;
  });
  const chosen = groupList[0];
  if (!chosen?.length) return null;

  const candidates = getCandidateList(chosen);
  if (!candidates.length) return null;

  const { start, end } = getDateRange(chosen);
  if (!start || !end) return null;

  const series = buildDailyWeightedSeries(chosen, candidates, start, end);
  const last = series[series.length - 1];
  if (!last) return null;

  const ranked = candidates
    .map((c) => ({ name: c, pct: Number(last[c] ?? 0) }))
    .filter((x) => Number.isFinite(x.pct))
    .map((x) => ({ ...x, pct: round1(x.pct) }))
    .sort((a, b) => b.pct - a.pct);

  const leader = ranked[0];
  const runner = ranked[1];
  if (!leader) return null;

  return {
    leaderName: leader.name,
    leaderPct: leader.pct,
    runnerUpName: runner?.name,
    runnerUpPct: runner?.pct,
    margin: round1((leader.pct ?? 0) - (runner?.pct ?? 0)),
    lastDate: end, // ✅ latest datapoint date
    pollsUsed: chosen.length,
  };
}

/* =========================
   Merge state modules
========================= */
const STATE_MODS = [
  SenateMichigan,
  SenateGeorgia,
  SenateNorthCarolina,
  SenateMaine,
  SenateNewHampshire,
  SenateTexas,
  SenateOhio,
  SenateNebraska,
  SenateAlaska,
  SenateSouthCarolina,
  SenateFlorida,
] as const;

function getStateSummaryMerged(abbr: string): LeaderSummary | null {
  for (const mod of STATE_MODS) {
    const anyMod = mod as any;

    // Preferred if you add getStateSummary later
    if (typeof anyMod.getStateSummary === "function") {
      const s = anyMod.getStateSummary(abbr);
      if (s) return s as LeaderSummary;
    }

    // Fallback: STATE_POLLS map
    const pollsMap = anyMod.STATE_POLLS as Record<string, any[]> | undefined;
    const raw = pollsMap?.[abbr];
    if (raw?.length) return computeLeaderFromPollsUsingDailyModel(raw);
  }
  return null;
}

/* =========================
   Map helpers
========================= */
type TooltipState =
  | {
      x: number; // viewport coords (fixed tooltip)
      y: number;
      abbr: string;
      name: string;
      seatType?: "Class II" | "Special";
      party: "R" | "D";
      summary: LeaderSummary | null;
    }
  | null;

function isDem(name: string) {
  return /\(d\)/i.test(name);
}
function isGop(name: string) {
  return /\(r\)/i.test(name);
}
function partyFromCandidateName(name: string): "D" | "R" | "U" {
  if (isDem(name)) return "D";
  if (isGop(name)) return "R";
  return "U";
}
function classForWinner(summary: LeaderSummary | null, incumbentParty: "R" | "D") {
  // if no polling, tint by seat party so map still looks sane
  const p = summary ? partyFromCandidateName(summary.leaderName) : incumbentParty;

  if (p === "D") return "fill-[rgba(59,130,246,0.35)] hover:fill-[rgba(59,130,246,0.55)]";
  if (p === "R") return "fill-[rgba(239,68,68,0.35)] hover:fill-[rgba(239,68,68,0.55)]";
  return "fill-[rgba(148,163,184,0.25)] hover:fill-[rgba(148,163,184,0.4)]";
}
function shortName(s: string) {
  const base = s.replace(/\s*\([DR]\)\s*/gi, "").trim();
  const parts = base.split(/\s+/);
  return parts.length ? parts[parts.length - 1] : base;
}
function tooltipLine(summary: LeaderSummary | null) {
  if (!summary) return "No polling yet";
  const leaderParty = partyFromCandidateName(summary.leaderName);
  const runnerParty = summary.runnerUpName ? partyFromCandidateName(summary.runnerUpName) : "U";
  const leaderTag = leaderParty !== "U" ? `(${leaderParty})` : "";
  const runnerTag = runnerParty !== "U" ? `(${runnerParty})` : "";
  const m = typeof summary.margin === "number" ? fmtMargin(summary.margin) : "—";

  return `${shortName(summary.leaderName)} ${leaderTag} ${summary.leaderPct.toFixed(
    1
  )}%  •  ${shortName(summary.runnerUpName ?? "—")} ${runnerTag} ${
    Number.isFinite(summary.runnerUpPct) ? summary.runnerUpPct!.toFixed(1) : "—"
  }%  •  ${m}`;
}

export default function Senate2026Page() {
  const [tip, setTip] = React.useState<TooltipState>(null);

  const {
    rows,
    seatsTotal,
    seatsR,
    seatsD,
    polledCount,
    latestAsOf,
    activeByName,
    mapFeatures,
  } = useMemo(() => {
    const topo: any = usStates as any;

    const topoGeoms: any[] = topo?.objects?.states?.geometries ?? [];
    const topoNameSet = new Set(
      topoGeoms
        .map((g) => String(g?.properties?.name ?? "").trim())
        .filter(Boolean)
    );

    const active = SENATE_2026_ACTIVE.map((s) => {
      const party = SEAT_PARTY[s.abbr] ?? "R";
      const summary = getStateSummaryMerged(s.abbr); // ✅ daily model now
      return { ...s, party, inTopo: topoNameSet.has(s.name), summary };
    });

    const seatsTotal = active.length;
    const seatsR = active.filter((x) => x.party === "R").length;
    const seatsD = active.filter((x) => x.party === "D").length;

    const polled = active.filter((x) => x.summary && (x.summary.pollsUsed ?? 0) > 0);
    const polledCount = polled.length;

    const latestAsOf =
      polled
        .map((x) => x.summary?.lastDate)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] ?? "—";

    const rows = [...active].sort((a, b) => {
      const ad = a.summary?.lastDate ?? "";
      const bd = b.summary?.lastDate ?? "";
      if (ad !== bd) return ad < bd ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    const activeByName = new Map(active.map((a) => [a.name, a]));

    const fc = feature(topo, topo.objects.states) as any;
    const mapFeatures = (fc?.features ?? []) as any[];

    return {
      rows,
      seatsTotal,
      seatsR,
      seatsD,
      polledCount,
      latestAsOf,
      activeByName,
      mapFeatures,
    };
  }, []);

  const projection = useMemo(() => geoAlbersUsa().translate([520, 310]).scale(1100), []);
  const path = useMemo(() => geoPath(projection), [projection]);

  return (
    <div className="space-y-10 psi-animate-in">
      {/* HERO */}
      <section className="relative overflow-hidden psi-card p-7 md:p-10">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-[rgba(34,197,94,0.14)] blur-3xl" />
          <div className="absolute -right-28 top-10 h-96 w-96 rounded-full bg-[rgba(255,79,216,0.14)] blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Chip>U.S. Senate</Chip>
              <Chip>2026</Chip>
              <Chip>Daily weighted averages</Chip>
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white/90 md:text-6xl">
              2026 Senate Seats: Polling Leaderboard
            </h1>

            <p className="mt-3 text-white/65">
              Latest values shown are the <span className="font-semibold text-white/85">last daily datapoint</span> from{" "}
              <span className="font-semibold text-white/85">buildDailyWeightedSeries()</span>.
            </p>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 lg:grid-cols-4">
        <KpiCard label="Seats up" value={`${seatsTotal}`} sub="Active races shown" />
        <KpiCard label="R seats up" value={`${seatsR}`} sub="Incumbent party" />
        <KpiCard label="D seats up" value={`${seatsD}`} sub="Incumbent party" />
        <KpiCard label="With polling" value={`${polledCount}/${seatsTotal}`} sub={`Latest as-of: ${latestAsOf}`} />
      </section>

      {/* MAP */}
      <section className="psi-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white/85">2026 Senate Elections</div>
            <div className="mt-1 text-sm text-white/60">Hover a highlighted state to see leader & margin.</div>
          </div>
        </div>

        <div className="my-4 psi-divider" />

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/20">
          <svg viewBox="-15 0 1040 620" className="h-[650px] w-full" onMouseLeave={() => setTip(null)}>
            <g>
              {mapFeatures.map((f: any, idx: number) => {
                const name = String(f?.properties?.name ?? "").trim();
                const active = activeByName.get(name);
                const d = (path as any)(f) || undefined;

                if (!active) {
                  return (
                    <path
                      key={idx}
                      d={d}
                      className="fill-[rgba(255,255,255,0.04)] stroke-[rgba(255,255,255,0.08)]"
                      strokeWidth={1}
                    />
                  );
                }

                const cls = classForWinner(active.summary, active.party);

                return (
                  <path
                    key={idx}
                    d={d}
                    className={`${cls} stroke-[rgba(255,255,255,0.18)] cursor-pointer transition`}
                    strokeWidth={1.2}
                    onMouseMove={(e) => {
                      setTip({
                        x: e.clientX + 12,
                        y: e.clientY + 12,
                        abbr: active.abbr,
                        name: active.name,
                        seatType: active.seatType,
                        party: active.party,
                        summary: active.summary,
                      });
                    }}
                  />
                );
              })}
            </g>
          </svg>
        </div>

        <div className="mt-3 text-xs text-white/45">
          Color reflects polling leader party (based on “(D)” / “(R)” in candidate name).
        </div>
      </section>

      {/* ✅ TOOLTIP PORTAL (NOT CLIPPED) */}
      {tip && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[9999] w-[320px] rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur"
              style={{ left: tip.x, top: tip.y, maxWidth: "calc(100vw - 24px)" }}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white/90">
                  {tip.name} <span className="psi-mono text-xs text-white/55">{tip.abbr}</span>
                </div>
                <span className="psi-chip text-[11px] text-white/75">
                  {tip.seatType === "Special" ? "Special" : "Class II"}
                </span>
              </div>

              <div className="mt-2 text-sm text-white/75">{tooltipLine(tip.summary)}</div>

              <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/55">
                <span className="psi-chip">Incumbent seat: {tip.party}</span>
                <span className="psi-chip">Polls: {tip.summary?.pollsUsed ?? 0}</span>
                <span className="psi-chip">As-of: {tip.summary?.lastDate ?? "—"}</span>
              </div>
            </div>,
            document.body
          )
        : null}

      {/* TABLE */}
      <section className="psi-card p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white/85">State polling</div>
            <div className="mt-1 text-sm text-white/60">Sorted by most recent datapoint date.</div>
          </div>
        </div>

        <div className="my-4 psi-divider" />

        <div className="overflow-x-auto">
          <table className="psi-table w-full min-w-[980px]">
            <thead>
              <tr>
                <th>State</th>
                <th className="psi-num">Seat</th>
                <th className="psi-num">Incumbent</th>
                <th>Leader</th>
                <th className="psi-num">Leader</th>
                <th>Runner-up</th>
                <th className="psi-num">Runner-up</th>
                <th className="psi-num">Margin</th>
                <th className="psi-num">Polls</th>
                <th className="psi-num">As-of</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = r.summary;

                return (
                  <tr key={r.abbr}>
                    <td className="text-white/85">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.name}</span>
                        <span className="psi-mono text-xs text-white/45">{r.abbr}</span>
                        {!r.inTopo ? <span className="psi-chip text-[11px] text-white/70">Topo?</span> : null}
                      </div>
                    </td>

                    <td className="psi-num text-white/70">{r.seatType === "Special" ? "Special" : "Class II"}</td>

                    <td className="psi-num text-white/70">
                      <span className="text-white/85">{r.party}</span>
                    </td>

                    <td className="text-white/85">{s?.leaderName ?? "No polling"}</td>
                    <td className="psi-num text-white/85">
                      {Number.isFinite(s?.leaderPct) ? `${s!.leaderPct.toFixed(1)}%` : "—"}
                    </td>

                    <td className="text-white/70">{s?.runnerUpName ?? "—"}</td>
                    <td className="psi-num text-white/70">
                      {Number.isFinite(s?.runnerUpPct) ? `${s!.runnerUpPct!.toFixed(1)}%` : "—"}
                    </td>

                    <td className="psi-num text-white/85">{fmtMargin(Number(s?.margin))}</td>
                    <td className="psi-num text-white/70">{s?.pollsUsed ?? 0}</td>
                    <td className="psi-num text-white/70">{s?.lastDate ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
