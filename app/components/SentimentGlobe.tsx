"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { feature } from "topojson-client";
import { geoContains } from "d3-geo";

/**
 * The coverage globe — a scroll-pinned three.js sequence.
 *
 * A near-black sphere rises from below the viewport as the visitor scrolls,
 * rotates the United States into view, resolves the country as a dot-matrix
 * sampled from the real /us-states.json topology, then fires one beacon per
 * 2026 Senate race. Beam height = the PSI model's margin; color = the leader
 * (lime = inside 1.5 points). The numbers are the forecast model's, verbatim.
 */

import { SENATE_MODEL, senateBalance } from "./senateModel";



const IVORY = "#f4f4ef";
const cl01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function latLonToVec3(lat: number, lon: number, r: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function makeCircleSprite(size = 64) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.9)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const RIM_SHADER = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      float f = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.6);
      vec3 base = vec3(0.022, 0.022, 0.021);
      float crown = smoothstep(0.05, 0.85, vNormal.y);
      vec3 rim = mix(vec3(0.16, 0.16, 0.155), vec3(0.46, 0.27, 0.36), crown);
      gl_FragColor = vec4(mix(base, rim, f), 1.0);
    }
  `,
};

export default function SentimentGlobe() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef(0);
  const [phase, setPhase] = useState(0); // 0 hidden · 1 headline · 2 beacons readout

  useEffect(() => {
    const wrap = wrapRef.current;
    const mount = mountRef.current;
    if (!wrap || !mount) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL — the copy still reads fine on black
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    camera.position.set(0, 0, 3.05);

    const globe = new THREE.Group();
    scene.add(globe);

    // Sphere with a soft ivory fresnel rim
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 96),
      new THREE.ShaderMaterial({ ...RIM_SHADER }),
    );
    globe.add(sphere);

    // Graticule — hairline meridians/parallels every 15°
    {
      const pts: THREE.Vector3[] = [];
      const R = 1.001;
      for (let lon = -180; lon < 180; lon += 15) {
        for (let lat = -80; lat < 80; lat += 2) {
          pts.push(latLonToVec3(lat, lon, R), latLonToVec3(lat + 2, lon, R));
        }
      }
      for (let lat = -75; lat <= 75; lat += 15) {
        for (let lon = -180; lon < 180; lon += 2) {
          pts.push(latLonToVec3(lat, lon, R), latLonToVec3(lat, lon + 2, R));
        }
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: IVORY, transparent: true, opacity: 0.032 });
      globe.add(new THREE.LineSegments(geo, mat));
    }

    const sprite = makeCircleSprite();

    // US dot-matrix — pure white, always facing the camera. The country is
    // the single highlighted object on an otherwise near-silent sphere.
    const dotsMat = new THREE.PointsMaterial({
      color: new THREE.Color("#fbfaf7"), size: 0.0155, map: sprite, transparent: true,
      opacity: 0, depthWrite: false, sizeAttenuation: true,
    });
    let cancelled = false;

    fetch("/us-states.json")
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return;
        const nation = feature(topo, topo.objects.nation) as unknown as GeoJSON.Feature;
        const verts: number[] = [];
        const sample = (lat0: number, lat1: number, lon0: number, lon1: number, step: number) => {
          for (let lat = lat0; lat <= lat1; lat += step) {
            for (let lon = lon0; lon <= lon1; lon += step) {
              if (geoContains(nation, [lon, lat])) {
                const v = latLonToVec3(lat, lon, 1.004);
                verts.push(v.x, v.y, v.z);
              }
            }
          }
        };
        sample(24.5, 49.5, -125, -66.5, 0.62); // CONUS
        sample(54, 71.5, -168, -130, 1.3);     // Alaska
        sample(18.7, 22.4, -160.4, -154.6, 0.5); // Hawaii
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
        globe.add(new THREE.Points(geo, dotsMat));
      })
      .catch(() => { /* globe still works without the matrix */ });

    // ── Choreography targets
    const usFacing = latLonToVec3(39, -98, 1);
    const yawTarget = -Math.atan2(usFacing.x, usFacing.z);
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    let raf = 0;
    let running = false;
    let lastPhase = -1;

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();

    const frame = (now: number) => {
      const p = reduced ? 1 : progressRef.current;
      const t = now / 1000;

      const rise = easeOutCubic(cl01(p / 0.52));
      // widescreen: monumental — the sphere dominates and the bottom limb runs
      // past the fold. Portrait: sized to fit the narrow frame.
      const wide = camera.aspect > 1.15;
      const rScale = wide ? 0.92 : Math.min(0.7, camera.aspect * 1.05 * 0.94);
      globe.scale.setScalar(rScale);
      dotsMat.size = 0.0155 * (rScale / 0.7);
      const endY = wide ? -0.9 : rScale - 1.0;         // top limb clears the copy; full US in frame
      globe.position.y = -2.45 + rise * (endY + 2.45);
      globe.position.x = 0;

      // the United States stays face-on the whole time, breathing only slightly
      globe.rotation.y = yawTarget + (reduced ? 0 : Math.sin(t * 0.14) * 0.03);
      globe.rotation.x = 0.5;

      dotsMat.opacity = cl01((p - 0.22) / 0.26);

      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      camera.position.x = pointer.x * 0.1;
      camera.position.y = pointer.y * 0.06;
      camera.lookAt(0, globe.position.y * 0.12, 0);

      renderer.render(scene, camera);

      const ph = p > 0.62 ? 2 : p > 0.18 ? 1 : 0;
      if (ph !== lastPhase) { lastPhase = ph; setPhase(ph); }

      if (running) raf = requestAnimationFrame(frame);
    };

    const onScroll = () => {
      const rect = wrap.getBoundingClientRect();
      const vh = Math.max(window.innerHeight, 1);
      const scrollable = Math.max(wrap.offsetHeight - vh, 1);
      progressRef.current = cl01(-rect.top / scrollable);
    };
    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible && !running) { running = true; raf = requestAnimationFrame(frame); }
        if (!visible && running) { running = false; cancelAnimationFrame(raf); }
      },
      { rootMargin: "20% 0px 20% 0px" },
    );
    io.observe(wrap);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      cancelled = true;
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      sprite.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  const hotRaces = SENATE_MODEL.filter((r) => Math.abs(r.m) < 1.5)
    .sort((a, b) => Math.abs(a.m) - Math.abs(b.m));
  const balance = senateBalance();

  return (
    <section className={`gl-wrap${phase >= 2 ? " is-set" : ""}`} ref={wrapRef} aria-label="The 2026 Senate map on a globe">
      <div className="gl-sticky">
        <div className="gl-shine" aria-hidden="true" />
        <div className="gl-canvas" ref={mountRef} aria-hidden="true" />
        <div className="gl-horizon" aria-hidden="true" />

        <div className={`gl-copy${phase >= 1 ? " is-in" : ""}`}>
          <div className="gl-eyebrow"><span className="gl-rule" />The senate model · every seat, one sphere<span className="gl-rule" /></div>
          <h2>Every race casts a signal.</h2>
          <p>
            All 35 Senate seats on the ballot, modeled nightly &mdash; the whole
            map, rendered as one signal.
          </p>
        </div>

        <div className={`gl-dock${phase >= 1 ? " is-in" : ""}`}>
          <Link href="/forecastratings" className="gl-cta">Open the forecast &rarr;</Link>
        </div>

        <div className={`gl-readout${phase >= 2 ? " is-in" : ""}`} aria-hidden={phase < 2}>
          <div className="gl-readout-label">projected balance</div>
          <div className="gl-readout-num">
            <span className="gl-readout-side"><b>{balance.d}</b><i>dem</i></span>
            <span className="gl-readout-rule" aria-hidden="true" />
            <span className="gl-readout-side"><b>{balance.r}</b><i>rep</i></span>
          </div>
          <div className="gl-readout-hot">
            {hotRaces.map((r, i) => (
              <span key={r.st}>
                {i > 0 && <em aria-hidden="true">·</em>}
                {r.st} {r.m < 0 ? `D+${Math.abs(r.m).toFixed(1)}` : `R+${r.m.toFixed(1)}`}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        /* Top corners stay rounded so the panel reads as riding over the white finale */
        .gl-wrap { position: relative; width: 100vw; margin: 0 calc(50% - 50vw); height: 320vh; background: #050505; border-radius: 36px 36px 0 0; }
        .gl-sticky { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; border-radius: 36px 36px 0 0; }
        .gl-canvas, .gl-canvas canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; }
        .gl-shine {
          position: absolute;
          left: -10%;
          right: -10%;
          top: -8%;
          height: 116%;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(26% 18% at 50% -1%, rgba(244, 125, 140, 0.52), transparent 70%),
            radial-gradient(44% 32% at 50% 0%, rgba(224, 104, 143, 0.26), transparent 68%),
            radial-gradient(40% 28% at 30% 5%, rgba(194, 85, 148, 0.2), transparent 70%),
            radial-gradient(40% 28% at 70% 5%, rgba(147, 71, 159, 0.2), transparent 70%),
            radial-gradient(48% 28% at 50% 15%, rgba(92, 57, 174, 0.15), transparent 70%),
            radial-gradient(74% 32% at 50% 27%, rgba(46, 42, 150, 0.14), transparent 74%),
            radial-gradient(100% 42% at 50% 41%, rgba(20, 32, 107, 0.16), transparent 78%);
          filter: blur(34px) saturate(1.12);
          opacity: 0;
          transform: translateY(-6%);
          transition: opacity 1500ms ease, transform 2000ms cubic-bezier(.16, 1, .3, 1);
        }
        .gl-wrap.is-set .gl-shine {
          opacity: 1;
          transform: translateY(0);
          animation: gl-shine-breathe 14s ease-in-out 1.6s infinite alternate;
        }
        @keyframes gl-shine-breathe {
          from { filter: blur(34px) saturate(1.12) hue-rotate(-5deg); }
          to { filter: blur(34px) saturate(1.12) hue-rotate(9deg); }
        }
        .gl-horizon { position: absolute; left: 50%; bottom: -42vh; width: 160vw; height: 90vh; transform: translateX(-50%); pointer-events: none; z-index: 1;
          background: radial-gradient(ellipse 50% 50% at 50% 50%, rgba(150, 96, 232, 0.06), rgba(72, 96, 235, 0.035) 40%, transparent 70%); }
        .gl-copy { position: absolute; left: 50%; top: clamp(84px, 13vh, 150px); transform: translate(-50%, 24px); width: min(880px, calc(100vw - 48px)); z-index: 3;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          opacity: 0; transition: opacity 700ms ease, transform 900ms cubic-bezier(.16,1,.3,1); pointer-events: none; }
        .gl-copy.is-in { opacity: 1; transform: translate(-50%, 0); }
        .gl-eyebrow { display: flex; align-items: center; gap: 14px; font-size: 12px; font-weight: 700; letter-spacing: 1.9px; text-transform: uppercase; color: rgba(244,244,239,0.46); }
        .gl-rule { width: 40px; height: 1px; background: rgba(255,255,255,0.3); }
        .gl-copy h2 { margin: 24px 0 0; font-size: clamp(46px, 6.2vw, 96px); line-height: 0.96; letter-spacing: -0.035em; font-weight: 540; color: #f4f4ef; text-wrap: balance; text-shadow: 0 2px 36px rgba(5, 5, 9, 0.55); }
        .gl-copy p { margin: 20px auto 0; font-size: clamp(15px, 1.3vw, 18px); line-height: 1.45; color: rgba(244,244,239,0.55); max-width: 52ch; text-wrap: balance; }
        .gl-dock { position: absolute; left: clamp(24px, 5vw, 80px); bottom: clamp(28px, 6vh, 64px); z-index: 3;
          opacity: 0; transform: translateY(14px); transition: opacity 600ms ease 200ms, transform 800ms cubic-bezier(.16,1,.3,1) 200ms; }
        .gl-dock.is-in { opacity: 1; transform: translateY(0); }
        .gl-lime { font-style: normal; color: #6d3ee9; font-weight: 650; }
        .gl-cta { display: inline-flex; align-items: center; gap: 9px; margin-top: 28px; padding: 13px 26px; border-radius: 999px; background: var(--brand-grad); color: #050505;
          font-size: 15px; font-weight: 650; text-decoration: none; transition: transform 220ms cubic-bezier(.2,.8,.2,1), box-shadow 220ms ease; }
        .gl-cta:hover { transform: translateY(-2px); box-shadow: 0 18px 44px rgba(109,62,233,0.32); }
        .gl-readout { position: absolute; right: clamp(24px, 5vw, 80px); bottom: clamp(28px, 6vh, 64px); z-index: 3; text-align: right;
          opacity: 0; transform: translateY(16px); transition: opacity 600ms ease, transform 800ms cubic-bezier(.16,1,.3,1); }
        .gl-readout.is-in { opacity: 1; transform: translateY(0); }
        .gl-readout-label { font-size: 11px; font-weight: 700; letter-spacing: 1.8px; text-transform: uppercase; color: rgba(244,244,239,0.42); }
        .gl-readout-num { display: flex; align-items: flex-start; justify-content: flex-end; gap: 18px; margin-top: 10px; }
        .gl-readout-side { display: flex; align-items: baseline; gap: 9px; }
        .gl-readout-side b { font-size: clamp(42px, 4.4vw, 60px); line-height: 0.9; font-weight: 470; letter-spacing: -0.025em; font-variant-numeric: tabular-nums; color: #f6f4f0; }
        .gl-readout-side i { font-style: normal; font-size: 10.5px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: rgba(244,244,239,0.38); }
        .gl-readout-rule { width: 1px; align-self: stretch; background: linear-gradient(180deg, rgba(244,244,239,0.3), rgba(244,244,239,0.05)); }
        .gl-readout-hot { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 7px; margin-top: 16px; font-size: 11.5px; font-weight: 580; letter-spacing: 0.3px; color: rgba(244,244,239,0.48); font-variant-numeric: tabular-nums; }
        .gl-readout-hot em { font-style: normal; margin-right: 7px; color: rgba(244,244,239,0.25); }
        @media (max-width: 980px) {
          .gl-wrap { height: 280vh; }
          .gl-sticky:after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 48vh; z-index: 2;
            background: linear-gradient(180deg, transparent, rgba(5,5,5,0.82) 62%); pointer-events: none; }
          .gl-copy { top: clamp(70px, 10vh, 110px); }
          .gl-copy h2 { font-size: clamp(34px, 9.4vw, 52px); }
          .gl-readout { right: 18px; bottom: 100px; }
          .gl-dock { left: 18px; bottom: 28px; }
          .gl-readout-hot { flex-wrap: wrap; max-width: 220px; }
        }
      `}</style>
    </section>
  );
}
