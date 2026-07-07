"use client";

import React, { useEffect, useRef } from "react";
import { loadGeo, makeProjector, geomToPath } from "../onpoint/electionLib.js";

// DeskMapField — the hero backdrop is a broadcast-style tour of the season:
//   1 · the NATIONAL county map fills in red/blue/purple as returns land,
//   2 · the camera dives into one real state (one that actually has races),
//   3 · that state's counties report in close-up, county by county,
//   4 · fade — next state, then back out to the nation. Forever.
// Canvas 2D over the shared us-counties geometry: no WebGL to lose, and the
// zoom is a scene-blit (cheap) followed by a crisp re-fit of the state.

const NAT_COUNT_MS = 46_000;
const NAT_HOLD_MS = 4_500;
const ZOOM_MS = 1_600;
const ST_COUNT_MS = 22_000;
const ST_HOLD_MS = 5_000;
const FADE_MS = 1_200;

const REDS = ["#5c1b20", "#6e2026", "#4c161b"];
const BLUES = ["#1c2f63", "#22397a", "#172750"];
const PURPS = ["#3c2360", "#46296e", "#311d4e"];
const DEFAULT_STATES = ["TX", "CA", "GA", "VA", "MI", "CO", "MO", "NH", "WI", "OR"];

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", FL: "Florida", GA: "Georgia", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska",
  NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "Washington DC",
};

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type County = { id: string; path: Path2D };

