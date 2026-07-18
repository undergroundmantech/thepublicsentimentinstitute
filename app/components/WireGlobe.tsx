"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import { geoContains } from "d3-geo";
import { SENATE_MODEL } from "./senateModel";

/**
 * The desk's eye — a compact, always-on version of the homepage coverage
 * globe for the situation room masthead. Same material language (near-black
 * sphere, warm-crowned fresnel rim, hairline graticule, pure-white US
 * dot-matrix) but no scroll choreography: the United States sits face-on,
 * breathing, with lime beacons pulsing over this cycle's toss-up senate
 * states (|margin| < 1.5 — the same threshold the homepage readout uses).
 */

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

// Interior centroids for beacon placement — geography, not data.
const STATE_CENTROIDS: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AK: [64.0, -152.0], AZ: [34.3, -111.7], AR: [34.9, -92.4], CA: [37.2, -119.3],
  CO: [39.0, -105.5], CT: [41.6, -72.7], DE: [39.0, -75.5], FL: [28.6, -81.7], GA: [32.6, -83.4],
  HI: [20.3, -156.4], ID: [44.4, -114.6], IL: [40.0, -89.2], IN: [39.9, -86.3], IA: [42.0, -93.5],
  KS: [38.5, -98.4], KY: [37.5, -85.3], LA: [31.1, -92.0], ME: [45.4, -69.2], MD: [39.0, -76.8],
  MA: [42.3, -71.8], MI: [44.3, -85.4], MN: [46.3, -94.3], MS: [32.7, -89.7], MO: [38.4, -92.5],
  MT: [47.0, -109.6], NE: [41.5, -99.8], NV: [39.3, -116.6], NH: [43.7, -71.6], NJ: [40.2, -74.7],
  NM: [34.4, -106.1], NY: [42.9, -75.6], NC: [35.5, -79.4], ND: [47.4, -100.5], OH: [40.3, -82.8],
  OK: [35.6, -97.5], OR: [43.9, -120.6], PA: [40.9, -77.8], RI: [41.7, -71.6], SC: [33.9, -80.9],
  SD: [44.4, -100.2], TN: [35.8, -86.4], TX: [31.5, -99.3], UT: [39.3, -111.7], VT: [44.1, -72.7],
  VA: [37.5, -78.9], WA: [47.4, -120.4], WV: [38.6, -80.6], WI: [44.6, -89.7], WY: [43.0, -107.6],
};

export default function WireGlobe() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    camera.position.set(0, 0, 2.62);

    const globe = new THREE.Group();
    scene.add(globe);

    globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), new THREE.ShaderMaterial({ ...RIM_SHADER })));

    // graticule
    {
      const pts: THREE.Vector3[] = [];
      const R = 1.001;
      for (let lon = -180; lon < 180; lon += 15)
        for (let lat = -80; lat < 80; lat += 2) pts.push(latLonToVec3(lat, lon, R), latLonToVec3(lat + 2, lon, R));
      for (let lat = -75; lat <= 75; lat += 15)
        for (let lon = -180; lon < 180; lon += 2) pts.push(latLonToVec3(lat, lon, R), latLonToVec3(lat, lon + 2, R));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      globe.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: "#f4f4ef", transparent: true, opacity: 0.03 })));
    }

    const sprite = makeCircleSprite();

    const dotsMat = new THREE.PointsMaterial({
      color: new THREE.Color("#fbfaf7"), size: 0.0175, map: sprite, transparent: true,
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
          for (let lat = lat0; lat <= lat1; lat += step)
            for (let lon = lon0; lon <= lon1; lon += step)
              if (geoContains(nation, [lon, lat])) {
                const v = latLonToVec3(lat, lon, 1.004);
                verts.push(v.x, v.y, v.z);
              }
        };
        sample(24.5, 49.5, -125, -66.5, 0.62);
        sample(54, 71.5, -168, -130, 1.3);
        sample(18.7, 22.4, -160.4, -154.6, 0.5);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
        globe.add(new THREE.Points(geo, dotsMat));
      })
      .catch(() => {});

    // brand-purple beacons on the toss-up senate states — the live layer
    const hot = SENATE_MODEL.filter((r) => Math.abs(r.m) < 1.5 && STATE_CENTROIDS[r.st]);
    const beaconMat = new THREE.PointsMaterial({
      color: new THREE.Color("#6d3ee9"), size: 0.052, map: sprite, transparent: true,
      opacity: 0.95, depthWrite: false, sizeAttenuation: true,
    });
    {
      const verts: number[] = [];
      for (const r of hot) {
        const [lat, lon] = STATE_CENTROIDS[r.st];
        const v = latLonToVec3(lat, lon, 1.012);
        verts.push(v.x, v.y, v.z);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      globe.add(new THREE.Points(geo, beaconMat));
    }

    const usFacing = latLonToVec3(39, -98, 1);
    const yawTarget = -Math.atan2(usFacing.x, usFacing.z);

    let raf = 0;
    let running = false;
    const t0 = performance.now();

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();

    const frame = (now: number) => {
      const t = now / 1000;
      const enter = reduced ? 1 : easeOutCubic(cl01((now - t0) / 1600));

      globe.scale.setScalar(1.04);
      globe.position.y = -0.34 - (1 - enter) * 0.5;
      globe.rotation.y = yawTarget + (reduced ? 0 : Math.sin(t * 0.13) * 0.035);
      globe.rotation.x = 0.5;

      dotsMat.opacity = 0.95 * cl01((enter - 0.25) / 0.6);
      beaconMat.opacity = (0.55 + 0.4 * Math.sin(t * 2.1)) * cl01((enter - 0.5) / 0.5);
      beaconMat.size = 0.046 + 0.012 * (0.5 + 0.5 * Math.sin(t * 2.1));

      renderer.render(scene, camera);
      if (running) raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible && !running) { running = true; raf = requestAnimationFrame(frame); }
        if (!visible && running) { running = false; cancelAnimationFrame(raf); }
      },
      { rootMargin: "10% 0px 10% 0px" },
    );
    io.observe(mount);

    window.addEventListener("resize", resize);

    return () => {
      cancelled = true;
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      sprite.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} aria-hidden="true" />;
}
