"use client";
// The situation monitor: the election night desk for every November 3 race on one globe you can grab and turn.
// States and counties are coloured by the returns civicAPI reports, or by how far the returns run from the expected
// vote. Click a state to fly in and see its counties; click any race to open its full results desk, with the
// reported results, the live win probability, the estimate of the final count and the county table.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { geoOrthographic, geoPath, geoGraticule10, geoContains, geoCentroid, geoDistance, geoBounds, geoArea, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { marginColor, marginColorInd } from "@/app/lib/opp";
import { STN, KIND_LABEL, FIRST_CLOSE, fmtM, isInd, sides, expSides, type CRace, type CCand, type Kind, type XRace, type Exp } from "../2026/live";
import { useIndex, useLive, useStateFile } from "../2026/useLive";
import NightDesk from "../2026/NightDesk";
import FloatTip from "@/app/components/opp/FloatTip";
import RaceBrief from "./RaceBrief";
import { useSiteTheme } from "@/app/lib/useSiteTheme";

const FIPS: Record<string, string> = { "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY" };
type SF = Feature<Geometry, { name: string }> & { st: string };
type Mode = "sen" | "gov" | "house" | "state" | "measure" | "leg";
type Color = "results" | "versus";
const MODES: [Mode, string][] = [["sen", "Senate"], ["gov", "Governors"], ["house", "House"], ["state", "Statewide"], ["measure", "Measures"], ["leg", "Legislatures"]];
const SETS: Record<Mode, ("fed" | "leg" | "ballot" | "state")[]> = { sen: ["fed"], gov: ["fed"], house: ["fed"], state: ["fed", "state"], measure: ["fed", "ballot"], leg: ["fed", "leg"] };
export type Chambers = { sen: { notD: number; notR: number; dS: number; pD: number }; house: { dS: number; pD: number }; gov: { notD: number; notR: number; dS: number; pD: number } };
type Feed = { t: Date; id: string; text: string };
const NO_RACE = "#16122a", AWAIT = "#2c2547";

const hasReturns = (c?: CRace) => !!c && (c.pr > 0 || c.c.some((x) => x[2] > 0));
const liveMargin = (r: XRace, c: CRace | undefined) => { if (!c) return null; const s = sides(r, c.c); return s.t > 0 ? (100 * (s.b - s.a)) / s.t : null; };
const expM = (r: XRace) => (r.k === "measure" ? (r.yes != null ? 100 - 2 * r.yes : null) : r.m ?? null);
const vsColor = (d: number) => { const a = Math.min(1, Math.abs(d) / 12); return d < 0 ? `rgba(61,123,255,${0.15 + a * 0.8})` : `rgba(255,59,92,${0.15 + a * 0.8})`; };
// results colour: purple where an independent leads the Republican, as on every forecast map
const shade = (m: number, k?: Kind, ind = false) => (k === "measure" ? (m < 0 ? `rgba(47,191,155,${0.25 + Math.min(1, -m / 40) * 0.7})` : `rgba(231,121,74,${0.25 + Math.min(1, m / 40) * 0.7})`) : ind ? marginColorInd(m) : marginColor(m));
const label = (r: XRace, inState: boolean) => (r.k === "house" ? `${r.st}-${r.id.split("-")[2]}` : inState ? r.nm.replace(STN[r.st] + " ", "") : r.nm);
const clockET = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

