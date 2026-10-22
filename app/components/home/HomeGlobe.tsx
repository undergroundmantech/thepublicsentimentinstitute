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
import Mascot, { MASCOT_CSS } from "./Mascot";
import { RATE, RATING_LABEL, rating, type Rating } from "@/app/lib/opp";

export type GRace = { id: string; st: string; name: string; dem: string; gop: string; m: number; p: number; ind: boolean; href: string };
type Office = "senate" | "governor";
const FIPS: Record<string, string> = { "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY" };
const last = (n: string) => n.replace(/\s+(Jr\.|Sr\.|II|III|IV)$/, "").split(" ").slice(-1)[0];
const fm = (m: number, ind = false) => (Math.abs(m) >= 99 ? "Unopposed" : Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(m).toFixed(1)}`);
const pc = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);
type SF = Feature<Geometry, { name: string }> & { st: string };

export default function HomeGlobe({ races, odds, updated, daysOut }: { races: Record<Office, GRace[]>; odds: { senate: number; house: number; governor: number }; updated: string; daysOut: number }) {
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
  }, [geo, bySt, tour, router]);

  const tr = tip ? bySt[tip.st] : null;
  const closest = [...list].filter((r) => Math.abs(r.m) < 99).sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5)).slice(0, 6);
  return (
    <section className="hg" aria-label="2026 forecast globe">
      <style>{MASCOT_CSS}</style>
      <div className="hg-stage" ref={wrap}>
        <canvas ref={cv} className="hg-cv" role="img" aria-label={`The 2026 ${office} forecast on a globe, each state shaded by its rating`} />
        <div className="hg-man" ref={man} aria-hidden="true">
          <div className={`hg-flip${dir < 0 ? " l" : ""}`}><Mascot size={150} walking={walking} look={dir} /></div>
          {stop ? (
            <button className="hg-bub" onClick={() => router.push(stop.href)} aria-hidden="true" tabIndex={-1}>
              <b>{stop.name}</b><span className={stop.m < 0 ? (stop.ind ? "i" : "d") : "r"}>{last(stop.m < 0 ? stop.dem : stop.gop)} {fm(stop.m, stop.ind)}</span><small>Click for the race</small>
            </button>
          ) : null}
        </div>
        {tr ? (
          <div className="hg-tip" style={{ left: tip!.x, top: tip!.y, transform: `translate(${tip!.x > tip!.w - 300 ? "calc(-100% - 18px)" : "18px"}, ${tip!.y > tip!.h - 220 ? "calc(-100% - 12px)" : "12px"})` }}>
            <h4>{tr.name}</h4>
            <div className="r"><span style={{ color: tr.ind ? "#b78cff" : "#8fb0ff" }}>{tr.dem}</span><b>{pc(1 - tr.p)}</b></div>
            <div className="r"><span style={{ color: "#ff8399" }}>{tr.gop}</span><b>{pc(tr.p)}</b></div>
            <div className="r"><span>{RATING_LABEL[rateOf(tr)]}</span><b>{fm(tr.m, tr.ind)}</b></div>
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
