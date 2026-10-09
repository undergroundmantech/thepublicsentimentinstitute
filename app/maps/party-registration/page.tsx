"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

/**
 * Party Registration — interactive choropleth of the U.S. voter rolls.
 * Each state / county is colored by the single largest registered party bloc,
 * shaded by margin (states & focused view) or by registration size (national
 * county view). Click a state to focus on its counties. Dark glass cards on the
 * OnPoint Politics tokens. Unaffiliated is a neutral grey violet, never the
 * independent lavender, which is reserved for independent candidates.
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

const PCOL: Record<"DEM" | "REP" | "UNA", string> = { DEM: "#3d7bff", REP: "#ff3b5c", UNA: "#a39cb8" };
const OTH_C = "#5f5873";      // --mute2, other parties
const NOPARTY_C = "#3a3448";  // a state that does not record party
const PWORD: Record<"DEM" | "REP" | "UNA", string> = { DEM: "Democratic", REP: "Republican", UNA: "Unaffiliated" };
// per-party [light, deep] ramps — the light end is still a clearly-readable
// party hue so even a razor-thin plurality reads as its color, not grey.
const RAMP: Record<"DEM" | "REP" | "UNA", [number[], number[]]> = {
  DEM: [[166, 194, 255], [16, 40, 140]],
  REP: [[255, 179, 192], [140, 10, 40]],
  UNA: [[214, 208, 228], [95, 88, 115]],
};
const GREY: [number[], number[]] = [[92, 86, 110], [58, 52, 72]];

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
  if (!m || m.length < 3) return "rgba(255,255,255,0.85)";
  const [r, g, b] = m.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#1a1030" : "rgba(255,255,255,0.9)";
}
function fmt(n: number | null | undefined): string { return n == null ? "…" : n.toLocaleString("en-US"); }
function compact(n: number | null | undefined): string {
  if (n == null) return "…";
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
    { lab: "Oth", k: "OTH" as keyof Party, c: OTH_C },
  ]).filter(s => p[s.k] > 0);
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ d }: { d: Tip }) {
  if (!d.visible) return null;
  const spine = d.noReg ? NOPARTY_C : d.plur ? PCOL[d.plur] : OTH_C;
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
    <div className="pm-tip" style={{ left, top, width: W, borderLeftColor: spine }}>
      <div className="pm-tip-top">
        <b>{d.title}</b>
        <span>{d.noReg ? "None" : compact(d.value)}</span>
      </div>
      <div className="pm-tip-sub">{d.sub}</div>
      {d.party && !d.noReg && (
        <>
          <div className="pm-tip-bar">
            <i style={{ width: `${share(d.party,"DEM")}%`, background: PCOL.DEM }} />
            <i style={{ width: `${share(d.party,"UNA")}%`, background: PCOL.UNA }} />
            <i style={{ width: `${share(d.party,"OTH")}%`, background: OTH_C }} />
            <i style={{ width: `${share(d.party,"REP")}%`, background: PCOL.REP }} />
          </div>
          {(() => {
            const cats = partyCats(d.party!);
            return (
              <div className="pm-tip-cats" style={{ gridTemplateColumns: `repeat(${cats.length},1fr)` }}>
                {cats.map(s => (
                  <div key={s.k}>
                    <em>{s.lab}</em>
                    <b style={{ color: s.k === "OTH" ? "var(--ink2)" : s.c }}>{shareLabel(d.party!, s.k)}</b>
                  </div>
                ))}
              </div>
            );
          })()}
        </>
      )}
      <div className="pm-tip-foot">
        {d.plur && !d.noReg ? (
          <><i style={{ background: PCOL[d.plur] }} /><span>{PWORD[d.plur]} plurality</span></>
        ) : (
          <em>{d.foot}</em>
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
  const [failed, setFailed] = useState(false);
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
      } catch { if (!dead) setFailed(true); }
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
    return NOPARTY_C;
  }, []);
  // national county view: solid plurality color so every county clearly shows its party
  const fillCounty = useCallback((fips: string): string => {
    const v = countyVals?.[fips]; if (!v) return "rgba(255,255,255,0.08)";
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
    return "rgba(255,255,255,0.08)";
  }, [detailByFips, countyVals, iso]);

  // ── tooltip builders ──
  const move = (e: React.MouseEvent, d: TipData) => setTip({ ...d, visible: true, x: e.clientX, y: e.clientY });
  const hide = () => setTip(t => (t ? { ...t, visible: false } : t));

  const tipState = (s: StateSummary): TipData => s.no_reg
    ? { title: s.name, sub: "No voter registration", value: null, party: null, plur: null, foot: "Vote with ID · no rolls", noReg: true }
    : {
        title: s.name, sub: `registered · as of ${s.as_of ?? "n/a"}`, value: s.total,
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
    ? { l: "Other", k: "OTH" as keyof Party, c: "var(--ink2)" }
    : { l: "Unaffiliated", k: "UNA" as keyof Party, c: PCOL.UNA };
  const TILES = iso
    ? [
        { l: "Registered", v: compact(iso.total), c: "var(--ink)" },
        { l: "Democratic", v: iso.party ? shareLabel(iso.party, "DEM") : "n/a", c: PCOL.DEM },
        { l: "Republican", v: iso.party ? shareLabel(iso.party, "REP") : "n/a", c: PCOL.REP },
        { l: isoThird.l, v: iso.party ? shareLabel(iso.party, isoThird.k) : "n/a", c: isoThird.c },
      ]
    : [
        { l: "Dem plurality", v: String(counts.DEM), c: PCOL.DEM },
        { l: "Rep plurality", v: String(counts.REP), c: PCOL.REP },
        { l: "Una plurality", v: String(counts.UNA), c: PCOL.UNA },
        { l: "No party reg.", v: String(counts.NONE), c: "var(--ink2)" },
      ];

  const LEGEND = [
    { l: "Democratic", c: PCOL.DEM }, { l: "Republican", c: PCOL.REP }, { l: "Unaffiliated", c: PCOL.UNA },
    { l: "No party reg.", c: NOPARTY_C, kind: "muted" as const }, { l: "No registration", c: "#8e86a3", kind: "hatch" as const },
  ];

  // national party beam segments
  const beam = national ? (() => {
    const p = national.party, T = p.DEM + p.REP + p.UNA + p.OTH || 1;
    return [
      { w: p.DEM, c: PCOL.DEM, k: "d" }, { w: p.UNA, c: PCOL.UNA, k: "u" },
      { w: p.OTH, c: OTH_C, k: "o" }, { w: p.REP, c: PCOL.REP, k: "r" },
    ].map(s => ({ ...s, pct: (s.w / T) * 100 }));
  })() : [];

  const stageHint = iso
    ? `${iso.name}: ${fmt(iso.total)} registered across ${iso.county_count} ${iso.unit_label ?? "county"}${iso.county_count === 1 ? "" : "s"}`
    : scope === "counties"
      ? "Every county colored by its largest registered party. Hover for detail · click to focus a state."
      : "Each state colored by the largest registered bloc, deeper where the margin is wider. Click any state to focus.";

  const layer = isoGeo ? "iso" : scope === "counties" ? "counties" : "states";

  return (
    <div className="opp pm-page">
      <style>{CSS}</style>

      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/maps">Maps</Link><span className="sep">/</span><span>Party registration</span>
      </nav>
      <header className="ph">
        <div className="eye g">Voter rolls</div>
        <h1>Party <em>registration</em></h1>
        <p className="lede">
          The U.S. voter rolls by registered party. Thirty one states record each voter&apos;s party: blue where registered
          Democrats lead, red where Republicans do, and grey where the unaffiliated are the largest bloc. Switch to counties,
          or click a state to read it county by county.
        </p>
        <div className="pmeta">
          {national && <span><b className="mono">{compact(national.total)}</b> registered nationwide</span>}
          <span><b className="mono">31</b> states record party</span>
          <Link className="btn sm" href="/maps/voter-registration">Voter registration</Link>
        </div>
      </header>

      <div className="pm-stack">
        {national && (
          <div className="card">
            <div className="card-h"><h3>The national rolls by party</h3><span className="eye" style={{ marginLeft: "auto" }}>{compact(national.total)} voters</span></div>
            <div className="card-b">
              <div className="pm-beam">
                {beam.map(s => <i key={s.k} style={{ width: `${s.pct}%`, background: s.c }} title={`${compact(s.w)}`} />)}
              </div>
              <div className="legend" style={{ marginTop: 10 }}>
                {([["Democratic","DEM",PCOL.DEM],["Republican","REP",PCOL.REP],["Unaffiliated","UNA",PCOL.UNA],["Other","OTH",OTH_C]] as const).map(([lab,k,c]) => (
                  <span key={k}><i style={{ background: c }} />{lab} <b className="mono pm-n">{compact(national.party[k as keyof Party])}</b></span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="pm-controls">
          <div className="seg pm-seg" role="radiogroup" aria-label="Map scope">
            {(["states", "counties"] as Scope[]).map(sc => (
              <button key={sc} role="radio" aria-checked={scope === sc && !iso}
                className={scope === sc && !iso ? "on" : ""}
                onClick={() => { exitFocus(); setScope(sc); }}>{sc === "states" ? "States" : "Counties"}</button>
            ))}
          </div>
          {iso && <button className="btn sm" onClick={exitFocus}>All states</button>}
        </div>

        <div className="grid4 pm-sum">
          {TILES.map(t => (
            <div key={t.l} className="card tile">
              <span className="eye">{t.l}</span>
              <span className="v" style={{ color: t.c }}>{summary.length ? t.v : "…"}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-h">
            <div>
              <h3>{iso ? `${iso.name} by ${iso.unit_label ?? "county"}` : scope === "counties" ? "Party registration by county" : "Party registration by state"}</h3>
              <div className="pm-hint">{stageHint}</div>
            </div>
            <div className="legend pm-legend">
              {LEGEND.map(l => (
                <span key={l.l}>
                  <i style={{ background: l.kind === "hatch" ? "repeating-linear-gradient(45deg,#8e86a3 0 1.5px,transparent 1.5px 3px)" : l.c }} />
                  {l.l}
                </span>
              ))}
            </div>
          </div>

          <div style={{ position: "relative" }}>
            {loadingCounties && layer === "counties" && !countiesGeo && (
              <div className="empty pm-loading">Drawing 3,000 counties</div>
            )}
            {!statesGeo && layer === "states" && (
              <div className="empty pm-loading">{failed ? "Registration data is unavailable right now. Try again shortly." : "Loading the map"}</div>
            )}
            <svg viewBox="0 0 960 600" style={{ width: "100%", display: "block" }} preserveAspectRatio="xMidYMid meet">
              <defs>
                <pattern id="pm-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="rgba(255,255,255,0.04)" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#8e86a3" strokeWidth="1.4" />
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
                  <path d={statesGeo.border} style={{ fill: "none", stroke: "var(--bg)", strokeWidth: 0.8, pointerEvents: "none" }} />
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
                  <path d={countiesGeo.border} style={{ fill: "none", stroke: "var(--bg)", strokeWidth: 0.7, pointerEvents: "none" }} />
                </g>
              )}

              {/* Focused state layer, no county labels */}
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

        <div className="callout">
          <div className="eye">Note</div>
          Color reflects <em>registered</em> party, not how a place votes. States and focused counties deepen with the plurality&apos;s margin; the national county view shows each county&apos;s largest registered party. Only 31 states record party at registration, and the rest are shaded as no party registration. North Dakota, hatched, has no voter registration. Latest official rolls compiled from each state&apos;s election authority.
          {iso?.source_url && <> · <a href={iso.source_url} target="_blank" rel="noreferrer" className="pm-a">{iso.name} source</a></>}{" "}
          · <Link href="/forecast" className="pm-a">See the 2026 forecast</Link>
        </div>
      </div>

      {tip && mounted && createPortal(<Tooltip d={tip} />, document.body)}
    </div>
  );
}

