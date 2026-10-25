"use client";
// The state as a pixel map. Counties are drawn into a small grid and blown up with hard edges. The campaign only
// sees its own read of each county: a bucket from Safe you to Safe them, dithered with fog where the read is old or
// blurry, never the true number. On top run the sprites: your bus, theirs, field office flags, volunteers walking
// their turf, rally crowds, ad strikes and poll sweeps.
import React, { useEffect, useMemo, useRef } from "react";
import type { CountyPath } from "@/app/components/home/countyGeo";
import { pathsBox, fit } from "@/app/components/home/countyGeo";
import * as E from "../engine";
import { PAL, partyCol, bits, bitsOutlined, BUS, FLAG, TV, PERSON, HEART, DOLLAR, CLIP, XMARK, BUBBLE, RADAR, type Bits } from "./sprites";

export type MapFx = { id: number; kind: "rally" | "hall" | "office" | "knock" | "reg" | "poll" | "air" | "money" | "bad" | "opp"; f?: string; fs?: string[]; t0: number };
export type Layer = "read" | "regions" | "ground" | "rival";
type Geo = { LW: number; LH: number; id: Int16Array; cen: Map<string, [number, number]>; idx: Map<string, number>; fips: string[]; paths: Path2D[]; tr: { sc: number; ox: number; oy: number } };

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hex = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const REGC = ["#ffb547", "#7fd1ff", "#b78cff", "#5ee0a0", "#ff8fb0", "#f4e06b", "#7f8cff", "#ff9f6b"];

export function useMapGeo(paths: CountyPath[] | null, maxW = 300, maxH = 220): Geo | null {
  return useMemo(() => {
    if (!paths || !paths.length || typeof document === "undefined") return null;
    const box = pathsBox(paths); const aspect = (box[2] - box[0]) / Math.max(1, box[3] - box[1]);
    let LW = maxW, LH = Math.round(maxW / aspect);
    if (LH > maxH) { LH = maxH; LW = Math.round(maxH * aspect); }
    LH += 5; // room for the board's shadow under the state
    const tr = fit(box, LW, LH - 5, 6, 6);
    const cv = document.createElement("canvas"); cv.width = LW; cv.height = LH;
    const g = cv.getContext("2d", { willReadFrequently: true })!;
    g.imageSmoothingEnabled = false;
    g.setTransform(tr.sc, 0, 0, tr.sc, tr.ox, tr.oy);
    const p2 = paths.map((p) => new Path2D(p.d));
    p2.forEach((p, i) => { const k = i + 1; g.fillStyle = `rgb(${k & 255},${(k >> 8) & 255},7)`; g.fill(p); });
    const img = g.getImageData(0, 0, LW, LH).data;
    const id = new Int16Array(LW * LH).fill(-2);
    for (let q = 0; q < LW * LH; q++) {
      const a = img[q * 4 + 3]; if (a < 110) continue;
      const k = img[q * 4] + (img[q * 4 + 1] << 8) - 1;
      id[q] = img[q * 4 + 2] === 7 && k >= 0 && k < paths.length && a > 250 ? k : -1;
    }
    for (let pass = 0; pass < 2; pass++) for (let q = 0; q < LW * LH; q++) if (id[q] === -1) { const n = [q - 1, q + 1, q - LW, q + LW].find((z) => z >= 0 && z < LW * LH && id[z] >= 0); if (n != null) id[q] = id[n]; }
    // tiny counties that rounded away get one pixel at their centre so they can still be clicked
    const sx = new Float64Array(paths.length), sy = new Float64Array(paths.length), n = new Float64Array(paths.length);
    for (let q = 0; q < LW * LH; q++) if (id[q] >= 0) { sx[id[q]] += q % LW; sy[id[q]] += Math.floor(q / LW); n[id[q]]++; }
    const cen = new Map<string, [number, number]>();
    const re = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
    paths.forEach((p, i) => {
      if (n[i]) cen.set(p.id, [sx[i] / n[i], sy[i] / n[i]]);
      else { const m = re.exec(p.d); if (m) { const x = Math.round(+m[1] * tr.sc + tr.ox), y = Math.round(+m[2] * tr.sc + tr.oy); if (x >= 0 && y >= 0 && x < LW && y < LH) { id[y * LW + x] = i; cen.set(p.id, [x, y]); } } }
    });
    return { LW, LH, id, cen, idx: new Map(paths.map((p, i) => [p.id, i])), fips: paths.map((p) => p.id), paths: p2, tr };
  }, [paths, maxW, maxH]);
}

