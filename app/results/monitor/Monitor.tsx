"use client";
// The situation monitor: every November 3 race on one globe you can grab and turn. States are coloured by the
// forecast, by the live returns from civicAPI, or by how far the returns run from the forecast. Zoom into a state and
// its counties appear, coloured the same way for the race you pick. Panels show the chambers, the state you pick and
// a feed of what changed since the last read.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { geoOrthographic, geoPath, geoGraticule10, geoContains, geoCentroid, geoDistance, geoBounds, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { marginColor } from "@/app/lib/opp";
import { STN, KIND_LABEL, expMargin, fmtM, fmtK, forecastHref, resultsHref, sides, type CRace, type Kind, type XRace, type Exp } from "../2026/live";
import { useIndex, useLive, useStateFile } from "../2026/useLive";

const FIPS: Record<string, string> = { "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY" };
type SF = Feature<Geometry, { name: string }> & { st: string };
type Mode = "sen" | "gov" | "house" | "state" | "measure" | "leg";
type Color = "forecast" | "live" | "versus";
const MODES: [Mode, string][] = [["sen", "Senate"], ["gov", "Governors"], ["house", "House"], ["state", "Statewide"], ["measure", "Measures"], ["leg", "Legislatures"]];
const SETS: Record<Mode, ("fed" | "leg" | "ballot" | "state")[]> = { sen: ["fed"], gov: ["fed"], house: ["fed"], state: ["fed", "state"], measure: ["fed", "ballot"], leg: ["fed", "leg"] };
export type Chambers = { sen: { notD: number; notR: number; dS: number; pD: number }; house: { dS: number; pD: number }; gov: { notD: number; notR: number; dS: number; pD: number } };
type Feed = { t: Date; id: string; text: string };

const liveMargin = (r: XRace, c: CRace | undefined) => { if (!c) return null; const s = sides(r, c.c); return s.t > 0 ? (100 * (s.b - s.a)) / s.t : null; };
const vsColor = (d: number) => { const a = Math.min(1, Math.abs(d) / 12); return d < 0 ? `rgba(61,123,255,${0.15 + a * 0.8})` : `rgba(255,59,92,${0.15 + a * 0.8})`; };
const shade = (m: number | null, k?: Kind) => (m == null ? "#2b2440" : k === "measure" ? (m < 0 ? `rgba(47,191,155,${0.25 + Math.min(1, -m / 40) * 0.7})` : `rgba(231,121,74,${0.25 + Math.min(1, m / 40) * 0.7})`) : marginColor(m));

