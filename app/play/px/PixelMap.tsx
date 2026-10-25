"use client";
// The state as a pixel map. Counties are drawn into a small grid and blown up with hard edges. The campaign only
// sees its own read of each county: a bucket from Safe you to Safe them, dithered with fog where the read is old or
// blurry, never the true number. On top run the sprites: your bus, theirs, field office flags, volunteers walking
// their turf, rally crowds, ad strikes and poll sweeps.
import React, { useEffect, useMemo, useRef } from "react";
import type { CountyPath } from "@/app/components/home/countyGeo";
import { pathsBox, fit } from "@/app/components/home/countyGeo";
import * as E from "../engine";
import { PAL, partyCol, bits, BUS, FLAG, TV, PERSON, HEART, STAR, DOLLAR, CLIP, XMARK, BUBBLE, RADAR } from "./sprites";

export type MapFx = { id: number; kind: "rally" | "hall" | "office" | "knock" | "reg" | "poll" | "air" | "money" | "bad" | "opp"; f?: string; fs?: string[]; t0: number };
export type Layer = "read" | "regions" | "ground" | "rival";
type Geo = { LW: number; LH: number; id: Int16Array; cen: Map<string, [number, number]>; idx: Map<string, number>; fips: string[]; paths: Path2D[]; tr: { sc: number; ox: number; oy: number } };

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hex = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const REGC = ["#ffb547", "#7fd1ff", "#b78cff", "#5ee0a0", "#ff8fb0", "#f4e06b", "#7f8cff", "#ff9f6b"];

