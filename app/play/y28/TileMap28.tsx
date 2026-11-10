"use client";
// The 2028 map: every state in its real shape, rasterized once into a grid of map pixels and drawn on a canvas at
// that resolution, then scaled up crisp, so it reads as pixel art and still looks like the country. The small
// northeastern states, DC and the Maine and Nebraska districts also get a labeled box down the right edge, so each
// one is easy to read and to click. Tiles shade by margin, the selected state's outline blinks, and the campaign's
// marks sit on top: your bus, the rival's stops, rally bursts and, on election night, the calls.
import React, { useEffect, useRef } from "react";
import { US_STATE_PATHS, MAP_W, MAP_H } from "./statePaths28";

// map pixels: the projected outlines are scaled to MW wide, and a column of boxes sits to the right
const S = 0.4;
const MW = Math.round(MAP_W * S), MH = Math.round(MAP_H * S);
const COL = MW + 4;
export const GW = COL + 22, GH = Math.max(MH, 172);
const K = 4; // device pixels per map pixel on the canvas, so labels and marks stay sharp when scaled
const BOXES = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC", "ME-1", "ME-2", "NE-1", "NE-2", "NE-3"];
const BOX_W = 19, BOX_H = 9, BOX_GAP = 12, BOX_Y0 = 6;
const boxAt = (st: string) => { const i = BOXES.indexOf(st); return i < 0 ? null : { x: COL, y: BOX_Y0 + i * BOX_GAP + (i >= 9 ? 4 : 0) }; };
const boxLabel = (st: string) => st.replace("-", "");

// a 3 by 5 pixel font for the state codes
const F: Record<string, string> = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110", "-": "000000111000000",
};
function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, c: string) {
  g.fillStyle = c; let cx = x;
  for (const ch of s) { const b = F[ch]; if (b) for (let k = 0; k < 15; k++) if (b[k] === "1") g.fillRect(cx + (k % 3), y + Math.floor(k / 3), 1, 1); cx += 4; }
}
const DR = ["#13308f", "#2a5ee8", "#5b8cff", "#a9c2ff"], RR = ["#8f1028", "#e0284b", "#ff6f8a", "#ffbdc9"];
/** Fill for an R minus D margin. */
export function shade(m: number | null) {
  if (m == null || !isFinite(m)) return "#2f1f5a";
  const a = Math.abs(m), k = a >= 15 ? 0 : a >= 7 ? 1 : a >= 3 ? 2 : 3;
  return m < 0 ? DR[k] : RR[k];
}