export default function DeskMapField({ className, states }: { className?: string; states?: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statesRef = useRef<string[]>(states && states.length ? states : DEFAULT_STATES);
  statesRef.current = states && states.length ? states : DEFAULT_STATES;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    // the persistent scene (counties accumulate here); visible canvas blits it
    const scene = document.createElement("canvas");
    const sctx = scene.getContext("2d")!;

    let geoFeats: any[] = [];           // lower-48 features
    let counties: County[] = [];        // current stage's Path2D set
    let natRect: { x: number; y: number; w: number; h: number } | null = null; // zoom target in scene coords
    let stage: "nat" | "state" = "nat";
    let stageState = "";                // province code when stage === "state"
    let phase: "count" | "hold" | "zoom" | "fade" = "count";
    let phaseStart = 0;
    let lastElapsed = 0;
    let cycleSeed = 0;
    let tourIdx = 0;                    // how many states visited since national
    let raf = 0;
    let idle = 0;
    let alive = true;
    let running = false;

    const colorFor = (id: string, seed: number) => {
      const h = djb2(id + "·" + seed);
      const fam = h % 100;
      const pick = (arr: string[]) => arr[(h >>> 7) % arr.length];
      if (fam < 42) return pick(BLUES);
      if (fam < 84) return pick(REDS);
      return pick(PURPS);
    };
    const reportAt = (id: string, seed: number, cycle: number) => {
      const h = djb2("t·" + id + "·" + seed);
      return Math.pow((h % 10_000) / 10_000, 1.35) * cycle;
    };

    const countMs = () => (stage === "nat" ? NAT_COUNT_MS : ST_COUNT_MS);

    const buildStage = (feats: any[]) => {
      const proj = makeProjector(feats, scene.width, scene.height, Math.floor((stage === "nat" ? 26 : 60) * dpr));
      if (!proj) return false;
      counties = feats.map((f: any) => ({
        id: String(f.properties.county_id),
        path: new Path2D(geomToPath(f.geometry, proj.project)),
      }));
      // wireframe base
      sctx.clearRect(0, 0, scene.width, scene.height);
      sctx.lineWidth = Math.max(0.5, (stage === "nat" ? 0.6 : 0.9) * dpr);
      sctx.strokeStyle = stage === "nat" ? "rgba(244,244,239,0.045)" : "rgba(244,244,239,0.08)";
      for (const c of counties) sctx.stroke(c.path);
      return true;
    };

    // projected bbox of a state's features under the CURRENT (national) projector
    const stateRectInScene = (feats: any[]) => {
      const proj = makeProjector(geoFeats, scene.width, scene.height, Math.floor(26 * dpr));
      if (!proj) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const f of feats) {
        const g = f.geometry;
        const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
        for (const poly of polys) for (const ring of poly) for (const pt of ring) {
          const [px, py] = proj.project(pt[0], pt[1]);
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
        }
      }
      if (!isFinite(minX)) return null;
      // pad + match canvas aspect so the zoom lands framed like the refit
      let w = (maxX - minX) * 1.35, h = (maxY - minY) * 1.35;
      const cxm = (minX + maxX) / 2, cym = (minY + maxY) / 2;
      const ar = scene.width / scene.height;
      if (w / h > ar) h = w / ar; else w = h * ar;
      return { x: cxm - w / 2, y: cym - h / 2, w, h };
    };

    const pickState = () => {
      const avail = statesRef.current.filter((s) => STATE_NAMES[s]);
      const pool = avail.length ? avail : DEFAULT_STATES;
      return pool[(djb2("s·" + cycleSeed + "·" + tourIdx) >>> 3) % pool.length];
    };

    const stateFeats = (st: string) => geoFeats.filter((f: any) => String(f.properties?.county_id || "").startsWith(st + "-"));

    const label = () => (stage === "nat" ? "the nation · reporting" : `${STATE_NAMES[stageState] || stageState} · reporting`);

    const blit = (veil = 0, zoomRect?: { x: number; y: number; w: number; h: number } | null) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (zoomRect) {
        ctx.drawImage(scene, zoomRect.x, zoomRect.y, zoomRect.w, zoomRect.h, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.drawImage(scene, 0, 0);
      }
      if (veil > 0) {
        ctx.fillStyle = `rgba(5,5,5,${veil.toFixed(3)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      // corner label — quiet, mono, broadcast chyron
      ctx.font = `600 ${Math.round(10 * dpr)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = "rgba(244,244,239,0.30)";
      ctx.fillText(label().toUpperCase().split("").join(" "), Math.round(24 * dpr), canvas.height - Math.round(22 * dpr));
    };

    const startStage = (nextStage: "nat" | "state", st = "") => {
      stage = nextStage;
      stageState = st;
      const feats = nextStage === "nat" ? geoFeats : stateFeats(st);
      if (!feats.length || !buildStage(feats)) return;
      phase = "count";
      phaseStart = performance.now();
      lastElapsed = 0;
    };

    const tick = (now: number) => {
      if (!alive || !running) return;
      const elapsed = now - phaseStart;

      if (phase === "count") {
        const cyc = countMs();
        sctx.globalAlpha = stage === "nat" ? 0.82 : 0.92;
        sctx.lineWidth = Math.max(0.5, (stage === "nat" ? 0.55 : 1.0) * dpr);
        for (const c of counties) {
          const t = reportAt(c.id, cycleSeed, cyc);
          if (t > lastElapsed && t <= elapsed) {
            sctx.fillStyle = colorFor(c.id, cycleSeed);
            sctx.fill(c.path);
            sctx.strokeStyle = "rgba(5,5,5,0.5)";
            sctx.stroke(c.path);
          }
        }
        sctx.globalAlpha = 1;
        lastElapsed = elapsed;
        blit();
        if (elapsed >= cyc) { phase = "hold"; phaseStart = now; }
      } else if (phase === "hold") {
        blit();
        const holdMs = stage === "nat" ? NAT_HOLD_MS : ST_HOLD_MS;
        if (elapsed >= holdMs) {
          if (stage === "nat") {
            // dive into a state
            const st = pickState();
            natRect = stateRectInScene(stateFeats(st));
            stageState = st;
            phase = natRect ? "zoom" : "fade";
            phaseStart = now;
          } else {
            phase = "fade";
            phaseStart = now;
          }
        }
      } else if (phase === "zoom") {
        // camera dive: full scene → the state's rect, darkening at the end
        const t = Math.min(1, elapsed / ZOOM_MS);
        const e = easeInOut(t);
        const full = { x: 0, y: 0, w: scene.width, h: scene.height };
        const r = natRect!;
        const cur = {
          x: full.x + (r.x - full.x) * e,
          y: full.y + (r.y - full.y) * e,
          w: full.w + (r.w - full.w) * e,
          h: full.h + (r.h - full.h) * e,
        };
        blit(t > 0.72 ? ((t - 0.72) / 0.28) * 0.85 : 0, cur);
        if (t >= 1) {
          startStage("state", stageState);
        }
      } else {
        // fade through dark → next stop on the tour
        const t = Math.min(1, elapsed / FADE_MS);
        blit(t * 0.95);
        if (t >= 1) {
          cycleSeed++;
          if (stage === "nat") {
            // nat → (zoom handles states); fade from nat only when no rect
            tourIdx++;
            startStage("state", stageState || pickState());
          } else if (tourIdx < 1) {
            tourIdx++;
            startStage("state", pickState());
          } else {
            tourIdx = 0;
            startStage("nat");
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    const build = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      scene.width = canvas.width;
      scene.height = canvas.height;
      loadGeo()
        .then((geo: any) => {
          if (!alive) return;
          geoFeats = geo.features.filter((f: any) => {
            const id = String(f.properties?.county_id || "");
            return id && !id.startsWith("AK-") && !id.startsWith("HI-");
          });
          stage = "nat";
          if (!buildStage(geoFeats)) return;
          if (reduce) {
            sctx.globalAlpha = 0.55;
            for (const c of counties) { sctx.fillStyle = colorFor(c.id, 0); sctx.fill(c.path); }
            sctx.globalAlpha = 1;
            blit();
            return;
          }
          phase = "count";
          phaseStart = performance.now();
          lastElapsed = 0;
          running = true;
          raf = requestAnimationFrame(tick);
        })
        .catch(() => {});
    };

    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduce && counties.length && !running) {
        running = true;
        phaseStart = performance.now() - lastElapsed;
        raf = requestAnimationFrame(tick);
      }
    };
    let resizeT = 0;
    const onResize = () => {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(() => { cancelAnimationFrame(raf); running = false; tourIdx = 0; build(); }, 220);
    };

    const ric = (window as any).requestIdleCallback;
    idle = ric ? ric(build, { timeout: 1600 }) : window.setTimeout(build, 500);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeT);
      const cic = (window as any).cancelIdleCallback;
      if (ric && cic) cic(idle); else window.clearTimeout(idle as number);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