export default function Monitor({ chambers }: { chambers: Chambers }) {
  const ix = useIndex();
  const [mode, setMode] = useState<Mode>("sen");
  const [color, setColor] = useState<Color>("results");
  const [sel, setSel] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [desk, setDesk] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ land: Feature<Geometry>; states: SF[] } | null>(null);
  const [cll, setCll] = useState<Record<string, number[][][]> | null>(null);
  const [hov, setHov] = useState<{ st: string; f?: string; d?: string; x: number; y: number } | null>(null);
  const hovRef = useRef<{ st: string; f?: string; d?: string } | null>(null);
  const theme = useSiteTheme();
  const [dll, setDll] = useState<Record<string, number[][][]> | null>(null);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [zoomK, setZoomK] = useState(2.2);
  const live = useLive(ix, SETS[mode]);
  const sf = useStateFile(sel);
  const stage = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const view = useRef({ rot: [97, -39, 0] as [number, number, number], k: 2.2, target: null as null | { rot: [number, number, number]; k: number } });
  const deskOpen = useRef(false);
  useEffect(() => { deskOpen.current = !!desk; }, [desk]);
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
  useEffect(() => { if (sel && !cll) fetch("/results/2026/counties_ll.json").then((r) => r.json()).then(setCll).catch(() => {}); }, [sel, cll]);
  // House districts, the forecast's district map turned into longitude and latitude
  useEffect(() => { if (mode === "house" && !dll) fetch("/results/2026/districts_ll.json").then((r) => r.json()).then(setDll).catch(() => {}); }, [mode, dll]);
  const dGeo = useMemo(() => !dll ? [] : Object.entries(dll).map(([id, rings]) => {
    const g = { type: "MultiPolygon", coordinates: rings.map((r) => [r]) } as unknown as GeoPermissibleObjects;
    return { id, st: id.split("-")[1], g, c: geoCentroid(g) as [number, number] };
  }), [dll]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") setDesk(null); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  const races = useMemo(() => (ix?.races ?? []).filter((r) => r.k === mode), [ix, mode]);
  const byState = useMemo(() => { const m: Record<string, XRace[]> = {}; for (const r of races) (m[r.st] ??= []).push(r); return m; }, [races]);
  // one colour per state: the returns in the mode's races there, or how far they run from the expected vote
  const stateColor = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [st, rs] of Object.entries(byState)) {
      const rep = rs.filter((r) => hasReturns(live.byId[r.id]));
      if (!rep.length) { out[st] = AWAIT; continue; }
      const w = (r: XRace) => (r.k === "house" ? 1 : r.tot || 1);
      const l = rep.reduce((s, r) => s + (liveMargin(r, live.byId[r.id]) ?? 0) * w(r), 0) / rep.reduce((s, r) => s + w(r), 0);
      const lm = mode === "house" ? (100 * (rep.filter((r) => (liveMargin(r, live.byId[r.id]) ?? 0) > 0).length - rep.filter((r) => (liveMargin(r, live.byId[r.id]) ?? 0) < 0).length)) / rep.length : l;
      const e = rep.reduce((s, r) => s + (expM(r) ?? 0) * w(r), 0) / rep.reduce((s, r) => s + w(r), 0);
      const ind = rep.length === 1 && isInd(rep[0]);
      out[st] = color === "results" ? shade(lm, mode === "measure" ? "measure" : undefined, ind) : vsColor(l - e);
    }
    return out;
  }, [byState, live.byId, color, mode]);
  const districtColor = useMemo(() => {
    const out: Record<string, { fill: string; a: number }> = {};
    if (mode !== "house") return out;
    for (const r of races) {
      const c = live.byId[r.id];
      if (!hasReturns(c)) { out[r.id] = { fill: AWAIT, a: 1 }; continue; }
      const m = liveMargin(r, c) ?? 0, e = expM(r);
      out[r.id] = { fill: color === "results" ? shade(m, undefined, isInd(r)) : e != null ? vsColor(m - e) : AWAIT, a: 0.45 + 0.55 * Math.min(1, (c!.pr || 0) / 100) };
    }
    return out;
  }, [mode, races, live.byId, color]);
  const selRaces = useMemo(() => (sel ? (ix?.races ?? []).filter((r) => r.st === sel) : []), [ix, sel]);
  const layerRace = useMemo(() => {
    if (!sel) return null;
    const cands = selRaces.filter((r) => r.cty);
    return cands.find((r) => r.id === pick) ?? cands.find((r) => r.k === mode) ?? cands.find((r) => r.k === "sen") ?? cands.find((r) => r.k === "gov") ?? cands[0] ?? null;
  }, [sel, selRaces, pick, mode]);
  // the race shown in brief in the side panel: the state's race for this view when a state is picked
  useEffect(() => {
    // keep a race picked in this state, such as a clicked district; otherwise show the state's race for this view
    const all = ix?.races ?? [];
    setFocus((f) => { const cur = f ? all.find((x) => x.id === f) : null; if (cur && cur.st === sel && cur.k === mode) return f; const r = sel ? all.find((x) => x.st === sel && x.k === mode) : null; return r ? r.id : null; });
  }, [sel, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const focusRace = useMemo(() => (focus ? (ix?.races ?? []).find((r) => r.id === focus) ?? null : null), [ix, focus]);
  const expC: Record<string, Exp> | null = layerRace && sf ? sf.counties[layerRace.id] ?? null : null;
  const [liveC, setLiveC] = useState<Record<string, { m: number | null; pr: number; c: CCand[] }> | null>(null);
  useEffect(() => {
    setLiveC(null); if (!layerRace) return;
    const c = live.byId[layerRace.id]; if (!hasReturns(c)) return;
    let dead = false;
    import("../2026/live").then(({ civicRace }) => civicRace(c!.id)).then((d) => {
      if (dead) return; const o: Record<string, { m: number | null; pr: number; c: CCand[] }> = {};
      for (const [f, g] of Object.entries(d.regions)) { const s = sides(layerRace, g.c); o[f] = { m: s.t ? (100 * (s.b - s.a)) / s.t : null, pr: g.pr, c: g.c }; }
      setLiveC(o);
    }).catch(() => {});
    return () => { dead = true; };
  }, [layerRace, live.at, live.byId]);

  const calledSt = useMemo(() => new Set(races.filter((r) => live.byId[r.id]?.c.some((c) => c[4])).map((r) => r.st)), [races, live.byId]);
  const sweepOn = useMemo(() => Object.values(live.byId).some((c) => hasReturns(c)), [live.byId]);
  const votesIn = useMemo(() => races.reduce((s, r) => { const c = live.byId[r.id]; return s + (c ? c.c.reduce((a, x) => a + x[2], 0) : 0); }, 0), [races, live.byId]);
  // the share of this view's races reporting, read by read, for the sparkline
  const [hist, setHist] = useState<number[]>([]);
  useEffect(() => { if (!live.at || !races.length) return; const rep = races.filter((r) => hasReturns(live.byId[r.id])).length / races.length; setHist((h) => [...h.slice(-39), rep]); }, [live.at]); // eslint-disable-line react-hooks/exhaustive-deps
  // a banner for each new call
  const [toast, setToast] = useState<{ id: string; who: string; race: string } | null>(null);
  useEffect(() => {
    if (!live.at || !ix) return;
    for (const r of ix.races) { const a = live.byId[r.id], b = live.prev[r.id]; const w = a?.c.find((c) => c[4]); if (w && b && !b.c.some((c) => c[4]) && (r.k === "sen" || r.k === "gov" || r.k === "house")) { setToast({ id: r.id, who: w[0], race: r.nm }); const t = window.setTimeout(() => setToast(null), 7000); return () => window.clearTimeout(t); } }
  }, [live.at]); // eslint-disable-line react-hooks/exhaustive-deps
  // what changed between reads
  useEffect(() => {
    if (!live.at || !ix) return;
    const items: Feed[] = [];
    for (const r of ix.races) {
      const a = live.byId[r.id], b = live.prev[r.id]; if (!a) continue;
      const s = sides(r, a.c);
      if (b && a.pr > b.pr) items.push({ t: live.at, id: r.id, text: `${r.nm}: ${a.pr.toFixed(0)}% reporting, ${fmtM(s.t ? (100 * (s.b - s.a)) / s.t : null, r.k, isInd(r))}` });
      if (a.c.some((c) => c[4]) && !(b?.c.some((c) => c[4]))) { const w = a.c.find((c) => c[4]); if (w) items.push({ t: live.at, id: r.id, text: `${r.nm}: civicAPI calls it for ${w[0]}` }); }
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
    // each county as its own polygons; any ring that reads as the rest of the globe is turned around
    const cGeo = sel && cll ? Object.entries(cll).filter(([f]) => FIPS[f.slice(0, 2)] === sel).map(([f, rings]) => ({
      f, g: { type: "MultiPolygon", coordinates: rings.map((r) => [geoArea({ type: "Polygon", coordinates: [r] } as GeoPermissibleObjects) > 2 * Math.PI ? [...r].reverse() : r]) } as unknown as GeoPermissibleObjects,
    })) : [];
    // the globe by night, or by day in the light theme
    const LT = theme === "light";
    const fx = (c: string) => (!LT ? c : c === AWAIT ? "#d8d2ea" : c === NO_RACE ? "#ebe8f3" : c);
    const GOLD = LT ? "176,122,0" : "255,217,138";
    const draw = () => {
      const v = view.current;
      if (v.target) {
        const t = v.target; v.rot = v.rot.map((x, i) => x + (t.rot[i] - x) * 0.14) as [number, number, number]; v.k += (t.k - v.k) * 0.14;
        if (Math.abs(v.k - t.k) < 0.002 && v.rot.every((x, i) => Math.abs(x - t.rot[i]) < 0.02)) v.target = null;
      }
      // with a race desk open on the right, the globe centres in the space left of it
      const dw = deskOpen.current && W > 1100 ? Math.min(1180, W * 0.64) : 0;
      proj.rotate(v.rot).scale(base * v.k).translate([(W - dw) / 2, H / 2]);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const R = proj.scale(), [cx, cy] = proj.translate();
      const atm = ctx.createRadialGradient(cx, cy, R * 0.94, cx, cy, R * 1.1); atm.addColorStop(0, LT ? "rgba(120,90,255,.2)" : "rgba(120,90,255,.32)"); atm.addColorStop(1, "rgba(120,90,255,0)");
      ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, R * 1.1, 0, 6.283); ctx.fill();
      const sea = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R); sea.addColorStop(0, LT ? "#f3f1fb" : "#17113a"); sea.addColorStop(1, LT ? "#cbc5e4" : "#06040e");
      ctx.fillStyle = sea; ctx.beginPath(); path({ type: "Sphere" }); ctx.fill();
      ctx.strokeStyle = LT ? "rgba(60,40,140,.09)" : "rgba(170,150,255,.09)"; ctx.lineWidth = 1; ctx.beginPath(); path(grat); ctx.stroke();
      ctx.fillStyle = LT ? "#e6e2f2" : "#1a1530"; ctx.beginPath(); path(geo.land as GeoPermissibleObjects); ctx.fill();
      const hv = hovRef.current;
      for (const f of geo.states) {
        ctx.beginPath(); path(f as GeoPermissibleObjects);
        ctx.fillStyle = fx(stateColor[f.st] ?? NO_RACE); ctx.globalAlpha = sel && sel !== f.st ? 0.45 : 1; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = hv?.st === f.st && !hv.f ? (LT ? "#110019" : "#fff") : LT ? "rgba(255,255,255,.95)" : "rgba(8,5,16,.9)"; ctx.lineWidth = hv?.st === f.st && !hv.f ? 2 : 0.7; ctx.stroke();
      }
      if (mode === "house" && dGeo.length) {
        for (const x of dGeo) {
          if (geoDistance(x.c, [-v.rot[0], -v.rot[1]]) > 1.6) continue;
          const dc = districtColor[x.id] ?? { fill: NO_RACE, a: 1 };
          ctx.beginPath(); path(x.g); ctx.fillStyle = fx(dc.fill); ctx.globalAlpha = (sel && sel !== x.st ? 0.5 : 1) * dc.a; ctx.fill(); ctx.globalAlpha = 1;
          ctx.strokeStyle = hv?.d === x.id ? (LT ? "#110019" : "#fff") : LT ? "rgba(255,255,255,.85)" : "rgba(8,5,16,.75)"; ctx.lineWidth = hv?.d === x.id ? 2 : v.k > 5 ? 0.8 : 0.45; ctx.stroke();
        }
        ctx.strokeStyle = LT ? "rgba(17,0,25,.4)" : "rgba(255,255,255,.38)"; ctx.lineWidth = 1;
        for (const f of geo.states) { ctx.beginPath(); path(f as GeoPermissibleObjects); ctx.stroke(); }
        if (v.k >= 4) {
          ctx.font = "700 10px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          for (const x of dGeo) {
            if (geoDistance(x.c, [-v.rot[0], -v.rot[1]]) > 1.3) continue; const b = path.bounds(x.g); if (b[1][0] - b[0][0] < 26 || b[1][1] - b[0][1] < 16) continue;
            const pt = proj(x.c); if (!pt) continue; const c = live.byId[x.id]; const n = x.id.split("-")[2];
            ctx.fillStyle = LT ? "rgba(17,0,25,.85)" : "rgba(255,255,255,.92)"; ctx.fillText(n === "01" && !(byState[x.st]?.length > 1) ? "AL" : n.replace(/^0/, ""), pt[0], pt[1] - (hasReturns(c) ? 6 : 0));
            if (hasReturns(c)) { ctx.fillStyle = LT ? "rgba(17,0,25,.6)" : "rgba(255,255,255,.7)"; ctx.fillText(`${Math.round(c!.pr)}%`, pt[0], pt[1] + 6); }
          }
        }
      }
      if (mode !== "house" && cGeo.length && layerRace) {
        const ind = isInd(layerRace);
        for (const x of cGeo) {
          const e = expC?.[x.f]; const lv = liveC?.[x.f];
          const em = e && e[3] ? (100 * (e[1] - e[0])) / e[3] : null;
          const fill = lv?.m != null ? (color === "results" ? shade(lv.m, layerRace.k, ind) : em != null ? vsColor(lv.m - em) : AWAIT) : AWAIT;
          ctx.beginPath(); path(x.g); ctx.fillStyle = fx(fill); ctx.globalAlpha = lv?.m != null ? 0.4 + 0.6 * Math.min(1, lv.pr / 100) : 1; ctx.fill(); ctx.globalAlpha = 1;
          ctx.strokeStyle = hv?.f === x.f ? (LT ? "#110019" : "#fff") : LT ? "rgba(255,255,255,.9)" : "rgba(8,5,16,.8)"; ctx.lineWidth = hv?.f === x.f ? 1.8 : 0.5; ctx.stroke();
        }
      }
      if (stSel) { ctx.beginPath(); path(stSel as GeoPermissibleObjects); ctx.strokeStyle = `rgb(${GOLD})`; ctx.lineWidth = 2.2; ctx.stroke(); }
      // states whose race civicAPI has called glow gold, breathing slowly
      const breathe = 0.45 + 0.35 * Math.sin(performance.now() / 700);
      for (const f of geo.states) {
        if (!calledSt.has(f.st)) continue; ctx.beginPath(); path(f as GeoPermissibleObjects);
        ctx.strokeStyle = `rgba(${GOLD},${breathe})`; ctx.lineWidth = 2.6; ctx.shadowColor = `rgba(${GOLD},.8)`; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
      }
      // a radar sweep across the globe while votes are being counted
      if (sweepOn && !reduce) {
        const a = (performance.now() / 2600) % (Math.PI * 2);
        const g = ctx.createConicGradient ? ctx.createConicGradient(a, cx, cy) : null;
        if (g) { g.addColorStop(0, "rgba(140,110,255,.16)"); g.addColorStop(0.06, "rgba(140,110,255,0)"); g.addColorStop(1, "rgba(140,110,255,0)"); ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R); ctx.restore(); }
        ctx.strokeStyle = LT ? "rgba(90,60,200,.25)" : "rgba(160,140,255,.18)"; ctx.setLineDash([2, 6]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
      }
      const fresh = new Set(feed.filter((x) => live.at && x.t.getTime() === live.at.getTime()).map((x) => x.id.split("-")[1]));
      const tt = performance.now();
      for (const f of geo.states) {
        if (!fresh.has(f.st)) continue; const ll = geoCentroid(f as GeoPermissibleObjects) as [number, number];
        if (geoDistance(ll, [-v.rot[0], -v.rot[1]]) > 1.4) continue; const p = proj(ll); if (!p) continue;
        const ph = (tt / 1600) % 1; ctx.strokeStyle = `rgba(${GOLD},${1 - ph})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 6 + ph * 30, 0, 6.283); ctx.stroke();
      }
      ctx.font = "700 10.5px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = LT ? "rgba(17,0,25,.78)" : "rgba(255,255,255,.86)";
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
      if (v.k < (mode === "house" ? 4 : 4.5)) for (const f of geo.states) {
        const ll = geoCentroid(f as GeoPermissibleObjects) as [number, number]; if (geoDistance(ll, [-v.rot[0], -v.rot[1]]) > 1.35) continue;
        const b = path.bounds(f as GeoPermissibleObjects); if (b[1][0] - b[0][0] < 30) continue; const p = proj(ll); if (p) { if (LT) ctx.strokeText(f.st, p[0], p[1]); ctx.fillText(f.st, p[0], p[1]); }
      }
      if (!reduce || v.target) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => size()); ro.observe(box);
    const hit = (x: number, y: number) => {
      const ll = proj.invert?.([x, y]); if (!ll || geoDistance(ll, [-view.current.rot[0], -view.current.rot[1]]) > 1.57) return null;
      const s = geo.states.find((f) => geoContains(f as GeoPermissibleObjects, ll)); if (!s) return null;
      if (mode === "house") { const d = dGeo.find((x) => x.st === s.st && geoContains(x.g, ll)); return { st: s.st, d: d?.id }; }
      const co = s.st === sel ? cGeo.find((x) => geoContains(x.g, ll)) : undefined;
      return { st: s.st, f: co?.f };
    };
    const down = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, r: [...view.current.rot] as [number, number, number], moved: false }; view.current.target = null; box.setPointerCapture?.(e.pointerId); };
    const move = (e: PointerEvent) => {
      const b = box.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, d = drag.current;
      if (d) { const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true; const k = 70 / proj.scale(); view.current.rot = [d.r[0] + dx * k, Math.max(-85, Math.min(85, d.r[1] - dy * k)), 0]; if (reduce) draw(); return; }
      const h = hit(x, y); hovRef.current = h; setHov(h ? { ...h, x: e.clientX, y: e.clientY } : null); box.style.cursor = h ? "pointer" : "grab";
    };
    const up = (e: PointerEvent) => {
      const d = drag.current; drag.current = null; if (d?.moved) return;
      const b = box.getBoundingClientRect(); const h = hit(e.clientX - b.left, e.clientY - b.top);
      if (!h) return;
      if (h.d) setFocus(h.d);
      else if (h.st === sel && layerRace) { setFocus(layerRace.id); return; }
      if (h.d && h.st === sel) return; // a second click on the state opens its race desk
      const f = geo.states.find((s) => s.st === h.st)!; const bb = geoBounds(f as GeoPermissibleObjects); const ll = geoCentroid(f as GeoPermissibleObjects);
      const span = Math.max(bb[1][0] - bb[0][0], (bb[1][1] - bb[0][1]) * 1.4, 3);
      view.current.target = { rot: [-ll[0], -ll[1], 0], k: Math.max(1.6, Math.min(14, 60 / span)) }; setZoomK(view.current.target.k);
      setSel(h.st); setPick(null); if (reduce) draw(); else { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); const k = Math.max(0.7, Math.min(16, view.current.k * Math.exp(-e.deltaY * 0.0015))); view.current.k = k; view.current.target = null; setZoomK(k); if (reduce) draw(); };
    const leave = () => { hovRef.current = null; setHov(null); };
    box.addEventListener("pointerdown", down); box.addEventListener("pointermove", move); box.addEventListener("pointerup", up); box.addEventListener("wheel", wheel, { passive: false }); box.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); box.removeEventListener("pointerdown", down); box.removeEventListener("pointermove", move); box.removeEventListener("pointerup", up); box.removeEventListener("wheel", wheel); box.removeEventListener("pointerleave", leave); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, stateColor, sel, cll, expC, liveC, color, layerRace, feed, live.at, mode, dGeo, districtColor, byState, calledSt, sweepOn, theme]);

  const home = () => { view.current.target = { rot: [97, -39, 0], k: 2.2 }; setZoomK(2.2); setSel(null); setPick(null); };
  const zoomBy = (f: number) => { const k = Math.max(0.7, Math.min(16, view.current.k * f)); view.current.target = { rot: [...view.current.rot] as [number, number, number], k }; setZoomK(k); };
  const full = () => { const el = stage.current?.parentElement; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.().catch(() => {}); };

  // chambers from the returns: seats not up, races civicAPI has called, races being counted
  const tally = (k: "sen" | "gov" | "house") => {
    const rs = (ix?.races ?? []).filter((r) => r.k === k); let cD = 0, cR = 0, lD = 0, lR = 0, counting = 0;
    for (const x of rs) {
      const c = live.byId[x.id]; if (!hasReturns(c)) continue; counting++;
      const w = c!.c.find((y) => y[4]); const m = liveMargin(x, c);
      if (w) { const p = w[1].toLowerCase(); if (p.startsWith("rep")) cR++; else cD++; } else if (m != null) { if (m < 0) lD++; else lR++; }
    }
    return { cD, cR, lD, lR, counting, n: rs.length };
  };
  const T = { sen: tally("sen"), house: tally("house"), gov: tally("gov") };
  const anyLive = T.sen.counting + T.house.counting + T.gov.counting > 0;
  const reportingNow = useMemo(() => races.filter((r) => hasReturns(live.byId[r.id])).sort((a, b) => Math.abs(liveMargin(a, live.byId[a.id]) ?? 99) - Math.abs(liveMargin(b, live.byId[b.id]) ?? 99)), [races, live.byId]);
  const left = now ? FIRST_CLOSE - now.getTime() : 0;
  const clock = now ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "America/New_York" }) : "";

  const raceRow = (r: XRace, inState: boolean) => {
    const c = live.byId[r.id]; const lm = liveMargin(r, c); const w = c?.c.find((x) => x[4]);
    return (
      <li key={r.id}>
        <button type="button" className={`mon-row${focus === r.id ? " on" : ""}`} onClick={() => setFocus(focus === r.id ? null : r.id)} onDoubleClick={() => setDesk(r.id)} onMouseEnter={() => r.cty && setPick(r.id)}>
          <span className="nm">{label(r, inState)}</span>
          <span className={`lv ${lm == null ? "" : lm < 0 ? (isInd(r) ? "i" : "d") : "r"}`}>{!c ? "Not linked" : lm == null ? "No returns" : fmtM(lm, r.k, isInd(r))}</span>
          <span className="pr">{w ? "Called" : c && hasReturns(c) ? `${c.pr.toFixed(0)}% in` : ""}</span>
        </button>
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
          <h1>Election night, <em>as it comes in.</em></h1>
          <p>{live.loading ? "Connecting to civicAPI" : live.error ? live.error : anyLive ? `${T.sen.counting + T.gov.counting + T.house.counting} federal and governor races counting · last read ${live.at ? clockET(live.at) : ""} ET` : left > 0 ? `${Object.keys(live.byId).length} races linked to civicAPI · first polls close in ${Math.floor(left / 86400000)}d ${Math.floor((left % 86400000) / 3600000)}h` : "Polls are closing. Returns appear as they land."}</p>
          {live.test && live.hidden > 0 ? <p className="mon-test">civicAPI is publishing test returns before Election Day; they are hidden. <a href="?test=1">Preview with test returns</a></p> : null}
          {live.test && live.hidden === 0 && anyLive ? <p className="mon-test">Showing civicAPI test returns for preview. These are not real votes. <a href="?">Hide them</a></p> : null}
        </div>
        <div className="mon-seg" role="group" aria-label="Races">{MODES.map(([k, l]) => <button key={k} aria-pressed={mode === k} onClick={() => { setMode(k); setPick(null); }}>{l}</button>)}</div>
        <div className="mon-seg sm" role="group" aria-label="Colour by">{(["results", "versus"] as Color[]).map((k) => <button key={k} aria-pressed={color === k} onClick={() => setColor(k)}>{k === "results" ? "Results" : "Versus expected vote"}</button>)}</div>
      </section>

      <aside className="mon-left" aria-label="Chambers">
        {([["sen", "Senate", 100, chambers.sen.notD, chambers.sen.notR], ["house", "House", 435, 0, 0], ["gov", "Governors", 50, chambers.gov.notD, chambers.gov.notR]] as const).map(([k, l, N, nd, nr]) => {
          const t = T[k]; const dW = nd + t.cD, rW = nr + t.cR;
          return (
            <div className="mon-ch" key={k}>
              <div className="h"><b>{l}</b><span>{t.cD + t.cR} of {t.n} called · {t.counting} counting</span></div>
              <div className="bar" aria-hidden="true">
                <i className="d" style={{ width: `${(100 * dW) / N}%` }} /><i className="d lead" style={{ width: `${(100 * t.lD) / N}%` }} />
                <span className="gap" />
                <i className="r lead" style={{ width: `${(100 * t.lR) / N}%` }} /><i className="r" style={{ width: `${(100 * rW) / N}%` }} /><span className="mid" />
              </div>
              <div className="n"><span className="d">D {dW}{t.lD ? ` + ${t.lD} leading` : ""}</span><span className="r">{t.lR ? `${t.lR} leading + ` : ""}R {rW}</span></div>
            </div>
          );
        })}
        <div className="mon-legend">
          {color === "versus" ? <><span>Bluer than expected</span><i className="vs" /><span>Redder</span></> : mode === "measure" ? <><span>Yes</span><i className="ms" /><span>No</span></> : <><span>D +40</span><i className="mg" /><span>R +40</span></>}
        </div>
        <div className="mon-feed">
          <h3>// Feed</h3>
          {feed.length ? <ul>{feed.slice(0, 14).map((f, i) => <li key={i}><time>{clockET(f.t)}</time><button type="button" onClick={() => setFocus(f.id)}>{f.text}</button></li>)}</ul>
            : <p>{anyLive ? "Returns are in. New counts and calls appear here as each read lands." : "New counts and calls appear here as civicAPI reports them. Nothing has been counted yet."}</p>}
        </div>
      </aside>

      <aside className="mon-right" aria-label={sel ? `${STN[sel]} races` : "Races reporting"}>
        {focusRace ? <RaceBrief key={focusRace.id} r={focusRace} c={live.byId[focusRace.id]} sf={focusRace.st === sel ? sf : null} at={live.at} onOpen={() => setDesk(focusRace.id)} onClose={() => setFocus(null)} /> : null}
        {sel ? (
          <>
            <div className="mon-rh"><b>{STN[sel]}</b><button onClick={home}>Back to the country</button></div>
            <p className="mon-note">{layerRace ? `Counties show the ${label(layerRace, true)} ${color === "results" ? "returns" : "returns against the expected vote"}. ` : ""}Click any race to see it here; open the full desk from it.</p>
            {(["sen", "gov", "house", "state", "measure", "leg", "other"] as Kind[]).map((k) => { const rs = selRaces.filter((r) => r.k === k); if (!rs.length) return null; return (
              <div key={k} className="mon-grp"><h3>{KIND_LABEL[k]} <em>{rs.length}</em></h3><ul>{rs.slice(0, k === "other" ? 8 : 60).map((r) => raceRow(r, true))}</ul></div>
            ); })}
          </>
        ) : (
          <>
            <div className="mon-rh"><b>{reportingNow.length ? `${MODES.find((m) => m[0] === mode)?.[1]} races counting` : `${MODES.find((m) => m[0] === mode)?.[1]} races`}</b><span>Returns · in</span></div>
            {!reportingNow.length ? <p className="mon-note">No returns yet. {races.length} races are linked; each fills in as its first votes are counted. Click a state or a race to open its results desk.</p> : null}
            <ul>{(reportingNow.length ? reportingNow : races.slice().sort((a, b) => a.nm.localeCompare(b.nm))).slice(0, 80).map((r) => raceRow(r, false))}</ul>
            <Link className="mon-all" href="/results/2026">Every race as a list</Link>
          </>
        )}
      </aside>

      <div className="mon-hud" aria-hidden="true"><span className="vin"><i />{votesIn ? <><CountUp v={votesIn} /> votes in</> : "awaiting votes"}</span>{hist.length > 1 ? <svg className="spark" viewBox="0 0 80 18" preserveAspectRatio="none"><polyline points={hist.map((v, i) => `${(80 * i) / Math.max(1, hist.length - 1)},${17 - 16 * v}`).join(" ")} /></svg> : null}<span>{clock} ET</span><span>Zoom {zoomK.toFixed(1)}x</span><span>civicAPI · 30 second cache</span></div>
      <div className="mon-zoom">
        <button onClick={() => zoomBy(1.5)} aria-label="Zoom in">+</button>
        <button onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom out">−</button>
        <button onClick={home} aria-label="Show the whole country" className="t">US</button>
        <button onClick={full} aria-label="Full screen" className="t">Full</button>
      </div>

      {toast ? (
        <button type="button" className="mon-toast" onClick={() => { setFocus(toast.id); setToast(null); }}>
          <span className="k">civicAPI call</span><b>{toast.race}</b><span className="w">{toast.who}</span>
        </button>
      ) : null}
      {hov ? (() => {
        const rs = byState[hov.st] ?? [];
        const cr = hov.f && layerRace ? layerRace : null;
        const e = cr ? expC?.[hov.f!] : null; const lv = cr ? liveC?.[hov.f!] : null;
        const dr = hov.d ? races.find((r) => r.id === hov.d) : null;
        return (
          <FloatTip x={hov.x} y={hov.y} className="mon-tip" scope="opp">
            {dr ? <RaceTip r={dr} c={live.byId[dr.id]} title={`${STN[dr.st]} ${(byState[dr.st]?.length ?? 0) > 1 ? `District ${Number(dr.id.split("-")[2])}` : "at large"}`} hint="Click to see it beside the globe" />
            : cr ? (
              <>
                <h4>{sf?.names?.[hov.f!] ?? "County"} · {STN[hov.st]}</h4>
                <div className="sub">{cr.nm}</div>
                <Cands r={cr} c={lv?.c ?? null} exp={e ? [["D", e[0]], ["R", e[1]], ["O", e[2]]] : null} />
                <div className="meta"><span>{lv ? `${lv.pr.toFixed(0)}% reporting` : "No returns yet"}</span>{e ? <span>Expected {Math.round(e[3]).toLocaleString("en-US")} votes</span> : null}</div>
                <small>Click to see the race beside the globe</small>
              </>
            ) : rs.length === 1 ? <RaceTip r={rs[0]} c={live.byId[rs[0].id]} title={STN[hov.st]} hint={hov.st === sel ? "Click to see it beside the globe" : "Click to zoom in and see it beside the globe"} />
            : (
              <>
                <h4>{STN[hov.st]}</h4>
                {rs.length ? rs.slice(0, 5).map((r) => { const c = live.byId[r.id]; const lm = liveMargin(r, c); return <div key={r.id} className="row"><span>{label(r, true)}</span><b>{lm != null ? `${fmtM(lm, r.k, isInd(r))} · ${c!.pr.toFixed(0)}% in` : `Expected ${fmtM(expM(r), r.k, isInd(r))}`}</b></div>; }) : <div>No {MODES.find((m) => m[0] === mode)?.[1].toLowerCase()} race here</div>}
                {rs.length > 5 ? <div className="sub">and {rs.length - 5} more</div> : null}
                <small>{hov.st === sel ? "Click a race in the list to see it" : "Click to zoom in"}</small>
              </>
            )}
          </FloatTip>
        );
      })() : null}

      {desk ? (
        <div className="mon-desk" role="dialog" aria-modal="true" aria-label="Race results desk">
          <NightDesk id={desk} embedded onClose={() => setDesk(null)} />
        </div>
      ) : null}
      <noscript><p>Turn on JavaScript to use the monitor. <Link href="/results/2026">Every race as a list</Link>.</p></noscript>
    </div>
  );
}

/** Candidate rows: the counted vote where there is one, else the expected vote. */
function Cands({ r, c, exp }: { r: XRace; c: CCand[] | null; exp?: [string, number][] | null }) {
  const counted = c && c.some((x) => x[2] > 0);
  if (counted) {
    const t = c!.reduce((s, x) => s + x[2], 0) || 1;
    return <table className="mon-tc"><tbody>{[...c!].sort((a, b) => b[2] - a[2]).slice(0, 4).map((x) => (
      <tr key={x[0]}><td><i className={`p p-${(x[1] || "O")[0].toUpperCase()}`} />{x[0]}{x[4] ? <em>Winner</em> : null}</td><td>{x[2].toLocaleString("en-US")}</td><td>{((100 * x[2]) / t).toFixed(1)}%</td></tr>
    ))}</tbody></table>;
  }
  const rows: [string, string, number][] = exp ? exp.map(([p, v]) => [p === "D" ? (r.c?.find((x) => x[1] === "D" || (isInd(r) && x[1] === "I"))?.[0] ?? "Democrat") : p === "R" ? (r.c?.find((x) => x[1] === "R")?.[0] ?? "Republican") : "Others", p, v] as [string, string, number]).filter((x) => x[2] > 0) : (r.c ?? []);
  const t = rows.reduce((s, x) => s + x[2], 0) || 1;
  return <table className="mon-tc exp"><thead><tr><th>Expected</th><th>Votes</th><th>Share</th></tr></thead><tbody>{rows.slice(0, 4).map((x) => (
    <tr key={x[0]}><td><i className={`p p-${x[1][0]}`} />{x[0]}</td><td>{Math.round(x[2]).toLocaleString("en-US")}</td><td>{((100 * x[2]) / t).toFixed(1)}%</td></tr>
  ))}</tbody></table>;
}

/** One race at the cursor: who leads, the counted vote, the share reporting and how it compares with the forecast. */
function RaceTip({ r, c, title, hint }: { r: XRace; c?: CRace; title: string; hint: string }) {
  const counted = !!c && (c.pr > 0 || c.c.some((x) => x[2] > 0));
  const s = c ? sides(r, c.c) : null; const lm = s && s.t ? (100 * (s.b - s.a)) / s.t : null;
  const w = c?.c.find((x) => x[4]); const e = expM(r); const ex = expSides(r);
  return (
    <>
      <h4>{title}</h4>
      <div className="sub">{r.nm}{w ? <b className="call"> · civicAPI call: {w[0]}</b> : null}</div>
      <Cands r={r} c={counted ? c!.c : null} />
      <div className="meta">
        <span>{counted ? `${c!.pr.toFixed(0)}% reporting` : c ? "No returns yet" : "Not linked to civicAPI yet"}</span>
        {counted && s ? <span>{s.t.toLocaleString("en-US")} votes counted{ex.t ? ` of about ${Math.round(ex.t).toLocaleString("en-US")} expected` : ""}</span> : ex.t ? <span>About {Math.round(ex.t).toLocaleString("en-US")} votes expected</span> : null}
      </div>
      <div className="meta"><span>Now <b>{counted ? fmtM(lm, r.k, isInd(r)) : "not counting"}</b></span><span>Forecast <b>{fmtM(e, r.k, isInd(r))}</b></span></div>
      <small>{hint}</small>
    </>
  );
}

/** A whole number that counts up to its value and glides to each new one. */
function CountUp({ v }: { v: number }) {
  const [x, setX] = useState(0); const from = useRef(0);
  useEffect(() => {
    const a = from.current, t0 = performance.now(); let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3); setX(a + (v - a) * e); if (k < 1) raf = requestAnimationFrame(step); else from.current = v; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [v]);
  return <>{Math.round(x).toLocaleString("en-US")}</>;
}
