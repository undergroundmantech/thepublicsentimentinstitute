"use client";
// The On Point canvasser: a little pixel art figure who walks the home page map from one close race to the next,
// leaves fading footprints, stops at each state to knock, and holds up a bubble with the forecast there. Click
// him or the bubble to open that race. Lives inside the map's SVG so it shares the map's coordinates; moves
// by writing transforms straight to the DOM, so the map itself never re-renders per frame.
import { useEffect, useMemo, useRef, useState } from "react";

export type WalkStop = { st: string; x: number; y: number; title: string; line: string; color: string; href: string };

const PX = 3.2; // viewBox units per sprite pixel
const PAL: Record<string, string> = { h: "#8b6bff", H: "#5a3ee0", s: "#f1c7a3", e: "#1a1030", t: "#f5c542", T: "#d9a21c", p: "#2c2442", b: "#0e0a16", c: "#c98a4b", w: "#ffffff" };
// 9 wide by 13 tall, facing right
const HEAD = [
  "...hhhh..",
  "..hhhhhHH",
  "...ssss..",
  "...sses..",
  "...ssss..",
];
const BODY = [
  "..tttttcw",
  ".ttTtttcw",
  ".s.tTtt.c",
  "...tttt..",
];
const LEGS = {
  a: ["...pppp..", "..pp..pp.", ".pp....pp", "bb.....bb"],
  b: ["...pppp..", "....pp...", "....pp...", "...bbb..."],
  stand: ["...pppp..", "...p..p..", "...p..p..", "..bb..bb."],
};
const WAVE_BODY = [
  "..tttttts",
  ".ttTttt.s",
  ".s.tTtt..",
  "...tttt..",
];

function Sprite({ frame }: { frame: "a" | "b" | "stand" | "wave" }) {
  const rows = [...HEAD, ...(frame === "wave" ? WAVE_BODY : BODY), ...LEGS[frame === "wave" ? "stand" : frame]];
  const out: React.ReactElement[] = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== ".") out.push(<rect key={`${x}-${y}`} x={x * PX} y={y * PX} width={PX + 0.05} height={PX + 0.05} fill={PAL[ch]} />); }));
  return <>{out}</>;
}

