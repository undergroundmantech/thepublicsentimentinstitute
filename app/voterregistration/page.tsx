"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { notFound } from "next/navigation";
import { Manrope } from "next/font/google";
import DarkNav from "@/app/components/DarkNav";
import { SITE_V2 } from "@/app/lib/flags";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-mp", display: "swap" });

// ─── types ──────────────────────────────────────────────────────────────────
type Scope = "states" | "counties";
type Lens = "reg" | "party";
type Plur = "DEM" | "REP" | "UNA" | null;

interface StateSummary {
  abbr: string; name: string; fips: string;
  total: number | null; as_of: string | null;
  registers_by_party: boolean; quality: string | null; unit_label: string | null;
  county_count: number;
  party: { DEM: number; REP: number; UNA: number; OTH: number } | null;
  plurality: Plur; no_reg: boolean; source_url: string | null;
  county_breakdown_as_of?: string | null;
}
interface CountyVal { r: number; p: Plur; n: string; s: string }
interface DetailUnit { name: string; fips: string | null; total: number | null; party: { DEM:number;REP:number;UNA:number;OTH:number } | null; plurality: Plur }
interface StateDetail {
  abbr: string; name: string; as_of: string | null; unit_label: string | null;
  registers_by_party: boolean; total: number | null;
  party: { DEM:number;REP:number;UNA:number;OTH:number } | null; plurality: Plur;
  county_breakdown_as_of?: string | null; source_url: string | null; counties: DetailUnit[];
}
interface Tip {
  visible: boolean; x: number; y: number;
  title: string; sub: string; value: number | null;
  plur: Plur; party: { DEM:number;REP:number;UNA:number;OTH:number } | null;
  hint: string; noReg?: boolean; rank?: string;
}
interface Geo { key: string; d: string; cx?: number; cy?: number; abbr?: string; name?: string }

// ─── constants ──────────────────────────────────────────────────────────────
const PCOL: Record<"DEM" | "REP" | "UNA", string> = { DEM: "#3568e6", REP: "#e84450", UNA: "#8b5cf6" };
const PWORD: Record<"DEM" | "REP" | "UNA", string> = { DEM: "Democratic", REP: "Republican", UNA: "Unaffiliated" };
const DIM_NOREG = "#171a26";     // North Dakota — no registration
const DIM_NOPARTY = "#242a3c";   // state that doesn't record party (in party lens)
const STATES_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const COUNTIES_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

