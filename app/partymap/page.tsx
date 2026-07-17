"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

/**
 * Party Registration — interactive choropleth of the U.S. voter rolls.
 * Each state / county is colored by the single largest registered party bloc,
 * shaded by margin (states & focused view) or by registration size (national
 * county view). Click a state to focus on its counties. Built in the site's
 * light-card design language (tri-stripe header, --panel/--border tokens).
 *
 * Data: /public/voterreg/{summary.json, county_values.json, counties/<ABBR>.json}
 */

// ─── Types ────────────────────────────────────────────────────────────────────
type Scope = "states" | "counties";
type Plur = "DEM" | "REP" | "UNA" | null;
interface Party { DEM: number; REP: number; UNA: number; OTH: number }
interface StateSummary {
  abbr: string; name: string; fips: string;
  total: number | null; as_of: string | null;
  registers_by_party: boolean; quality: string | null; unit_label: string | null;
  county_count: number;
  party: Party | null; plurality: Plur; no_reg: boolean; source_url: string | null;
}
interface CountyVal { r: number; p: Plur; n: string; s: string }
interface DetailUnit { name: string; fips: string; total: number | null; party: Party | null; plurality: Plur }
interface StateDetail {
  abbr: string; name: string; as_of: string | null; unit_label: string | null;
  registers_by_party: boolean; total: number | null; party: Party | null; plurality: Plur;
  county_breakdown_as_of?: string | null; source_url: string | null; counties: DetailUnit[];
}
interface Geo { key: string; d: string; cx?: number; cy?: number; small?: boolean; name?: string }
interface TipData {
  title: string; sub: string; value: number | null;
  party: Party | null; plur: Plur; foot: string; noReg?: boolean;
}
interface Tip extends TipData { visible: boolean; x: number; y: number }

// ─── Constants ────────────────────────────────────────────────────────────────
const FIPS: Record<string, string> = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
  "10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL",
  "18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD",
  "25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE",
  "32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND",
  "39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD",
  "47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
  "55":"WI","56":"WY",
};

const PCOL: Record<"DEM" | "REP" | "UNA", string> = { DEM: "#1a5fd4", REP: "#d42020", UNA: "#6d3ee9" };
const PWORD: Record<"DEM" | "REP" | "UNA", string> = { DEM: "Democratic", REP: "Republican", UNA: "Unaffiliated" };
// per-party [light, deep] ramps — the light end is still a clearly-readable
// party hue so even a razor-thin plurality reads as its color, not grey.
const RAMP: Record<"DEM" | "REP" | "UNA", [number[], number[]]> = {
  DEM: [[99, 152, 238], [10, 48, 146]],
  REP: [[233, 112, 112], [150, 20, 20]],
  UNA: [[160, 120, 232], [72, 28, 150]],
};
const GREY: [number[], number[]] = [[205, 209, 220], [120, 126, 144]];

const STATES_URL   = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const COUNTIES_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