export function useMapGeo(paths: CountyPath[] | null, maxW = 256, maxH = 196): Geo | null {
  return useMemo(() => {
    if (!paths || !paths.length || typeof document === "undefined") return null;
    const box = pathsBox(paths); const aspect = (box[2] - box[0]) / Math.max(1, box[3] - box[1]);
    let LW = maxW, LH = Math.round(maxW / aspect);
    if (LH > maxH) { LH = maxH; LW = Math.round(maxH * aspect); }
    const tr = fit(box, LW, LH, 6, 6);
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

export default function PixelMap({ r, s, geo, mode, layer = "read", sel, onSel, hover, onHover, fx = [], night, bus, oppPath, oppT0, className }: {
  r: E.RaceFile; s: E.State; geo: Geo | null; mode: "plan" | "night" | "preview"; layer?: Layer; sel?: string | null; onSel?: (f: string) => void;
  hover?: string | null; onHover?: (f: string | null) => void; fx?: MapFx[]; night?: Map<string, number>; bus?: string | null; oppPath?: string[] | null; oppT0?: number; className?: string;
}) {
  const base = useRef<HTMLCanvasElement>(null), over = useRef<HTMLCanvasElement>(null);
  const meP = r.cands[s.side === "D" ? 0 : 1].party, opP = r.cands[s.side === "D" ? 1 : 0].party;
  const byF = useMemo(() => new Map(r.counties.map((c, i) => [c[0], i])), [r]);
  const regOf = useMemo(() => { const m = new Map<string, number>(); E.regionsOf(r).forEach((g, k) => g.f.forEach((f) => m.set(f, /^(Everywhere else|Rest of the state)$/.test(g.name) ? -1 : k))); return m; }, [r]);

  // ---------------------------------------------------------------- the base layer, redrawn when the state changes
  useEffect(() => {
    const cv = base.current; if (!cv || !geo) return;
    const { LW, LH, id, fips } = geo; cv.width = LW; cv.height = LH;
    const g = cv.getContext("2d")!; const im = g.createImageData(LW, LH); const d = im.data;
    const you = [hex(partyCol(meP, 1)), hex(partyCol(meP, 2)), hex(partyCol(meP, 3))], them = [hex(partyCol(opP, 1)), hex(partyCol(opP, 2)), hex(partyCol(opP, 3))];
    const toss = hex("#c9b07a"), fog = hex(PAL.fog), fog2 = hex(PAL.fog2), none = hex("#2a2246"), edge = hex("#120b24");
    const cols: { c: number[]; dith: number; alt: number[] }[] = fips.map((f) => {
      const i = byF.get(f);
      if (i == null) return { c: none, dith: 0, alt: none };
      if (mode === "night") { const m = night?.get(f); if (m == null) return { c: fog, dith: 4, alt: fog2 }; const a = Math.abs(m); const pal = m >= 0 ? you : them; return { c: a > 20 ? pal[0] : a > 8 ? pal[1] : pal[2], dith: 0, alt: none }; }
      if (layer === "regions") { const k = regOf.get(f); return { c: k == null || k < 0 ? none : hex(REGC[k % REGC.length]), dith: 0, alt: none }; }
      if (layer === "ground") { const v = (s.visits[f] ?? 0) + (s.offices.includes(f) ? 2 : 0) + ((s.visits["reg:" + f] ?? 0) ? 1 : 0); return { c: v ? hex(v >= 4 ? "#ffd166" : v >= 2 ? "#e0a030" : "#8a6420") : none, dith: 0, alt: none }; }
      if (layer === "rival") { const v = s.oppVisits[f] ?? 0; return { c: v ? hex(v >= 3 ? partyCol(opP, 1) : v >= 2 ? partyCol(opP, 2) : partyCol(opP, 3)) : none, dith: 0, alt: none }; }
      const rd = E.readOf(s, f); if (!rd) return { c: fog, dith: 8, alt: fog2 };
      const k = rd.est / Math.max(1, rd.sd), pal = rd.est >= 0 ? you : them;
      const c = Math.abs(k) < 0.35 ? toss : Math.abs(k) < 1 ? pal[2] : Math.abs(k) < 2 ? pal[1] : pal[0];
      const dith = rd.sd < 4 ? 0 : rd.sd < 7 ? 4 : rd.sd < 10 ? 7 : 10;
      return { c, dith, alt: fog };
    });
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      const q = y * LW + x, k = id[q], o = q * 4;
      if (k < 0) { d[o + 3] = 0; continue; }
      const right = x + 1 < LW ? id[q + 1] : -2, down = y + 1 < LH ? id[q + LW] : -2, left = x > 0 ? id[q - 1] : -2, up = y > 0 ? id[q - LW] : -2;
      let c = cols[k].c;
      if (cols[k].dith && BAYER[(y & 3) * 4 + (x & 3)] < cols[k].dith) c = cols[k].alt;
      if (right < 0 || down < 0 || left < 0 || up < 0) c = edge;
      else if ((right !== k || down !== k) && mode !== "preview") c = [Math.round(c[0] * 0.55), Math.round(c[1] * 0.55), Math.round(c[2] * 0.6)];
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, [geo, s, r, mode, layer, night, byF, regOf, meP, opP]);

  // ---------------------------------------------------------------- sprites, animated
  const busRef = useRef<{ from: [number, number]; to: [number, number]; t0: number } | null>(null);
  const lastBus = useRef<string | null>(null);
  useEffect(() => {
    if (!geo || !bus) return; const to = geo.cen.get(bus); if (!to) return;
    const prev = lastBus.current ? geo.cen.get(lastBus.current) : null;
    busRef.current = { from: prev ?? to, to, t0: performance.now() }; lastBus.current = bus;
  }, [bus, geo]);
  const live = useRef({ s, fx, sel, hover, oppPath, oppT0 }); useEffect(() => { live.current = { s, fx, sel, hover, oppPath, oppT0 }; });
  useEffect(() => {
    const cv = over.current; if (!cv || !geo) return;
    const { LW, LH, id, cen } = geo; cv.width = LW; cv.height = LH;
    const g = cv.getContext("2d")!; g.imageSmoothingEnabled = false;
    const busPal = { P: partyCol(meP, 1), w: "#d8f0ff", S: PAL.gold, k: "#111" };
    const oppPal = { P: partyCol(opP, 1), w: "#ffe0e6", S: "#222", k: "#111" };
    const outline = (k: number, col: string, phase: number) => {
      g.fillStyle = col;
      for (let q = 0; q < LW * LH; q++) if (id[q] === k) { const x = q % LW, y = (q / LW) | 0; const e = (x + 1 < LW && id[q + 1] !== k) || (x > 0 && id[q - 1] !== k) || (y + 1 < LH && id[q + LW] !== k) || (y > 0 && id[q - LW] !== k); if (e && ((x + y + phase) & 3) < 3) g.fillRect(x, y, 1, 1); }
    };
    let raf = 0, lastDraw = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - lastDraw < 66) return; lastDraw = t;
      const L = live.current; g.clearRect(0, 0, LW, LH);
      const fr = Math.floor(t / 260) % 2;
      if (L.hover && mode === "plan") { const k = geo.idx.get(L.hover); if (k != null) outline(k, "#ffffffaa", 0); }
      if (L.sel) { const k = geo.idx.get(L.sel); if (k != null) outline(k, PAL.gold, Math.floor(t / 120)); }
      if (mode === "plan") {
        // volunteers walking their turf around each field office
        L.s.offices.forEach((f, oi) => {
          const c = cen.get(f); if (!c) return;
          const n = Math.min(6, 2 + Math.floor(L.s.volunteers / 400));
          for (let k = 0; k < n; k++) { const a = t / 1400 + k * 2.1 + oi; const x = c[0] + Math.cos(a) * (4 + k) - 1, y = c[1] + Math.sin(a * 1.3) * 3 - 2; bits(g, PERSON[(Math.floor(t / 200) + k) % 2], x, y, { h: "#3a2a1a", s: "#e8b48f", c: partyCol(meP, 2), l: "#222" }); }
          bits(g, FLAG[fr], c[0] - 1, c[1] - 7, { P: "#ddd", f: partyCol(meP, 1) });
        });
        // the other side's last stops
        Object.keys(L.s.oppVisits).forEach((f) => { const c = cen.get(f); if (c) { g.fillStyle = (Math.floor(t / 400) % 2) ? partyCol(opP, 1) : partyCol(opP, 3); g.fillRect(Math.round(c[0]), Math.round(c[1]), 1, 1); } });
      }
      // your bus
      const b = busRef.current;
      if (b && mode === "plan") {
        const k = Math.min(1, (t - b.t0) / 1100), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const x = b.from[0] + (b.to[0] - b.from[0]) * e, y = b.from[1] + (b.to[1] - b.from[1]) * e - (k < 1 ? Math.abs(Math.sin(k * Math.PI * 6)) : 0);
        if (k < 1) { g.fillStyle = "#c9b07a"; for (let j = 1; j < 4; j++) g.fillRect(Math.round(x - (b.to[0] > b.from[0] ? j * 2 + 5 : -j * 2 - 5)), Math.round(y + 4 + (j % 2)), 1, 1); }
        bits(g, BUS, x - 5, y - 4, busPal, b.to[0] < b.from[0]);
      }
      // their bus on its route, during the replay of their week
      if (L.oppPath && L.oppPath.length && L.oppT0 != null) {
        const per = 1300, k = (t - L.oppT0) / per, seg = Math.min(L.oppPath.length - 1, Math.floor(k));
        const a = cen.get(L.oppPath[Math.max(0, seg - 1)]) ?? cen.get(L.oppPath[0]), z = cen.get(L.oppPath[seg]);
        if (a && z) { const u = seg === 0 ? 1 : Math.min(1, k - seg), x = a[0] + (z[0] - a[0]) * u, y = a[1] + (z[1] - a[1]) * u; bits(g, BUS, x - 5, y - 4, oppPal, z[0] < a[0]); if (u >= 1) { g.fillStyle = partyCol(opP, 2); g.fillRect(Math.round(z[0]) - 4 + (fr ? 1 : 0), Math.round(z[1]) + 3, 9, 1); } }
      }
      // effects
      for (const e of L.fx) {
        const age = t - e.t0; if (age > 2400 || age < 0) continue;
        const c = e.f ? cen.get(e.f) : null;
        if (e.kind === "rally" && c) {
          for (let k = 0; k < 9; k++) { const jx = c[0] - 8 + (k % 5) * 4 + (k > 4 ? 2 : 0), jy = c[1] + (k > 4 ? 2 : -1) - (Math.floor((t + k * 90) / 150) % 2) * 2; bits(g, PERSON[(Math.floor(t / 150) + k) % 2], jx, jy, { h: "#3a2a1a", s: k % 2 ? "#e8b48f" : "#a8693f", c: k % 3 ? partyCol(meP, 1) : PAL.hi, l: "#222" }); }
          for (let k = 0; k < 14; k++) { const a = k * 0.45 + age / 300; const rr = age / 60; g.fillStyle = [PAL.gold, partyCol(meP, 1), PAL.hi][k % 3]; g.fillRect(Math.round(c[0] + Math.cos(a) * rr), Math.round(c[1] - 6 + Math.sin(a) * rr * 0.6 + age / 200), 1, 1); }
        }
        if (e.kind === "hall" && c) bits(g, BUBBLE, c[0] - 3, c[1] - 9 - (age / 400 | 0), { w: PAL.hi, k: "#333" });
        if (e.kind === "office" && c) { const drop = Math.max(0, 12 - age / 40); bits(g, FLAG[fr], c[0] - 1, c[1] - 7 - drop, { P: "#ddd", f: PAL.gold }); }
        if (e.kind === "knock" && c) for (let k = 0; k < 5; k++) bits(g, HEART, c[0] - 8 + k * 4, c[1] - 6 - ((age / 90 + k * 3) % 10), { r: "#ff5a7a" });
        if (e.kind === "reg" && c) bits(g, CLIP, c[0] - 2, c[1] - 8 - (age / 300 | 0), { k: "#333", w: "#fff", b: partyCol(meP, 1) });
        if (e.kind === "money") { const cc = c ?? [LW / 2, LH / 2]; for (let k = 0; k < 6; k++) bits(g, DOLLAR, cc[0] - 10 + k * 4, cc[1] - (age / 40 + k * 5) % 20, { g: PAL.green }); }
        if (e.kind === "bad" && c) { if (Math.floor(age / 150) % 2) bits(g, XMARK, c[0] - 2, c[1] - 2, { r: PAL.gop }); }
        if ((e.kind === "poll" || e.kind === "air" || e.kind === "opp") && e.fs) {
          for (const f of e.fs.slice(0, 40)) {
            const p = cen.get(f); if (!p) continue;
            if (e.kind === "poll") { if ((Math.floor(age / 100) + Math.round(p[0])) % 3 === 0) bits(g, RADAR, p[0] - 2, p[1] - 2, { g: PAL.green }); }
            else { const fall = Math.min(1, age / 700); bits(g, TV, p[0] - 2, p[1] - 14 + fall * 10, { a: "#999", k: "#111", s: e.kind === "air" ? partyCol(meP, 2) : partyCol(opP, 2), S: "#fff" }); if (fall >= 1) { const rr = (age - 700) / 120; g.fillStyle = e.kind === "air" ? partyCol(meP, 1) : partyCol(opP, 1); for (let a = 0; a < 12; a++) g.fillRect(Math.round(p[0] + Math.cos(a / 1.9) * rr), Math.round(p[1] + Math.sin(a / 1.9) * rr * 0.7), 1, 1); } }
          }
        }
      }
      if (mode === "night") { const k = Math.floor(t / 500) % 2; if (k) { g.fillStyle = "#ffffff10"; g.fillRect(0, 0, LW, LH); } }
      void STAR;
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
    if (k < 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) { const z = geo.id[(y + dy) * geo.LW + x + dx]; if (z >= 0) { k = z; break; } }
    return k >= 0 ? geo.fips[k] : null;
  };
  if (!geo) return <div className="px-map-ph"><span className="px-spin" />Loading {r.state}</div>;
  return (
    <div className={`px-map ${className ?? ""}`} style={{ aspectRatio: `${geo.LW} / ${geo.LH}` }}>
      <canvas ref={base} className="px-cv" aria-hidden="true" />
      <canvas ref={over} className="px-cv over" role="img" aria-label={`Map of ${r.state}`}
        onClick={(e) => { const f = pick(e); if (f && onSel && byF.has(f)) onSel(f); }}
        onMouseMove={(e) => { if (!onHover) return; const f = pick(e); onHover(f && byF.has(f) ? f : null); }}
        onMouseLeave={() => onHover?.(null)} />
    </div>
  );
}
