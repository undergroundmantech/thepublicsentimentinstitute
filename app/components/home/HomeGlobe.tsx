"use client";
// The home page stage: the 2026 map drawn on a globe that fills the screen, every state shaded by the forecast,
// with Pointy the On Point canvasser walking across it from one close race to the next. Drag to turn the globe,
// hover a state for its odds, click it for the full race. Canvas for the globe, SVG for the mascot and its bubble.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { geoOrthographic, geoPath, geoGraticule10, geoContains, geoCentroid, geoInterpolate, geoDistance, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import Mascot from "./Mascot";
import PollTrail from "@/app/components/opp/PollTrail";
import { RATE, RATING_LABEL, rating, type Rating } from "@/app/lib/opp";

export type GRace = { id: string; st: string; name: string; dem: string; gop: string; m: number; p: number; ind: boolean; href: string; pl?: [number, number, number][] };
const HQ: [number, number] = [-80.19, 25.76];
const NO_ST: string[] = [];
type Office = "senate" | "governor";
const FIPS: Record<string, string> = { "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY" };
const last = (n: string) => n.replace(/\s+(Jr\.|Sr\.|II|III|IV)$/, "").split(" ").slice(-1)[0];
const fm = (m: number, ind = false) => (Math.abs(m) >= 99 ? "Unopposed" : Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(m).toFixed(1)}`);
const pc = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);
type SF = Feature<Geometry, { name: string }> & { st: string };

export default function HomeGlobe({ races, odds, updated, daysOut, opStates = NO_ST }: { races: Record<Office, GRace[]>; odds: { senate: number; house: number; governor: number }; updated: string; daysOut: number; opStates?: string[] }) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const man = useRef<HTMLDivElement>(null);
  const [office, setOffice] = useState<Office>("senate");
  const [geo, setGeo] = useState<{ land: Feature<Geometry> | null; states: SF[] } | null>(null);
  const [tip, setTip] = useState<{ st: string; x: number; y: number; w: number; h: number } | null>(null);
  const [stop, setStop] = useState<GRace | null>(null);
  const [dir, setDir] = useState(1);
  const [walking, setWalking] = useState(true);
  const rot = useRef<[number, number, number]>([96, -38, 0]);
  const dragRef = useRef<{ x: number; y: number; r: [number, number, number]; moved: boolean } | null>(null);
  const hoverRef = useRef<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/us-states.json").then((r) => r.json()), fetch("/geo/world-110m.json").then((r) => r.json())]).then(([us, w]) => {
      const S = feature(us as Topology, (us as Topology).objects.states as GeometryCollection<{ name: string }>) as unknown as { features: (Feature<Geometry, { name: string }> & { id?: string })[] };
      const W = feature(w as Topology, (w as Topology).objects.countries as GeometryCollection) as unknown as { features: (Feature<Geometry> & { id?: string })[] };
      const land = { type: "Feature", properties: {}, geometry: { type: "GeometryCollection", geometries: W.features.filter((f) => f.id !== "840").map((f) => f.geometry) } } as unknown as Feature<Geometry>;
      setGeo({ land, states: S.features.map((f) => ({ ...f, st: FIPS[String(f.id).padStart(2, "0")] ?? "" })).filter((f) => f.st) as SF[] });
    }).catch(() => {});
  }, []);

  const list = races[office];
  const bySt = useMemo(() => Object.fromEntries(list.map((r) => [r.st, r])) as Record<string, GRace>, [list]);
  const rateOf = (r: GRace): Rating => (Math.abs(r.m) >= 99 ? (r.m < 0 ? "safeD" : "safeR") : rating(r.m, r.ind));
  // Pointy's route: the eight closest races, nearest neighbour order
  const tour = useMemo(() => {
    if (!geo) return [] as { r: GRace; ll: [number, number] }[];
    const pts = [...list].filter((r) => Math.abs(r.m) < 99 && r.st !== "AK" && r.st !== "HI").sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).slice(0, 8)
      .map((r) => { const f = geo.states.find((s) => s.st === r.st); return f ? { r, ll: geoCentroid(f as GeoPermissibleObjects) as [number, number] } : null; }).filter(Boolean) as { r: GRace; ll: [number, number] }[];
    if (!pts.length) return pts;
    const out = [pts.shift()!];
    while (pts.length) { const c = out[out.length - 1]; let bi = 0, bd = 9; pts.forEach((p, i) => { const d = geoDistance(c.ll, p.ll); if (d < bd) { bd = d; bi = i; } }); out.push(pts.splice(bi, 1)[0]); }
    return out;
  }, [geo, list]);

  useEffect(() => {
    const c = cv.current, box = wrap.current; if (!c || !box || !geo) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, raf = 0, visible = true;
    const proj = geoOrthographic().clipAngle(90);
    const size = () => {
      W = box.clientWidth; H = box.clientHeight; c.width = W * dpr; c.height = H * dpr; c.style.width = W + "px"; c.style.height = H + "px";
      const R = W < 760 ? W * 1.15 : Math.min(W * 0.62, H * 1.12);
      proj.scale(R).translate([W < 760 ? W / 2 : W * 0.57, W < 760 ? H * 0.58 : H * 0.6]);
    };
    size();
    const path = geoPath(proj, ctx), grat = geoGraticule10();
    const t0 = performance.now();
    // scenery: a twinkling starfield, the odd shooting star, beacons on the closest races, fieldwork arcs from
    // On Point HQ in Miami to every state On Point Polling has surveyed, Pointy's footprints and ballot confetti
    const rnd = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
    const stars = Array.from({ length: 280 }, (_, i) => ({ x: rnd(i), y: rnd(i + 500), r: 0.35 + rnd(i + 900) * 1.35, ph: rnd(i + 1300) * 6.283, sp: 0.5 + rnd(i + 1700) * 1.8, hue: rnd(i + 2100) }));
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null, nextShoot = 2500;
    const centroid = (st: string) => { const f = geo.states.find((g) => g.st === st); return f ? (geoCentroid(f as GeoPermissibleObjects) as [number, number]) : null; };
    const beacons = list.filter((r) => Math.abs(r.m) < 4 && r.st !== "AK" && r.st !== "HI").map((r, i) => ({ ll: centroid(r.st), c: Math.abs(r.m) < 1.5 ? "231,179,65" : r.m < 0 ? (r.ind ? "183,140,255" : "93,140,255") : "255,80,110", d: i * 0.37 })).filter((b) => b.ll) as { ll: [number, number]; c: string; d: number }[];
    const arcs = opStates.map((st, i) => ({ st, ll: centroid(st), d: i * 0.29 })).filter((a) => a.ll) as { st: string; ll: [number, number]; d: number }[];
    const steps: { ll: [number, number]; t: number; side: number }[] = []; let lastStep = 0, side = 1;
    const parts: { x: number; y: number; vx: number; vy: number; c: string; life: number; rot: number; vr: number }[] = [];
    let lastPhase = "stop";
    const facing = (ll: [number, number]) => geoDistance(ll, [-rot.current[0], -rot.current[1]]) < 1.5;
    // the walk: leg k goes from tour[k] to tour[k+1] over the globe surface, then a pause at the stop
    let leg = 0, phase: "walk" | "stop" = "stop", tp = t0, interp = tour.length > 1 ? geoInterpolate(tour[0].ll, tour[1].ll) : null;
    if (tour[0]) setStop(tour[0].r);
    const STOP = 2800;
    const draw = (now: number) => {
      const t = now - t0;
      if (!dragRef.current && !reduce) rot.current = [96 + Math.sin(t / 9000) * 7, -38 + Math.sin(t / 13000) * 2.5, 0];
      proj.rotate(rot.current);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const [cx, cy] = proj.translate(), R = proj.scale();
      // stars
      for (const st of stars) {
        const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(st.ph + t / 1000 * st.sp));
        ctx.fillStyle = st.hue > 0.85 ? `rgba(255,214,140,${a * 0.8})` : st.hue > 0.7 ? `rgba(160,190,255,${a * 0.8})` : `rgba(255,255,255,${a * 0.7})`;
        ctx.fillRect(st.x * W, st.y * H, st.r, st.r);
      }
      if (!reduce) {
        if (!shoot && t > nextShoot) { shoot = { x: W * (0.15 + Math.random() * 0.6), y: H * (0.02 + Math.random() * 0.25), vx: 9 + Math.random() * 6, vy: 3 + Math.random() * 3, life: 1 }; nextShoot = t + 5000 + Math.random() * 6000; }
        if (shoot) {
          const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 12, shoot.y - shoot.vy * 12);
          g.addColorStop(0, `rgba(255,255,255,${shoot.life})`); g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 12, shoot.y - shoot.vy * 12); ctx.stroke();
          shoot.x += shoot.vx; shoot.y += shoot.vy; shoot.life -= 0.018; if (shoot.life <= 0 || shoot.x > W) shoot = null;
        }
      }
      // atmosphere and ocean
      const atm = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.12);
      atm.addColorStop(0, "rgba(120,90,255,.35)"); atm.addColorStop(1, "rgba(120,90,255,0)");
      ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, 6.283); ctx.fill();
      const sea = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R);
      sea.addColorStop(0, "#1a1240"); sea.addColorStop(1, "#07040f");
      ctx.fillStyle = sea; ctx.beginPath(); path({ type: "Sphere" }); ctx.fill();
      ctx.strokeStyle = "rgba(170,150,255,.08)"; ctx.lineWidth = 1; ctx.beginPath(); path(grat); ctx.stroke();
      if (geo.land) { ctx.fillStyle = "#1c1630"; ctx.beginPath(); path(geo.land as GeoPermissibleObjects); ctx.fill(); }
      ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.stroke();
      for (const f of geo.states) {
        const r = bySt[f.st];
        ctx.beginPath(); path(f as GeoPermissibleObjects);
        ctx.fillStyle = r ? RATE[rateOf(r)] : "#2b2440";
        ctx.fill();
        ctx.strokeStyle = hoverRef.current === f.st ? "#fff" : "rgba(10,6,18,.9)"; ctx.lineWidth = hoverRef.current === f.st ? 2.2 : 0.8; ctx.stroke();
      }
      // labels
      ctx.font = "800 11px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const f of geo.states) {
        if (f.st === "DC") continue;
        const ll = geoCentroid(f as GeoPermissibleObjects); if (geoDistance(ll, [-rot.current[0], -rot.current[1]]) > 1.45) continue;
        const b = path.bounds(f as GeoPermissibleObjects); if (b[1][0] - b[0][0] < 34) continue;
        const p = proj(ll); if (!p || (W >= 1100 && p[0] < W * 0.31)) continue;
        const r = bySt[f.st], rt = r ? rateOf(r) : null;
        ctx.fillStyle = rt === "leanD" || rt === "leanR" || rt === "toss" ? "rgba(20,10,40,.85)" : r ? "rgba(255,255,255,.92)" : "rgba(255,255,255,.3)";
        ctx.fillText(f.st, p[0], p[1]);
      }
      // a slow light sweeping over the globe
      if (!reduce) {
        const lx = cx + Math.cos(t / 6000) * R * 0.45, ly = cy - R * 0.35 + Math.sin(t / 8000) * R * 0.12;
        const sh = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * 0.75);
        sh.addColorStop(0, "rgba(200,180,255,.10)"); sh.addColorStop(1, "rgba(200,180,255,0)");
        ctx.save(); ctx.beginPath(); path({ type: "Sphere" }); ctx.clip(); ctx.fillStyle = sh; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); ctx.restore();
      }
      // beacons on the closest races
      for (const bc of beacons) {
        if (!facing(bc.ll)) continue; const p = proj(bc.ll); if (!p) continue;
        for (let k = 0; k < 2; k++) {
          const ph = ((t / 2200) + bc.d + k * 0.5) % 1;
          ctx.strokeStyle = `rgba(${bc.c},${(1 - ph) * 0.8})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 4 + ph * 26, 0, 6.283); ctx.stroke();
        }
        ctx.fillStyle = `rgba(${bc.c},1)`; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 6.283); ctx.fill();
      }
      // fieldwork arcs from HQ
      const hq = facing(HQ) ? proj(HQ) : null;
      if (hq && arcs.length) {
        for (const a of arcs) {
          if (!facing(a.ll)) continue;
          const ip = geoInterpolate(HQ, a.ll), dist = geoDistance(HQ, a.ll);
          const pts: [number, number][] = [];
          for (let k = 0; k <= 36; k++) { const q = proj(ip(k / 36) as [number, number]); if (!q) continue; pts.push([q[0], q[1] - Math.sin(Math.PI * k / 36) * dist * R * 0.55]); }
          if (pts.length < 2) continue;
          ctx.strokeStyle = "rgba(231,179,65,.38)"; ctx.lineWidth = 1.4; ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t / 60;
          ctx.beginPath(); pts.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.setLineDash([]);
          const ph = ((t / 3200) + a.d) % 1, q = pts[Math.min(pts.length - 1, Math.floor(ph * pts.length))];
          ctx.save(); ctx.shadowColor = "#e7b341"; ctx.shadowBlur = 14; ctx.fillStyle = "#ffe2a0"; ctx.beginPath(); ctx.arc(q[0], q[1], 3.2, 0, 6.283); ctx.fill(); ctx.restore();
          const e = pts[pts.length - 1]; ctx.strokeStyle = "rgba(231,179,65,.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e[0], e[1], 5, 0, 6.283); ctx.stroke();
        }
        const pu = 0.5 + 0.5 * Math.sin(t / 400);
        ctx.fillStyle = "#e7b341"; ctx.beginPath(); ctx.arc(hq[0], hq[1], 5, 0, 6.283); ctx.fill();
        ctx.strokeStyle = `rgba(231,179,65,${0.3 + pu * 0.5})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hq[0], hq[1], 9 + pu * 4, 0, 6.283); ctx.stroke();
        ctx.font = "800 10px ui-monospace, monospace"; ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,226,160,.95)"; ctx.fillText("ON POINT HQ", hq[0] + 14, hq[1] + 4);
      }
      // Pointy's footprints
      for (const s0 of steps) {
        if (!facing(s0.ll)) continue; const p = proj(s0.ll); if (!p) continue;
        const age = (now - s0.t) / 4200; if (age > 1) continue;
        ctx.fillStyle = `rgba(255,255,255,${(1 - age) * 0.55})`; ctx.beginPath(); ctx.ellipse(p[0] + s0.side * 4, p[1], 2.6, 1.6, 0, 0, 6.283); ctx.fill();
      }
      while (steps.length && now - steps[0].t > 4200) steps.shift();
      // the canvasser
      if (tour.length && man.current) {
        let ll = tour[leg].ll;
        if (phase === "walk" && interp) {
          const dur = Math.max(1400, geoDistance(tour[leg].ll, tour[(leg + 1) % tour.length].ll) * 26000);
          const k = Math.min(1, (now - tp) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          ll = interp(e) as [number, number];
          if (k >= 1) { leg = (leg + 1) % tour.length; phase = "stop"; tp = now; setWalking(false); setStop(tour[leg].r); ll = tour[leg].ll; }
        } else if (phase === "stop" && now - tp > STOP && tour.length > 1 && !reduce) {
          const nx = (leg + 1) % tour.length; interp = geoInterpolate(tour[leg].ll, tour[nx].ll);
          const a = proj(tour[leg].ll), b = proj(tour[nx].ll); if (a && b) setDir(b[0] >= a[0] ? 1 : -1);
          phase = "walk"; tp = now; setWalking(true); setStop(null);
        }
        const p = proj(ll);
        if (p) { man.current.style.transform = `translate(${p[0]}px, ${p[1]}px)`; man.current.style.opacity = "1"; } else man.current.style.opacity = "0";
        if (phase === "walk" && now - lastStep > 150) { steps.push({ ll, t: now, side }); side = -side; lastStep = now; }
        if (phase === "stop" && lastPhase === "walk" && p) {
          const r = tour[leg].r, col = r.m < 0 ? (r.ind ? ["#b78cff", "#e2d2ff"] : ["#3d7bff", "#8fb0ff"]) : ["#ff3b5c", "#ff8399"];
          for (let k = 0; k < 26; k++) parts.push({ x: p[0], y: p[1] - 120, vx: (Math.random() - 0.5) * 7, vy: -2 - Math.random() * 5, c: k % 3 === 0 ? "#e7b341" : col[k % 2], life: 1, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3 });
        }
        lastPhase = phase;
      }
      // ballot confetti
      for (let k = parts.length - 1; k >= 0; k--) {
        const q = parts[k]; q.x += q.vx; q.y += q.vy; q.vy += 0.16; q.vx *= 0.99; q.rot += q.vr; q.life -= 0.011;
        if (q.life <= 0) { parts.splice(k, 1); continue; }
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, q.life * 1.5); ctx.fillStyle = q.c; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore();
      }
      if (visible && !reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => { size(); if (reduce) draw(performance.now()); }); ro.observe(box);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !reduce) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } }); io.observe(box);
    const hit = (x: number, y: number) => { const ll = proj.invert?.([x, y]); if (!ll || geoDistance(ll, [-rot.current[0], -rot.current[1]]) > 1.57) return null; return geo.states.find((f) => geoContains(f as GeoPermissibleObjects, ll)) ?? null; };
    const move = (e: PointerEvent) => {
      const b = box.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      const d = dragRef.current;
      if (d) {
        const dx = x - d.x, dy = y - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
        const k = 90 / proj.scale(); rot.current = [d.r[0] + dx * k, Math.max(-70, Math.min(10, d.r[1] - dy * k)), 0];
        if (reduce) draw(performance.now());
        return;
      }
      const f = hit(x, y); hoverRef.current = f && bySt[f.st] ? f.st : null;
      setTip(f && bySt[f.st] ? { st: f.st, x, y, w: b.width, h: b.height } : null);
      box.style.cursor = f && bySt[f.st] ? "pointer" : "grab";
    };
    const down = (e: PointerEvent) => { const b = box.getBoundingClientRect(); dragRef.current = { x: e.clientX - b.left, y: e.clientY - b.top, r: [...rot.current] as [number, number, number], moved: false }; };
    const up = (e: PointerEvent) => {
      const d = dragRef.current; dragRef.current = null;
      if (d && !d.moved) { const b = box.getBoundingClientRect(); const f = hit(e.clientX - b.left, e.clientY - b.top); if (f && bySt[f.st]) router.push(bySt[f.st].href); }
    };
    const leave = () => { hoverRef.current = null; setTip(null); dragRef.current = null; };
    box.addEventListener("pointermove", move); box.addEventListener("pointerdown", down); window.addEventListener("pointerup", up); box.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); box.removeEventListener("pointermove", move); box.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); box.removeEventListener("pointerleave", leave); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, bySt, tour, router, list, opStates]);

  const tr = tip ? bySt[tip.st] : null;
  const closest = [...list].filter((r) => Math.abs(r.m) < 99).sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5)).slice(0, 6);
  return (
    <section className="hg" aria-label="2026 forecast globe">
      <div className="hg-stage" ref={wrap}>
        <canvas ref={cv} className="hg-cv" role="img" aria-label={`The 2026 ${office} forecast on a globe, each state shaded by its rating`} />
        <div className="hg-man" ref={man} aria-hidden="true">
          <div className={`hg-flip${dir < 0 ? " l" : ""}`}><Mascot size={150} pose={walking ? "walk" : "cheer"} prop={walking ? "clipboard" : "flag"} look={dir} cap /></div>
          {stop ? (
            <button className="hg-bub" onClick={() => router.push(stop.href)} aria-hidden="true" tabIndex={-1}>
              <b>{stop.name}</b><span className={stop.m < 0 ? (stop.ind ? "i" : "d") : "r"}>{last(stop.m < 0 ? stop.dem : stop.gop)} {fm(stop.m, stop.ind)}</span>{stop.pl?.length ? <span className="hg-bptr"><PollTrail polls={stop.pl.map(([age, margin, n]) => ({ age, margin, n }))} compact width={200} ind={stop.ind} uid={`hb${stop.id}`} /><em>{stop.pl.length} polls</em></span> : null}<small>Click for the race</small>
            </button>
          ) : null}
        </div>
        {tr ? (
          <div className="hg-tip" style={{ left: tip!.x, top: tip!.y, transform: `translate(${tip!.x > tip!.w - 300 ? "calc(-100% - 18px)" : "18px"}, ${tip!.y > tip!.h - 220 ? "calc(-100% - 12px)" : "12px"})` }}>
            <h4>{tr.name}</h4>
            <div className="r"><span style={{ color: tr.ind ? "#b78cff" : "#8fb0ff" }}>{tr.dem}</span><b>{pc(1 - tr.p)}</b></div>
            <div className="r"><span style={{ color: "#ff8399" }}>{tr.gop}</span><b>{pc(tr.p)}</b></div>
            <div className="r"><span>{RATING_LABEL[rateOf(tr)]}</span><b>{fm(tr.m, tr.ind)}</b></div>
            {tr.pl?.length ? <div className="hg-tptr"><span>{tr.pl.length} polls</span><PollTrail polls={tr.pl.map(([age, margin, n]) => ({ age, margin, n }))} compact width={220} ind={tr.ind} uid={`ht${tr.id}`} /></div> : null}
            <div className="cta">Click for the full race</div>
          </div>
        ) : null}
      </div>

      <div className="hg-over">
        <div className="hg-copy">
          <span className="chip"><i />{daysOut} days to Election Day · updated {updated}</span>
          <h1>Every race.<br />Every county.<br /><em>On point.</em></h1>
          <p>The 2026 midterms on one globe. Spin it, hover a state, click it for the full forecast, or follow Pointy, our canvasser, through the closest races.</p>
          <div className="hg-odds">
            {([["Senate", odds.senate, "/forecast?office=senate"], ["House", odds.house, "/forecast?office=house"], ["Governors", odds.governor, "/forecast?office=governor"]] as const).map(([l, v, h]) => (
              <Link key={l} href={h} className={v >= 0.5 ? "d" : "r"}><b>{pc(v >= 0.5 ? v : 1 - v)}</b><span>{v >= 0.5 ? "D" : "R"} {l}</span></Link>
            ))}
          </div>
          <div className="hg-cta"><Link className="btn g" href="/forecast">Open the forecast</Link><Link className="btn" href="/forecast/what-if">Play What if</Link><Link className="btn" href="/maps/electoral">Make a map</Link></div>
        </div>
        <div className="hg-side">
          <div className="hg-tabs" role="tablist" aria-label="Office">
            {(["senate", "governor"] as Office[]).map((o) => <button key={o} role="tab" aria-selected={office === o} className={office === o ? "on" : ""} onClick={() => setOffice(o)}>{o === "senate" ? "Senate" : "Governors"}</button>)}
          </div>
          <div className="hg-list">
            <div className="eye">Closest {office === "senate" ? "Senate" : "governor"} races</div>
            {closest.map((r) => (
              <Link key={r.id} href={r.href} className="hg-row" onMouseEnter={() => { hoverRef.current = r.st; }} onMouseLeave={() => { hoverRef.current = null; }}>
                <span className="st">{r.st}</span><span className="nm">{last(r.dem)} v {last(r.gop)}</span><b className={r.m < 0 ? (r.ind ? "i" : "d") : "r"}>{fm(r.m, r.ind)}</b>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="hg-legend">{(["safeD", "likelyD", "leanD", "toss", "leanR", "likelyR", "safeR"] as Rating[]).map((k) => <span key={k}><i style={{ background: RATE[k] }} />{RATING_LABEL[k]}</span>)}<span><i style={{ background: RATE.ind }} />Independent</span><span className="hint">Drag to spin the globe</span></div>
    </section>
  );
}