export default function PixelMap({ r, s, geo, mode, layer = "read", sel, onSel, hover, onHover, fx = [], night, bus, oppPath, oppT0, className, labels = 0, flash, clear = false, detail = "clean" }: {
  r: E.RaceFile; s: E.State; geo: Geo | null; mode: "plan" | "night" | "preview"; layer?: Layer; sel?: string | null; onSel?: (f: string) => void;
  hover?: string | null; onHover?: (f: string | null) => void; fx?: MapFx[]; night?: Map<string, number>; bus?: string | null; oppPath?: string[] | null; oppT0?: number; className?: string;
  /** how many of the biggest counties get a name tag */ labels?: number; /** counties that just reported, outlined for a moment */ flash?: string[]; /** clear view: tint fuzzy reads instead of dithering */ clear?: boolean;
  /** how busy the map's markers and effects are: clean keeps one small pin per office and short effects */ detail?: "clean" | "full";
}) {
  const base = useRef<HTMLCanvasElement>(null), over = useRef<HTMLCanvasElement>(null);
  const meP = r.cands[s.side === "D" ? 0 : 1].party, opP = r.cands[s.side === "D" ? 1 : 0].party;
  const byF = useMemo(() => new Map(r.counties.map((c, i) => [c[0], i])), [r]);
  const regOf = useMemo(() => { const m = new Map<string, number>(); E.regionsOf(r).forEach((g, k) => g.f.forEach((f) => m.set(f, /^(Everywhere else|Rest of the state)$/.test(g.name) ? -1 : k))); return m; }, [r]);

  // ---------------------------------------------------------------- the base layer, a game board, redrawn when the state changes
  useEffect(() => {
    const cv = base.current; if (!cv || !geo) return;
    const { LW, LH, id, fips } = geo; cv.width = LW; cv.height = LH;
    const g = cv.getContext("2d")!; const im = g.createImageData(LW, LH); const d = im.data;
    const you = [hex(partyCol(meP, 1)), hex(partyCol(meP, 2)), hex(partyCol(meP, 3))], them = [hex(partyCol(opP, 1)), hex(partyCol(opP, 2)), hex(partyCol(opP, 3))];
    const toss = hex("#d9bf84"), fog = hex("#4a4070"), none = hex("#3a3160"), line = hex("#140c26"), shadow = hex("#05030b");
    const mix = (a: number[], b: number[], t: number) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
    // each county: a fill, a dot pattern density for how fuzzy the read is, and the dot color
    const cols: { c: number[]; dith: number; alt: number[] }[] = fips.map((f) => {
      const i = byF.get(f);
      if (i == null) return { c: none, dith: 0, alt: none };
      if (mode === "night") { const m = night?.get(f); if (m == null) return { c: hex("#2c2448"), dith: 2, alt: hex("#3e3466") }; const a = Math.abs(m); const pal = m >= 0 ? you : them; return { c: a > 20 ? pal[0] : a > 8 ? pal[1] : pal[2], dith: 0, alt: none }; }
      if (layer === "regions") { const k = regOf.get(f); return { c: k == null || k < 0 ? none : hex(REGC[k % REGC.length]), dith: 0, alt: none }; }
      if (layer === "ground") { const v = (s.visits[f] ?? 0) + (s.offices.includes(f) ? 2 : 0) + ((s.visits["reg:" + f] ?? 0) ? 1 : 0); return { c: v ? hex(v >= 4 ? "#ffd166" : v >= 2 ? "#e0a030" : "#9a7428") : none, dith: 0, alt: none }; }
      if (layer === "rival") { const v = s.oppVisits[f] ?? 0; return { c: v ? hex(v >= 3 ? partyCol(opP, 1) : v >= 2 ? partyCol(opP, 2) : partyCol(opP, 3)) : none, dith: 0, alt: none }; }
      const rd = E.readOf(s, f); if (!rd) return { c: fog, dith: 6, alt: hex("#6a5aa8") };
      const k = rd.est / Math.max(1, rd.sd), pal = rd.est >= 0 ? you : them;
      const c = Math.abs(k) < 0.35 ? toss : Math.abs(k) < 1 ? pal[2] : Math.abs(k) < 2 ? pal[1] : pal[0];
      // a good read is solid; a fuzzy one gets a sparse dot texture; guesswork a denser one
      const dith = rd.sd < 4 ? 0 : rd.sd < 7 ? 2 : 5;
      if (clear) return { c: dith ? mix(c, fog, dith >= 5 ? 0.5 : 0.28) : c, dith: 0, alt: c };
      return { c, dith, alt: mix(c, fog, 0.65) };
    });
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      const q = y * LW + x, k = id[q], o = q * 4;
      if (k < 0) {
        // the board's drop shadow, a few pixels under the state
        const above = [1, 2, 3, 4].some((dy) => y - dy >= 0 && id[q - dy * LW] >= 0);
        if (above && mode !== "preview") { d[o] = shadow[0]; d[o + 1] = shadow[1]; d[o + 2] = shadow[2]; d[o + 3] = 200; } else d[o + 3] = 0;
        continue;
      }
      const right = x + 1 < LW ? id[q + 1] : -2, down = y + 1 < LH ? id[q + LW] : -2, left = x > 0 ? id[q - 1] : -2, up = y > 0 ? id[q - LW] : -2;
      let c = cols[k].c;
      if (cols[k].dith && BAYER[(y & 3) * 4 + (x & 3)] < cols[k].dith) c = cols[k].alt;
      if (right < 0 || down < 0 || left < 0) c = line; // the state's outline
      else if (up < 0) c = mix(c, [255, 255, 255], 0.35); // a lit top edge
      else if (right !== k || down !== k) c = mix(c, line, 0.6); // county lines
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, [geo, s, r, mode, layer, night, byF, regOf, meP, opP, clear]);

  // ---------------------------------------------------------------- sprites, animated, drawn at double size with an outline
  const busRef = useRef<{ from: [number, number]; to: [number, number]; t0: number } | null>(null);
  const lastBus = useRef<string | null>(null);
  useEffect(() => {
    if (!geo || !bus) return; const to = geo.cen.get(bus); if (!to) return;
    const prev = lastBus.current ? geo.cen.get(lastBus.current) : null;
    busRef.current = { from: prev ?? to, to, t0: performance.now() }; lastBus.current = bus;
  }, [bus, geo]);
  const live = useRef({ s, fx, sel, hover, oppPath, oppT0, flash, detail, layer }); useEffect(() => { live.current = { s, fx, sel, hover, oppPath, oppT0, flash, detail, layer }; });
  useEffect(() => {
    const cv = over.current; if (!cv || !geo) return;
    const { LW, LH, id, cen } = geo; cv.width = LW; cv.height = LH;
    const g = cv.getContext("2d")!; g.imageSmoothingEnabled = false;
    const K = LW >= 240 ? 2 : 1;
    const busPal = { P: partyCol(meP, 1), w: "#d8f0ff", S: PAL.gold, k: "#111", g: "#888" };
    const oppPal = { P: partyCol(opP, 1), w: "#ffe0e6", S: "#eee", k: "#111", g: "#888" };
    const put = (b: Bits, cx: number, cy: number, pal: Record<string, string>, flip = false, k = K) => bitsOutlined(g, b, cx - (b[0].length * k) / 2, cy - b.length * k, pal, flip, k);
    const outline = (k: number, col: string, phase: number, solid = false) => {
      g.fillStyle = col;
      for (let q = 0; q < LW * LH; q++) if (id[q] === k) { const x = q % LW, y = (q / LW) | 0; const e = (x + 1 < LW && id[q + 1] !== k) || (x > 0 && id[q - 1] !== k) || (y + 1 < LH && id[q + LW] !== k) || (y > 0 && id[q - LW] !== k); if (e && (solid || ((x + y + phase) & 3) < 3)) g.fillRect(x, y, 1, 1); }
    };
    let raf = 0, lastDraw = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - lastDraw < 66) return; lastDraw = t;
      const L = live.current; g.clearRect(0, 0, LW, LH);
      const fr = Math.floor(t / 260) % 2;
      if (L.flash) for (const f of L.flash) { const k = geo.idx.get(f); if (k != null) outline(k, PAL.gold, 0, true); }
      if (L.hover && mode !== "preview") { const k = geo.idx.get(L.hover); if (k != null) outline(k, "#ffffff", 0, true); }
      if (L.sel) { const k = geo.idx.get(L.sel); if (k != null) outline(k, PAL.gold, Math.floor(t / 120)); }
      const full = L.detail === "full";
      if (mode === "plan") {
        // the other side's stops: on the Their stops layer every stop, otherwise only last week's, and only in full detail
        const opStops = L.layer === "rival" ? Object.keys(L.s.oppVisits) : full ? [...(L.s.oppLast?.stops ?? []), ...(L.s.oppLast?.base ?? [])] : [];
        opStops.forEach((f) => { const c = cen.get(f); if (!c) return; g.fillStyle = "#0b0716"; g.fillRect(Math.round(c[0]) - 2, Math.round(c[1]) - 2, 5, 5); g.fillStyle = partyCol(opP, 1); g.fillRect(Math.round(c[0]) - 1, Math.round(c[1]) - 1, 3, 3); });
        // field offices: a small pin; volunteers walking their turf only in full detail or on the Ground game layer
        L.s.offices.forEach((f, oi) => {
          const c = cen.get(f); if (!c) return;
          if (full || L.layer === "ground") {
            const n = Math.min(full ? 5 : 2, 2 + Math.floor(L.s.volunteers / 500));
            for (let k = 0; k < n; k++) { const a = t / 1500 + k * 2.4 + oi; put(PERSON[(Math.floor(t / 220) + k) % 2], c[0] + Math.cos(a) * (6 + k * 1.5), c[1] + 4 + Math.sin(a * 1.3) * 3, { h: "#3a2a1a", s: "#e8b48f", c: partyCol(meP, 2), l: "#222" }, false, 1); }
            put(FLAG[fr], c[0] + 2, c[1], { P: "#eee", f: partyCol(meP, 1) });
          } else {
            const x = Math.round(c[0]), y = Math.round(c[1]);
            g.fillStyle = "#0b0716"; g.fillRect(x - 2, y - 2, 5, 5); g.fillStyle = PAL.gold; g.fillRect(x - 1, y - 1, 3, 3);
          }
        });
      }
      // your bus
      const b = busRef.current;
      if (b && mode === "plan") {
        const k = Math.min(1, (t - b.t0) / 1100), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const x = b.from[0] + (b.to[0] - b.from[0]) * e, y = b.from[1] + (b.to[1] - b.from[1]) * e - (k < 1 ? Math.abs(Math.sin(k * Math.PI * 6)) * 2 : 0);
        if (k < 1) { g.fillStyle = "#d9bf84"; for (let j = 1; j < 5; j++) g.fillRect(Math.round(x - (b.to[0] > b.from[0] ? 1 : -1) * (j * 3 + 12)), Math.round(y - 2 + (j % 2)), 2, 2); }
        // in clean detail the bus is smaller and parks beside the county, so its name tag stays readable
        if (L.detail === "full") put(BUS, x, y + 2, busPal, b.to[0] < b.from[0]);
        else put(BUS, x + 10, y + 8, busPal, b.to[0] < b.from[0], 1);
      }
      // their bus on its route, during the replay of their week
      if (L.oppPath && L.oppPath.length && L.oppT0 != null) {
        const per = 1300, k = (t - L.oppT0) / per, seg = Math.min(L.oppPath.length - 1, Math.floor(k));
        const a = cen.get(L.oppPath[Math.max(0, seg - 1)]) ?? cen.get(L.oppPath[0]), z = cen.get(L.oppPath[seg]);
        if (a && z) { const u = seg === 0 ? 1 : Math.min(1, k - seg), x = a[0] + (z[0] - a[0]) * u, y = a[1] + (z[1] - a[1]) * u; put(BUS, x, y + 2, oppPal, z[0] < a[0]); }
      }
      // effects
      for (const e of L.fx) {
        const age = t - e.t0; if (age > (full ? 2600 : 1400) || age < 0) continue;
        const c = e.f ? cen.get(e.f) : null;
        if (e.kind === "rally" && c && !full) {
          for (let k = 0; k < 8; k++) { const a = k * 0.8 + age / 300; const rr = age / 60; g.fillStyle = [PAL.gold, partyCol(meP, 1)][k % 2]; g.fillRect(Math.round(c[0] + Math.cos(a) * rr), Math.round(c[1] - 6 + Math.sin(a) * rr * 0.6), 2, 2); }
        }
        if (e.kind === "rally" && c && full) {
          for (let k = 0; k < 7; k++) { const jx = c[0] - 12 + k * 4, jy = c[1] + 6 - (Math.floor((t + k * 90) / 150) % 2) * 2; put(PERSON[(Math.floor(t / 150) + k) % 2], jx, jy, { h: "#3a2a1a", s: k % 2 ? "#e8b48f" : "#a8693f", c: k % 3 ? partyCol(meP, 1) : PAL.hi, l: "#222" }, false, 1); }
          for (let k = 0; k < 18; k++) { const a = k * 0.35 + age / 300; const rr = age / 45; g.fillStyle = [PAL.gold, partyCol(meP, 1), PAL.hi][k % 3]; g.fillRect(Math.round(c[0] + Math.cos(a) * rr), Math.round(c[1] - 10 + Math.sin(a) * rr * 0.6 + age / 160), 2, 2); }
        }
        if (e.kind === "hall" && c) put(BUBBLE, c[0] + (full ? 0 : 12), c[1] - (full ? 4 : 10) - (age / 400 | 0), { w: PAL.hi, k: "#333" }, false, full ? K : 1);
        if (e.kind === "office" && c) { const drop = Math.max(0, 16 - age / 30); put(FLAG[fr], c[0] + 2, c[1] - drop, { P: "#eee", f: PAL.gold }); }
        if (e.kind === "knock" && c) for (let k = 0; k < (full ? 4 : 2); k++) put(HEART, c[0] - 12 + k * 8, c[1] - ((age / 80 + k * 3) % 14), { r: "#ff5a7a" });
        if (e.kind === "reg" && c) put(CLIP, c[0], c[1] - (age / 300 | 0), { k: "#333", w: "#fff", b: partyCol(meP, 1) });
        if (e.kind === "money") { const cc = c ?? [LW / 2, LH / 2]; for (let k = 0; k < (full ? 6 : 3); k++) put(DOLLAR, cc[0] - 20 + k * 8, cc[1] - (age / 30 + k * 6) % 28, { g: PAL.green }); }
        if (e.kind === "bad" && c) { if (Math.floor(age / 150) % 2) put(XMARK, c[0], c[1] + 4, { r: PAL.gop }); }
        if ((e.kind === "poll" || e.kind === "air" || e.kind === "opp") && e.fs) {
          for (const f of e.fs.slice(0, full ? 30 : 6)) {
            const p = cen.get(f); if (!p) continue;
            if (e.kind === "poll") { if ((Math.floor(age / 120) + Math.round(p[0])) % 3 === 0) put(RADAR, p[0], p[1] + 3, { g: PAL.green }, false, 1); }
            else { const fall = Math.min(1, age / 700); put(TV, p[0], p[1] - 14 + fall * 14, { a: "#bbb", k: "#111", s: e.kind === "air" ? partyCol(meP, 2) : partyCol(opP, 2), S: "#fff" }, false, 1); if (fall >= 1) { const rr = (age - 700) / 90; g.fillStyle = e.kind === "air" ? partyCol(meP, 1) : partyCol(opP, 1); for (let a = 0; a < 14; a++) g.fillRect(Math.round(p[0] + Math.cos(a / 2.2) * rr), Math.round(p[1] + Math.sin(a / 2.2) * rr * 0.7), 1, 1); } }
          }
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [geo, mode, meP, opP]);

  const pick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!geo) return null;
    const rc = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rc.left) / rc.width) * geo.LW), y = Math.floor(((e.clientY - rc.top) / rc.height) * geo.LH);
    if (x < 0 || y < 0 || x >= geo.LW || y >= geo.LH) return null;
    let k = geo.id[y * geo.LW + x];
    if (k < 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) { const z = geo.id[(y + dy) * geo.LW + x + dx]; if (z >= 0) { k = z; break; } }
    return k >= 0 ? geo.fips[k] : null;
  };
  // name tags for the biggest counties, plus whatever is selected or under the cursor
  const tags = useMemo(() => {
    if (!geo) return [];
    const big = [...r.counties].sort((a, b) => b[5] - a[5]).slice(0, labels).map((c) => c[0]);
    const want = [...new Set([...(sel ? [sel] : []), ...big])];
    // place each tag above its county, or below, left or right of it when that spot is taken; drop it if none is free
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const out: { f: string; n: string; x: number; y: number }[] = [];
    for (const f of want) {
      const n = r.counties[byF.get(f) ?? -1]?.[1] ?? "", c = geo.cen.get(f); if (!n || !c) continue;
      const w = n.length * 3.2 + 4, h = 6;
      const spots = [[c[0], c[1] - 4], [c[0], c[1] + 8], [c[0] - w / 2 - 3, c[1] + 2], [c[0] + w / 2 + 3, c[1] + 2], [c[0], c[1] - 11]];
      const hit = spots.map(([x, y]) => ({ x, y, b: { x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y } })).find(({ b }) => b.x0 >= 0 && b.x1 <= geo.LW && b.y0 >= 0 && !placed.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0));
      if (!hit && f !== sel) continue;
      const pick = hit ?? { x: c[0], y: c[1] - 4, b: { x0: 0, x1: 0, y0: 0, y1: 0 } };
      placed.push(pick.b); out.push({ f, n, x: pick.x, y: pick.y });
    }
    return out;
  }, [geo, r, labels, sel, byF]);
  if (!geo) return <div className="px-map-ph"><span className="px-spin" />Loading {r.state}</div>;
  return (
    <div className={`px-map ${className ?? ""}`} style={{ aspectRatio: `${geo.LW} / ${geo.LH}`, "--ar": (geo.LW / geo.LH).toFixed(3) } as React.CSSProperties}>
      <canvas ref={base} className="px-cv" aria-hidden="true" />
      <canvas ref={over} className="px-cv over" role="img" aria-label={`Map of ${r.state}`}
        onClick={(e) => { const f = pick(e); if (f && onSel && byF.has(f)) onSel(f); }}
        onMouseMove={(e) => { if (!onHover) return; const f = pick(e); onHover(f && byF.has(f) ? f : null); }}
        onMouseLeave={() => onHover?.(null)} />
      {tags.map((x) => <span key={x.f} className={`px-tagname${x.f === sel ? " sel" : ""}`} style={{ left: `${(100 * x.x) / geo.LW}%`, top: `${(100 * x.y) / geo.LH}%` }}>{x.n}</span>)}
    </div>
  );
}