export default function Walker({ stops, onOpen }: { stops: WalkStop[]; onOpen: (href: string) => void }) {
  const g = useRef<SVGGElement>(null);
  const flip = useRef<SVGGElement>(null);
  const [frame, setFrame] = useState<"a" | "b" | "stand" | "wave">("stand");
  const [at, setAt] = useState<number | null>(null);
  const [steps, setSteps] = useState<{ x: number; y: number; k: number; t: number }[]>([]);
  // visit order: start at the closest race and keep going to the nearest unvisited one
  const tour = useMemo(() => {
    if (!stops.length) return [] as WalkStop[];
    const left = stops.slice(1), out = [stops[0]];
    while (left.length) {
      const cur = out[out.length - 1];
      let bi = 0, bd = Infinity;
      left.forEach((s, i) => { const d = Math.hypot(s.x - cur.x, s.y - cur.y); if (d < bd) { bd = d; bi = i; } });
      out.push(left.splice(bi, 1)[0]);
    }
    return out;
  }, [stops]);

  useEffect(() => {
    if (!tour.length || !g.current) return;
    const el = g.current, fl = flip.current;
    const W = 9 * PX, H = 13 * PX;
    const place = (x: number, y: number, bob: number, dir: number) => {
      el.setAttribute("transform", `translate(${(x - W / 2).toFixed(2)} ${(y - H + bob).toFixed(2)})`);
      fl?.setAttribute("transform", dir < 0 ? `translate(${W} 0) scale(-1 1)` : "");
    };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    place(tour[0].x, tour[0].y, 0, 1);
    if (reduce) { setAt(0); setFrame("wave"); return; }
    let raf = 0, visible = true, i = 0, phase: "walk" | "stop" = "stop", t0 = performance.now(), from = tour[0], to = tour[0], dur = 0, lastStep = 0, stepK = 0, dir = 1;
    setAt(0); setFrame("wave");
    const STOP = 2600, SPEED = 0.085; // viewBox units per ms
    const tick = (now: number) => {
      const t = now - t0;
      if (phase === "stop") {
        setFrame(Math.floor(t / 320) % 2 ? "wave" : "stand");
        if (t > STOP) {
          from = tour[i]; i = (i + 1) % tour.length; to = tour[i];
          dur = Math.max(500, Math.hypot(to.x - from.x, to.y - from.y) / SPEED);
          dir = to.x >= from.x ? 1 : -1;
          phase = "walk"; t0 = now; setAt(null);
        }
        place(tour[i].x, tour[i].y, 0, dir);
      } else {
        const k = Math.min(1, t / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e;
        const stride = Math.floor(t / 150);
        const bob = stride % 2 ? -1 : 0;
        place(x, y, bob, dir);
        setFrame(stride % 2 ? "a" : "b");
        if (now - lastStep > 300) {
          lastStep = now; stepK++;
          setSteps((s) => [...s.filter((f) => now - f.t < 1800), { x, y, k: stepK, t: now }]);
        }
        if (k >= 1) { phase = "stop"; t0 = now; setAt(i); }
      }
      if (visible) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const svg = el.ownerSVGElement;
    const io = svg ? new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { cancelAnimationFrame(raf); t0 = performance.now() - (phase === "stop" ? 0 : 0); raf = requestAnimationFrame(tick); } }) : null;
    if (svg && io) io.observe(svg);
    return () => { cancelAnimationFrame(raf); io?.disconnect(); };
  }, [tour]);

  if (!tour.length) return null;
  const s = at != null ? tour[at] : null;
  const bw = s ? Math.max(s.title.length * 7.4, s.line.length * 8.6) + 24 : 0;
  const bx = s ? Math.max(4, Math.min(760 - bw - 4, s.x - bw / 2)) : 0;
  const by = s ? Math.max(4, s.y - 13 * PX - 62) : 0;
  return (
    <g className="wk" aria-hidden="true">
      {steps.map((f) => <rect key={f.k} className="wk-step" x={f.x - 1.5 + (f.k % 2 ? 2 : -2)} y={f.y - 1} width={4} height={2.6} />)}
      {s ? <circle key={`ring${at}`} className="wk-ring" cx={s.x} cy={s.y} r={6} style={{ stroke: s.color }} /> : null}
      <g ref={g} className="wk-man" onClick={() => { const n = at != null ? tour[at] : null; if (n) onOpen(n.href); }}>
        <ellipse cx={9 * PX / 2} cy={13 * PX + 0.5} rx={11} ry={2.6} fill="rgba(0,0,0,.45)" />
        <g ref={flip}><Sprite frame={frame} /></g>
      </g>
      {s ? (
        <g key={`b${at}`} className="wk-bub" onClick={() => onOpen(s.href)} style={{ transformOrigin: `${s.x}px ${by + 54}px` }}>
          <rect x={bx} y={by} width={bw} height={46} rx={8} style={{ stroke: s.color }} />
          <polygon points={`${s.x - 6},${by + 46} ${s.x + 6},${by + 46} ${s.x},${by + 54}`} style={{ fill: s.color }} />
          <text className="wk-t1" x={bx + 12} y={by + 18}>{s.title}</text>
          <text className="wk-t2" x={bx + 12} y={by + 36} style={{ fill: s.color }}>{s.line}</text>
        </g>
      ) : null}
    </g>
  );
}

export const WALKER_CSS = `
.opp .usmap .wk-man{cursor:pointer}
.opp .usmap .wk-step{fill:rgba(255,255,255,.55);animation:wk-fade 1.8s linear forwards}
@keyframes wk-fade{to{opacity:0}}
.opp .usmap .wk-ring{fill:none;stroke-width:2;animation:wk-ring 1.3s ease-out infinite}
@keyframes wk-ring{from{r:4;opacity:1}to{r:26;opacity:0}}
.opp .usmap .wk-bub{cursor:pointer;animation:wk-pop .35s steps(4) both}
@keyframes wk-pop{from{transform:scale(.2);opacity:0}to{transform:none;opacity:1}}
.opp .usmap .wk-bub rect{fill:rgba(10,6,18,.94);stroke-width:1.4}
.opp .usmap .wk-bub text{text-anchor:start;pointer-events:none}
.opp .usmap .wk-t1{font:700 12.5px var(--font-b);fill:#fff}
.opp .usmap .wk-t2{font:800 13px var(--font-m)}
:root[data-theme="light"] .opp .usmap .wk-step{fill:rgba(20,10,40,.5)}
@media (prefers-reduced-motion:reduce){.opp .usmap .wk-ring,.opp .usmap .wk-bub{animation:none}}
`;
