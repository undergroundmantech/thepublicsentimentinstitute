"use client";

import React, { useEffect, useRef } from "react";

/**
 * Dot-field hero backdrop — an LED-wall simulation in one WebGL2 pass.
 *
 * Four coupled fields drive the wall, all sampled per cell on a domain-warped
 * noise space (Quilez-style warping, so the motion curls instead of sliding):
 *
 *  · intensity — warped fbm structure plus traveling iso-band "ribbons" of
 *    light that propagate through the matrix (sin of the warped field minus
 *    time), so waves of dots ignite in coherent patterns rather than mush;
 *  · visibility — a slow low-frequency mask that switches whole regions of
 *    the wall off. Where it is low the dots vanish entirely and the frame
 *    falls to true black: composed voids, not uniform coverage. The type
 *    sits inside a deliberate void carved over the headline;
 *  · hue — an even slower field that blends each region between three
 *    sub-palettes (ultramarine-blue, violet, orchid-pink), so neighborhoods
 *    of the wall glow in different colors and drift through one another;
 *  · pointer — the cursor lifts both intensity and visibility, waking dead
 *    zones of the wall as it passes.
 *
 * Per-dot life: hashed breathing phases and rare scintillation pings, gated
 * to lit regions. Grade: filmic roll-off, vignette above the headline, grain.
 */

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_pointer;  // -1..1, smoothed (y up)
uniform float u_cell;    // cell size in device px
out vec4 o;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i), b = hash12(i + vec2(1, 0));
  float c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }

float fbm3(vec2 p) {
  float v = 0.0, amp = 0.56;
  for (int i = 0; i < 3; i++) {
    v += amp * vnoise(p);
    p = rot(0.6) * p * 2.05;
    amp *= 0.52;
  }
  return v;
}

float fbm2(vec2 p) {
  float v = 0.0, amp = 0.62;
  for (int i = 0; i < 2; i++) {
    v += amp * vnoise(p);
    p = rot(0.7) * p * 2.1;
    amp *= 0.5;
  }
  return v;
}

// Quilez domain warp — the flow curls instead of sliding
vec2 warp(vec2 p, float t) {
  float a = fbm2(p * 0.9 + vec2(0.0, 3.1) + vec2(t * 0.030, -t * 0.012));
  float b = fbm2(p * 0.9 + vec2(5.2, 1.3) + vec2(-t * 0.022, t * 0.017));
  return p + 1.35 * vec2(a - 0.5, b - 0.5);
}

// three regional sub-palettes, each dim → mid → bright
vec3 pal3(float x, vec3 a, vec3 b, vec3 c) {
  vec3 col = mix(a, b, smoothstep(0.0, 0.58, x));
  return mix(col, c, smoothstep(0.58, 1.0, x));
}