// ------------------------------------------------------------- the raster, built once per page
type Raster = { codes: string[]; idx: Int16Array; edge: Uint8Array; px: Map<string, number>; at: Map<string, [number, number]> };
let RASTER: Raster | null = null;
function raster(): Raster {
  if (RASTER) return RASTER;
  const codes = Object.keys(US_STATE_PATHS);
  const idx = new Int16Array(MW * MH).fill(-1), best = new Uint8Array(MW * MH);
  const cv = document.createElement("canvas"); cv.width = MW; cv.height = MH; const g = cv.getContext("2d", { willReadFrequently: true })!;
  codes.forEach((st, i) => {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, MW, MH); g.setTransform(S, 0, 0, S, 0, 0);
    g.fillStyle = "#fff"; g.fill(new Path2D(US_STATE_PATHS[st].d));
    const a = g.getImageData(0, 0, MW, MH).data;
    // each map pixel goes to the state that covers most of it
    for (let p = 0; p < MW * MH; p++) { const v = a[p * 4 + 3]; if (v > 96 && v > best[p]) { best[p] = v; idx[p] = i; } }
  });
  // every state keeps at least one pixel, at its centroid, however small it is
  codes.forEach((st, i) => { const [cx, cy] = US_STATE_PATHS[st].c; const x = Math.min(MW - 1, Math.max(0, Math.round(cx * S))), y = Math.min(MH - 1, Math.max(0, Math.round(cy * S))); if (!idx.some((v) => v === i)) idx[y * MW + x] = i; });
  // island chains and slivers, Hawaii above all, grow into the sea around them until they are big enough to see and click
  codes.forEach((st, i) => {
    for (let pass = 0; pass < 3; pass++) {
      let n = 0; for (let p = 0; p < MW * MH; p++) if (idx[p] === i) n++;
      if (n >= 24) break;
      const grow: number[] = [];
      for (let p = 0; p < MW * MH; p++) if (idx[p] === i) { const x = p % MW; for (const q of [p - 1, p + 1, p - MW, p + MW]) if (q >= 0 && q < MW * MH && Math.abs((q % MW) - x) <= 1 && idx[q] < 0) grow.push(q); }
      for (const q of grow) idx[q] = i;
    }
  });
  const edge = new Uint8Array(MW * MH); const px = new Map<string, number>();
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const p = y * MW + x, v = idx[p]; if (v < 0) continue; px.set(codes[v], (px.get(codes[v]) ?? 0) + 1);
    const n = [x > 0 ? idx[p - 1] : -1, x < MW - 1 ? idx[p + 1] : -1, y > 0 ? idx[p - MW] : -1, y < MH - 1 ? idx[p + MW] : -1];
    if (n.some((q) => q !== v)) edge[p] = 1;
  }
  const at = new Map<string, [number, number]>(codes.map((st) => [st, [US_STATE_PATHS[st].c[0] * S, US_STATE_PATHS[st].c[1] * S]]));
  // a few centroids sit badly for labels: Florida's is in the Gulf, Michigan's spans two peninsulas, Louisiana's is in the bayou
  const nudge: Record<string, [number, number]> = { FL: [4, 0], MI: [3, 3], LA: [-3, 0], CA: [-2, 0], ID: [0, 3], KY: [2, 1], WV: [-1, 1], VA: [3, 0], NY: [2, 0], OK: [3, 0], TX: [1, 0], AK: [0, 0], HI: [10, -2] };
  for (const [st, [dx, dy]] of Object.entries(nudge)) { const c = at.get(st); if (c) at.set(st, [c[0] + dx, c[1] + dy]); }
  return (RASTER = { codes, idx, edge, px, at });
}
const hex = (h: string): [number, number, number] => { const s = h.length === 4 ? h.slice(1).split("").map((c) => c + c).join("") : h.slice(1, 7); const n = parseInt(s, 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgba = (h: string): [number, number, number, number] => {
  const m = /^rgba?\(([^)]+)\)$/.exec(h); if (m) { const p = m[1].split(",").map((x) => parseFloat(x)); return [p[0], p[1], p[2], p[3] ?? 1]; }
  const [r, g, b] = hex(h); return [r, g, b, 1];
};

export type Mark = { st: string; kind: "me" | "opp" | "burst" | "call" | "next" | "won" | "lost"; t0?: number; col?: string };
export type TileProps = {
  states: string[]; fill: (st: string) => string; label?: (st: string) => string | null; sel?: string | null; hov?: string | null; marks?: Mark[];
  onPick?: (st: string) => void; onHover?: (st: string | null) => void; dim?: (st: string) => boolean; title: string;
};
export default function TileMap28({ states, fill, label, sel, hov, marks = [], onPick, onHover, dim, title }: TileProps) {
  const cv = useRef<HTMLCanvasElement>(null);
  const live = useRef({ fill, label, sel, hov, marks, dim, states });
  useEffect(() => { live.current = { fill, label, sel, hov, marks, dim, states }; });
  useEffect(() => {
    const c = cv.current; if (!c) return; const g = c.getContext("2d")!; let raf = 0;
    const R = raster();
    const base = document.createElement("canvas"); base.width = GW; base.height = GH; const bg = base.getContext("2d")!;
    const img = bg.createImageData(GW, GH);
    // the night sea, drawn once into every frame's image
    const sea = new Uint8ClampedArray(GW * GH * 4);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const p = (y * GW + x) * 4; const dot = x % 4 === 0 && (y + (x / 4) % 2 * 2) % 4 === 0; sea[p] = dot ? 26 : 14; sea[p + 1] = dot ? 16 : 8; sea[p + 2] = dot ? 54 : 32; sea[p + 3] = 255; }
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const L = live.current; const inMap = new Set(L.states);
      const col = new Map<string, [number, number, number]>(); const dimmed = new Set<string>();
      for (const st of R.codes) { const [r, gg, b] = rgba(inMap.has(st) ? L.fill(st) : "#2a2048"); col.set(st, [r, gg, b]); if (!inMap.has(st) || L.dim?.(st)) dimmed.add(st); }
      const blink = Math.floor(t / 260) % 2 === 0;
      const d = img.data; d.set(sea);
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
        const p = y * MW + x, v = R.idx[p]; if (v < 0) continue; const st = R.codes[v]; const q = (y * GW + x) * 4;
        let [r, gg, b] = col.get(st)!;
        if (dimmed.has(st)) { r = r * 0.42 + 14 * 0.58; gg = gg * 0.42 + 8 * 0.58; b = b * 0.42 + 32 * 0.58; }
        if (L.hov === st && L.sel !== st) { r += (255 - r) * 0.22; gg += (255 - gg) * 0.22; b += (255 - b) * 0.22; }
        if (R.edge[p]) { if (L.sel === st) { [r, gg, b] = blink ? [255, 204, 77] : [255, 246, 224]; } else { r *= 0.55; gg *= 0.55; b *= 0.55; } }
        d[q] = r; d[q + 1] = gg; d[q + 2] = b; d[q + 3] = 255;
      }
      bg.putImageData(img, 0, 0);
      // labels on states big enough to hold one
      for (const st of R.codes) {
        if (BOXES.includes(st)) continue; const n = R.px.get(st) ?? 0; if (n < 70 && st !== "HI") continue;
        const lab = L.label ? L.label(st) : st; if (!lab) continue; const [cx, cy] = R.at.get(st)!; const w = lab.length * 4 - 1;
        const x = Math.round(cx - w / 2), y = Math.round(cy - 2);
        text(bg, lab, x + 1, y + 1, "#0b0716"); text(bg, lab, x, y, dimmed.has(st) ? "#8a80b0" : "#fff6e0");
      }
      // the boxes down the right edge
      for (const st of BOXES) {
        const bx = boxAt(st)!; const live2 = inMap.has(st); const f = live2 ? L.fill(st) : "#2a2048"; const isSel = L.sel === st;
        bg.fillStyle = "#000"; bg.fillRect(bx.x + 1, bx.y + 1, BOX_W, BOX_H);
        bg.fillStyle = f; bg.fillRect(bx.x, bx.y, BOX_W, BOX_H);
        if (!live2 || L.dim?.(st)) { bg.fillStyle = "rgba(14,8,32,.6)"; bg.fillRect(bx.x, bx.y, BOX_W, BOX_H); }
        if (L.hov === st && !isSel) { bg.fillStyle = "rgba(255,255,255,.2)"; bg.fillRect(bx.x, bx.y, BOX_W, BOX_H); }
        if (isSel) { bg.fillStyle = blink ? "#ffcc4d" : "#fff6e0"; bg.fillRect(bx.x - 1, bx.y - 1, BOX_W + 2, 1); bg.fillRect(bx.x - 1, bx.y + BOX_H, BOX_W + 2, 1); bg.fillRect(bx.x - 1, bx.y - 1, 1, BOX_H + 2); bg.fillRect(bx.x + BOX_W, bx.y - 1, 1, BOX_H + 2); }
        const lab = boxLabel(st); const w = lab.length * 4 - 1; text(bg, lab, bx.x + Math.round((BOX_W - w) / 2) + 1, bx.y + 3, "#0b0716"); text(bg, lab, bx.x + Math.round((BOX_W - w) / 2), bx.y + 2, "#fff6e0");
      }
      // scale the map pixels up, then draw the marks at full resolution on top
      g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height); g.drawImage(base, 0, 0, GW * K, GH * K);
      g.setTransform(K, 0, 0, K, 0, 0);
      for (const mk of L.marks) {
        const b = boxAt(mk.st); const pos = b ? [b.x + BOX_W / 2, b.y + BOX_H / 2] : R.at.get(mk.st.split("-")[0]); if (!pos) continue;
        const [cx, cy] = pos;
        if (mk.kind === "me") { const bob = Math.floor(t / 300) % 2 * 0.5; g.fillStyle = "#000"; g.fillRect(cx + 2.5, cy - 7 + bob, 7, 4); g.fillStyle = "#ffcc4d"; g.fillRect(cx + 2, cy - 7.5 + bob, 6.5, 3.5); g.fillStyle = "#3a2a5a"; g.fillRect(cx + 3, cy - 6.5 + bob, 1, 1); g.fillRect(cx + 5, cy - 6.5 + bob, 1, 1); g.fillRect(cx + 7, cy - 6.5 + bob, 1, 1); g.fillStyle = "#111"; g.fillRect(cx + 3, cy - 4 + bob, 1.2, 1.2); g.fillRect(cx + 7, cy - 4 + bob, 1.2, 1.2); }
        if (mk.kind === "opp") { g.fillStyle = "#ff3b5c"; for (let k = 0; k < 4; k++) { g.fillRect(cx - 7 + k, cy + 2 + k, 1, 1); g.fillRect(cx - 4 - k, cy + 2 + k, 1, 1); } }
        if (mk.kind === "next") { if (Math.floor(t / 400) % 2) { g.fillStyle = "#ffcc4d"; g.fillRect(cx + 3, cy - 4, 2, 2); } }
        if (mk.kind === "won" || mk.kind === "lost") { g.fillStyle = "#000"; g.fillRect(cx + 2, cy + 2, 4, 4); g.fillStyle = mk.col ?? (mk.kind === "won" ? "#41e08f" : "#ff3b5c"); g.fillRect(cx + 2.5, cy + 2.5, 3, 3); }
        if (mk.kind === "burst" || mk.kind === "call") {
          const age = (t - (mk.t0 ?? t)) / 900; if (age < 0 || age > 1) continue;
          const r = 2 + age * 10; g.fillStyle = mk.col ?? (mk.kind === "call" ? "#fff6e0" : "#ffcc4d");
          for (let a = 0; a < 20; a++) { const an = (a / 20) * Math.PI * 2; g.fillRect(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r), 1, 1); }
        }
      }
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  const pick = (e: React.MouseEvent<HTMLCanvasElement>, fn?: (st: string | null) => void) => {
    const c = cv.current; if (!c || !fn) return; const b = c.getBoundingClientRect();
    const px = ((e.clientX - b.left) / b.width) * GW, py = ((e.clientY - b.top) / b.height) * GH;
    const L = live.current; let hit: string | null = null;
    for (const st of BOXES) { const bx = boxAt(st)!; if (px >= bx.x && px <= bx.x + BOX_W && py >= bx.y && py <= bx.y + BOX_H) hit = st; }
    if (!hit && px >= 0 && px < MW && py >= 0 && py < MH) { const R = raster(); const v = R.idx[Math.floor(py) * MW + Math.floor(px)]; if (v >= 0) hit = R.codes[v]; }
    fn(hit && L.states.includes(hit) ? hit : null);
  };
  return (
    <canvas ref={cv} width={GW * K} height={GH * K} className="y28-map" role="img" aria-label={title} style={{ ["--ar" as string]: String(GW / GH) } as React.CSSProperties}
      onClick={(e) => pick(e, (st) => st && onPick?.(st))} onMouseMove={(e) => pick(e, (st) => onHover?.(st))} onMouseLeave={() => onHover?.(null)} />
  );
}
