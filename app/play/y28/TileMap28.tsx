"use client";
// The 2028 map: every state as a pixel tile on one grid, with Maine's and Nebraska's districts as their own small
// tiles, drawn on a canvas at native pixel size and scaled up crisp. Tiles shade by margin, pulse when selected, and
// carry the campaign's marks: your bus, the rival's stops, rally bursts and, on election night, the calls.
import React, { useEffect, useRef } from "react";

export const TILE: Record<string, [number, number]> = {
  AK: [0, 0], ME: [11, 0], VT: [9, 1], NH: [10, 1],
  WA: [1, 2], ID: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], IL: [6, 2], WI: [7, 2], MI: [8, 2], NY: [9, 2], RI: [10, 2], MA: [11, 2],
  OR: [1, 3], NV: [2, 3], WY: [3, 3], SD: [4, 3], IA: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3],
  CA: [1, 4], UT: [2, 4], CO: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4],
  AZ: [2, 5], NM: [3, 5], KS: [4, 5], AR: [5, 5], TN: [6, 5], NC: [7, 5], SC: [8, 5], DC: [9, 5],
  OK: [4, 6], LA: [5, 6], MS: [6, 6], AL: [7, 6], GA: [8, 6],
  HI: [0, 7], TX: [4, 7], FL: [9, 7],
  "ME-1": [10.05, 0.05], "ME-2": [10.55, 0.05], "NE-1": [1.0, 6.2], "NE-2": [1.5, 6.2], "NE-3": [2.0, 6.2],
};
const SMALL = (st: string) => st.includes("-");
const CELL = 16, PAD = 3, K = 4; // drawn at four device pixels per map pixel so the scaled map stays crisp
export const GW = 12 * CELL + PAD * 2, GH = 8 * CELL + PAD * 2 + 4;
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
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const L = live.current; g.setTransform(K, 0, 0, K, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, GW, GH);
      // the night sea and a faint grid
      g.fillStyle = "#0e0820"; g.fillRect(0, 0, GW, GH);
      g.fillStyle = "#1a1036"; for (let x = 0; x < GW; x += 4) for (let y = (x / 4) % 2 ? 2 : 0; y < GH; y += 4) g.fillRect(x, y, 1, 1);
      for (const st of L.states) {
        const p = TILE[st]; if (!p) continue; const sm = SMALL(st); const sz = sm ? 7 : CELL - 2;
        const x = Math.round(PAD + p[0] * CELL), y = Math.round(PAD + p[1] * CELL + 2);
        const isSel = L.sel === st, isHov = L.hov === st, faded = L.dim?.(st);
        // drop shadow, tile, bevel
        g.fillStyle = "#000"; g.fillRect(x + 1, y + 1, sz, sz);
        g.fillStyle = L.fill(st); g.fillRect(x, y, sz, sz);
        g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(x, y, sz, 1); g.fillRect(x, y, 1, sz);
        g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(x, y + sz - 1, sz, 1); g.fillRect(x + sz - 1, y, 1, sz);
        if (faded) { g.fillStyle = "rgba(14,8,32,.62)"; g.fillRect(x, y, sz, sz); }
        if (isHov && !isSel) { g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x, y, sz, sz); }
        if (isSel) { const on = Math.floor(t / 260) % 2 === 0; g.fillStyle = on ? "#ffcc4d" : "#fff6e0"; g.fillRect(x - 1, y - 1, sz + 2, 1); g.fillRect(x - 1, y + sz, sz + 2, 1); g.fillRect(x - 1, y - 1, 1, sz + 2); g.fillRect(x + sz, y - 1, 1, sz + 2); }
        const lab = L.label ? L.label(st) : st;
        if (lab && !sm) { const w = lab.length * 4 - 1; text(g, lab, x + Math.round((sz - w) / 2), y + 3, "#0b0716"); text(g, lab, x + Math.round((sz - w) / 2) - 1, y + 2, faded ? "#8a80b0" : "#fff6e0"); }
        if (sm) { const n = st.slice(-1); text(g, n, x + 2, y + 1, "#fff6e0"); }
      }
      // marks on top
      for (const mk of L.marks) {
        const p = TILE[mk.st]; if (!p) continue; const sm = SMALL(mk.st); const sz = sm ? 7 : CELL - 2;
        const x = Math.round(PAD + p[0] * CELL), y = Math.round(PAD + p[1] * CELL + 2);
        if (mk.kind === "me") { const bob = Math.floor(t / 300) % 2; g.fillStyle = "#000"; g.fillRect(x + sz - 6, y - 4 + bob, 7, 4); g.fillStyle = "#ffcc4d"; g.fillRect(x + sz - 6, y - 5 + bob, 6, 3); g.fillStyle = "#3a2a5a"; g.fillRect(x + sz - 5, y - 4 + bob, 1, 1); g.fillRect(x + sz - 3, y - 4 + bob, 1, 1); }
        if (mk.kind === "opp") { g.fillStyle = "#ff3b5c"; for (let k = 0; k < 4; k++) { g.fillRect(x + 1 + k, y + sz - 5 + k, 1, 1); g.fillRect(x + 4 - k, y + sz - 5 + k, 1, 1); } }
        if (mk.kind === "next") { if (Math.floor(t / 400) % 2) { g.fillStyle = "#ffcc4d"; g.fillRect(x + sz - 3, y + 1, 2, 2); } }
        if (mk.kind === "won" || mk.kind === "lost") { g.fillStyle = mk.col ?? (mk.kind === "won" ? "#41e08f" : "#ff3b5c"); g.fillRect(x + sz - 4, y + sz - 4, 3, 3); }
        if (mk.kind === "burst" || mk.kind === "call") {
          const age = (t - (mk.t0 ?? t)) / 900; if (age < 0 || age > 1) continue;
          const r = Math.round(2 + age * 9), cx = x + sz / 2, cy = y + sz / 2;
          g.fillStyle = mk.col ?? (mk.kind === "call" ? "#fff6e0" : "#ffcc4d");
          for (let a = 0; a < 16; a++) { const an = (a / 16) * Math.PI * 2; g.fillRect(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r), 1, 1); }
        }
      }
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  const pick = (e: React.MouseEvent<HTMLCanvasElement>, fn?: (st: string | null) => void) => {
    const c = cv.current; if (!c || !fn) return; const b = c.getBoundingClientRect();
    const px = ((e.clientX - b.left) / b.width) * GW, py = ((e.clientY - b.top) / b.height) * GH;
    let hit: string | null = null;
    for (const st of live.current.states) { const p = TILE[st]; if (!p) continue; const sz = SMALL(st) ? 7 : CELL - 2; const x = PAD + p[0] * CELL, y = PAD + p[1] * CELL + 2; if (px >= x && px <= x + sz && py >= y && py <= y + sz) { hit = st; if (SMALL(st)) break; } }
    fn(hit);
  };
  return (
    <canvas ref={cv} width={GW * K} height={GH * K} className="y28-map" role="img" aria-label={title}
      onClick={(e) => pick(e, (st) => st && onPick?.(st))} onMouseMove={(e) => pick(e, (st) => onHover?.(st))} onMouseLeave={() => onHover?.(null)} />
  );
}