const CSS = `
.pm-page { color: var(--ink); }
.pm-stack { display: grid; gap: 16px; }
.pm-beam { display: flex; gap: 2px; height: 12px; border-radius: 999px; overflow: hidden; }
.pm-beam i { display: block; height: 100%; }
.opp .pm-n { font-family: var(--font-m); color: var(--ink); margin-left: 4px; font-weight: 600; }
.pm-controls { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.opp .pm-seg { margin-left: 0; }
.opp .pm-sum .tile { text-align: left; }
.opp .pm-sum .tile .v { font-size: 30px; }
.pm-hint { font-size: 12.5px; color: var(--mute); margin-top: 3px; max-width: 60ch; }
.opp .pm-legend { margin: 0 0 0 auto; gap: 6px 12px; font-size: 11.5px; }
.pm-loading { position: absolute; inset: 0; display: grid; place-items: center; z-index: 2; }
.pm-state { stroke: var(--bg); stroke-width: 0.9; cursor: pointer; transition: filter 110ms; }
.pm-state:hover { filter: brightness(1.2); stroke: #fff; stroke-width: 1.4; }
.pm-county { stroke: var(--bg); stroke-width: 0.28; cursor: pointer; transition: filter 110ms; }
.pm-county:hover { filter: brightness(1.2); stroke: #fff; stroke-width: 0.9; }
.pm-lab { font: 600 10px var(--font-m); text-anchor: middle; dominant-baseline: central; pointer-events: none; user-select: none; }
.opp .pm-a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.pm-tip { position: fixed; z-index: 99999; pointer-events: none; padding: 11px 13px; border-radius: 10px;
  background: rgba(17,0,25,.94); border: 1px solid var(--line2); border-left: 3px solid var(--line2);
  box-shadow: 0 12px 40px rgba(0,0,0,.5); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  font-family: var(--font-b); color: var(--ink2); }
.pm-tip-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.pm-tip-top b { font: 700 14px var(--font-d); color: #fff; }
.pm-tip-top span { font: 700 14px var(--font-m); color: #fff; }
.pm-tip-sub { margin-top: 3px; font: 600 10px var(--font-m); letter-spacing: .08em; text-transform: uppercase; color: var(--mute); }
.pm-tip-bar { display: flex; gap: 1.5px; height: 7px; margin: 10px 0 8px; border-radius: 999px; overflow: hidden; }
.pm-tip-bar i { display: block; height: 100%; }
.pm-tip-cats { display: grid; gap: 5px; }
.pm-tip-cats > div { background: var(--glass2); border: 1px solid var(--line); border-radius: 6px; padding: 6px 5px; text-align: center; }
.pm-tip-cats em { display: block; font: 700 9px var(--font-m); font-style: normal; letter-spacing: .1em; text-transform: uppercase; color: var(--mute); margin-bottom: 3px; }
.pm-tip-cats b { font: 800 14px var(--font-d); }
.pm-tip-foot { margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--line); display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--ink); font-weight: 600; }
.pm-tip-foot i { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.pm-tip-foot em { font: 600 10px var(--font-m); font-style: normal; letter-spacing: .06em; text-transform: uppercase; color: var(--mute); }
@media (max-width: 960px) { .opp .pm-sum { grid-template-columns: repeat(2, 1fr); } .opp .pm-legend { margin-left: 0; } }
`;