// ─── Math / color helpers ───────────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const PAD2 = (f: string | number) => String(f).padStart(2, "0");
const PAD5 = (f: string | number) => String(f).padStart(5, "0");
function lerp(a: number[], b: number[], t: number): string {
  t = clamp(t, 0, 1);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
function partyMargin(p: Party): number {
  const T = p.DEM + p.REP + p.UNA + p.OTH || 1;
  const arr = [p.DEM, p.REP, p.UNA, p.OTH].sort((a, b) => b - a);
  return (arr[0] - arr[1]) / T;
}
const intensity = (m: number) => clamp(0.42 + (m / 0.4) * 0.58, 0.42, 1);
function ink(fill: string): string {
  const m = fill.match(/\d+/g);
  if (!m || m.length < 3) return "var(--foreground2)";
  const [r, g, b] = m.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "rgba(10,11,20,0.92)" : "rgba(255,255,255,0.95)";
}
function fmt(n: number | null | undefined): string { return n == null ? "—" : n.toLocaleString("en-US"); }
function compact(n: number | null | undefined): string {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return Math.round(n / 1e3) + "K";
  return String(n);
}
const share = (p: Party, k: keyof Party) => Math.round((p[k] / (p.DEM + p.REP + p.UNA + p.OTH || 1)) * 100);
// label that never reads a misleading "0%": a non-zero sliver shows "<1%"
function shareLabel(p: Party, k: keyof Party): string {
  const r = (p[k] / (p.DEM + p.REP + p.UNA + p.OTH || 1)) * 100;
  return r > 0 && r < 0.5 ? "<1%" : Math.round(r) + "%";
}
// the categories a place actually uses (drops empty buckets like UNA in LA/OK/KY)
function partyCats(p: Party) {
  return ([
    { lab: "Dem", k: "DEM" as keyof Party, c: PCOL.DEM },
    { lab: "Rep", k: "REP" as keyof Party, c: PCOL.REP },
    { lab: "Una", k: "UNA" as keyof Party, c: PCOL.UNA },
    { lab: "Oth", k: "OTH" as keyof Party, c: "#9aa0b4" },
  ]).filter(s => p[s.k] > 0);
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ d }: { d: Tip }) {
  if (!d.visible) return null;
  const spine = d.noReg ? "#6b7088" : d.plur ? PCOL[d.plur] : "#9aa0b4";
  const hasBars = !!d.party && !d.noReg;
  const W = 250, H = hasBars ? 190 : 104, M = 12, GAP = 16;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  // sit beside the cursor; flip to whichever side has room; clamp fully on-screen
  let left = d.x + GAP;
  if (left + W + M > vw) left = d.x - W - GAP;
  left = Math.max(M, Math.min(left, vw - W - M));
  let top = d.y - H - GAP;          // prefer just above the cursor
  if (top < M) top = d.y + GAP;     // otherwise just below
  top = Math.max(M, Math.min(top, vh - H - M));
  return (
    <div style={{
      position: "fixed", left, top, width: W,
      background: "var(--panel)", border: `1px solid ${spine}55`, borderLeft: `3px solid ${spine}`,
      borderRadius: "var(--r-md)", boxShadow: `0 0 0 1px ${spine}22, 0 14px 44px rgba(15,16,32,0.28)`,
      padding: "13px 15px", zIndex: 99999, pointerEvents: "none",
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-display),sans-serif", fontSize: 19, letterSpacing: "-0.01em", textTransform: "uppercase", color: "var(--foreground)", lineHeight: 1 }}>{d.title}</span>
        <span style={{ fontFamily: "var(--font-display),sans-serif", fontSize: 18, color: "var(--foreground)" }}>{d.noReg ? "—" : compact(d.value)}</span>
      </div>
      <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted2)", marginTop: 4 }}>{d.sub}</div>
      {d.party && !d.noReg && (
        <>
          <div style={{ display: "flex", gap: 1.5, height: 7, margin: "11px 0 8px", borderRadius: 999, overflow: "hidden" }}>
            <i style={{ width: `${share(d.party,"DEM")}%`, background: PCOL.DEM }} />
            <i style={{ width: `${share(d.party,"UNA")}%`, background: PCOL.UNA }} />
            <i style={{ width: `${share(d.party,"OTH")}%`, background: "#9aa0b4" }} />
            <i style={{ width: `${share(d.party,"REP")}%`, background: PCOL.REP }} />
          </div>
          {(() => {
            const cats = partyCats(d.party!);
            return (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cats.length},1fr)`, gap: 5 }}>
                {cats.map(s => (
                  <div key={s.k} style={{ background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "6px 5px", textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 8.5, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 3 }}>{s.lab}</div>
                    <div style={{ fontFamily: "var(--font-display),sans-serif", fontSize: 14, color: s.c, lineHeight: 1 }}>{shareLabel(d.party!, s.k)}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 7 }}>
        {d.plur && !d.noReg ? (
          <>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: PCOL[d.plur], flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-body),monospace", fontSize: 10.5, fontWeight: 600, color: "var(--foreground)" }}>{PWORD[d.plur]} plurality</span>
          </>
        ) : (
          <span style={{ fontFamily: "var(--font-body),monospace", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted2)" }}>{d.foot}</span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PartyMapPage() {
  const [scope, setScope] = useState<Scope>("states");
  const [isoAbbr, setIsoAbbr] = useState<string | null>(null);
  const [summary, setSummary] = useState<StateSummary[]>([]);
  const [national, setNational] = useState<{ total: number; party: Party } | null>(null);
  const [countyVals, setCountyVals] = useState<Record<string, CountyVal> | null>(null);
  const [detail, setDetail] = useState<StateDetail | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [loadingCounties, setLoadingCounties] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [statesGeo, setStatesGeo] = useState<{ shapes: Geo[]; border: string } | null>(null);
  const [countiesGeo, setCountiesGeo] = useState<{ shapes: Geo[]; border: string } | null>(null);
  const [isoGeo, setIsoGeo] = useState<{ shapes: Geo[]; border: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countiesTopoRef = useRef<{ features: any[]; toAbbr: Record<string, string> } | null>(null);

  const byAbbr = useMemo(() => Object.fromEntries(summary.map(s => [s.abbr, s])), [summary]);
  const byFips = useMemo(() => Object.fromEntries(summary.map(s => [s.fips, s])), [summary]);

  // ── load state summary + state geometry ──
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
        setSummary(sum.states);
        setNational({ total: sum.national_total, party: sum.national_party });
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const proj = (geoAlbersUsa as any)().scale(1280).translate([480, 300]);
        const path = (geoPath as any)().projection(proj);
        const fc = (topojson as any).feature(topo, (topo as any).objects.states);
        const shapes: Geo[] = [];
        for (const f of fc.features) {
          const abbr = FIPS[PAD2(f.id)]; if (!abbr) continue;
          const [cx, cy] = path.centroid(f);
          const [[x0, y0], [x1, y1]] = path.bounds(f);
          shapes.push({ key: abbr, d: path(f) ?? "", cx, cy, small: (x1 - x0 < 26 || y1 - y0 < 17) });
        }
        const border = path((topojson as any).mesh(topo, (topo as any).objects.states, (a: any, b: any) => a !== b)) ?? "";
        /* eslint-enable @typescript-eslint/no-explicit-any */
        setStatesGeo({ shapes, border });
      } catch { /* offline */ }
    })();
    return () => { dead = true; };
  }, []);

  // ── lazy: county geometry + values ──
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
      const fc = (topojson as any).feature(topo, (topo as any).objects.counties);
      const proj = (geoAlbersUsa as any)().scale(1280).translate([480, 300]);
      const path = (geoPath as any)().projection(proj);
      const shapes: Geo[] = [];
      const toAbbr: Record<string, string> = {};
      for (const f of fc.features) {
        const fips = PAD5(f.id);
        toAbbr[fips] = FIPS[fips.slice(0, 2)] ?? "";
        shapes.push({ key: fips, d: path(f) ?? "", small: true });
      }
      const border = path((topojson as any).mesh(topo, (topo as any).objects.states, (a: any, b: any) => a !== b)) ?? "";
      /* eslint-enable @typescript-eslint/no-explicit-any */
      countiesTopoRef.current = { features: fc.features, toAbbr };
      setCountiesGeo({ shapes, border });
      if (!countyVals) setCountyVals(vals);
    } catch { /* offline */ }
    setLoadingCounties(false);
  }, [countyVals]);

  useEffect(() => { if (scope === "counties") ensureCounties(); }, [scope, ensureCounties]);

  // ── focus a state: fit its counties to the stage ──
  const focusState = useCallback(async (abbr: string) => {
    const s = byAbbr[abbr]; if (!s) return;
    setIsoAbbr(abbr); setTip(null); setDetail(null); setIsoGeo(null);
    try {
      const dPromise = fetch(`/voterreg/counties/${abbr}.json`).then(r => r.json()).catch(() => null);
      await ensureCounties();
      const topoRef = countiesTopoRef.current;
      const { geoMercator, geoAlbers, geoPath } = await import("d3-geo");
      if (topoRef) {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const feats = topoRef.features.filter((f: any) => PAD5(f.id).slice(0, 2) === s.fips);
        const fc = { type: "FeatureCollection", features: feats } as any;
        const proj = (abbr === "AK"
          ? (geoAlbers as any)().rotate([154, 0]).center([0, 62]).parallels([55, 65])
          : (geoMercator as any)()).fitExtent([[40, 36], [920, 564]], fc);
        const path = (geoPath as any)().projection(proj);
        const shapes: Geo[] = feats.map((f: any) => {
          const [cx, cy] = path.centroid(f);
          const [[x0, y0], [x1, y1]] = path.bounds(f);
          return { key: PAD5(f.id), d: path(f) ?? "", cx, cy, small: (x1 - x0 < 44 || y1 - y0 < 26), name: f.properties?.name };
        });
        /* eslint-enable @typescript-eslint/no-explicit-any */
        setIsoGeo({ shapes, border: "" });
      }
      setDetail(await dPromise);
    } catch { /* offline */ }
  }, [byAbbr, ensureCounties]);

  const exitFocus = useCallback(() => { setIsoAbbr(null); setDetail(null); setIsoGeo(null); setTip(null); }, []);

  const detailByFips = useMemo(() => Object.fromEntries((detail?.counties ?? []).map(c => [c.fips, c])), [detail]);
  const iso = isoAbbr ? byAbbr[isoAbbr] : null;

  // ── fills ──
  const fillState = useCallback((s: StateSummary): string => {
    if (s.no_reg) return "url(#pm-hatch)";
    if (s.plurality) return s.party ? lerp(RAMP[s.plurality][0], RAMP[s.plurality][1], intensity(partyMargin(s.party))) : PCOL[s.plurality];
    return "var(--pm-grey)";
  }, []);
  // national county view: solid plurality color so every county clearly shows its party
  const fillCounty = useCallback((fips: string): string => {
    const v = countyVals?.[fips]; if (!v) return "var(--muted3)";
    return v.p ? PCOL[v.p] : lerp(GREY[0], GREY[1], 0.4);
  }, [countyVals]);
  const fillIso = useCallback((fips: string): string => {
    const u = detailByFips[fips];
    if (u && u.plurality && u.party) return lerp(RAMP[u.plurality][0], RAMP[u.plurality][1], intensity(partyMargin(u.party)));
    if (u && u.plurality) return PCOL[u.plurality];
    const v = countyVals?.[fips];
    if (v && v.p) return PCOL[v.p];
    // town / district states (NH, CT, RI, AK): no county-level rolls — show the statewide plurality
    if (iso?.plurality) return PCOL[iso.plurality];
    return "var(--muted3)";
  }, [detailByFips, countyVals, iso]);

  // ── tooltip builders ──
  const move = (e: React.MouseEvent, d: TipData) => setTip({ ...d, visible: true, x: e.clientX, y: e.clientY });
  const hide = () => setTip(t => (t ? { ...t, visible: false } : t));

  const tipState = (s: StateSummary): TipData => s.no_reg
    ? { title: s.name, sub: "No voter registration", value: null, party: null, plur: null, foot: "Vote with ID · no rolls", noReg: true }
    : {
        title: s.name, sub: `registered · as of ${s.as_of ?? "—"}`, value: s.total,
        party: s.registers_by_party ? s.party : null, plur: s.plurality,
        foot: s.registers_by_party ? "click to focus" : `does not record party · ${s.county_count} ${s.unit_label ?? "county"}s`,
      };
  const tipCounty = (fips: string): TipData => {
    const v = countyVals?.[fips]; const st = byFips[fips.slice(0, 2)];
    if (!v) return { title: "County", sub: st?.name ?? "", value: null, party: null, plur: null, foot: "not separately reported" };
    return { title: v.n, sub: st?.name ?? v.s, value: v.r, party: null, plur: v.p, foot: `click to focus ${v.s}` };
  };
  const tipUnit = (fips: string, fallback: string): TipData => {
    const u = detailByFips[fips];
    if (u) return { title: u.name, sub: `${detail?.unit_label ?? "county"} · registered`, value: u.total, party: u.party, plur: u.plurality, foot: u.plurality ? "" : "no party recorded" };
    const v = countyVals?.[fips];
    if (v) return { title: v.n, sub: `${detail?.name ?? v.s} · registered`, value: v.r, party: null, plur: v.p, foot: v.p ? "" : "no party recorded" };
    // town / district state: no county-level rolls — surface the statewide figures
    if (iso) return { title: fallback || iso.name, sub: `${iso.name} · statewide`, value: iso.total, party: iso.party, plur: iso.plurality, foot: `registered by ${iso.unit_label ?? "town"}` };
    return { title: fallback || "County", sub: detail?.name ?? "", value: null, party: null, plur: null, foot: "not separately reported" };
  };

  // ── summary tiles ──
  const counts = useMemo(() => {
    const c = { DEM: 0, REP: 0, UNA: 0, NONE: 0 };
    for (const s of summary) {
      if (s.registers_by_party && s.plurality) c[s.plurality]++;
      else c.NONE++;
    }
    return c;
  }, [summary]);

  // third tile: a state with no unaffiliated category (LA/OK/KY) shows "Other" instead
  const isoThird = iso?.party && iso.party.UNA < iso.party.OTH
    ? { l: "Other", k: "OTH" as keyof Party, c: "#9aa0b4" }
    : { l: "Unaffiliated", k: "UNA" as keyof Party, c: PCOL.UNA };
  const TILES = iso
    ? [
        { l: "Registered", v: compact(iso.total), c: "var(--foreground)" },
        { l: "Democratic", v: iso.party ? shareLabel(iso.party, "DEM") : "—", c: PCOL.DEM },
        { l: "Republican", v: iso.party ? shareLabel(iso.party, "REP") : "—", c: PCOL.REP },
        { l: isoThird.l, v: iso.party ? shareLabel(iso.party, isoThird.k) : "—", c: isoThird.c },
      ]
    : [
        { l: "Dem plurality", v: String(counts.DEM), c: PCOL.DEM },
        { l: "Rep plurality", v: String(counts.REP), c: PCOL.REP },
        { l: "Una plurality", v: String(counts.UNA), c: PCOL.UNA },
        { l: "No party reg.", v: String(counts.NONE), c: "#9aa0b4" },
      ];

  const LEGEND = [
    { l: "Democratic", c: PCOL.DEM }, { l: "Republican", c: PCOL.REP }, { l: "Unaffiliated", c: PCOL.UNA },
    { l: "No party reg.", c: "#aab0c6", kind: "muted" as const }, { l: "No registration", c: "#6b7088", kind: "hatch" as const },
  ];

  // national party beam segments
  const beam = national ? (() => {
    const p = national.party, T = p.DEM + p.REP + p.UNA + p.OTH || 1;
    return [
      { w: p.DEM, c: PCOL.DEM, k: "d" }, { w: p.UNA, c: PCOL.UNA, k: "u" },
      { w: p.OTH, c: "#9aa0b4", k: "o" }, { w: p.REP, c: PCOL.REP, k: "r" },
    ].map(s => ({ ...s, pct: (s.w / T) * 100 }));
  })() : [];

  const stageHint = iso
    ? `${iso.name} — ${fmt(iso.total)} registered across ${iso.county_count} ${iso.unit_label ?? "county"}${iso.county_count === 1 ? "" : "s"}`
    : scope === "counties"
      ? "Every county colored by its largest registered party. Hover for detail · click to focus a state."
      : "Each state colored by the largest registered bloc, deeper where the margin is wider. Click any state to focus.";

  const layer = isoGeo ? "iso" : scope === "counties" ? "counties" : "states";

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 80px", position: "relative", zIndex: 1, color: "var(--foreground)" }}>
      <style>{`
        .pm-root { --pm-grey: rgba(15,16,32,0.16); }
        [data-theme="dark"] .pm-root { --pm-grey: rgba(244,245,251,0.16); }
        .pm-tri { height:3px; background:linear-gradient(90deg,var(--red) 0%,var(--purple) 50%,var(--blue) 100%); border-radius:9999px 9999px 0 0; box-shadow:0 4px 18px -2px rgba(109, 62, 233,0.28); }
        .pm-state { stroke:#080810; stroke-width:0.9; cursor:pointer; transition:filter 110ms; }
        .pm-state:hover { filter:brightness(1.12) saturate(1.18); stroke-width:1.4; }
        .pm-county { stroke:#080810; stroke-width:0.28; cursor:pointer; transition:filter 110ms; }
        .pm-county:hover { filter:brightness(1.18) saturate(1.2); stroke-width:0.9; }
        .pm-lab { font-family:var(--font-display),sans-serif; font-size:11px; letter-spacing:0.02em; text-anchor:middle; dominant-baseline:central; pointer-events:none; user-select:none; }
        .pm-seg { display:inline-flex; padding:3px; gap:2px; background:var(--panel2); border:1px solid var(--border); border-radius:9999px; }
        .pm-seg button { padding:8px 18px; border:0; border-radius:9999px; background:transparent; cursor:pointer; font-family:var(--font-body),monospace; font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--muted2); transition:color .16s, background .2s; }
        .pm-seg button:hover { color:var(--foreground); }
        .pm-seg button.on { background:var(--gradient-purple); color:#fff; box-shadow:var(--shadow-purple); }
        .pm-back { display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border:1px solid var(--border2); border-radius:9999px; background:var(--panel2); cursor:pointer; font-family:var(--font-body),monospace; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:var(--foreground); transition:border-color .16s; }
        .pm-back:hover { border-color:var(--border3); }
        @media(max-width:760px){ .pm-wrap{ padding-left:18px!important; padding-right:18px!important; } .pm-sum{ grid-template-columns:repeat(2,1fr)!important; } }
      `}</style>

      <div className="pm-root">
        {/* ── Hero ── */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", marginBottom: 20, overflow: "hidden", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-md)" }}>
          <div className="pm-tri" />
          <div style={{ padding: "34px 40px 30px" }}>
            <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 12 }}>
              TPSI · Voter Registration · {national ? `${compact(national.total)} registered nationwide` : "loading…"}
            </div>
            <h1 style={{ fontFamily: "var(--font-display),sans-serif", fontSize: "clamp(34px,5vw,60px)", letterSpacing: "-0.02em", lineHeight: 0.95, textTransform: "uppercase", color: "var(--foreground)", marginBottom: 16 }}>
              Party{" "}
              <span style={{ background: "linear-gradient(100deg,#d64550,#a78bfa,#3b7bde)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Registration</span>
            </h1>
            <p style={{ fontFamily: "var(--font-body),monospace", fontSize: 14, color: "var(--muted)", lineHeight: 1.6, maxWidth: 620, marginBottom: 20 }}>
              The U.S. voter rolls by registered party. Thirty-one states record each voter&apos;s party — blue where registered Democrats lead, red where Republicans do, indigo where the unaffiliated are the largest bloc. Toggle counties, or click a state to read it county by county.
            </p>
            {national && (
              <div style={{ maxWidth: 620 }}>
                <div style={{ display: "flex", gap: 2, height: 12, borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                  {beam.map(s => <i key={s.k} style={{ width: `${s.pct}%`, background: s.c }} title={`${compact(s.w)}`} />)}
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {[["Dem","DEM",PCOL.DEM],["Rep","REP",PCOL.REP],["Una","UNA",PCOL.UNA],["Other","OTH","#9aa0b4"]].map(([lab,k,c]) => (
                    <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body),monospace", fontSize: 11, color: "var(--muted)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c as string }} />
                      {lab} {compact(national.party[k as keyof Party])}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Controls + summary tiles ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
          <div className="pm-seg" role="radiogroup" aria-label="Map scope">
            {(["states", "counties"] as Scope[]).map(sc => (
              <button key={sc} role="radio" aria-checked={scope === sc && !iso}
                className={scope === sc && !iso ? "on" : ""}
                onClick={() => { exitFocus(); setScope(sc); }}>{sc}</button>
            ))}
          </div>
          {iso && <button className="pm-back" onClick={exitFocus}><span aria-hidden>←</span> All states</button>}
        </div>

        <div className="pm-sum" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 18 }}>
          {TILES.map(t => (
            <div key={t.l} style={{ background: "var(--panel)", border: `1px solid ${t.c === "var(--foreground)" ? "var(--border)" : t.c + "44"}`, borderRadius: "var(--r-sm)", padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 9, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 6 }}>{t.l}</div>
              <div style={{ fontFamily: "var(--font-display),sans-serif", textTransform: "uppercase", fontSize: 28, lineHeight: 1, color: t.c }}>{t.v}</div>
            </div>
          ))}
        </div>

        {/* ── Map card ── */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20, borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-sm)" }}>
          <div className="pm-tri" />
          <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--foreground)", marginBottom: 3 }}>
                {iso ? `${iso.name} · by ${iso.unit_label ?? "county"}` : scope === "counties" ? "Party registration · by county" : "Party registration · by state"}
              </div>
              <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 10, color: "var(--muted2)", maxWidth: 560 }}>{stageHint}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {LEGEND.map(l => (
                <div key={l.l} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", background: `${l.c}22`, border: `1px solid ${l.c}44`, fontFamily: "var(--font-body),monospace", fontSize: 9, color: l.c }}>
                  <span style={{ width: 7, height: 7, borderRadius: l.kind === "hatch" ? 1 : "50%", flexShrink: 0,
                    background: l.kind === "hatch" ? "repeating-linear-gradient(45deg,#6b7088 0 1.5px,transparent 1.5px 3px)" : l.c,
                    opacity: l.kind === "muted" ? 0.55 : 1 }} />
                  {l.l}
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: "relative" }}>
            {loadingCounties && layer === "counties" && !countiesGeo && (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--font-body),monospace", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted2)", zIndex: 2 }}>
                drawing 3,000 counties…
              </div>
            )}
            <svg viewBox="0 0 960 600" style={{ width: "100%", display: "block" }} preserveAspectRatio="xMidYMid meet">
              <defs>
                <pattern id="pm-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="var(--panel2)" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#9aa0b4" strokeWidth="1.4" />
                </pattern>
              </defs>

              {/* States layer */}
              {layer === "states" && statesGeo && (
                <g>
                  {statesGeo.shapes.map(g => {
                    const s = byAbbr[g.key]; if (!s) return null;
                    const f = fillState(s);
                    return <path key={g.key} className="pm-state" d={g.d} style={{ fill: f }}
                      onMouseMove={(e) => move(e, tipState(s))} onMouseLeave={hide}
                      onClick={() => s.registers_by_party && focusState(g.key)} />;
                  })}
                  <path d={statesGeo.border} style={{ fill: "none", stroke: "#080810", strokeWidth: 0.8, pointerEvents: "none" }} />
                  {statesGeo.shapes.filter(g => !g.small).map(g => {
                    const s = byAbbr[g.key]; if (!s) return null;
                    return <text key={"l" + g.key} x={g.cx} y={g.cy} className="pm-lab" style={{ fill: ink(fillState(s)) }}>{g.key}</text>;
                  })}
                </g>
              )}

              {/* Counties layer (national) */}
              {layer === "counties" && countiesGeo && (
                <g>
                  {countiesGeo.shapes.map(g => (
                    <path key={g.key} className="pm-county" d={g.d} style={{ fill: fillCounty(g.key) }}
                      onMouseMove={(e) => move(e, tipCounty(g.key))} onMouseLeave={hide}
                      onClick={() => { const ab = countiesTopoRef.current?.toAbbr[g.key]; if (ab) { setScope("states"); focusState(ab); } }} />
                  ))}
                  <path d={countiesGeo.border} style={{ fill: "none", stroke: "#080810", strokeWidth: 0.7, pointerEvents: "none" }} />
                </g>
              )}

              {/* Focused state layer — no county labels */}
              {layer === "iso" && isoGeo && (
                <g>
                  {isoGeo.shapes.map(g => (
                    <path key={g.key} className="pm-county" d={g.d} style={{ fill: fillIso(g.key) }}
                      onMouseMove={(e) => move(e, tipUnit(g.key, g.name ?? ""))} onMouseLeave={hide} />
                  ))}
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* ── Footnote ── */}
        <div style={{ background: "var(--blue-dim)", border: "1px solid rgba(29, 95, 196,0.20)", borderRadius: "var(--r-md)", padding: "14px 20px", fontFamily: "var(--font-body),monospace", fontSize: 12, color: "var(--muted)", lineHeight: 1.8 }}>
          <span style={{ color: "#4a9dff", fontWeight: 500 }}>Note:</span> Color reflects <em>registered</em> party — not how a place votes. States &amp; focused counties deepen with the plurality&apos;s margin; the national county view shows each county&apos;s largest registered party. Only 31 states record party at registration (the rest are grey); North Dakota (hatched) has no voter registration. Latest official rolls compiled from each state&apos;s election authority.
          {iso?.source_url && <> · <a href={iso.source_url} target="_blank" rel="noreferrer" style={{ color: "var(--foreground2)", borderBottom: "1px solid var(--border3)" }}>{iso.name} source ↗</a></>}{" "}
          <Link href="/forecastratings" style={{ color: "var(--foreground2)", borderBottom: "1px solid var(--border3)" }}>See 2026 race ratings →</Link>
        </div>
      </div>

      {tip && mounted && createPortal(<Tooltip d={tip} />, document.body)}
    </div>
  );
}