const REG_STOPS: [number, [number, number, number]][] = [
  [0.00, [34, 38, 58]], [0.20, [47, 40, 104]], [0.42, [78, 42, 170]],
  [0.66, [124, 58, 237]], [0.84, [168, 85, 247]], [1.00, [221, 190, 255]],
];
function rampReg(t: number): string {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < REG_STOPS.length; i++) {
    if (t <= REG_STOPS[i][0]) {
      const [t0, c0] = REG_STOPS[i - 1], [t1, c1] = REG_STOPS[i];
      const f = (t - t0) / (t1 - t0 || 1);
      return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * f)).join(",")})`;
    }
  }
  return `rgb(${REG_STOPS[REG_STOPS.length - 1][1].join(",")})`;
}
const logNorm = (v: number, min: number, max: number) =>
  max <= min ? 0.5 : (Math.log(Math.max(v, 1)) - Math.log(Math.max(min, 1))) / (Math.log(max) - Math.log(Math.max(min, 1)));

function fmt(n: number | null | undefined): string { return n == null ? "—" : n.toLocaleString("en-US"); }
function compact(n: number | null | undefined): string {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return Math.round(n / 1e3) + "K";
  return String(n);
}
const PAD = (f: string | number) => String(f).padStart(2, "0");

// ─── page ─────────────────────────────────────────────────────────────────────
export default function VoterRegistrationPage() {
  // v2-only route — the v1 site's registration map lives at /partymap
  if (!SITE_V2) notFound();
  const [scope, setScope] = useState<Scope>("states");
  const [lens, setLens] = useState<Lens>("reg");
  const [isoAbbr, setIsoAbbr] = useState<string | null>(null);
  const [summary, setSummary] = useState<StateSummary[]>([]);
  const [nat, setNat] = useState<{ total: number; party: { DEM:number;REP:number;UNA:number;OTH:number } } | null>(null);
  const [countyVals, setCountyVals] = useState<Record<string, CountyVal> | null>(null);
  const [detail, setDetail] = useState<StateDetail | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [loadingCounties, setLoadingCounties] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const lensRef = useRef<Lens>("reg"); lensRef.current = lens;

  // geometry caches
  const [statesGeo, setStatesGeo] = useState<{ shapes: Geo[]; border: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countiesTopoRef = useRef<{ feature: { features: any[] }; toAbbr: Record<string, string> } | null>(null);
  const [countiesGeo, setCountiesGeo] = useState<{ shapes: Geo[]; border: string } | null>(null);
  const [isoGeo, setIsoGeo] = useState<{ shapes: Geo[]; border: string } | null>(null);

  useEffect(() => setMounted(true), []);

  // ── load summary + state geometry on mount ──
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [sum, { geoAlbersUsa, geoPath }, topojson, topo] = await Promise.all([
          fetch("/voterreg/summary.json").then(r => r.json()),
          import("d3-geo"), import("topojson-client"),
          fetch(STATES_URL).then(r => r.json()),
        ]);
        if (dead) return;
        setSummary(sum.states); setNat({ total: sum.national_total, party: sum.national_party });
        const proj = geoAlbersUsa().scale(1280).translate([480, 300]);
        const path = geoPath().projection(proj);
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const fc = (topojson as any).feature(topo, (topo as any).objects.states) as any;
        const byFips: Record<string, StateSummary> = Object.fromEntries((sum.states as StateSummary[]).map(s => [s.fips, s]));
        const shapes: Geo[] = [];
        for (const f of fc.features) {
          const fips = PAD(f.id); const s = byFips[fips]; if (!s) continue;
          const d = path(f) ?? ""; const [cx, cy] = (path as any).centroid(f);
          const [[x0, y0], [x1, y1]] = (path as any).bounds(f);
          shapes.push({ key: s.abbr, d, abbr: s.abbr, name: s.name, cx, cy, ...(x1 - x0 < 28 || y1 - y0 < 18 ? { cx: undefined } : {}) });
        }
        const border = path((topojson as any).mesh(topo, (topo as any).objects.states, (a: any, b: any) => a !== b)) ?? "";
        /* eslint-enable @typescript-eslint/no-explicit-any */
        setStatesGeo({ shapes, border });
      } catch { /* offline */ }
    })();
    return () => { dead = true; };
  }, []);

  // ── lazy: load county geometry + values when first needed ──
  const ensureCounties = useCallback(async () => {
    if (countiesTopoRef.current && countyVals) return;
    setLoadingCounties(true);
    try {
      const [{ geoAlbersUsa, geoPath }, topojson, topo, vals] = await Promise.all([
        import("d3-geo"), import("topojson-client"),
        fetch(COUNTIES_URL).then(r => r.json()),
        countyVals ? Promise.resolve(countyVals) : fetch("/voterreg/county_values.json").then(r => r.json()),
      ]);
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const fc = (topojson as any).feature(topo, (topo as any).objects.counties) as any;
      const proj = geoAlbersUsa().scale(1280).translate([480, 300]);
      const path = geoPath().projection(proj);
      const shapes: Geo[] = [];
      const toAbbr: Record<string, string> = {};
      const sBy = Object.fromEntries(summary.map(s => [s.fips, s.abbr]));
      for (const f of fc.features) {
        const fips = String(f.id).padStart(5, "0");
        toAbbr[fips] = sBy[fips.slice(0, 2)] ?? "";
        shapes.push({ key: fips, d: path(f) ?? "", name: f.properties?.name, abbr: toAbbr[fips] });
      }
      const border = path((topojson as any).mesh(topo, (topo as any).objects.states, (a: any, b: any) => a !== b)) ?? "";
      /* eslint-enable @typescript-eslint/no-explicit-any */
      countiesTopoRef.current = { feature: fc, toAbbr };
      setCountiesGeo({ shapes, border });
      if (!countyVals) setCountyVals(vals);
    } catch { /* offline */ }
    setLoadingCounties(false);
  }, [countyVals, summary]);

  useEffect(() => { if (scope === "counties") ensureCounties(); }, [scope, ensureCounties]);

  // ── isolate a state: fit its counties to the stage ──
  const isolate = useCallback(async (abbr: string) => {
    setIsoAbbr(abbr); setTip(null); setHoverKey(null);
    setDetail(null); setIsoGeo(null);
    const s = summary.find(x => x.abbr === abbr); if (!s) return;
    try {
      const dPromise = fetch(`/voterreg/counties/${abbr}.json`).then(r => r.json());
      await ensureCounties();
      const topoRef = countiesTopoRef.current;
      const [{ geoMercator, geoAlbers, geoPath }] = await Promise.all([import("d3-geo")]);
      if (topoRef) {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const feats = (topoRef.feature.features as any[]).filter(f => String(f.id).padStart(5, "0").slice(0, 2) === s.fips);
        const fc = { type: "FeatureCollection", features: feats } as any;
        // Alaska crosses the antimeridian — Albers behaves; Mercator for the rest.
        const proj = (abbr === "AK" ? geoAlbers().rotate([154, 0]).center([0, 62]).parallels([55, 65]) : geoMercator())
          .fitExtent([[46, 40], [914, 560]], fc);
        const path = geoPath().projection(proj as any);
        const shapes: Geo[] = feats.map(f => ({ key: String(f.id).padStart(5, "0"), d: path(f) ?? "", name: f.properties?.name }));
        /* eslint-enable @typescript-eslint/no-explicit-any */
        // internal county borders come from each path's own stroke; outer hairline only.
        setIsoGeo({ shapes, border: "" });
      }
      setDetail(await dPromise);
    } catch { /* offline */ }
  }, [summary, ensureCounties]);

  const exitIsolate = useCallback(() => { setIsoAbbr(null); setDetail(null); setIsoGeo(null); setTip(null); setHoverKey(null); }, []);

  // ── deep-link (?state=&lens=&scope=) ──
  useEffect(() => {
    if (!summary.length) return;
    try {
      const u = new URL(window.location.href);
      const l = u.searchParams.get("lens"); if (l === "party" || l === "reg") setLens(l);
      const sc = u.searchParams.get("scope"); if (sc === "counties") setScope("counties");
      const st = u.searchParams.get("state"); if (st && summary.some(s => s.abbr === st.toUpperCase())) isolate(st.toUpperCase());
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.length]);
  useEffect(() => {
    if (!mounted) return;
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("lens", lens);
      scope === "counties" ? u.searchParams.set("scope", "counties") : u.searchParams.delete("scope");
      isoAbbr ? u.searchParams.set("state", isoAbbr) : u.searchParams.delete("state");
      window.history.replaceState(null, "", u.toString());
    } catch {}
  }, [lens, scope, isoAbbr, mounted]);

  // ── domains for the magnitude scale ──
  const stateDomain = useMemo(() => {
    const v = summary.map(s => s.total).filter((x): x is number => !!x);
    return v.length ? [Math.min(...v), Math.max(...v)] as const : [1, 1] as const;
  }, [summary]);
  const countyDomain = useMemo(() => {
    if (!countyVals) return [1, 1] as const;
    const v = Object.values(countyVals).map(c => c.r);
    return [Math.min(...v), Math.max(...v)] as const;
  }, [countyVals]);
  const isoDomain = useMemo(() => {
    const v = (detail?.counties ?? []).map(c => c.total).filter((x): x is number => !!x);
    return v.length ? [Math.min(...v), Math.max(...v)] as const : [1, 1] as const;
  }, [detail]);

  const fillState = useCallback((s: StateSummary): string => {
    if (lens === "party") return s.no_reg ? DIM_NOREG : s.registers_by_party && s.plurality ? PCOL[s.plurality] : DIM_NOPARTY;
    return s.total ? rampReg(logNorm(s.total, stateDomain[0], stateDomain[1])) : DIM_NOREG;
  }, [lens, stateDomain]);
  const fillCounty = useCallback((fips: string): string => {
    const v = countyVals?.[fips];
    if (!v) return "#14171f";
    if (lens === "party") return v.p ? PCOL[v.p] : DIM_NOPARTY;
    return rampReg(logNorm(v.r, countyDomain[0], countyDomain[1]));
  }, [countyVals, lens, countyDomain]);
  const fillIso = useCallback((fips: string): string => {
    const u = detail?.counties.find(c => c.fips === fips);
    if (!u || u.total == null) return "#1a1e2a";
    if (lens === "party") return u.plurality ? PCOL[u.plurality] : DIM_NOPARTY;
    return rampReg(logNorm(u.total, isoDomain[0], isoDomain[1]));
  }, [detail, lens, isoDomain]);

  // ── tooltip builders ──
  const moveTip = (e: React.MouseEvent, t: Omit<Tip, "visible" | "x" | "y">) =>
    setTip({ ...t, visible: true, x: e.clientX, y: e.clientY });
  const hideTip = () => setTip(t => (t ? { ...t, visible: false } : t));

  const rankOf = useMemo(() => {
    const sorted = [...summary].filter(s => s.total).sort((a, b) => (b.total! - a.total!));
    const m: Record<string, number> = {}; sorted.forEach((s, i) => (m[s.abbr] = i + 1));
    return m;
  }, [summary]);

  // ── leaderboard rows ──
  const stateRows = useMemo(() =>
    [...summary].sort((a, b) => (b.total ?? -1) - (a.total ?? -1)), [summary]);
  const countyRows = useMemo(() => {
    if (!countyVals) return [] as (CountyVal & { fips: string })[];
    return Object.entries(countyVals).map(([fips, v]) => ({ ...v, fips })).sort((a, b) => b.r - a.r).slice(0, 40);
  }, [countyVals]);
  const detailRows = useMemo(() =>
    (detail?.counties ?? []).filter(c => c.total != null).sort((a, b) => (b.total! - a.total!)), [detail]);

  // search suggestions
  const suggest = useMemo(() => {
    const q = query.trim().toLowerCase(); if (!q) return [];
    return summary.filter(s => s.name.toLowerCase().includes(q) || s.abbr.toLowerCase() === q).slice(0, 6);
  }, [query, summary]);

  // ── narrator deck ──
  const iso = isoAbbr ? summary.find(s => s.abbr === isoAbbr) : null;
  const deck = (() => {
    if (iso) {
      if (iso.no_reg) return `${iso.name} is the only state with no voter registration — every eligible resident may vote with ID. Counties below show 2024 ballots cast as the closest equivalent.`;
      const unit = iso.unit_label ?? "county";
      const base = `${iso.name} — ${fmt(iso.total)} registered across ${iso.county_count} ${unit}${iso.county_count === 1 ? "" : unit.endsWith("y") ? "" : "s"}, as of ${iso.as_of}.`;
      if (iso.registers_by_party && iso.party) {
        const p = iso.party, t = p.DEM + p.REP + p.UNA + p.OTH || 1;
        const lead = iso.plurality ? `${PWORD[iso.plurality]} registration leads at ${Math.round((p[iso.plurality] / t) * 100)}%.` : "";
        return `${base} ${lead}`;
      }
      return `${base} ${iso.name} does not record party at registration.`;
    }
    if (lens === "party")
      return "Thirty-one states record each voter's party. The map runs blue where registered Democrats lead, red where Republicans do, and indigo where the unaffiliated are the single largest bloc.";
    if (scope === "counties")
      return "Every county in the nation, shaded by the weight of its rolls — deep indigo for the largest. Click anywhere to isolate a state and read it county by county.";
    return `${fmt(nat?.total)} Americans are registered to vote across 50 states and D.C. Hover any state for its rolls; click to open it county by county.`;
  })();

  // ── scoreboard ──
  const partyTotal = (p: { DEM:number;REP:number;UNA:number;OTH:number }) => p.DEM + p.REP + p.UNA + p.OTH;
  const beamParty = (p: { DEM:number;REP:number;UNA:number;OTH:number }) => {
    const segs: { w: number; c: string; k: string; lab: string }[] = [
      { w: p.DEM, c: PCOL.DEM, k: "d", lab: "Democratic" },
      { w: p.UNA, c: PCOL.UNA, k: "u", lab: "Unaffiliated" },
      { w: p.OTH, c: "#5b6172", k: "o", lab: "Other parties" },
      { w: p.REP, c: PCOL.REP, k: "r", lab: "Republican" },
    ].filter(s => s.w > 0);
    return segs;
  };
  const topStatesBeam = useMemo(() => {
    const top = [...summary].filter(s => s.total).sort((a, b) => b.total! - a.total!);
    const shown = top.slice(0, 10); const rest = top.slice(10).reduce((s, x) => s + (x.total ?? 0), 0);
    const segs = shown.map((s, i) => ({ w: s.total!, c: rampReg(0.9 - i * 0.07), k: s.abbr, lab: s.name }));
    if (rest > 0) segs.push({ w: rest, c: "#262a39", k: "rest", lab: "all other states" });
    return segs;
  }, [summary]);

  // pop choreography on click
  const pop = useCallback((el: SVGPathElement | null, e: React.MouseEvent) => {
    if (!el) return;
    el.classList.remove("vr-pop"); void el.getBBox(); el.classList.add("vr-pop");
    el.addEventListener("animationend", () => el.classList.remove("vr-pop"), { once: true });
    const host = stageRef.current; if (!host) return;
    const r = host.getBoundingClientRect();
    const sp = document.createElement("span"); sp.className = "vr-ripple";
    sp.style.left = `${e.clientX - r.left}px`; sp.style.top = `${e.clientY - r.top}px`;
    host.appendChild(sp); sp.addEventListener("animationend", () => sp.remove(), { once: true });
  }, []);

  // ── rendered map layers (memoised so tooltip moves don't re-path) ──
  const statesLayer = useMemo(() => {
    if (!statesGeo) return null;
    return (
      <g>
        {statesGeo.shapes.map(g => {
          const s = summary.find(x => x.abbr === g.key)!;
          return (
            <path key={g.key} data-k={g.key} d={g.d} className="vr-shape" style={{ fill: fillState(s) }}
              onMouseMove={(e) => { setHoverKey(g.key); moveTip(e, tipForState(s, lens, rankOf[s.abbr])); }}
              onMouseLeave={() => { setHoverKey(null); hideTip(); }}
              onClick={(e) => { pop(e.currentTarget, e); isolate(g.key); }} />
          );
        })}
        <path d={statesGeo.border} className="vr-mesh" />
        {statesGeo.shapes.filter(g => g.cx != null).map(g => {
          const s = summary.find(x => x.abbr === g.key)!;
          const f = fillState(s);
          return <text key={"t" + g.key} x={g.cx} y={g.cy} className="vr-lab" style={{ fill: inkOn(f, lens) }}>{g.key}</text>;
        })}
      </g>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statesGeo, lens, summary, stateDomain, rankOf]);

  const countiesLayer = useMemo(() => {
    if (!countiesGeo) return null;
    return (
      <g>
        {countiesGeo.shapes.map(g => (
          <path key={g.key} data-k={g.key} d={g.d} className="vr-shape vr-county" style={{ fill: fillCounty(g.key) }}
            onMouseMove={(e) => { setHoverKey(g.key); moveTip(e, tipForCounty(g.key, g.name ?? "", countyVals, summary, lens)); }}
            onMouseLeave={() => { setHoverKey(null); hideTip(); }}
            onClick={(e) => { const ab = countiesTopoRef.current?.toAbbr[g.key]; pop(e.currentTarget, e); if (ab) isolate(ab); }} />
        ))}
        <path d={countiesGeo.border} className="vr-mesh vr-mesh-strong" />
      </g>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countiesGeo, lens, countyVals, countyDomain]);

  const isoLayer = useMemo(() => {
    if (!isoGeo) return null;
    return (
      <g>
        {isoGeo.shapes.map(g => {
          const u = detail?.counties.find(c => c.fips === g.key);
          return (
            <path key={g.key} data-k={g.key} d={g.d} className="vr-shape vr-county" style={{ fill: fillIso(g.key) }}
              onMouseMove={(e) => { setHoverKey(g.key); moveTip(e, tipForUnit(u, g.name ?? "", lens, detailRows)); }}
              onMouseLeave={() => { setHoverKey(null); hideTip(); }} />
          );
        })}
        <path d={isoGeo.border} className="vr-mesh vr-mesh-strong" />
      </g>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isoGeo, lens, detail, isoDomain, detailRows]);

  // legend scale ticks
  const dom = isoAbbr ? isoDomain : scope === "counties" ? countyDomain : stateDomain;

  return (
    <div className={`vr-page ${manrope.variable}`}>
      <style>{CSS}</style>
      <DarkNav />

      {/* ── Masthead ── */}
      <div className="vr-mast">
        <div className="vr-folio">
          <span>TPSI Interactive</span>
          <span>Voter Registration</span>
          <span>{nat ? `${compact(nat.total)} registered · 50 states + D.C.` : "loading…"}</span>
        </div>
        <h1 className="vr-title">voter registration</h1>
        <p className="vr-deck"><span key={deck} className="vr-live">{deck}</span></p>
      </div>

      {/* ── Scoreboard ── */}
      <div className="vr-board">
        <div className="vr-board-lead">
          <span className="vr-board-cap">{iso ? `${iso.name} · registered` : lens === "party" ? "Registered · party states" : "Registered nationwide"}</span>
          <span className="vr-board-num">
            <span key={(iso?.total ?? nat?.total) ?? 0} className="vr-num">
              {iso ? compact(iso.total) : lens === "party" && nat ? compact(partyTotal(nat.party)) : compact(nat?.total)}
            </span>
          </span>
          <span className="vr-board-sub">
            {iso
              ? `${iso.county_count} ${iso.unit_label ?? "county"}${iso.county_count === 1 ? "" : "s"} · as of ${iso.as_of ?? "—"}`
              : lens === "party" ? "31 states record party affiliation" : "latest official rolls · 2024–2026"}
          </span>
        </div>

        <div className="vr-board-mid">
          {(() => {
            // party beam when a party context applies, else the magnitude beam
            const showParty = iso ? (iso.registers_by_party && iso.party) : lens === "party";
            const segs = iso
              ? (iso.party ? beamParty(iso.party) : [])
              : lens === "party" && nat ? beamParty(nat.party) : topStatesBeam;
            const total = segs.reduce((s, x) => s + x.w, 0) || 1;
            return (
              <>
                <div className="vr-beam">
                  {segs.map(s => (
                    <i key={s.k} style={{ width: `${(s.w / total) * 100}%`, background: s.c }} title={`${s.lab} · ${fmt(s.w)}`} />
                  ))}
                </div>
                <div className="vr-board-meta">
                  {showParty ? (
                    <>
                      <span className="vr-leg"><i style={{ background: PCOL.DEM }} />Dem</span>
                      <span className="vr-leg"><i style={{ background: PCOL.UNA }} />Unaffiliated</span>
                      <span className="vr-leg"><i style={{ background: "#5b6172" }} />Other</span>
                      <span className="vr-leg"><i style={{ background: PCOL.REP }} />Rep</span>
                    </>
                  ) : (
                    <>
                      <span className="vr-board-hint">{iso ? "registration density across its counties" : "share of the national rolls, ten largest states"}</span>
                      {!iso && <span className="vr-board-hint vr-board-hint-r">CA {compact(stateRows[0]?.total)} · TX {compact(summary.find(s=>s.abbr==="TX")?.total)}</span>}
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        <div className="vr-board-side">
          <span className="vr-board-cap">{iso ? "data quality" : "register by party"}</span>
          <span className="vr-board-num2">{iso ? (iso.quality?.split(/[ ;—-]/)[0] ?? "—") : "31"}</span>
          <span className="vr-board-sub">{iso ? (iso.county_breakdown_as_of ? `county rolls ${iso.county_breakdown_as_of}` : "official source") : "of 51 jurisdictions"}</span>
        </div>
      </div>

      {/* ── Controls: lens + isolate + search ── */}
      <div className="vr-controls">
        <div className="vr-lens" role="radiogroup" aria-label="Map lens">
          <button className={`vr-lens-btn${lens === "reg" ? " is-on" : ""}`} role="radio" aria-checked={lens === "reg"} onClick={() => setLens("reg")}>
            <span className="vr-lens-ramp">{[0.3, 0.5, 0.7, 0.9].map(t => <i key={t} style={{ background: rampReg(t) }} />)}</span>
            <span className="vr-lens-lab">Registered voters</span>
          </button>
          <button className={`vr-lens-btn${lens === "party" ? " is-on" : ""}`} role="radio" aria-checked={lens === "party"} onClick={() => setLens("party")}>
            <span className="vr-lens-ramp"><i style={{ background: PCOL.DEM }} /><i style={{ background: PCOL.UNA }} /><i style={{ background: PCOL.REP }} /></span>
            <span className="vr-lens-lab">Party registration</span>
          </button>
        </div>

        <div className="vr-tools">
          {isoAbbr ? (
            <button className="vr-back" onClick={exitIsolate}>← all states</button>
          ) : (
            <div className="vr-search">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Jump to a state…" aria-label="Search states"
                onKeyDown={(e) => { if (e.key === "Enter" && suggest[0]) { isolate(suggest[0].abbr); setQuery(""); } }} />
              {suggest.length > 0 && (
                <div className="vr-sugg">
                  {suggest.map(s => (
                    <button key={s.abbr} onClick={() => { isolate(s.abbr); setQuery(""); }}>
                      <span>{s.name}</span><em>{compact(s.total)}</em>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Stage ── */}
      <div className="vr-stage" ref={stageRef}>
        <div className="vr-stage-glow" aria-hidden />
        {isoAbbr && (
          <button className="vr-stage-back" onClick={exitIsolate} aria-label="Back to all states">
            <span aria-hidden>←</span> {iso?.name}
          </button>
        )}
        {loadingCounties && !isoAbbr && scope === "counties" && !countiesGeo && (
          <div className="vr-loading">drawing 3,000 counties…</div>
        )}
        <svg viewBox="0 0 960 600" className="vr-svg" preserveAspectRatio="xMidYMid meet">
          {isoAbbr ? isoLayer : scope === "counties" ? countiesLayer : statesLayer}
        </svg>
      </div>

      {/* ── Legend ── */}
      <div className="vr-legend">
        <span className="vr-cap">{lens === "party" ? "Plurality of registered voters" : isoAbbr ? "Registered voters · per county" : scope === "counties" ? "Registered voters · per county" : "Registered voters · per state"}</span>
        {lens === "party" ? (
          <div className="vr-leg-row">
            <span className="vr-leg"><i style={{ background: PCOL.DEM }} />Democratic</span>
            <span className="vr-leg"><i style={{ background: PCOL.REP }} />Republican</span>
            <span className="vr-leg"><i style={{ background: PCOL.UNA }} />Unaffiliated</span>
            <span className="vr-leg"><i style={{ background: DIM_NOPARTY }} />No party registration</span>
            <span className="vr-leg"><i style={{ background: DIM_NOREG }} />No registration (ND)</span>
          </div>
        ) : (
          <div className="vr-scale">
            <span className="vr-scale-tick">{compact(dom[0])}</span>
            <span className="vr-scale-bar" style={{ background: `linear-gradient(90deg, ${[0,.25,.5,.75,1].map(t=>rampReg(t)).join(",")})` }} />
            <span className="vr-scale-tick">{compact(dom[1])}</span>
            <span className="vr-leg vr-leg-note">{isoAbbr || scope === "counties" ? "log scale · per county" : "log scale · per state"}</span>
          </div>
        )}
      </div>

      {/* ── Leaderboard ── */}
      <div className="vr-rank">
        <div className="vr-rank-head">
          <span className="vr-cap">{isoAbbr ? `${iso?.name} · ${iso?.unit_label ?? "county"}s by registration` : scope === "counties" ? "Largest counties in the nation" : "States by registered voters"}</span>
          <span className="vr-rank-count">{isoAbbr ? detailRows.length : scope === "counties" ? `top ${countyRows.length}` : `${stateRows.length} jurisdictions`}</span>
        </div>
        <div className="vr-rank-list">
          {(isoAbbr ? detailRows.slice(0, 60) : scope === "counties" ? countyRows : stateRows).map((row, i) => {
            const isCounty = isoAbbr || scope === "counties";
            const key = isoAbbr ? (row as DetailUnit).fips ?? (row as DetailUnit).name : isCounty ? (row as CountyVal & { fips: string }).fips : (row as StateSummary).abbr;
            const name = isCounty ? (row as { name: string }).name : (row as StateSummary).name;
            const val = isoAbbr ? (row as DetailUnit).total : isCounty ? (row as CountyVal).r : (row as StateSummary).total;
            const plur: Plur = isoAbbr ? (row as DetailUnit).plurality : isCounty ? (row as CountyVal).p : (row as StateSummary).plurality;
            const max = isoAbbr ? isoDomain[1] : isCounty ? countyDomain[1] : stateDomain[1];
            const barC = lens === "party" && plur ? PCOL[plur] : rampReg(0.55 + 0.4 * ((val ?? 0) / (max || 1)));
            const sub = isoAbbr ? "" : isCounty ? (row as CountyVal).s : `${(row as StateSummary).county_count} ${(row as StateSummary).unit_label ?? "county"}s`;
            const active = hoverKey === key;
            return (
              <button key={String(key) + i} className={`vr-rank-row${active ? " is-hot" : ""}`}
                onMouseEnter={() => { setHoverKey(String(key)); if (isCounty) document.querySelector(`[data-k="${key}"]`)?.classList.add("vr-hot"); }}
                onMouseLeave={() => { setHoverKey(null); if (isCounty) document.querySelector(`[data-k="${key}"]`)?.classList.remove("vr-hot"); }}
                onClick={() => { if (!isoAbbr) isolate(isCounty ? (row as CountyVal).s : (row as StateSummary).abbr); }}>
                <span className="vr-rank-n">{i + 1}</span>
                <span className="vr-rank-name">{name}{sub && <em>{sub}</em>}</span>
                <span className="vr-rank-bar"><i style={{ width: `${Math.max(2, ((val ?? 0) / (max || 1)) * 100)}%`, background: barC }} /></span>
                <span className="vr-rank-val">{val == null ? "—" : fmt(val)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Footnote ── */}
      <p className="vr-foot">
        Latest official voter-registration rolls compiled from each state&apos;s election authority. Reporting dates differ by state —
        most are 2026; a few states publish county detail only at the general election (shown as their 2024 figures). North Dakota has no
        voter registration. {iso?.source_url && <a href={iso.source_url} target="_blank" rel="noreferrer">{iso.name} source ↗</a>}
      </p>

      {/* ── Dock (portaled) ── */}
      {mounted && createPortal(
        <div className="vr-dock" role="tablist" aria-label="Map scope" style={{ fontFamily: manrope.style.fontFamily }}>
          {([["states", "states"], ["counties", "counties"]] as [Scope, string][]).map(([sc, label]) => (
            <button key={sc} role="tab" aria-selected={scope === sc}
              className={`vr-dock-btn${scope === sc ? " is-on" : ""}`}
              onClick={() => { setScope(sc); if (sc === "states") exitIsolate(); setTip(null); }}>
              {label}
            </button>
          ))}
        </div>, document.body)}

      {/* ── Tooltip (portaled, edge-flipping) ── */}
      {tip?.visible && mounted && createPortal((() => {
        const W = 234, H = 116;
        const left = (tip.x + 18 + W > window.innerWidth) ? tip.x - W - 18 : tip.x + 18;
        const top = (tip.y + 18 + H > window.innerHeight) ? tip.y - H - 18 : tip.y + 18;
        const spine = tip.noReg ? DIM_NOREG : tip.plur ? PCOL[tip.plur] : "#7c3aed";
        const t = tip.party ? (tip.party.DEM + tip.party.REP + tip.party.UNA + tip.party.OTH) || 1 : 1;
        return (
          <div className={`vr-tip ${manrope.className}`} style={{ left, top, borderLeftColor: spine }}>
            <div className="vr-tip-top">
              <span className="vr-tip-name">{tip.title}</span>
              <span className="vr-tip-val">{tip.noReg ? "—" : compact(tip.value)}</span>
            </div>
            <div className="vr-tip-sub">{tip.sub}</div>
            {tip.party && !tip.noReg && (
              <div className="vr-tip-bar">
                <i style={{ width: `${(tip.party.DEM / t) * 100}%`, background: PCOL.DEM }} />
                <i style={{ width: `${(tip.party.UNA / t) * 100}%`, background: PCOL.UNA }} />
                <i style={{ width: `${(tip.party.OTH / t) * 100}%`, background: "#5b6172" }} />
                <i style={{ width: `${(tip.party.REP / t) * 100}%`, background: PCOL.REP }} />
              </div>
            )}
            <div className="vr-tip-foot">
              {tip.plur && !tip.noReg && <span className="vr-tip-pick"><b style={{ background: PCOL[tip.plur] }} />{PWORD[tip.plur]} plurality</span>}
              {tip.rank && <span className="vr-tip-rank">{tip.rank}</span>}
              <span className="vr-tip-hint">{tip.hint}</span>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
}

// ─── tooltip data builders ──────────────────────────────────────────────────
function tipForState(s: StateSummary, lens: Lens, rank: number): Omit<Tip, "visible" | "x" | "y"> {
  if (s.no_reg) return { title: s.name, sub: "No voter registration in this state", value: null, plur: null, party: null, hint: "click to open counties", noReg: true };
  return {
    title: s.name, value: s.total,
    sub: `as of ${s.as_of ?? "—"}${s.unit_label && s.unit_label !== "county" ? ` · by ${s.unit_label}` : ""}`,
    plur: lens === "party" ? s.plurality : null,
    party: s.registers_by_party ? s.party : null,
    rank: lens === "reg" ? `#${rank} of 51` : (s.registers_by_party ? "" : "does not record party"),
    hint: "click to open counties",
  };
}
function tipForCounty(fips: string, geoName: string, vals: Record<string, CountyVal> | null, summary: StateSummary[], lens: Lens): Omit<Tip, "visible" | "x" | "y"> {
  const v = vals?.[fips];
  const st = summary.find(s => s.fips === fips.slice(0, 2));
  if (!v) return { title: geoName || "County", sub: st ? `${st.name} · not separately reported` : "", value: null, plur: null, party: null, hint: st ? "click to isolate " + st.abbr : "" };
  return {
    title: `${v.n}`, sub: st?.name ?? v.s, value: v.r,
    plur: lens === "party" ? v.p : null, party: null,
    hint: "click to isolate " + v.s,
  };
}
function tipForUnit(u: DetailUnit | undefined, geoName: string, lens: Lens, rows: DetailUnit[]): Omit<Tip, "visible" | "x" | "y"> {
  if (!u) return { title: geoName || "County", sub: "not separately reported", value: null, plur: null, party: null, hint: "" };
  const rank = rows.findIndex(r => r.fips === u.fips);
  return {
    title: u.name, sub: u.total != null ? "registered voters" : "—", value: u.total,
    plur: lens === "party" ? u.plurality : null, party: u.party,
    rank: rank >= 0 ? `#${rank + 1} in state` : "",
    hint: "",
  };
}
function inkOn(fill: string, lens: Lens): string {
  if (lens === "party") return "rgba(255,255,255,0.92)";
  const m = fill.match(/\d+/g); if (!m) return "rgba(244,244,239,0.8)";
  const [r, g, b] = m.map(Number);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "rgba(8,8,14,0.9)" : "rgba(244,244,239,0.86)";
}

