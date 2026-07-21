"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { loadGeo, makeProjector, geomToPath, candColor } from "../onpoint/electionLib.js";

// DeskSphere — the desk opens INSIDE a sphere of election boards.
//
// Technical notes, because the nuances are the point:
// · true spherical lattice — five latitude bands; cells share lon-angle, so
//   high-latitude boards physically narrow (cos φ) and converge toward the
//   poles. The distortion is the sphere's, not a bent cylinder's.
// · a wide lens (78°) close to the wall makes patches visibly curve in BOTH
//   axes; every patch is a 14×8-segment sphere section, not a rotated plane.
// · brightness follows the gaze — each board's luminance falls off with its
//   angular distance from the camera forward vector, so the wall has depth
//   instead of a uniform sprite-sheet glow. Hover lifts a board above that.
// · boards are painted per RACE and cached; cells re-use textures so a
//   90-cell wall costs ~60 canvases. Local contests are drawn at locality
//   scope (their county, neighbors for context) — not everything is a state.
// · drag has inertia, release keeps momentum, yaw velocity rolls the camera
//   a hair; idle drifts; the cursor parallaxes; entrance staggers cell-by-
//   cell; click dives INTO the board (fov 78 → 23) under a rising veil.
// · the viewport edge falls into backdrop-blur + vignette (see the overlay
//   divs) — the reference's soft-edge look.

type SphereDoc = {
  id: number;
  race: any;
  province: string;
  stateName?: string;
  contest: string;
  office?: string;
  date?: string;
  reporting?: number;
};

// many SMALL cells → the wall reads as one continuously warped surface (the
// reference's barrel distortion), not a few big leaning facets
const COLS = 24;                                   // 15° cells
const ROWS = 5;
const LON_SPAN = (2 * Math.PI) / COLS;
const LAT_SPAN = THREE.MathUtils.degToRad(14.4);
const LAT_CENTERS = [-30.8, -15.4, 0, 15.4, 30.8].map((d) => THREE.MathUtils.degToRad(d));
const RADIUS = 8;
const FOV = 72;                                    // vertical, pre-distortion
const K1 = 0.38;                                   // fisheye strength — the bow
const TEX_W = 448;
const TEX_H = 432;

// a rectilinear camera CANCELS the sphere's curvature at screen center — the
// "inside a sphere" read comes from a fisheye pass: render to a target, then
// barrel-warp it on a fullscreen quad. Grid lines bow, corners curl in.
const FISH_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const FISH_FRAG = `
uniform sampler2D tDiffuse;
uniform float k1;
uniform float aspect;
varying vec2 vUv;
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  vec2 ca = vec2(c.x * aspect, c.y);
  float maxR2 = aspect * aspect + 1.0;
  float r2 = dot(ca, ca) / maxR2;
  float f = (1.0 + k1 * r2) / (1.0 + k1);
  vec2 s = c * f * 0.5 + 0.5;
  gl_FragColor = texture2D(tDiffuse, s);
  #include <colorspace_fragment>
}
`;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * 1.02), Math.max(0.12, Math.min(0.58, hsl.l * (0.5 + 0.27 * k))));
  return `#${c.getHexString()}`;
}

const surname = (n?: string) => (n ? n.trim().split(/\s+/).pop() || n : "");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// a curved patch of the sphere's inner wall, centered on lon=0 at `lat`
function patchGeometry(lat: number): THREE.BufferGeometry {
  const segX = 14, segY = 8;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let iy = 0; iy <= segY; iy++) {
    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX, v = iy / segY;
      const lon = (u - 0.5) * LON_SPAN;
      const la = lat + (0.5 - v) * LAT_SPAN;
      pos.push(RADIUS * Math.cos(la) * Math.sin(lon), RADIUS * Math.sin(la), -RADIUS * Math.cos(la) * Math.cos(lon));
      uv.push(u, 1 - v);
    }
  }
  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * (segX + 1) + ix, b = a + 1, c = a + segX + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

type Cell = {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  doc: SphereDoc;
  yaw: number;
  lat: number;
  dir: THREE.Vector3;   // unit vector to the cell's center
  painted: boolean;
  bornAt: number;
  hoverK: number;
};