export default function Monitor({ chambers }: { chambers: Chambers }) {
  const ix = useIndex();
  const [mode, setMode] = useState<Mode>("sen");
  const [color, setColor] = useState<Color>("forecast");
  const [sel, setSel] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);     // race shown on the county layer
  const [geo, setGeo] = useState<{ land: Feature<Geometry>; states: SF[] } | null>(null);
  const [cll, setCll] = useState<Record<string, number[][][]> | null>(null);
  const [hov, setHov] = useState<{ st: string; f?: string; x: number; y: number } | null>(null);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [zoomK, setZoomK] = useState(2.2);
  const live = useLive(ix, SETS[mode]);
  const sf = useStateFile(sel);
  const stage = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const view = useRef({ rot: [97, -39, 0] as [number, number, number], k: 2.2, target: null as null | { rot: [number, number, number]; k: number } });
  const drag = useRef<{ x: number; y: number; r: [number, number, number]; moved: boolean } | null>(null);

  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    Promise.all([fetch("/us-states.json").then((r) => r.json()), fetch("/geo/world-110m.json").then((r) => r.json())]).then(([us, w]) => {
      const S = feature(us as Topology, (us as Topology).objects.states as GeometryCollection<{ name: string }>) as unknown as { features: (Feature<Geometry, { name: string }> & { id?: string })[] };
      const W = feature(w as Topology, (w as Topology).objects.countries as GeometryCollection) as unknown as { features: (Feature<Geometry> & { id?: string })[] };
      const land = { type: "Feature", properties: {}, geometry: { type: "GeometryCollection", geometries: W.features.filter((f) => f.id !== "840").map((f) => f.geometry) } } as unknown as Feature<Geometry>;
      setGeo({ land, states: S.features.map((f) => ({ ...f, st: FIPS[String(f.id).padStart(2, "0")] ?? "" })).filter((f) => f.st) as SF[] });
    }).catch(() => {});
  }, []);
  // counties load once, the first time anyone zooms into a state
  useEffect(() => { if (sel && !cll) fetch("/results/2026/counties_ll.json").then((r) => r.json()).then(setCll).catch(() => {}); }, [sel, cll]);

  const races = useMemo(() => (ix?.races ?? []).filter((r) => r.k === mode), [ix, mode]);
  const byState = useMemo(() => { const m: Record<string, XRace[]> = {}; for (const r of races) (m[r.st] ??= []).push(r); return m; }, [races]);
  // one colour per state for the mode
  const stateColor = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [st, rs] of Object.entries(byState)) {
      const ms = rs.map((r) => ({ e: expMargin(r), l: liveMargin(r, live.byId[r.id]), w: r.k === "house" ? 1 : r.tot || 1 }));
      const avg = (k: "e" | "l") => { const v = ms.filter((x) => x[k] != null); if (!v.length) return null; return v.reduce((s, x) => s + (x[k] as number) * x.w, 0) / v.reduce((s, x) => s + x.w, 0); };
      const e = mode === "house" ? (100 * (ms.filter((x) => (x.e ?? 0) > 0).length - ms.filter((x) => (x.e ?? 0) < 0).length)) / Math.max(1, ms.length) : avg("e");
      const l = avg("l");
      out[st] = color === "forecast" ? shade(e, mode === "measure" ? "measure" : undefined) : color === "live" ? (l == null ? "#2b2440" : shade(l, mode === "measure" ? "measure" : undefined)) : l == null || e == null ? "#2b2440" : vsColor(l - e);
    }
    return out;
  }, [byState, live.byId, color, mode]);
  // the race on the county layer: the picked race in the selected state, or its first statewide race of the mode
  const selRaces = useMemo(() => (sel ? (ix?.races ?? []).filter((r) => r.st === sel) : []), [ix, sel]);
  const layerRace = useMemo(() => {
    if (!sel) return null;
    const cands = selRaces.filter((r) => r.cty);
    return cands.find((r) => r.id === pick) ?? cands.find((r) => r.k === mode) ?? cands.find((r) => r.k === "sen") ?? cands.find((r) => r.k === "gov") ?? cands[0] ?? null;
  }, [sel, selRaces, pick, mode]);
  const expC: Record<string, Exp> | null = layerRace && sf ? sf.counties[layerRace.id] ?? null : null;
  const [liveC, setLiveC] = useState<Record<string, { m: number | null; pr: number }> | null>(null);
  useEffect(() => {
    setLiveC(null); if (!layerRace) return;
    const c = live.byId[layerRace.id]; if (!c || !(c.pr > 0 || c.c.some((x) => x[2] > 0))) return;
    let dead = false;
    import("../2026/live").then(({ civicRace }) => civicRace(c.id)).then((d) => {
      if (dead) return; const o: Record<string, { m: number | null; pr: number }> = {};
      for (const [f, g] of Object.entries(d.regions)) { const s = sides(layerRace, g.c); o[f] = { m: s.t ? (100 * (s.b - s.a)) / s.t : null, pr: g.pr }; }
      setLiveC(o);
    }).catch(() => {});
    return () => { dead = true; };
  }, [layerRace, live.at, live.byId]);

  // what changed between reads
  useEffect(() => {
    if (!live.at || !ix) return;
    const items: Feed[] = [];
    for (const r of ix.races) {
      const a = live.byId[r.id], b = live.prev[r.id]; if (!a) continue;
      const s = sides(r, a.c);
      if (b && a.pr > b.pr) items.push({ t: live.at, id: r.id, text: `${r.nm}: ${a.pr.toFixed(0)}% reporting, ${fmtM(s.t ? (100 * (s.b - s.a)) / s.t : null, r.k)}` });
      if (a.c.some((c) => c[4]) && !(b?.c.some((c) => c[4]))) { const w = a.c.find((c) => c[4]); if (w) items.push({ t: live.at, id: r.id, text: `${r.nm}: civicAPI marks ${w[0]} the winner` }); }
    }
    if (items.length) setFeed((f) => [...items.slice(0, 20), ...f].slice(0, 60));
  }, [live.at, live.byId, live.prev, ix]);

  // the globe
  useEffect(() => {
    const c = cv.current, box = stage.current; if (!c || !box || !geo) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, raf = 0, base = 1;
    const proj = geoOrthographic().clipAngle(90).precision(0.4);
    const path = geoPath(proj, ctx), grat = geoGraticule10();
    const size = () => { W = box.clientWidth; H = box.clientHeight; c.width = W * dpr; c.height = H * dpr; c.style.width = W + "px"; c.style.height = H + "px"; base = Math.min(W, H) * 0.46; };
    size();
    const stSel = sel ? geo.states.find((s) => s.st === sel) : null;
    const counties = sel && cll ? Object.entries(cll).filter(([f]) => FIPS[f.slice(0, 2)] === sel).map(([f, rings]) => ({ f, g: { type: "Polygon", coordinates: [] } as unknown as GeoPermissibleObjects, rings })) : [];
    const cGeo = counties.map((x) => ({ f: x.f, g: { type: "MultiPolygon", coordinates: x.rings.map((r) => [r]) } as unknown as GeoPermissibleObjects }));
    const draw = () => {
      const v = view.current;
      if (v.target) { // ease toward a target view
        const t = v.target; v.rot = v.rot.map((x, i) => x + (t.rot[i] - x) * 0.14) as [number, number, number]; v.k += (t.k - v.k) * 0.14;
        if (Math.abs(v.k - t.k) < 0.002 && v.rot.every((x, i) => Math.abs(x - t.rot[i]) < 0.02)) v.target = null;
      }
      proj.rotate(v.rot).scale(base * v.k).translate([W / 2, H / 2]);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const R = proj.scale(), [cx, cy] = proj.translate();
      const atm = ctx.createRadialGradient(cx, cy, R * 0.94, cx, cy, R * 1.1); atm.addColorStop(0, "rgba(120,90,255,.32)"); atm.addColorStop(1, "rgba(120,90,255,0)");
      ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, R * 1.1, 0, 6.283); ctx.fill();
      const sea = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R); sea.addColorStop(0, "#17113a"); sea.addColorStop(1, "#06040e");
      ctx.fillStyle = sea; ctx.beginPath(); path({ type: "Sphere" }); ctx.fill();
      ctx.strokeStyle = "rgba(170,150,255,.09)"; ctx.lineWidth = 1; ctx.beginPath(); path(grat); ctx.stroke();
      ctx.fillStyle = "#1a1530"; ctx.beginPath(); path(geo.land as GeoPermissibleObjects); ctx.fill();
      for (const f of geo.states) {
        ctx.beginPath(); path(f as GeoPermissibleObjects);
        ctx.fillStyle = stateColor[f.st] ?? "#241e38"; ctx.globalAlpha = sel && sel !== f.st ? 0.45 : 1; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = hov?.st === f.st && !hov.f ? "#fff" : "rgba(8,5,16,.9)"; ctx.lineWidth = hov?.st === f.st && !hov.f ? 2 : 0.7; ctx.stroke();
      }
      // counties of the selected state
      if (cGeo.length && layerRace) {
        for (const x of cGeo) {
          const e = expC?.[x.f]; const lv = liveC?.[x.f];
          const em = e && e[3] ? (100 * (e[1] - e[0])) / e[3] : null;
          const fill = color === "forecast" ? shade(em, layerRace.k) : color === "live" ? (lv?.m != null ? shade(lv.m, layerRace.k) : "#2b2440") : lv?.m != null && em != null ? vsColor(lv.m - em) : "#2b2440";
          ctx.beginPath(); path(x.g); ctx.fillStyle = fill; ctx.fill();
          ctx.strokeStyle = hov?.f === x.f ? "#fff" : "rgba(8,5,16,.75)"; ctx.lineWidth = hov?.f === x.f ? 1.8 : 0.4; ctx.stroke();
        }
      }
      if (stSel) { ctx.beginPath(); path(stSel as GeoPermissibleObjects); ctx.strokeStyle = "#ffd98a"; ctx.lineWidth = 2.2; ctx.stroke(); }
      // pulses on states whose returns moved in the last read
      const fresh = new Set(feed.filter((x) => live.at && x.t.getTime() === live.at.getTime()).map((x) => x.id.split("-")[1]));
      const tt = performance.now();
      for (const f of geo.states) {
        if (!fresh.has(f.st)) continue; const ll = geoCentroid(f as GeoPermissibleObjects) as [number, number];
        if (geoDistance(ll, [-v.rot[0], -v.rot[1]]) > 1.4) continue; const p = proj(ll); if (!p) continue;
        const ph = (tt / 1600) % 1; ctx.strokeStyle = `rgba(255,217,138,${1 - ph})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 6 + ph * 30, 0, 6.283); ctx.stroke();
      }
      // state labels
      ctx.font = "700 10.5px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "rgba(255,255,255,.86)";
      if (v.k < 4.5) for (const f of geo.states) {
        const ll = geoCentroid(f as GeoPermissibleObjects) as [number, number]; if (geoDistance(ll, [-v.rot[0], -v.rot[1]]) > 1.35) continue;
        const b = path.bounds(f as GeoPermissibleObjects); if (b[1][0] - b[0][0] < 30) continue; const p = proj(ll); if (p) ctx.fillText(f.st, p[0], p[1]);
      }
      if (!reduce || v.target) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => size()); ro.observe(box);
    const hit = (x: number, y: number) => {
      const ll = proj.invert?.([x, y]); if (!ll || geoDistance(ll, [-view.current.rot[0], -view.current.rot[1]]) > 1.57) return null;
      const s = geo.states.find((f) => geoContains(f as GeoPermissibleObjects, ll)); if (!s) return null;
      const co = s.st === sel ? cGeo.find((x) => geoContains(x.g, ll)) : undefined;
      return { st: s.st, f: co?.f };
    };
    const down = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, r: [...view.current.rot] as [number, number, number], moved: false }; view.current.target = null; box.setPointerCapture?.(e.pointerId); };
    const move = (e: PointerEvent) => {
      const b = box.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, d = drag.current;
      if (d) { const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true; const k = 70 / proj.scale(); view.current.rot = [d.r[0] + dx * k, Math.max(-85, Math.min(85, d.r[1] - dy * k)), 0]; if (reduce) draw(); return; }
      const h = hit(x, y); setHov(h ? { ...h, x: e.clientX, y: e.clientY } : null); box.style.cursor = h ? "pointer" : "grab";
    };
    const up = (e: PointerEvent) => {
      const d = drag.current; drag.current = null; if (d?.moved) return;
      const b = box.getBoundingClientRect(); const h = hit(e.clientX - b.left, e.clientY - b.top);
      if (h) {
        const f = geo.states.find((s) => s.st === h.st)!; const bb = geoBounds(f as GeoPermissibleObjects); const ll = geoCentroid(f as GeoPermissibleObjects);
        const span = Math.max(bb[1][0] - bb[0][0], (bb[1][1] - bb[0][1]) * 1.4, 3);
        view.current.target = { rot: [-ll[0], -ll[1], 0], k: Math.max(1.6, Math.min(14, 60 / span)) }; setZoomK(view.current.target.k);
        setSel(h.st); setPick(null); if (reduce) draw(); else { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
      }
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); const k = Math.max(0.7, Math.min(16, view.current.k * Math.exp(-e.deltaY * 0.0015))); view.current.k = k; view.current.target = null; setZoomK(k); if (reduce) draw(); };
    const leave = () => setHov(null);
    box.addEventListener("pointerdown", down); box.addEventListener("pointermove", move); box.addEventListener("pointerup", up); box.addEventListener("wheel", wheel, { passive: false }); box.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); box.removeEventListener("pointerdown", down); box.removeEventListener("pointermove", move); box.removeEventListener("pointerup", up); box.removeEventListener("wheel", wheel); box.removeEventListener("pointerleave", leave); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, stateColor, sel, cll, expC, liveC, color, layerRace, feed, live.at]);

  const home = () => { view.current.target = { rot: [97, -39, 0], k: 2.2 }; setZoomK(2.2); setSel(null); setPick(null); };
  const zoomBy = (f: number) => { const k = Math.max(0.7, Math.min(16, view.current.k * f)); view.current.target = { rot: [...view.current.rot] as [number, number, number], k }; setZoomK(k); };
  const full = () => { const el = stage.current?.parentElement; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.().catch(() => {}); };

  // chamber tallies: seats not up, plus races led in the returns, plus the forecast's expected seats
  const tally = (k: "sen" | "gov" | "house") => {
    const rs = (ix?.races ?? []).filter((r) => r.k === k); let d = 0, r = 0, ind = 0, inRet = 0;
    for (const x of rs) { const c = live.byId[x.id]; const m = liveMargin(x, c); if (m == null) continue; inRet++; if (m < 0) { if (x.c?.[0]?.[1] === "I") ind++; else d++; } else r++; }
    return { d, r, ind, inRet, n: rs.length };
  };
  const T = { sen: tally("sen"), house: tally("house"), gov: tally("gov") };
  const anyLive = T.sen.inRet + T.house.inRet + T.gov.inRet > 0;
  const closest = useMemo(() => [...races].filter((r) => expMargin(r) != null && Math.abs(expMargin(r)!) < 99).sort((a, b) => Math.abs(expMargin(a)!) - Math.abs(expMargin(b)!)).slice(0, 14), [races]);
  const close = new Date("2026-11-03T23:00:00Z"); // first polls close, 6 PM Eastern
  const left = now ? close.getTime() - now.getTime() : 0;
  const clock = now ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "America/New_York" }) : "";

  const raceRow = (r: XRace) => {
    const c = live.byId[r.id]; const lm = liveMargin(r, c); const e = expMargin(r);
    return (
      <li key={r.id}>
        <Link href={resultsHref(r.id)} className="mon-row" onMouseEnter={() => r.cty && setPick(r.id)}>
          <span className="nm">{r.k === "house" ? `${r.st}-${r.id.split("-")[2]}` : sel ? r.nm.replace(STN[r.st] + " ", "") : r.nm}</span>
          <span className={`ex ${e == null ? "" : e < 0 ? "d" : "r"}`}>{r.k === "leg" ? `${r.dS?.toFixed(0) ?? "?"} D, ${r.rS?.toFixed(0) ?? "?"} R` : fmtM(e, r.k, r.c?.[0]?.[1] === "I")}</span>
          <span className={`lv ${lm == null ? "" : lm < 0 ? "d" : "r"}`}>{c ? (lm == null ? "0% in" : `${fmtM(lm, r.k)} · ${c.pr.toFixed(0)}%`) : "No feed"}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="mon">
      <div className="mon-stage" ref={stage} aria-label="Globe of every November 3 race. Drag to turn it, scroll or use the buttons to zoom, click a state to open it." role="application">
        <canvas ref={cv} />
        <div className="mon-reticle" aria-hidden="true"><i /><i /></div>
      </div>

      <section className="mon-top" aria-label="Monitor controls">
        <div className="mon-title">
          <span className="eye"><i className={anyLive ? "on" : ""} />Situation monitor · November 3, 2026</span>
          <h1>Every race, <em>as it comes in.</em></h1>
          <p>{live.loading ? "Connecting to civicAPI" : live.error ? live.error : anyLive ? `${T.sen.inRet + T.gov.inRet + T.house.inRet} federal and governor races reporting · last read ${live.at?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "America/New_York" })} ET` : left > 0 ? `${Object.keys(live.byId).length} races linked to civicAPI · no votes counted yet · first polls close in ${Math.floor(left / 86400000)}d ${Math.floor((left % 86400000) / 3600000)}h` : "Polls are closing. Returns appear as they land."}</p>
        </div>
        <div className="mon-seg" role="group" aria-label="Races">{MODES.map(([k, l]) => <button key={k} aria-pressed={mode === k} onClick={() => { setMode(k); setPick(null); }}>{l}</button>)}</div>
        <div className="mon-seg sm" role="group" aria-label="Colour by">{(["forecast", "live", "versus"] as Color[]).map((k) => <button key={k} aria-pressed={color === k} onClick={() => setColor(k)}>{k === "forecast" ? "Forecast" : k === "live" ? "Live returns" : "Versus forecast"}</button>)}</div>
      </section>

      <aside className="mon-left" aria-label="Chambers">
        {([["sen", "Senate", 100, chambers.sen.notD, chambers.sen.notR, chambers.sen.dS, chambers.sen.pD], ["house", "House", 435, 0, 0, chambers.house.dS, chambers.house.pD], ["gov", "Governors", 50, chambers.gov.notD, chambers.gov.notR, chambers.gov.dS, chambers.gov.pD]] as const).map(([k, l, N, nd, nr, ds, pd]) => {
          const t = T[k]; const dNow = nd + t.d + t.ind, rNow = nr + t.r;
          return (
            <div className="mon-ch" key={k}>
              <div className="h"><b>{l}</b><span>Forecast D {ds.toFixed(1)} · {Math.round(pd * 100)}% control</span></div>
              <div className="bar" aria-hidden="true"><i className="d" style={{ width: `${(100 * dNow) / N}%` }} /><i className="r" style={{ width: `${(100 * rNow) / N}%`, marginLeft: "auto" }} /><span className="mid" /></div>
              <div className="n"><span className="d">D {dNow}</span><span>{t.inRet ? `${t.inRet} of ${t.n} reporting` : `${t.n} races, none reporting`}</span><span className="r">R {rNow}</span></div>
            </div>
          );
        })}
        <div className="mon-legend">
          {color === "versus" ? <><span>Returns bluer than forecast</span><i className="vs" /><span>Redder</span></> : mode === "measure" ? <><span>Yes</span><i className="ms" /><span>No</span></> : <><span>D +40</span><i className="mg" /><span>R +40</span></>}
        </div>
        <div className="mon-feed">
          <h3>// Feed</h3>
          {feed.length ? <ul>{feed.slice(0, 14).map((f, i) => <li key={i}><time>{f.t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}</time><Link href={resultsHref(f.id)}>{f.text}</Link></li>)}</ul>
            : <p>{anyLive ? "Returns are in. New counts, leader changes and calls appear here as each read lands." : "New returns, leader changes and calls show here as civicAPI reports them. Nothing has been counted yet."}</p>}
        </div>
      </aside>

      <aside className="mon-right" aria-label={sel ? `${STN[sel]} races` : "Closest races"}>
        {sel ? (
          <>
            <div className="mon-rh"><b>{STN[sel]}</b><button onClick={home}>Back to the country</button></div>
            {layerRace ? <p className="mon-note">Counties show the {layerRace.nm.replace(STN[sel] + " ", "")}{color === "forecast" ? " forecast" : color === "live" ? " returns" : " returns against the forecast"}. Hover a race below to map it.</p> : null}
            {(["sen", "gov", "house", "state", "measure", "leg", "other"] as Kind[]).map((k) => { const rs = selRaces.filter((r) => r.k === k); if (!rs.length) return null; return (
              <div key={k} className="mon-grp"><h3>{KIND_LABEL[k]} <em>{rs.length}</em></h3><ul>{rs.slice(0, k === "other" ? 8 : 60).map(raceRow)}</ul></div>
            ); })}
            <Link className="mon-all" href={`/results/2026?st=${sel}`}>Every {STN[sel]} race</Link>
          </>
        ) : (
          <>
            <div className="mon-rh"><b>Closest {MODES.find((m) => m[0] === mode)?.[1].toLowerCase()} races</b><span>Forecast · Live</span></div>
            <ul>{closest.map(raceRow)}</ul>
            <Link className="mon-all" href="/results/2026">All {ix?.races.length ?? ""} races</Link>
          </>
        )}
      </aside>

      <div className="mon-hud" aria-hidden="true">
        <span>{clock} ET</span><span>Zoom {zoomK.toFixed(1)}x</span><span>civicAPI · 30 second cache</span>
      </div>
      <div className="mon-zoom">
        <button onClick={() => zoomBy(1.5)} aria-label="Zoom in">+</button>
        <button onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom out">−</button>
        <button onClick={home} aria-label="Show the whole country" className="t">US</button>
        <button onClick={full} aria-label="Full screen" className="t">Full</button>
      </div>

      {hov ? (() => {
        const rs = byState[hov.st] ?? [];
        const cr = hov.f && layerRace ? layerRace : null;
        const e = cr ? expC?.[hov.f!] : null; const lv = cr ? liveC?.[hov.f!] : null;
        return (
          <div className="mon-tip" style={{ left: Math.min(hov.x + 16, (typeof window !== "undefined" ? window.innerWidth : 1600) - 300), top: Math.min(hov.y + 16, (typeof window !== "undefined" ? window.innerHeight : 900) - 220) }}>
            {cr && e ? (
              <>
                <h4>{sf?.names?.[hov.f!] ?? "County"} · {STN[hov.st]}</h4>
                <div>{cr.nm}</div>
                <div>Expected: <b>{fmtM(e[3] ? (100 * (e[1] - e[0])) / e[3] : null, cr.k)}</b> of {fmtK(e[3])} votes</div>
                <div>Returns: <b>{lv?.m != null ? `${fmtM(lv.m, cr.k)} · ${lv.pr.toFixed(0)}% in` : "none yet"}</b></div>
              </>
            ) : (
              <>
                <h4>{STN[hov.st]}</h4>
                {rs.length ? rs.slice(0, 6).map((r) => { const c = live.byId[r.id]; const lm = liveMargin(r, c); return <div key={r.id}>{r.k === "house" ? `${r.st}-${r.id.split("-")[2]}` : r.nm.replace(STN[r.st] + " ", "")}: <b>{fmtM(expMargin(r), r.k)}</b>{lm != null ? ` · live ${fmtM(lm, r.k)}` : ""}</div>; }) : <div>No {MODES.find((m) => m[0] === mode)?.[1].toLowerCase()} race here</div>}
                {rs.length > 6 ? <div>and {rs.length - 6} more</div> : null}
                <small>Click to zoom in</small>
              </>
            )}
          </div>
        );
      })() : null}
      <noscript><p>Turn on JavaScript to use the monitor. <Link href="/results/2026">Every race as a list</Link>.</p></noscript>
    </div>
  );
}