// ─── styles ──────────────────────────────────────────────────────────────────
const CSS = `
html, body { background: #050505 !important; }
body header, body footer { display: none !important; }

.vr-page {
  --disp: var(--font-mp), "Manrope", "Helvetica Neue", Arial, sans-serif;
  --lab: var(--font-mp), "Manrope", "Helvetica Neue", Arial, sans-serif;
  --serif: var(--font-mp), "Manrope", "Helvetica Neue", Arial, sans-serif;
  --data: var(--font-mp), "Manrope", "Helvetica Neue", Arial, sans-serif;
  --background:#050505; --foreground:#f4f4ef; --foreground2:rgba(244,244,239,0.74);
  --muted:rgba(244,244,239,0.58); --muted2:rgba(244,244,239,0.40); --muted3:rgba(244,244,239,0.26);
  --border:rgba(255,255,255,0.10); --border2:rgba(255,255,255,0.16); --border3:rgba(255,255,255,0.24);
  --panel:rgba(255,255,255,0.03); --panel2:rgba(255,255,255,0.05);
  position: relative; z-index: 1; max-width: 1120px; margin: 0 auto; padding: 0 18px 120px;
  color: var(--foreground); font-family: var(--lab); font-size: 14px; letter-spacing: -0.01em;
}
.vr-page::before { content:''; position:absolute; inset:0; pointer-events:none; z-index:0;
  background: radial-gradient(46% 30% at 12% 4%, rgba(118,110,210,0.06), transparent 70%),
              radial-gradient(40% 26% at 92% 14%, rgba(244,125,140,0.035), transparent 72%); }
.vr-page > * { position: relative; z-index: 1; }

/* masthead */
.vr-folio { display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; padding:14px 0; border-top:1px solid var(--border2); border-bottom:1px solid var(--border); font-size:10.5px; font-weight:600; letter-spacing:0.18em; text-transform:uppercase; color:var(--muted2); }
.vr-folio span:first-child { color:var(--foreground); }
.vr-title { font-family:var(--disp); font-weight:500; text-transform:lowercase; letter-spacing:-0.035em; line-height:0.9; font-size:clamp(44px,8.5vw,96px); margin:18px 0 0; color:var(--foreground); }
.vr-deck { font-family:var(--serif); font-size:clamp(15px,1.5vw,18px); line-height:1.55; color:var(--foreground2); max-width:64ch; margin:16px 0 0; min-height:3em; }
.vr-live { display:inline; animation:vr-fade 420ms ease both; }
@keyframes vr-fade { from { opacity:0.25 } to { opacity:1 } }

/* entry choreography */
@keyframes vr-rise { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }
.vr-mast>* { animation:vr-rise .6s cubic-bezier(.16,1,.3,1) both }
.vr-mast>*:nth-child(2){animation-delay:.07s}.vr-mast>*:nth-child(3){animation-delay:.14s}
.vr-board{animation:vr-rise .6s cubic-bezier(.16,1,.3,1) .2s both}
.vr-controls{animation:vr-rise .6s cubic-bezier(.16,1,.3,1) .28s both}
.vr-stage{animation:vr-rise .7s cubic-bezier(.16,1,.3,1) .36s both}
.vr-legend{animation:vr-rise .6s cubic-bezier(.16,1,.3,1) .46s both}
.vr-rank{animation:vr-rise .6s cubic-bezier(.16,1,.3,1) .54s both}

/* scoreboard */
.vr-board { position:sticky; top:0; z-index:40; display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:clamp(18px,4vw,52px); margin-top:24px; padding:18px 2px; background:rgba(5,5,5,0.86); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); border-top:1px solid var(--border); border-bottom:1px solid var(--foreground); }
.vr-board-cap { font-size:9.5px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:var(--muted2); }
.vr-board-lead { display:flex; flex-direction:column; gap:5px; }
.vr-board-num { font-family:var(--disp); font-weight:700; font-size:clamp(34px,5.6vw,60px); line-height:0.82; letter-spacing:-0.04em; font-variant-numeric:tabular-nums; color:var(--foreground); }
.vr-num { display:inline-block; animation:vr-num .34s cubic-bezier(.2,.9,.3,1.25) both; }
@keyframes vr-num { from { opacity:0; transform:translateY(9px) } to { opacity:1; transform:none } }
.vr-board-sub { font-size:10.5px; letter-spacing:0.03em; color:var(--muted2); text-transform:uppercase; }
.vr-board-mid { min-width:0; }
.vr-beam { display:flex; gap:2px; height:18px; }
.vr-beam>i { display:block; height:100%; min-width:1px; border-radius:2px; transform-origin:left center; animation:vr-grow .9s cubic-bezier(.2,.8,.2,1) .3s both; transition:opacity .2s ease; }
.vr-beam>i:first-child{border-radius:9px 2px 2px 9px}.vr-beam>i:last-child{border-radius:2px 9px 9px 2px}
.vr-beam>i:hover{opacity:.82}
@keyframes vr-grow { from { transform:scaleX(0) } to { transform:scaleX(1) } }
.vr-board-meta { display:flex; align-items:center; gap:14px; margin-top:11px; flex-wrap:wrap; }
.vr-board-hint { font-size:10px; letter-spacing:0.04em; text-transform:uppercase; color:var(--muted2); }
.vr-board-hint-r { margin-left:auto; color:var(--muted3); }
.vr-board-side { display:flex; flex-direction:column; gap:5px; align-items:flex-end; text-align:right; }
.vr-board-num2 { font-family:var(--disp); font-weight:700; font-size:clamp(26px,3.4vw,40px); line-height:0.85; letter-spacing:-0.03em; color:var(--foreground); text-transform:capitalize; }

/* controls */
.vr-controls { display:flex; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; gap:18px 28px; margin-top:28px; }
.vr-lens { display:flex; gap:24px; }
.vr-lens-btn { position:relative; display:flex; flex-direction:column; gap:9px; background:none; border:0; padding:0 0 9px; cursor:pointer; }
.vr-lens-ramp { display:flex; gap:3px; }
.vr-lens-ramp i { display:block; width:26px; height:13px; border-radius:3px; opacity:0.5; transition:opacity .2s ease, transform .24s cubic-bezier(.2,.9,.25,1.25); transform-origin:bottom; }
.vr-lens-btn:hover .vr-lens-ramp i { opacity:0.82; }
.vr-lens-btn.is-on .vr-lens-ramp i { opacity:1; transform:scaleY(1.45); }
.vr-lens-lab { font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--muted2); text-align:left; transition:color .18s ease; }
.vr-lens-btn:hover .vr-lens-lab, .vr-lens-btn.is-on .vr-lens-lab { color:var(--foreground); }
.vr-lens-btn.is-on::after { content:''; position:absolute; left:0; bottom:0; width:18px; height:1.5px; background:var(--foreground); }

.vr-tools { display:flex; align-items:center; gap:14px; padding-bottom:4px; }
.vr-back { font-size:12px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:#050505; background:#b7ff00; border:0; border-radius:999px; padding:9px 18px; cursor:pointer; transition:transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s ease; }
.vr-back:hover { transform:translateY(-1.5px); box-shadow:0 12px 30px rgba(183,255,0,0.22); }
.vr-search { position:relative; }
.vr-search input { width:230px; max-width:46vw; background:var(--panel2); border:1px solid var(--border2); border-radius:999px; padding:9px 16px; color:var(--foreground); font-size:13px; letter-spacing:-0.01em; outline:none; transition:border-color .18s ease, background .18s ease; }
.vr-search input::placeholder { color:var(--muted2); }
.vr-search input:focus { border-color:var(--border3); background:rgba(255,255,255,0.07); }
.vr-sugg { position:absolute; top:calc(100% + 6px); right:0; left:0; z-index:60; background:rgba(14,14,18,0.98); border:1px solid var(--border2); border-radius:14px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.6); -webkit-backdrop-filter:blur(16px); backdrop-filter:blur(16px); }
.vr-sugg button { display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; padding:9px 14px; background:none; border:0; border-bottom:1px solid var(--border); color:var(--foreground2); font-size:13px; cursor:pointer; text-align:left; transition:background .14s ease, color .14s ease; }
.vr-sugg button:last-child { border-bottom:0; }
.vr-sugg button:hover { background:rgba(124,58,237,0.18); color:var(--foreground); }
.vr-sugg em { font-style:normal; font-size:11px; font-variant-numeric:tabular-nums; color:var(--muted2); }

/* stage */
.vr-stage { position:relative; width:100%; margin-top:22px; min-height:200px; }
.vr-stage-glow { position:absolute; inset:-8% -5% -12%; pointer-events:none; z-index:0; filter:blur(28px);
  background: radial-gradient(56% 52% at 50% 46%, rgba(118,110,210,0.12), transparent 72%),
             radial-gradient(34% 30% at 74% 26%, rgba(244,125,140,0.05), transparent 70%),
             radial-gradient(38% 36% at 24% 64%, rgba(86,110,230,0.08), transparent 72%); }
.vr-svg { position:relative; z-index:1; width:100%; display:block; overflow:visible; }
.vr-shape { stroke:#050505; stroke-width:0.6; cursor:pointer; transition:filter .16s ease; }
.vr-shape:hover, .vr-shape.vr-hot { filter:brightness(1.25) saturate(1.15); stroke:var(--foreground); stroke-width:1.4; }
.vr-county { stroke-width:0.3; }
.vr-county:hover, .vr-county.vr-hot { stroke-width:0.9; }
.vr-mesh { fill:none; stroke:#050505; stroke-width:0.7; pointer-events:none; }
.vr-mesh-strong { stroke:rgba(255,255,255,0.22); stroke-width:0.7; }
.vr-lab { font-family:var(--data); font-size:11px; font-weight:800; letter-spacing:0.01em; text-anchor:middle; dominant-baseline:central; pointer-events:none; }
.vr-stage-back { position:absolute; top:6px; left:6px; z-index:5; display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; letter-spacing:0.05em; text-transform:uppercase; color:var(--foreground); background:rgba(14,14,18,0.8); border:1px solid var(--border2); border-radius:999px; padding:7px 13px; cursor:pointer; -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); transition:border-color .16s ease; }
.vr-stage-back:hover { border-color:var(--border3); }
.vr-loading { position:absolute; inset:0; display:grid; place-items:center; font-size:12px; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted2); }

/* click choreography */
.vr-ripple { position:absolute; width:16px; height:16px; margin:-8px 0 0 -8px; z-index:6; border-radius:999px; border:1.5px solid rgba(244,244,239,0.6); pointer-events:none; animation:vr-ripple 560ms cubic-bezier(.2,.8,.4,1) both; }
@keyframes vr-ripple { from { opacity:.9; transform:scale(.4) } to { opacity:0; transform:scale(5) } }
.vr-svg path.vr-pop { animation:vr-pop 420ms ease both; }
@keyframes vr-pop { 0% { filter:brightness(1.8) saturate(1.4) } 100% { filter:none } }

/* legend */
.vr-cap { font-size:9.5px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:var(--muted2); }
.vr-legend { display:flex; align-items:center; gap:18px; flex-wrap:wrap; margin-top:20px; padding-top:16px; border-top:1px solid var(--border); }
.vr-leg-row { display:flex; flex-wrap:wrap; gap:6px 16px; }
.vr-leg { display:inline-flex; align-items:center; gap:7px; font-size:10px; letter-spacing:0.04em; text-transform:uppercase; color:var(--muted); }
.vr-leg i { width:12px; height:12px; border-radius:3px; flex-shrink:0; }
.vr-leg-note { color:var(--muted3); letter-spacing:0.08em; }
.vr-scale { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.vr-scale-bar { width:min(260px,40vw); height:10px; border-radius:999px; display:inline-block; }
.vr-scale-tick { font-size:11px; font-variant-numeric:tabular-nums; color:var(--muted); letter-spacing:0.02em; }

/* leaderboard */
.vr-rank { margin-top:30px; }
.vr-rank-head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding-bottom:12px; border-bottom:1px solid var(--border); }
.vr-rank-count { font-size:10px; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted3); }
.vr-rank-list { margin-top:6px; display:grid; grid-template-columns:1fr 1fr; gap:0 36px; }
@media (max-width:680px){ .vr-rank-list { grid-template-columns:1fr; } }
.vr-rank-row { display:grid; grid-template-columns:24px minmax(0,1.5fr) 1fr auto; align-items:center; gap:12px; width:100%; padding:9px 6px; background:none; border:0; border-bottom:1px solid var(--border); cursor:pointer; text-align:left; transition:background .14s ease; }
.vr-rank-row:hover, .vr-rank-row.is-hot { background:rgba(124,58,237,0.10); }
.vr-rank-n { font-size:11px; font-variant-numeric:tabular-nums; color:var(--muted3); text-align:right; }
.vr-rank-name { font-size:13px; color:var(--foreground2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vr-rank-name em { font-style:normal; font-size:10px; letter-spacing:0.04em; text-transform:uppercase; color:var(--muted3); margin-left:8px; }
.vr-rank-bar { height:7px; border-radius:999px; background:rgba(255,255,255,0.05); overflow:hidden; }
.vr-rank-bar i { display:block; height:100%; border-radius:999px; transition:width .5s cubic-bezier(.2,.8,.2,1); }
.vr-rank-val { font-size:12px; font-variant-numeric:tabular-nums; color:var(--foreground); text-align:right; min-width:62px; }

/* footnote */
.vr-foot { margin-top:34px; padding-top:16px; border-top:1px solid var(--border); font-family:var(--serif); font-size:12px; line-height:1.6; color:var(--muted2); max-width:78ch; }
.vr-foot a { color:var(--foreground2); border-bottom:1px solid var(--border3); }

/* dock */
.vr-dock { position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:240; display:inline-flex; gap:3px; padding:5px; border-radius:999px; border:1px solid rgba(255,255,255,0.13); background:rgba(9,9,12,0.66); -webkit-backdrop-filter:blur(18px) saturate(150%); backdrop-filter:blur(18px) saturate(150%); box-shadow:0 18px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07); animation:vr-dock-in .7s cubic-bezier(.16,1,.3,1) .5s both; }
@keyframes vr-dock-in { from { opacity:0; transform:translate(-50%,18px) } to { opacity:1; transform:translate(-50%,0) } }
.vr-dock-btn { padding:9px 20px; border:0; border-radius:999px; background:transparent; font-size:12px; font-weight:650; letter-spacing:0.02em; text-transform:lowercase; color:rgba(244,244,239,0.6); cursor:pointer; transition:color .18s ease, background .22s cubic-bezier(.2,.8,.2,1); }
.vr-dock-btn:hover { color:#f4f4ef; }
.vr-dock-btn.is-on { background:#f4f4ef; color:#050505; }

/* tooltip */
.vr-tip { position:fixed; z-index:99999; pointer-events:none; width:224px; background:rgba(14,14,16,0.97); border:1px solid rgba(255,255,255,0.12); border-left:3px solid #7c3aed; border-radius:13px; box-shadow:0 24px 60px rgba(0,0,0,0.62); overflow:hidden; -webkit-backdrop-filter:blur(18px); backdrop-filter:blur(18px); animation:vr-tip-in .16s cubic-bezier(.2,.9,.3,1.2) both; transform-origin:top left; }
@keyframes vr-tip-in { from { opacity:0; transform:scale(.94) translateY(5px) } to { opacity:1; transform:none } }
.vr-tip-top { display:flex; align-items:baseline; justify-content:space-between; gap:10px; padding:11px 14px 4px; }
.vr-tip-name { font-weight:700; font-size:14.5px; letter-spacing:-0.02em; line-height:1.1; color:#f4f4ef; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vr-tip-val { font-size:17px; font-weight:800; letter-spacing:-0.02em; color:#f4f4ef; white-space:nowrap; }
.vr-tip-sub { padding:0 14px 9px; font-size:9.5px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:rgba(244,244,239,0.42); }
.vr-tip-bar { display:flex; gap:1.5px; height:6px; margin:0 14px 9px; }
.vr-tip-bar i { display:block; height:100%; }
.vr-tip-bar i:first-child{border-radius:3px 0 0 3px}.vr-tip-bar i:last-child{border-radius:0 3px 3px 0}
.vr-tip-foot { display:flex; align-items:center; gap:9px; flex-wrap:wrap; padding:9px 14px 11px; border-top:1px solid rgba(255,255,255,0.08); }
.vr-tip-pick { display:inline-flex; align-items:center; gap:6px; font-size:10.5px; font-weight:700; color:#f4f4ef; }
.vr-tip-pick b { width:8px; height:8px; border-radius:50%; }
.vr-tip-rank { font-size:9.5px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(244,244,239,0.5); }
.vr-tip-hint { margin-left:auto; font-size:9px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; color:rgba(244,244,239,0.4); }

@media (prefers-reduced-motion: reduce) {
  .vr-mast>*,.vr-board,.vr-controls,.vr-stage,.vr-legend,.vr-rank,.vr-beam>i,.vr-num,.vr-live,.vr-dock,.vr-rank-bar i { animation:none !important; }
  .vr-ripple { display:none; }
}
@media (max-width:720px) {
  .vr-board { grid-template-columns:1fr auto; gap:14px 18px; }
  .vr-board-mid { grid-column:1 / -1; order:3; }
  .vr-title { font-size:clamp(40px,12vw,64px); }
}
`;