vec3 regionColor(float x, float h) {
  // brand hues, low saturation: cool violet/blue (#6d3ee9 / #3f60e8) through
  // warm red/magenta (#d2494b / #a44197) — luminance held at/below the prior
  // purple/gray palette so the type still wins.
  vec3 blue   = pal3(x, vec3(0.014, 0.020, 0.058), vec3(0.180, 0.260, 0.760), vec3(0.560, 0.660, 0.960));
  vec3 violet = pal3(x, vec3(0.036, 0.022, 0.078), vec3(0.360, 0.230, 0.780), vec3(0.760, 0.700, 0.980));
  vec3 pink   = pal3(x, vec3(0.072, 0.018, 0.062), vec3(0.620, 0.240, 0.560), vec3(0.960, 0.660, 0.780));
  return h < 0.5
    ? mix(blue, violet, smoothstep(0.0, 1.0, h * 2.0))
    : mix(violet, pink, smoothstep(0.0, 1.0, h * 2.0 - 1.0));
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy / u_cell);
  vec2 f = fract(gl_FragCoord.xy / u_cell) - 0.5;
  vec2 gp = cell + 0.5;
  vec2 uv = gp * u_cell / u_res;
  float h = hash12(cell);
  float t = u_time;

  // ── fields ──
  vec2 p = gp * 0.075;
  vec2 wp = warp(p, t);
  float structure = fbm3(wp + vec2(t * 0.018, 0.0));

  // traveling ribbons — iso-bands of the warped field marching with time
  float ribbon = 0.5 + 0.5 * sin(structure * 7.0 + wp.x * 0.9 - t * 0.5);
  ribbon = pow(smoothstep(0.40, 1.0, ribbon), 1.6);

  float intensity = structure * 0.62 + ribbon * 0.72;

  // visibility — whole regions of the wall switch off into true black
  float m = fbm2(gp * 0.034 + vec2(31.7, 7.3) + vec2(-t * 0.014, t * 0.010)) + 0.07;
  float portrait = step(u_res.x, u_res.y);
  vec2 q = (uv - vec2(0.5, 0.55)) * mix(vec2(1.35, 2.05), vec2(1.0, 1.4), portrait);
  m -= mix(0.27, 0.38, portrait) * exp(-dot(q, q) * 2.4);   // carved void behind the type

  // pointer wakes the wall — lifts intensity AND visibility
  vec2 pt = u_pointer * 0.5 + 0.5;
  vec2 pd = (uv - pt) * vec2(u_res.x / u_res.y, 1.0);
  float lift = exp(-dot(pd, pd) * 18.0);
  intensity += 0.30 * lift;
  m += 0.22 * lift;

  float vis = smoothstep(0.22, 0.48, m);

  // hue — slow regional drift between blue / violet / pink
  float hue = fbm2(gp * 0.026 + vec2(-12.4, 19.2) + vec2(t * 0.008, -t * 0.011));
  hue = clamp((hue - 0.30) * 2.4, 0.0, 1.0);

  // ── per-dot life ──
  float e = smoothstep(0.20, 1.05, intensity);
  float breathe = 1.0 + 0.07 * sin(t * (0.55 + h * 0.5) + h * 6.2831);

  float tick = floor(t * 1.4);
  float h2 = hash12(cell + tick * 7.13);
  float ping = step(0.992, h2) * pow(1.0 - fract(t * 1.4), 2.4) * step(0.4, vis);
  e = min(e + ping * 0.5, 1.1);

  float r = mix(0.10, 0.45, pow(clamp(e, 0.0, 1.0), 1.3)) * breathe * vis + ping * 0.06;

  float d = length(f);
  float aa = max(1.5 / u_cell, 0.02);
  float dotMask = smoothstep(r, r - aa, d) * step(0.003, r);

  // color — regional hue, compressed so the bright top end stays rare
  float ec = pow(clamp(e, 0.0, 1.0), 1.3);
  vec3 dc = regionColor(ec, hue) * (0.35 + 0.65 * vis);

  // soft halo past the dot edge in the bright registers
  float halo = exp(-pow(d / max(r, 1e-3), 2.0) * 1.25) * smoothstep(0.55, 1.0, e) * vis * 0.36;

  vec3 col = vec3(0.010, 0.008, 0.020);                 // true-black floor
  col += regionColor(e * 0.4, hue) * 0.045 * vis;       // ambient only where lit
  col = mix(col, dc, dotMask);
  col += dc * halo * (1.0 - dotMask * 0.35);

  col = 1.0 - exp(-col * 2.2);                          // filmic roll-off

  vec2 vg = uv - vec2(0.5, 0.56);
  col *= 1.0 - dot(vg, vg) * 0.55;

  float gr = fract(sin(dot(gl_FragCoord.xy + fract(t) * 47.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (gr - 0.5) * 0.014;

  o = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
  }
  return sh;
}

const CELL_CSS_PX = 24;

export default function DotField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) return; // CSS fallback gradient on the hero stays visible

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let prog: WebGLProgram;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link failed");
    } catch {
      return;
    }
    gl.useProgram(prog);
    gl.bindVertexArray(gl.createVertexArray());

    const u = {
      res: gl.getUniformLocation(prog, "u_res"),
      time: gl.getUniformLocation(prog, "u_time"),
      pointer: gl.getUniformLocation(prog, "u_pointer"),
      cell: gl.getUniformLocation(prog, "u_cell"),
    };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();

    const pointer = { x: -2, y: -2, tx: -2, ty: -2 }; // start far offscreen
    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };

    const draw = (now: number) => {
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, now / 1000);
      gl.uniform2f(u.pointer, pointer.x, pointer.y);
      gl.uniform1f(u.cell, CELL_CSS_PX * dpr);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    if (reduced) {
      draw(18_000); // a settled, composed frame
      const ro = new ResizeObserver(() => { resize(); draw(18_000); });
      ro.observe(canvas);
      return () => { ro.disconnect(); gl.deleteProgram(prog); };
    }

    let raf = 0;
    let running = false;
    const frame = (now: number) => {
      draw(now);
      if (running) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting) && !document.hidden) start();
        else stop();
      },
      { rootMargin: "12% 0px 12% 0px" },
    );
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      gl.deleteProgram(prog);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
