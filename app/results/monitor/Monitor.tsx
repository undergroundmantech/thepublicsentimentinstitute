"use client";
// The situation monitor: the election night desk for every November 3 race on one globe you can grab and turn.
// States and counties are coloured by the returns civicAPI reports, or by how far the returns run from the expected
// vote. Click a state to fly in and see its counties; click any race to open its full results desk, with the
// reported results, the live win probability, the estimate of the final count and the county table.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/app/components/Link";
import { geoOrthographic, geoPath, geoGraticule10, geoContains, geoCentroid, geoDistance, geoBounds, geoArea, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { marginColor, marginColorInd } from "@/app/lib/opp";
import { STN, KIND_LABEL, FIRST_CLOSE, fmtM, isInd, sides, expSides, type CRace, type CCand, type Kind, type XRace, type Exp } from "../2026/live";
import { useIndex, useLive, useStateFile } from "../2026/useLive";
import NightDesk from "../2026/NightDesk";
import FloatTip from "@/app/components/opp/FloatTip";
import { paintUnit } from "./paint";
import RaceBrief from "./RaceBrief";
import { SeatArc, MajorityBar, GovTiles, SeatKey, countSeats, seatOf, hasReturns, liveMargin, expM, raceLabel as label, GOV_HOLD, type Seat, type SeatState, type Tile } from "./Chambers";
import { frameGap } from "@/app/lib/lite";
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

const vsColor = (d: number) => { const a = Math.min(1, Math.abs(d) / 12); return d < 0 ? `rgba(61,123,255,${0.15 + a * 0.8})` : `rgba(255,59,92,${0.15 + a * 0.8})`; };
// results colour: purple where an independent leads the Republican, as on every forecast map
const shade = (m: number, k?: Kind, ind = false) => (k === "measure" ? (m < 0 ? `rgba(47,191,155,${0.25 + Math.min(1, -m / 40) * 0.7})` : `rgba(231,121,74,${0.25 + Math.min(1, m / 40) * 0.7})`) : ind ? marginColorInd(m) : marginColor(m));
// statewide offices grouped the way readers look for them, so the map can show one office across every state
const OFFICE_GROUPS: [string, string, RegExp][] = [
  ["lg", "Lieutenant governor", /lieutenant/i], ["ag", "Attorney general", /attorney general/i], ["sos", "Secretary of state", /secretary of state/i],
  ["treas", "Treasurer", /treasurer/i], ["aud", "Auditor", /auditor/i], ["comp", "Comptroller and controller", /comptroller|controller/i],
  ["edu", "Education", /superintendent|education|school/i], ["agri", "Agriculture", /agricultur/i], ["ins", "Insurance", /insurance/i],
  ["labor", "Labor", /labor/i], ["land", "Land", /land/i], ["util", "Commissions", /commission|railroad|mine inspector|utilit/i],
  ["court", "Courts", /justice|court/i], ["univ", "Universities", /universit|regents|trustees|board of governors/i],
];
const officeGroup = (off: string) => OFFICE_GROUPS.find((g) => g[2].test(off))?.[0] ?? "other";
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
  const [office, setOffice] = useState<string>("all");
  const [q, setQ] = useState("");
  const live = useLive(ix, SETS[mode]);
  const sf = useStateFile(sel);
  const stage = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const view = useRef({ rot: [97, -39, 0] as [number, number, number], k: 2.2, target: null as null | { rot: [number, number, number]; k: number } });
  // the stage's size, so the home view fits the country to whatever room the map has
  const dims = useRef({ W: 0, H: 0, base: 1 });
  const fitted = useRef(false);
  const autoFit = useRef(true);
  const homeK = () => { const d = dims.current; if (!d.W || !d.H) return 2.2; return Math.max(1.2, Math.min(7, Math.min(1.16 * d.W, 2.0 * d.H) / d.base)); };
  const fly = useRef<(st: string) => void>(() => {});
  const wake = useRef<() => void>(() => {});
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
  useEffect(() => { if (!desk) return; const r = (ix?.races ?? []).find((x) => x.id === desk); if (r) fly.current(r.st); }, [desk]); // eslint-disable-line react-hooks/exhaustive-deps
  const escRef = useRef<() => void>(() => {});
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") escRef.current(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  const allMode = useMemo(() => (ix?.races ?? []).filter((r) => r.k === mode), [ix, mode]);
  const officeCounts = useMemo(() => { const m: Record<string, number> = {}; if (mode === "state") for (const r of allMode) { const g = officeGroup(r.off); m[g] = (m[g] ?? 0) + 1; } return m; }, [allMode, mode]);
  const races = useMemo(() => (mode === "state" && office !== "all" ? allMode.filter((r) => officeGroup(r.off) === office) : allMode), [allMode, mode, office]);
  const byState = useMemo(() => { const m: Record<string, XRace[]> = {}; for (const r of races) (m[r.st] ??= []).push(r); return m; }, [races]);
  // one colour per state: the returns in the mode's races there, or how far they run from the expected vote
  const stateColor = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [st, rs] of Object.entries(byState)) {
      const rep = rs.filter((r) => hasReturns(live.byId[r.id]));
      if (!rep.length) {
        out[st] = AWAIT;
        // nothing counted yet: the forecast lean, hatched over the neutral fill so it never reads as returns
        const em = rs.filter((r) => expM(r) != null);
        if (color === "results" && em.length) {
          const wf = (r: XRace) => (r.k === "house" ? 1 : r.tot || 1);
          const e0 = mode === "house" ? (100 * (em.filter((r) => (expM(r) ?? 0) > 0).length - em.filter((r) => (expM(r) ?? 0) < 0).length)) / em.length : em.reduce((s, r) => s + (expM(r) ?? 0) * wf(r), 0) / em.reduce((s, r) => s + wf(r), 0);
          out["~" + st] = shade(e0, mode === "measure" ? "measure" : undefined, em.length === 1 && isInd(em[0]));
        }
        continue;
      }
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
    const out: Record<string, { fill: string; a: number; h?: string }> = {};
    if (mode !== "house") return out;
    for (const r of races) {
      const c = live.byId[r.id];
      if (!hasReturns(c)) { const p = paintUnit(null, expM(r)); out[r.id] = color === "results" && p.kind === "expected" ? { fill: AWAIT, a: 1, h: shade(p.m, undefined, isInd(r)) } : { fill: AWAIT, a: 1 }; continue; }
      const m = liveMargin(r, c) ?? 0, e = expM(r);
      out[r.id] = { fill: color === "results" ? shade(m, undefined, isInd(r)) : e != null ? vsColor(m - e) : AWAIT, a: 0.45 + 0.55 * Math.min(1, (c!.pr || 0) / 100) };
    }
    return out;
  }, [mode, races, live.byId, color]);
  const selRaces = useMemo(() => (sel ? (ix?.races ?? []).filter((r) => r.st === sel) : []), [ix, sel]);
  const layerRace = useMemo(() => {
    if (!sel) return null;
    const cands = selRaces.filter((r) => r.cty);
    return cands.find((r) => r.id === pick) ?? (mode === "state" && office !== "all" ? cands.find((r) => r.k === "state" && officeGroup(r.off) === office) : undefined) ?? cands.find((r) => r.k === mode) ?? cands.find((r) => r.k === "sen") ?? cands.find((r) => r.k === "gov") ?? cands[0] ?? null;
  }, [sel, selRaces, pick, mode, office]);
  // the race shown in brief in the side panel: the state's race for this view when a state is picked
  useEffect(() => {
    // keep a race picked in this state, such as a clicked district; otherwise show the state's race for this view
    const all = ix?.races ?? [];
    setFocus((f) => { const cur = f ? all.find((x) => x.id === f) : null; if (cur && cur.st === sel && cur.k === mode) return f; const r = sel ? (mode === "state" && office !== "all" ? all.find((x) => x.st === sel && x.k === "state" && officeGroup(x.off) === office) : undefined) ?? all.find((x) => x.st === sel && x.k === mode) : null; return r ? r.id : null; });
  }, [sel, mode, office]); // eslint-disable-line react-hooks/exhaustive-deps
  const focusRace = useMemo(() => (focus ? (ix?.races ?? []).find((r) => r.id === focus) ?? null : null), [ix, focus]);
  const expC: Record<string, Exp> | null = layerRace && sf ? sf.counties[layerRace.id] ?? null : null;
  const [liveC, setLiveC] = useState<Record<string, { m: number | null; pr: number; c: CCand[] }> | null>(null);
  // the county returns stay on screen between reads, so a new read never blanks the map; they clear only when the
  // race changes. A county whose count moved since the last read is marked fresh and shines for a moment.
  const liveCFor = useRef<string | null>(null);
  const freshC = useRef<Map<string, { t: number; m: number | null; pr: number }>>(new Map());
  useEffect(() => {
    const id = layerRace?.id ?? null;
    if (liveCFor.current !== id) { liveCFor.current = id; freshC.current = new Map(); setLiveC(null); }
    if (!layerRace) return;
    const c = live.byId[layerRace.id]; if (!hasReturns(c)) return;
    let dead = false;
    import("../2026/live").then(({ civicRace }) => civicRace(c!.id)).then((d) => {
      if (dead || liveCFor.current !== layerRace.id) return; const o: Record<string, { m: number | null; pr: number; c: CCand[] }> = {};
      for (const [f, g] of Object.entries(d.regions)) { const s = sides(layerRace, g.c); o[f] = { m: s.t ? (100 * (s.b - s.a)) / s.t : null, pr: g.pr, c: g.c }; }
      setLiveC((prev) => {
        if (prev) { const t = performance.now(); for (const [f, x] of Object.entries(o)) { const a = prev[f]; const va = a ? a.c.reduce((s2, y) => s2 + y[2], 0) : 0, vb = x.c.reduce((s2, y) => s2 + y[2], 0); if (vb > va || (a && x.pr > a.pr)) freshC.current.set(f, { t, m: x.m, pr: x.pr }); } }
        return o;
      });
    }).catch(() => {});
    return () => { dead = true; };
  }, [layerRace, live.at, live.byId]);

  const calledSt = useMemo(() => new Set(races.filter((r) => live.byId[r.id]?.c.some((c) => c[4])).map((r) => r.st)), [races, live.byId]);
  const sweepOn = useMemo(() => Object.values(live.byId).some((c) => hasReturns(c)), [live.byId]);
  const votesIn = useMemo(() => races.reduce((s, r) => { const c = live.byId[r.id]; return s + (c ? c.c.reduce((a, x) => a + x[2], 0) : 0); }, 0), [races, live.byId]);
  // the share of this view's races reporting, read by read, for the sparkline
  const [hist, setHist] = useState<number[]>([]);
  useEffect(() => { if (!live.at || !races.length) return; const rep = races.filter((r) => hasReturns(live.byId[r.id])).length / races.length; setHist((h) => [...h.slice(-39), rep]); }, [live.at]); // eslint-disable-line react-hooks/exhaustive-deps
  // a call card for each new call of a statewide race or a House seat, one after another, and the state flashes on
  // the map as its race is called
  type Call = { id: string; who: string; race: string; kind: Kind; st: string; p: string; m: number | null; pr: number };
  const [calls, setCalls] = useState<Call[]>([]);
  const callFlash = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!live.at || !ix) return;
    const add: Call[] = [];
    for (const r of ix.races) {
      if (r.k === "leg" || r.k === "other") continue;
      const a = live.byId[r.id], b = live.prev[r.id]; const w = a?.c.find((c) => c[4]);
      if (w && b && !b.c.some((c) => c[4])) { add.push({ id: r.id, who: w[0], race: r.nm, kind: r.k, st: r.st, p: (w[1] || "O")[0].toUpperCase(), m: liveMargin(r, a), pr: a!.pr }); if (r.k !== "house") callFlash.current.set(r.st, performance.now()); }
    }
    // statewide calls first, the biggest offices first
    const rank: Record<string, number> = { sen: 0, gov: 1, state: 2, measure: 3, house: 4 };
    if (add.length) setCalls((q0) => [...q0, ...add.sort((x, y) => (rank[x.kind] ?? 9) - (rank[y.kind] ?? 9))].slice(0, 30));
  }, [live.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const toast = calls[0] ?? null;
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setCalls((q0) => q0.slice(1)), calls.length > 4 ? 3800 : 6500); return () => window.clearTimeout(t); }, [toast, calls.length]);
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
    let W = 0, H = 0, raf = 0, base = 1, running = false, lastF = 0; const gap = frameGap();
    const proj = geoOrthographic().clipAngle(90).precision(0.4);
    const path = geoPath(proj, ctx), grat = geoGraticule10();
    const size = () => {
      // resizing a canvas wipes it, so only touch its size when the stage really changed; otherwise switching a race
      // would blank the globe for a frame, the black flash
      W = box.clientWidth; H = box.clientHeight;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = W + "px"; c.style.height = H + "px"; }
      base = Math.min(W, H) * 0.46;
      dims.current = { W, H, base };
      // the first time the stage has a size, open on the whole country filling it
      if (W && H && (!fitted.current || autoFit.current)) { fitted.current = true; view.current.k = homeK(); setZoomK(view.current.k); }
    };
    size();
    const stSel = sel ? geo.states.find((s) => s.st === sel) : null;
    // each county as its own polygons; any ring that reads as the rest of the globe is turned around
    const cGeo = sel && cll ? Object.entries(cll).filter(([f]) => FIPS[f.slice(0, 2)] === sel).map(([f, rings]) => ({
      f, g: { type: "MultiPolygon", coordinates: rings.map((r) => [geoArea({ type: "Polygon", coordinates: [r] } as GeoPermissibleObjects) > 2 * Math.PI ? [...r].reverse() : r]) } as unknown as GeoPermissibleObjects,
    })).map((x) => ({ ...x, c: geoCentroid(x.g) as [number, number] })) : [];
    // the globe by night, or by day in the light theme
    const LT = theme === "light";
    const fx = (c: string) => (!LT ? c : c === AWAIT ? "#d8d2ea" : c === NO_RACE ? "#ebe8f3" : c);
    // diagonal hatching in a unit's expected lean: the mark for "no votes yet"
    const hatches = new Map<string, CanvasPattern | string>();
    const hatch = (c: string) => {
      let p = hatches.get(c);
      if (!p) {
        const t = document.createElement("canvas"); t.width = t.height = 6;
        const g = t.getContext("2d");
        if (g) { g.strokeStyle = c; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-1, 7); g.lineTo(7, -1); g.moveTo(-1, 1); g.lineTo(1, -1); g.moveTo(5, 7); g.lineTo(7, 5); g.stroke(); }
        p = (g && ctx.createPattern(t, "repeat")) || c; hatches.set(c, p);
      }
      return p;
    };
    const GOLD = LT ? "176,122,0" : "255,217,138";
    // frames run only while something moves: a flight, a drag, the count sweep or a call glowing; otherwise the
    // globe is drawn once and waits, which keeps a laptop or phone cool on a long election night
    const draw = (now = performance.now()) => {
      const v = view.current;
      const SHINE = 2600, FLASH = 3200;
      for (const [f, x] of freshC.current) if (now - x.t > SHINE) freshC.current.delete(f);
      for (const [st, t0] of callFlash.current) if (now - t0 > FLASH) callFlash.current.delete(st);
      const busy = !!v.target || !!drag.current || (!reduce && (sweepOn || calledSt.size > 0 || freshC.current.size > 0 || callFlash.current.size > 0 || feed.some((x) => live.at && x.t.getTime() === live.at.getTime())));
      if (gap && busy && now - lastF < gap) { raf = requestAnimationFrame(draw); return; }
      lastF = now;
      if (v.target) {
        const t = v.target; v.rot = v.rot.map((x, i) => x + (t.rot[i] - x) * 0.14) as [number, number, number]; v.k += (t.k - v.k) * 0.14;
        if (Math.abs(v.k - t.k) < 0.002 && v.rot.every((x, i) => Math.abs(x - t.rot[i]) < 0.02)) v.target = null;
      }
      proj.rotate(v.rot).scale(base * v.k).translate([W / 2, H / 2]);
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
        const dim = sel && sel !== f.st ? 0.45 : 1, gh = stateColor["~" + f.st];
        ctx.fillStyle = fx(stateColor[f.st] ?? NO_RACE); ctx.globalAlpha = dim; ctx.fill();
        if (gh) { ctx.fillStyle = hatch(gh); ctx.globalAlpha = dim * (LT ? 0.75 : 0.6); ctx.fill(); }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = hv?.st === f.st && !hv.f ? (LT ? "#110019" : "#fff") : LT ? "rgba(255,255,255,.95)" : "rgba(8,5,16,.9)"; ctx.lineWidth = hv?.st === f.st && !hv.f ? 2 : 0.7; ctx.stroke();
      }
      if (mode === "house" && dGeo.length) {
        for (const x of dGeo) {
          if (geoDistance(x.c, [-v.rot[0], -v.rot[1]]) > 1.6) continue;
          const dc = districtColor[x.id] ?? { fill: NO_RACE, a: 1 };
          ctx.beginPath(); path(x.g); ctx.fillStyle = fx(dc.fill); ctx.globalAlpha = (sel && sel !== x.st ? 0.5 : 1) * dc.a; ctx.fill();
          if (dc.h) { ctx.fillStyle = hatch(dc.h); ctx.globalAlpha = (sel && sel !== x.st ? 0.5 : 1) * (LT ? 0.75 : 0.6); ctx.fill(); }
          ctx.globalAlpha = 1;
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
          const p = paintUnit(lv?.m, em);
          const fill = p.kind === "reported" ? (color === "results" ? shade(p.m, layerRace.k, ind) : em != null ? vsColor(p.m - em) : AWAIT) : AWAIT;
          ctx.beginPath(); path(x.g); ctx.fillStyle = fx(fill); ctx.globalAlpha = p.kind === "reported" ? 0.4 + 0.6 * Math.min(1, lv!.pr / 100) : 1; ctx.fill();
          // no votes yet: hatched in the expected lean, never filled like a result
          if (p.kind === "expected" && color === "results") { ctx.fillStyle = hatch(shade(p.m, layerRace.k, ind)); ctx.globalAlpha = LT ? 0.75 : 0.6; ctx.fill(); }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = hv?.f === x.f ? (LT ? "#110019" : "#fff") : LT ? "rgba(255,255,255,.9)" : "rgba(8,5,16,.8)"; ctx.lineWidth = hv?.f === x.f ? 1.8 : 0.5; ctx.stroke();
        }
      }
      // a county whose count just moved shines: a white glow that fades, a gold outline, a ring that opens out from its
      // centre and the share now in
      if (mode !== "house" && cGeo.length && freshC.current.size && !reduce) {
        const tn = performance.now();
        for (const x of cGeo) {
          const fr = freshC.current.get(x.f); if (!fr) continue; const k = Math.min(1, (tn - fr.t) / SHINE), fade = 1 - k;
          ctx.beginPath(); path(x.g);
          ctx.fillStyle = `rgba(255,255,255,${0.55 * fade * fade})`; ctx.fill();
          ctx.strokeStyle = `rgba(${GOLD},${0.95 * fade})`; ctx.lineWidth = 2.4; ctx.shadowColor = `rgba(${GOLD},.9)`; ctx.shadowBlur = 14 * fade; ctx.stroke(); ctx.shadowBlur = 0;
          const p = proj(x.c); if (!p) continue;
          ctx.strokeStyle = `rgba(255,255,255,${0.8 * fade})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(p[0], p[1], 4 + 26 * Math.sqrt(k), 0, 6.283); ctx.stroke();
          if (k < 0.85 && v.k > 3.2) { ctx.font = "800 10px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillStyle = `rgba(255,255,255,${Math.min(1, fade * 1.6)})`; ctx.fillText(`${Math.round(fr.pr)}% in`, p[0], p[1] - 8 - 10 * k); }
        }
      }
      // a state whose statewide race was just called flashes gold
      if (callFlash.current.size && !reduce) {
        const tn = performance.now();
        for (const f of geo.states) {
          const t0 = callFlash.current.get(f.st); if (t0 == null) continue; const k = Math.min(1, (tn - t0) / FLASH), pulse = (1 - k) * (0.6 + 0.4 * Math.sin(k * 18));
          ctx.beginPath(); path(f as GeoPermissibleObjects); ctx.fillStyle = `rgba(${GOLD},${0.35 * pulse})`; ctx.fill();
          ctx.strokeStyle = `rgba(${GOLD},${pulse})`; ctx.lineWidth = 3.4; ctx.shadowColor = `rgba(${GOLD},1)`; ctx.shadowBlur = 22 * (1 - k); ctx.stroke(); ctx.shadowBlur = 0;
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
      if (busy) raf = requestAnimationFrame(draw); else running = false;
    };
    const kick = () => { if (running) return; running = true; raf = requestAnimationFrame(draw); };
    // the first picture is drawn at once, so the globe never shows an empty frame when a race or state changes
    running = true; draw();
    wake.current = () => { running = false; cancelAnimationFrame(raf); kick(); };
    const ro = new ResizeObserver(() => { size(); running = false; cancelAnimationFrame(raf); kick(); }); ro.observe(box);
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
      if (d) { const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true; const k = 70 / proj.scale(); view.current.rot = [d.r[0] + dx * k, Math.max(-85, Math.min(85, d.r[1] - dy * k)), 0]; kick(); return; }
      const h = hit(x, y); const was = hovRef.current; hovRef.current = h; setHov(h ? { ...h, x: e.clientX, y: e.clientY } : null); box.style.cursor = h ? "pointer" : "grab";
      if (was?.st !== h?.st || was?.f !== h?.f || was?.d !== h?.d) { running = false; cancelAnimationFrame(raf); kick(); }
    };
    const up = (e: PointerEvent) => {
      const d = drag.current; drag.current = null; if (d?.moved) return;
      const b = box.getBoundingClientRect(); const h = hit(e.clientX - b.left, e.clientY - b.top);
      if (!h) return;
      if (h.d) setFocus(h.d);
      else if (h.st === sel && layerRace) { setFocus(layerRace.id); return; }
      if (h.d && h.st === sel) return; // a second click on the state opens its race desk
      fly.current(h.st);
    };
    fly.current = (st: string) => {
      autoFit.current = false;
      const f = geo.states.find((s) => s.st === st); if (!f) return; const bb = geoBounds(f as GeoPermissibleObjects); const ll = geoCentroid(f as GeoPermissibleObjects);
      const span = Math.max(bb[1][0] - bb[0][0], (bb[1][1] - bb[0][1]) * 1.4, 3);
      view.current.target = { rot: [-ll[0], -ll[1], 0], k: Math.max(1.6, Math.min(14, 60 / span)) }; setZoomK(view.current.target.k);
      setSel(st); setPick(null); running = false; cancelAnimationFrame(raf); kick();
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); autoFit.current = false; const k = Math.max(0.7, Math.min(16, view.current.k * Math.exp(-e.deltaY * 0.0015))); view.current.k = k; view.current.target = null; setZoomK(k); running = false; cancelAnimationFrame(raf); kick(); };
    const leave = () => { hovRef.current = null; setHov(null); running = false; cancelAnimationFrame(raf); kick(); };
    box.addEventListener("pointerdown", down); box.addEventListener("pointermove", move); box.addEventListener("pointerup", up); box.addEventListener("wheel", wheel, { passive: false }); box.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); box.removeEventListener("pointerdown", down); box.removeEventListener("pointermove", move); box.removeEventListener("pointerup", up); box.removeEventListener("wheel", wheel); box.removeEventListener("pointerleave", leave); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, stateColor, sel, cll, expC, liveC, color, layerRace, feed, live.at, mode, dGeo, districtColor, byState, calledSt, sweepOn, theme]);

  escRef.current = () => { if (desk) setDesk(null); else if (sel) home(); };
  const home = () => { autoFit.current = true; const k = homeK(); view.current.target = { rot: [97, -39, 0], k }; setZoomK(k); setSel(null); setPick(null); wake.current(); };
  const zoomBy = (f: number) => { autoFit.current = false;
    const k = Math.max(0.7, Math.min(16, view.current.k * f)); view.current.target = { rot: [...view.current.rot] as [number, number, number], k }; setZoomK(k); wake.current(); };
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
  // every race of a chamber as one seat: called, leading, not counted yet with its forecast lean, or not up
  const seats = useMemo(() => {
    const all = ix?.races ?? [];
    const of = (k: Kind) => all.filter((r) => r.k === k).map((r) => seatOf(r, live.byId[r.id]));
    const hold = (n: number, s: SeatState, l: string): Seat[] => Array.from({ length: n }, () => ({ s, label: l }));
    const sen = [...hold(chambers.sen.notD, "nd", "Democratic seat not up this year"), ...of("sen"), ...hold(chambers.sen.notR, "nr", "Republican seat not up this year")];
    const house = of("house");
    const gov = of("gov") as Tile[];
    for (const [st, p] of Object.entries(GOV_HOLD)) if (!gov.some((t) => t.st === st)) gov.push({ st, s: p === "D" ? "nd" : "nr", label: `${STN[st]}: ${p === "D" ? "Democratic" : "Republican"} governor, not up this year` });
    return { sen, house, gov };
  }, [ix, live.byId, chambers]);
  const pickSeat = (x: { id?: string; st?: string }) => { if (!x.id) return; if (x.st) fly.current(x.st); setFocus(x.id); };
  const reportingNow = useMemo(() => races.filter((r) => hasReturns(live.byId[r.id])).sort((a, b) => Math.abs(liveMargin(a, live.byId[a.id]) ?? 99) - Math.abs(liveMargin(b, live.byId[b.id]) ?? 99)), [races, live.byId]);
  // before returns, the list opens on the closest races by the forecast
  const closest = useMemo(() => races.slice().sort((a, b) => Math.abs(expM(a) ?? 99) - Math.abs(expM(b) ?? 99)), [races]);
  const left = now ? FIRST_CLOSE - now.getTime() : 0;
  const clock = now ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "America/New_York" }) : "";
  const modeName = mode === "state" && office !== "all" ? (OFFICE_GROUPS.find((g) => g[0] === office)?.[1] ?? "Other statewide") : MODES.find((m) => m[0] === mode)?.[1] ?? "";
  const found = useMemo(() => { const t = q.trim().toLowerCase(); if (!t) return []; return races.filter((r) => r.nm.toLowerCase().includes(t) || (STN[r.st] ?? "").toLowerCase().includes(t) || r.st.toLowerCase() === t || (r.c ?? []).some((x) => x[0].toLowerCase().includes(t))); }, [q, races]);
  const big: "sen" | "house" | "gov" = mode === "house" || mode === "gov" ? mode : "sen";
  const pctf = (p: number) => `${Math.round((p > 1 ? p : p * 100))}%`;

  const raceRow = (r: XRace, inState: boolean) => {
    const c = live.byId[r.id]; const lm = liveMargin(r, c); const w = c?.c.find((x) => x[4]); const e = expM(r);
    return (
      <li key={r.id}>
        <button type="button" className={`mon-row${focus === r.id ? " on" : ""}`} onClick={() => setFocus(focus === r.id ? null : r.id)} onDoubleClick={() => setDesk(r.id)} onMouseEnter={() => r.cty && setPick(r.id)}>
          <span className="nm">{label(r, inState)}</span>
          {lm == null
            ? <span className={`lv ex ${e == null ? "" : e < 0 ? (isInd(r) ? "i" : "d") : "r"}`}>{e == null ? "" : fmtM(e, r.k, isInd(r))}</span>
            : <span className={`lv ${lm < 0 ? (isInd(r) ? "i" : "d") : "r"}`}>{fmtM(lm, r.k, isInd(r))}</span>}
          <span className="pr">{w ? "Called" : c && hasReturns(c) ? `${c.pr.toFixed(0)}% in` : c ? "Forecast" : "Awaiting feed"}</span>
        </button>
      </li>
    );
  };

  const chamber = (k: "sen" | "house" | "gov") => {
    const list = seats[k]; const ct = countSeats(list); const t = T[k];
    const name = k === "sen" ? "Senate" : k === "house" ? "House" : "Governors";
    const maj = k === "sen" ? 51 : k === "house" ? 218 : 26;
    const fc = k === "sen" ? chambers.sen : k === "house" ? chambers.house : chambers.gov;
    const open = big === k;
    const dTot = ct.dW + ct.iW;
    const note = k === "sen" ? "51 for control, 50 with the vice president for Republicans" : k === "house" ? "218 for a majority" : "26 for a majority of governorships";
    return (
      <section key={k} className={`mon-cp${open ? " open" : ""}`} aria-label={`${name} control`}>
        <button type="button" className="mon-cp-h" onClick={() => { setMode(k); setPick(null); }} aria-pressed={open}>
          <b>{name}</b><span>{t.cD + t.cR} of {t.n} called · {t.counting} counting</span>
        </button>
        <div className="mon-cp-score">
          <div className="d"><b>{dTot}</b><span>Democrats{ct.iW ? `, ${ct.iW} independent` : ""}{ct.dL + ct.iL ? ` · ${ct.dL + ct.iL} leading` : ""}</span></div>
          <div className="mid"><b>{ct.aw}</b><span>not counted</span></div>
          <div className="r"><b>{ct.rW}</b><span>Republicans{ct.rL ? ` · ${ct.rL} leading` : ""}</span></div>
        </div>
        {open ? (k === "gov"
          ? <GovTiles tiles={list as Tile[]} onPick={pickSeat} />
          : <SeatArc seats={list} onPick={pickSeat} label={`${name}: ${dTot} Democratic and ${ct.rW} Republican seats held or won, ${ct.aw} not counted yet`} />) : null}
        <MajorityBar c={ct} maj={maj} majLabel={String(maj)} />
        {open ? (() => { const dN = Math.max(0, maj - dTot), rN = Math.max(0, (k === "sen" ? 50 : maj) - ct.rW); return (
          <div className="mon-cp-need">
            <span className="d">{dN ? <>Democrats need <b>{dN}</b> of {ct.aw + ct.dL + ct.rL + ct.iL} still open</> : <b>Democrats have a majority</b>}</span>
            <span className="r">{rN ? <>Republicans need <b>{rN}</b></> : <b>Republicans have a majority</b>}</span>
          </div>); })() : null}
        <p className="mon-cp-f"><span>{note}</span><span>Forecast <b className="d">D {pctf(fc.pD)}</b> · {fc.dS.toFixed(1)} D {k === "gov" ? "governors" : "seats"} on average</span></p>
      </section>
    );
  };

  return (
    <div className={`mon${desk ? " desk-on" : ""}`}>
      <section className="mon-top" aria-label="Monitor controls">
        <div className="mon-title">
          <span className="eye"><i className={anyLive ? "on" : ""} />Situation monitor · November 3, 2026</span>
          <h1>Election night, <em>as it comes in.</em></h1>
          <p>{live.loading ? "Connecting to civicAPI" : live.error ? live.error : anyLive ? `${T.sen.counting + T.gov.counting + T.house.counting} federal and governor races counting · last read ${live.at ? clockET(live.at) : ""} ET` : left > 0 ? `${Object.keys(live.byId).length} races linked to civicAPI · first polls close in ${Math.floor(left / 86400000)}d ${Math.floor((left % 86400000) / 3600000)}h` : "Polls are closing. Returns appear as they land."}</p>
          {live.test && live.hidden > 0 ? <p className="mon-test">civicAPI is publishing test returns before Election Day; they are hidden. <a href="?test=1">Preview with test returns</a></p> : null}
          {live.test && live.hidden === 0 && anyLive ? <p className="mon-test">Showing civicAPI test returns for preview. These are not real votes. <a href="?">Hide them</a></p> : null}
        </div>
        <div className="mon-ctl">
          <div className="mon-seg" role="group" aria-label="Races">{MODES.map(([k, l]) => <button key={k} aria-pressed={mode === k} onClick={() => { setMode(k); setPick(null); }}>{l}</button>)}</div>
          <label className="mon-jump"><span className="sr">Jump to a state</span>
            <select value={sel ?? ""} onChange={(e) => { const v = e.target.value; if (v) fly.current(v); else home(); }} aria-label="Jump to a state">
              <option value="">Jump to a state</option>
              {Object.keys(byState).sort((a, b) => (STN[a] ?? a).localeCompare(STN[b] ?? b)).map((st) => <option key={st} value={st}>{STN[st] ?? st} · {byState[st].length}</option>)}
            </select>
          </label>
          <div className="mon-seg sm" role="group" aria-label="Colour by">{(["results", "versus"] as Color[]).map((k) => <button key={k} aria-pressed={color === k} onClick={() => setColor(k)}>{k === "results" ? "Results" : "Versus expected vote"}</button>)}</div>
        </div>
        {mode === "state" ? (
          <div className="mon-office" role="group" aria-label="Statewide office">
            <span className="lb">Office</span>
            <button aria-pressed={office === "all"} onClick={() => { setOffice("all"); setPick(null); }}>All <em>{allMode.length}</em></button>
            {[...OFFICE_GROUPS.map((g) => [g[0], g[1]] as [string, string]), ["other", "Other"] as [string, string]].filter(([k]) => officeCounts[k]).map(([k, l]) => (
              <button key={k} aria-pressed={office === k} onClick={() => { setOffice(k); setPick(null); }}>{l} <em>{officeCounts[k]}</em></button>
            ))}
          </div>
        ) : null}
        <div className="mon-clock" aria-hidden="true"><b>{clock || " "}</b><span>ET · {votesIn ? <><CountUp v={votesIn} /> votes in</> : "awaiting votes"}</span></div>
      </section>

      <aside className="mon-left" aria-label="Control of the Senate, the House and the governorships">
        {chamber(big)}
        {(["sen", "house", "gov"] as const).filter((k) => k !== big).map((k) => chamber(k))}
        <SeatKey />
        <div className="mon-feed">
          <h3>Feed</h3>
          {feed.length ? <ul>{feed.slice(0, 14).map((f, i) => <li key={i}><time>{clockET(f.t)}</time><button type="button" onClick={() => setFocus(f.id)}>{f.text}</button></li>)}</ul>
            : <p>{anyLive ? "Returns are in. New counts and calls appear here as each read lands." : "New counts and calls appear here as civicAPI reports them. Nothing has been counted yet."}</p>}
        </div>
      </aside>

      <div className="mon-map">
        <div className="mon-stage" ref={stage} aria-label="Globe of every November 3 race. Drag to turn it, scroll or use the buttons to zoom, click a state to open it." role="application">
          <canvas ref={cv} />
          <div className="mon-reticle" aria-hidden="true"><i /><i /></div>
        </div>
        {sel ? <button type="button" className="mon-back" onClick={home}>{STN[sel]} · Back to the country</button> : null}
        <div className="mon-legend">
          {color === "versus" ? <><span>Bluer than expected</span><i className="vs" /><span>Redder</span></> : mode === "measure" ? <><span>Yes</span><i className="ms" /><span>No</span></> : <><span>D +40</span><i className="mg" /><span>R +40</span></>}
          {color === "results" ? <span className="ex-k"><i className="ex" />Hatched: no votes yet, expected lean</span> : null}
        </div>
        <div className="mon-hud" aria-hidden="true">{hist.length > 1 ? <svg className="spark" viewBox="0 0 80 18" preserveAspectRatio="none"><polyline points={hist.map((v, i) => `${(80 * i) / Math.max(1, hist.length - 1)},${17 - 16 * v}`).join(" ")} /></svg> : null}<span>Zoom {zoomK.toFixed(1)}x</span><span>civicAPI · 30 second cache</span></div>
        <div className="mon-zoom">
          <button onClick={() => zoomBy(1.5)} aria-label="Zoom in">+</button>
          <button onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom out">−</button>
          <button onClick={home} aria-label="Show the whole country" className="t">US</button>
          <button onClick={full} aria-label="Full screen" className="t">Full</button>
        </div>
        {toast ? (
          <button type="button" key={toast.id} className={`mon-toast p-${toast.p}`} onClick={() => { setFocus(toast.id); fly.current(toast.st); setCalls((q0) => q0.slice(1)); }}>
            <span className="k">civicAPI call · {KIND_LABEL[toast.kind]}</span><b>{toast.race}</b>
            <span className="w"><i />{toast.who}{toast.m != null && toast.kind !== "measure" && Math.abs(toast.m) >= 0.05 ? <>, ahead by {Math.abs(toast.m).toFixed(1)} points</> : null}</span>
            <span className="s">{toast.pr.toFixed(0)}% reporting{calls.length > 1 ? ` · ${calls.length - 1} more calls` : ""}</span>
          </button>
        ) : null}
      </div>

      <aside className="mon-right" aria-label={sel ? `${STN[sel]} races` : "Races reporting"}>
        {focusRace ? <RaceBrief r={focusRace} c={live.byId[focusRace.id]} sf={focusRace.st === sel ? sf : null} at={live.at} onOpen={() => setDesk(focusRace.id)} onClose={() => setFocus(null)} /> : null}
        {sel ? (
          <>
            <div className="mon-rh"><b>{STN[sel]}</b><button onClick={home}>Back to the country</button></div>
            <p className="mon-note">{layerRace ? `Counties show the ${label(layerRace, true)} ${color === "results" ? "returns" : "returns against the expected vote"}. ` : ""}{color === "results" ? "Hatched areas have no votes yet and show only the expected lean. " : ""}Click any race to see it here; open the full desk from it.</p>
            {(["sen", "gov", "house", "state", "measure", "leg", "other"] as Kind[]).map((k) => { const rs = selRaces.filter((r) => r.k === k); if (!rs.length) return null; return (
              <div key={k} className="mon-grp"><h3>{KIND_LABEL[k]} <em>{rs.length}</em></h3><ul>{rs.slice(0, k === "other" ? 8 : 60).map((r) => raceRow(r, true))}</ul></div>
            ); })}
          </>
        ) : (
          <>
            <div className="mon-rh"><b>{reportingNow.length ? `${modeName} races counting` : `Closest ${modeName.toLowerCase()} races`}</b><span>{reportingNow.length ? "Now · in" : "Forecast"}</span></div>
            <input className="mon-q" type="search" id="mon-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a race, state or candidate" aria-label="Find a race, state or candidate" />
            {!reportingNow.length && !q ? <p className="mon-note">No returns yet. Each race fills in as its first votes are counted; until then the list shows the forecast, closest first, in gray. Click a race or a state to open it.</p> : null}
            <ul>{(q ? found : reportingNow.length ? reportingNow : closest).slice(0, 80).map((r) => raceRow(r, false))}</ul>
            {q && !found.length ? <p className="mon-note">No {modeName.toLowerCase()} race matches that. Try a state name or a last name.</p> : null}
            <Link className="mon-all" href="/results/2026">Every race as a list</Link>
          </>
        )}
      </aside>

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
                {rs.length ? rs.slice(0, 5).map((r) => { const c = live.byId[r.id]; const lm = liveMargin(r, c); return <div key={r.id} className="row"><span>{label(r, true)}</span><b>{lm != null ? `${fmtM(lm, r.k, isInd(r))} · ${c!.pr.toFixed(0)}% in` : `Expected ${fmtM(expM(r), r.k, isInd(r))} · no votes yet`}</b></div>; }) : <div>No {MODES.find((m) => m[0] === mode)?.[1].toLowerCase()} race here</div>}
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
        <span>{counted ? `${c!.pr.toFixed(0)}% reporting` : c ? "No returns yet" : "Awaiting results feed"}</span>
        {counted && s ? <span>{s.t.toLocaleString("en-US")} votes counted{ex.t ? ` of about ${Math.round(ex.t).toLocaleString("en-US")} expected` : ""}</span> : ex.t ? <span>About {Math.round(ex.t).toLocaleString("en-US")} votes expected</span> : null}
      </div>
      <div className="meta"><span>Now <b>{counted ? fmtM(lm, r.k, isInd(r)) : "no votes yet"}</b></span><span>Expected <b>{fmtM(e, r.k, isInd(r))}</b></span></div>
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