export default function DeskSphere({
  docs,
  onOpen,
  className,
}: {
  docs: SphereDoc[];
  onOpen: (doc: SphereDoc) => void;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const veilRef = useRef<HTMLDivElement | null>(null);
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !docsRef.current.length) return;
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 820;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 40);
    camera.rotation.order = "YXZ";

    // fisheye pipeline: scene → render target → barrel-warped fullscreen quad
    const rt = new THREE.WebGLRenderTarget(2, 2, { samples: 4 });
    const fishMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: rt.texture },
        k1: { value: K1 },
        aspect: { value: 1 },
      },
      vertexShader: FISH_VERT,
      fragmentShader: FISH_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const fishScene = new THREE.Scene();
    const fishCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    fishScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fishMat));

    // the same lens math, for pointer → scene mapping (hover + click)
    const undistort = (nx: number, ny: number): [number, number] => {
      const aspect = camera.aspect;
      const ax = nx * aspect, ay = ny;
      const r2 = (ax * ax + ay * ay) / (aspect * aspect + 1);
      const f = (1 + K1 * r2) / (1 + K1);
      return [nx * f, ny * f];
    };

    // ── the lattice ───────────────────────────────────────────────────────
    const rowGeos = LAT_CENTERS.map((la) => patchGeometry(la));
    const cells: Cell[] = [];
    // interleave docs by state so neighboring cells never share a state
    const buckets = new Map<string, SphereDoc[]>();
    for (const d of docsRef.current) {
      const k = String(d.province || "?");
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(d);
    }
    const lists = [...buckets.values()];
    const pool: SphereDoc[] = [];
    let remaining = docsRef.current.length;
    let li = 0;
    while (remaining > 0) {
      const l = lists[li % lists.length];
      if (l.length) {
        pool.push(l.shift()!);
        remaining--;
      }
      li++;
    }
    let di = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const doc = pool[di % pool.length];
        di++;
        const mat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, transparent: true, opacity: 0 });
        const mesh = new THREE.Mesh(rowGeos[r], mat);
        const yaw = c * LON_SPAN + (r % 2 ? LON_SPAN / 2 : 0);
        mesh.rotation.y = yaw;
        mesh.userData.cell = cells.length;
        scene.add(mesh);
        const la = LAT_CENTERS[r];
        cells.push({
          mesh, mat, doc, yaw, lat: la,
          dir: new THREE.Vector3(Math.cos(la) * Math.sin(yaw), Math.sin(la), -Math.cos(la) * Math.cos(yaw)),
          painted: false, bornAt: -1, hoverK: 0,
        });
      }
    }

    // ── board textures (cached per race) ─────────────────────────────────
    let geoFeats: any[] | null = null;
    const stateNamesCache = new Map<string, { id: string; name: string; nname: string }[]>();
    loadGeo()
      .then((geo: any) => {
        geoFeats = geo.features.filter((f: any) => {
          const id = String(f.properties?.county_id || "");
          return id && !id.startsWith("AK-") && !id.startsWith("HI-");
        });
      })
      .catch(() => { geoFeats = []; });

    const fam = getComputedStyle(host).fontFamily || "Manrope, sans-serif";
    const mono = '"JetBrains Mono", ui-monospace, monospace';
    const texCache = new Map<number, THREE.CanvasTexture>();

    // find the county a local contest lives in — locality beats state
    const localityOf = (d: SphereDoc, feats: any[]): any | null => {
      let list = stateNamesCache.get(d.province);
      if (!list) {
        list = feats.map((f: any) => {
          const id = String(f.properties.county_id);
          const name = id.slice(d.province.length + 1);
          return { id, name, nname: norm(name) };
        });
        stateNamesCache.set(d.province, list);
      }
      const hay = norm(`${d.contest || ""} ${d.office || ""}`);
      let best: { f: any; len: number } | null = null;
      for (const it of list) {
        if (it.nname.length < 4) continue;
        if (hay.includes(it.nname)) {
          const f = feats.find((x: any) => String(x.properties.county_id) === it.id);
          if (f && (!best || it.nname.length > best.len)) best = { f, len: it.nname.length };
        }
      }
      return best?.f || null;
    };

    const bboxOf = (f: any): [number, number, number, number] => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const g = f.geometry;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
      for (const poly of polys) for (const ring of poly) for (const pt of ring) {
        if (pt[0] < x0) x0 = pt[0]; if (pt[0] > x1) x1 = pt[0];
        if (pt[1] < y0) y0 = pt[1]; if (pt[1] > y1) y1 = pt[1];
      }
      return [x0, y0, x1, y1];
    };

    const paintDoc = (d: SphereDoc): THREE.CanvasTexture => {
      const cached = texCache.get(d.id);
      if (cached) return cached;

      const cv = document.createElement("canvas");
      cv.width = TEX_W;
      cv.height = TEX_H;
      const ctx = cv.getContext("2d")!;

      // the wall + the continuous grid line
      ctx.fillStyle = "#050506";
      ctx.fillRect(0, 0, TEX_W, TEX_H);
      ctx.strokeStyle = "rgba(244,244,239,0.09)";
      ctx.lineWidth = 1.3;
      ctx.strokeRect(0, 0, TEX_W, TEX_H);

      const cands = Array.isArray(d.race?.candidates) ? [...d.race.candidates].sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0)) : [];
      const lead = cands[0];
      const run = cands[1];
      const tone = lead ? candColor(lead) : "#7c86a0";
      const tone2 = run ? candColor(run) : "#3a4152";
      const total = cands.reduce((s: number, c: any) => s + (c.votes || 0), 0);
      const lpct = total && lead ? (100 * (lead.votes || 0)) / total : 0;
      const called = cands.some((c: any) => c.winner);
      const h = djb2(String(d.id));

      // locality first — a contest that names a county is drawn AT the county
      const feats = geoFeats && d.province ? geoFeats.filter((f: any) => String(f.properties?.county_id || "").startsWith(d.province + "-")) : [];
      const local = feats.length > 6 ? localityOf(d, feats) : null;

      // boards fill the cell — tight margins, aspect varies with content
      const kind = local ? (h % 2 ? 1 : 2) : h % 5 < 3 ? 0 : h % 5 === 3 ? 2 : 1;
      const M = 24, TOP = 26, BOT = 36;
      const availW = TEX_W - M * 2, availH = TEX_H - TOP - BOT;
      const bw = kind === 0 ? availW : kind === 1 ? Math.round(availW * 0.64) : Math.round(availW * 0.82);
      const bh = kind === 0 ? Math.round(availH * 0.82) : availH;
      const bx = (TEX_W - bw) / 2;
      const by = TOP + (availH - bh) / 2;

      // board face — a whisper of depth, edge shadow into the wall
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = "#0b0c11";
      ctx.fillRect(bx, by, bw, bh);
      ctx.restore();
      const sheen = ctx.createLinearGradient(0, by, 0, by + bh);
      sheen.addColorStop(0, "rgba(255,255,255,0.05)");
      sheen.addColorStop(0.3, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = "rgba(244,244,239,0.14)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

      // ── the map ── locality (county + neighbors) or statewide mosaic
      const footH = 40;
      const mw = Math.round(bw - 20);
      const mh = Math.round(bh - footH - 16);
      if (feats.length && mw > 10 && mh > 10) {
        const map = document.createElement("canvas");
        map.width = mw;
        map.height = mh;
        const mc = map.getContext("2d")!;
        if (local) {
          // context = neighbors inside the target's grown bbox
          const [x0, y0, x1, y1] = bboxOf(local);
          const gx = (x1 - x0) * 0.9 + 0.02, gy = (y1 - y0) * 0.9 + 0.02;
          const ctxFeats = feats.filter((f: any) => {
            const [a0, b0, a1, b1] = bboxOf(f);
            return a1 > x0 - gx && a0 < x1 + gx && b1 > y0 - gy && b0 < y1 + gy;
          });
          const proj = makeProjector(ctxFeats.length ? ctxFeats : [local], mw, mh, 10);
          if (proj) {
            for (const f of ctxFeats) {
              if (f === local) continue;
              const p = new Path2D(geomToPath(f.geometry, proj.project));
              mc.fillStyle = "#111318";
              mc.fill(p);
              mc.strokeStyle = "rgba(244,244,239,0.1)";
              mc.lineWidth = 0.8;
              mc.stroke(p);
            }
            const p = new Path2D(geomToPath(local.geometry, proj.project));
            const g2 = mc.createLinearGradient(0, 0, mw, mh);
            g2.addColorStop(0, shade(tone, 3));
            g2.addColorStop(1, shade(tone, 1));
            mc.fillStyle = g2;
            mc.fill(p);
            mc.strokeStyle = "rgba(244,244,239,0.55)";
            mc.lineWidth = 1.6;
            mc.stroke(p);
          }
        } else {
          const proj = makeProjector(feats, mw, mh, 8);
          if (proj) {
            for (const f of feats) {
              const id = String(f.properties.county_id);
              const ch = djb2(id + "·" + d.id);
              const leaderSide = ch % 100 < Math.max(36, Math.min(76, lpct));
              mc.fillStyle = shade(leaderSide ? tone : tone2, (ch >>> 6) % 4);
              const p = new Path2D(geomToPath(f.geometry, proj.project));
              mc.fill(p);
              mc.strokeStyle = "rgba(4,4,6,0.6)";
              mc.lineWidth = 0.75;
              mc.stroke(p);
            }
          }
        }
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 12;
        ctx.drawImage(map, bx + 10, by + 8);
        ctx.restore();
      }

      // the board's lower third — name · share · status on a hairline
      if (lead) {
        const yLine = by + bh - footH;
        ctx.strokeStyle = "rgba(244,244,239,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 10, yLine);
        ctx.lineTo(bx + bw - 10, yLine);
        ctx.stroke();
        const yTx = by + bh - 14;
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f4f4ef";
        ctx.font = `800 18px ${fam}`;
        const nm = surname(lead.name);
        ctx.fillText(nm, bx + 10, yTx, bw * 0.48);
        const nw = Math.min(ctx.measureText(nm).width, bw * 0.48);
        ctx.font = `700 15.5px ${fam}`;
        ctx.fillStyle = tone;
        ctx.fillText(`${lpct.toFixed(1)}%`, bx + 10 + nw + 8, yTx);
        ctx.font = `600 10.5px ${fam}`;
        ctx.fillStyle = called ? tone : "rgba(244,244,239,0.52)";
        ctx.textAlign = "right";
        ctx.fillText(called ? "✓ called" : `${Math.round(d.reporting || 0)}% in`, bx + bw - 10, yTx);
        ctx.textAlign = "left";
        ctx.fillStyle = tone;
        ctx.fillRect(bx, by, 3, 22);
      }

      // wall labels hug the board's corners — the grid typography
      const ty = by - 9, byy = by + bh + 19;
      ctx.font = `600 10.5px ${mono}`;
      ctx.fillStyle = "rgba(244,244,239,0.68)";
      const place = local
        ? String(local.properties.county_id).slice(d.province.length + 1).toUpperCase()
        : (d.stateName || d.province || "").toUpperCase();
      ctx.fillText(place.slice(0, 22), bx, ty);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(244,244,239,0.34)";
      const yr = d.date ? String(new Date(d.date + "T00:00:00").getFullYear()) : "2026";
      ctx.fillText(yr, bx + bw, ty);
      ctx.textAlign = "left";
      const tag = (local ? d.stateName || d.province : d.office || "contest").toUpperCase().slice(0, 20);
      ctx.font = `600 9.5px ${mono}`;
      const tw = ctx.measureText(tag).width;
      const ph = 19;
      ctx.strokeStyle = "rgba(244,244,239,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      (ctx as any).roundRect(bx, byy - ph + 6, tw + 14, ph, 9.5);
      ctx.stroke();
      ctx.fillStyle = "rgba(244,244,239,0.55)";
      ctx.fillText(tag, bx + 7, byy);

      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      texCache.set(d.id, tex);
      return tex;
    };

    let paintCursor = 0;
    let fontsReady = false;
    document.fonts?.ready.then(() => { fontsReady = true; }).catch(() => { fontsReady = true; });

    // ── camera + interaction ─────────────────────────────────────────────
    let yaw = -0.55, pitch = 0, roll = 0;
    let tYaw = 0, tPitch = 0;
    let vYaw = 0;
    let dragging = false;
    let dragMoved = 0;
    let lastX = 0, lastY = 0;
    let lastInteract = performance.now();
    let mouseNX = 0, mouseNY = 0;
    let hovered = -1;
    const born = performance.now();
    let flying: null | { from: { yaw: number; pitch: number; fov: number }; to: { yaw: number; pitch: number; fov: number }; start: number; doc: SphereDoc; fired: boolean } = null;
    let exitP = 0;
    const wrap = host.closest(".desk-orb-wrap") as HTMLElement | null;
    const camDir = new THREE.Vector3();

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const pick = (cx: number, cy: number): number => {
      const r = host.getBoundingClientRect();
      if (cy < r.top || cy > r.bottom) return -1;
      const [ux, uy] = undistort(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ndc.set(ux, uy);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(scene.children, false)[0];
      return hit ? (hit.object.userData.cell as number) : -1;
    };

    const onDown = (e: PointerEvent) => {
      if (flying) return;
      dragging = true;
      dragMoved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      lastInteract = performance.now();
      host.style.cursor = "grabbing";
      host.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      mouseNX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNY = (e.clientY / window.innerHeight) * 2 - 1;
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        dragMoved += Math.abs(dx) + Math.abs(dy);
        lastX = e.clientX;
        lastY = e.clientY;
        const k = 0.0034;
        tYaw -= dx * k;
        vYaw = -dx * k;
        tPitch = THREE.MathUtils.clamp(tPitch + dy * 0.0027, -0.42, 0.42);
        lastInteract = performance.now();
      } else if (!flying) {
        const i = pick(e.clientX, e.clientY);
        if (i !== hovered) {
          hovered = i;
          host.style.cursor = i >= 0 ? "pointer" : "grab";
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      host.style.cursor = "grab";
      lastInteract = performance.now();
      if (dragMoved < 7 && !flying) {
        const i = pick(e.clientX, e.clientY);
        if (i >= 0) {
          const cell = cells[i];
          let dy2 = cell.yaw - (((yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
          if (dy2 > Math.PI) dy2 -= 2 * Math.PI;
          if (dy2 < -Math.PI) dy2 += 2 * Math.PI;
          flying = {
            from: { yaw, pitch, fov: camera.fov },
            to: { yaw: yaw + dy2, pitch: cell.lat, fov: 19 },
            start: performance.now(),
            doc: cell.doc,
            fired: false,
          };
          host.style.cursor = "default";
        }
      }
    };

    host.style.cursor = "grab";
    host.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    const size = () => {
      const w = host.clientWidth || 1, hh = host.clientHeight || 1;
      const pr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
      renderer.setPixelRatio(pr);
      renderer.setSize(w, hh);
      rt.setSize(Math.round(w * pr), Math.round(hh * pr));
      camera.aspect = w / hh;
      camera.updateProjectionMatrix();
      fishMat.uniforms.aspect.value = camera.aspect;
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(host);

    // ── the loop ──────────────────────────────────────────────────────────
    let raf = 0;
    let alive = true;
    let running = true;
    const veil = veilRef.current;

    const tick = (now: number) => {
      if (!alive || !running) return;
      try {
        renderTick(now);
      } catch (err) {
        // a bad race/geometry must never permanently freeze the whole wall —
        // log it, drop this frame, and keep the loop alive.
        console.warn("DeskSphere: render tick error, skipping frame", err);
      } finally {
        if (alive && running) raf = requestAnimationFrame(tick);
      }
    };

    const renderTick = (now: number) => {
      if (geoFeats && fontsReady) {
        let n = 0;
        while (paintCursor < cells.length && n < 2) {
          const cell = cells[paintCursor];
          try {
            cell.mat.map = paintDoc(cell.doc);
            cell.mat.needsUpdate = true;
          } catch (err) {
            // one malformed board's texture must never stop the rest of the
            // wall from painting — skip it and move on.
            console.warn("DeskSphere: skipped a board texture", cell.doc?.id, err);
          }
          cell.painted = true;
          cell.bornAt = now + (paintCursor % COLS) * 22 + Math.floor(paintCursor / COLS) * 46;
          paintCursor++;
          n++;
        }
      }

      camera.getWorldDirection(camDir);

      // entrance · gaze falloff · hover — per board, every frame
      for (const c of cells) {
        if (!c.painted) { c.mat.opacity = 0; continue; }
        const t = c.bornAt < 0 ? 1 : THREE.MathUtils.clamp((now - c.bornAt) / 600, 0, 1);
        const e = easeOutCubic(t);
        const hoverWant = hovered >= 0 && cells[hovered] === c && !flying ? 1 : 0;
        c.hoverK += (hoverWant - c.hoverK) * 0.16;
        const gaze = THREE.MathUtils.clamp((c.dir.dot(camDir) - 0.35) / 0.6, 0, 1);
        const b = (0.52 + 0.48 * (gaze * gaze * (3 - 2 * gaze))) * (0.7 + 0.3 * e);
        c.mat.opacity = e;
        c.mat.color.setScalar(Math.min(1, b + 0.22 * c.hoverK));
        c.mesh.scale.setScalar((0.968 + 0.032 * e) * (1 + 0.014 * c.hoverK));
      }

      if (wrap) {
        const r = wrap.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        exitP = THREE.MathUtils.clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
      }

      if (flying) {
        const t = Math.min(1, (now - flying.start) / 760);
        const e = easeInOut(t);
        yaw = tYaw = flying.from.yaw + (flying.to.yaw - flying.from.yaw) * e;
        pitch = tPitch = flying.from.pitch + (flying.to.pitch - flying.from.pitch) * e;
        camera.fov = flying.from.fov + (flying.to.fov - flying.from.fov) * e;
        camera.updateProjectionMatrix();
        roll *= 0.9;
        if (veil) veil.style.opacity = String(Math.max(0, (t - 0.45) / 0.55));
        if (t >= 1 && !flying.fired) {
          flying.fired = true;
          onOpenRef.current(flying.doc);
        }
      } else {
        const settle = reduce ? 1 : THREE.MathUtils.clamp((now - born) / 1500, 0, 1);
        const settleYaw = -0.55 * (1 - easeOutCubic(settle));
        const idleFor = now - lastInteract;
        if (!reduce && !dragging && idleFor > 2600 && settle >= 1) tYaw += 0.00032;
        if (!dragging && Math.abs(vYaw) > 0.00002) {
          tYaw += vYaw;
          vYaw *= 0.945;
        }
        const parX = reduce ? 0 : mouseNX * 0.045;
        const parY = reduce ? 0 : mouseNY * 0.03;
        yaw += (tYaw + parX + settleYaw - yaw) * 0.08;
        pitch += (THREE.MathUtils.clamp(tPitch + parY, -0.44, 0.44) - pitch) * 0.08;
        roll += (THREE.MathUtils.clamp(-vYaw * 2.4, -0.03, 0.03) - roll) * 0.06;
        const wantFov = FOV + exitP * 20;
        camera.fov += (wantFov - camera.fov) * 0.12;
        camera.updateProjectionMatrix();
        if (veil) veil.style.opacity = "0";
      }

      camera.rotation.set(-pitch + exitP * 0.2, -yaw, roll);
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(fishScene, fishCam);

      const k = 1 - exitP * 0.92;
      renderer.domElement.style.opacity = String(Math.max(0.06, k));
      renderer.domElement.style.transform = `scale(${1 - exitP * 0.045})`;
    };
    raf = requestAnimationFrame(tick);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      for (const c of cells) c.mat.dispose();
      texCache.forEach((t) => t.dispose());
      rowGeos.forEach((g) => g.dispose());
      rt.dispose();
      fishMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs.length > 0]);

  return (
    <div ref={hostRef} className={className} aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", touchAction: "pan-y" }}>
      <div className="desk-orb-blur" />
      <div className="desk-orb-vig" />
      <div ref={veilRef} className="desk-orb-veil" />
    </div>
  );
}
