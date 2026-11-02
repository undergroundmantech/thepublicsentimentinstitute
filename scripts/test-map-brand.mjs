// Map boundaries and brand accent: shared stroke tokens, no legacy gold UI chrome, toss-up kept as its own category.
// Run: node --test scripts/test-map-brand.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(ROOT + p, "utf8");
const css = read("app/globals.css");
const block = (sel) => { const i = css.indexOf(sel + " {"); assert.ok(i >= 0, sel); return css.slice(i, css.indexOf("\n}", i)); };
const px = (name) => { const m = css.match(new RegExp(`${name}:\\s*([\\d.]+)px`)); assert.ok(m, name); return Number(m[1]); };

test("map stroke tokens: county < state < hover < selected, all thin", () => {
  const [c, s, h, sel] = ["--map-w-county", "--map-w-state", "--map-w-hover", "--map-w-select"].map(px);
  assert.ok(c >= 0.5 && c <= 0.7, `county ${c}`);
  assert.ok(s >= 1.2 && s <= 1.5, `state ${s}`);
  assert.ok(c < s && s <= h && h < sel && sel <= 2, `${c} ${s} ${h} ${sel}`);
  assert.match(css, /--map-stroke-hi:/, "--map-stroke-hi is defined globally");
  assert.match(css, /--map-select:\s*var\(--accent\)/);
});

test("brand accent: gold names resolve to the OnPoint purple, warnings and toss-ups stay amber", () => {
  const root = block(":root"), light = block(':root[data-theme="light"]');
  assert.match(root, /--accent-fill:\s*#83449c/i);
  assert.match(root, /--gold:\s*var\(--accent\)/);
  assert.match(root, /--gold-fill:\s*var\(--accent-fill\)/);
  assert.match(light, /--accent:\s*#83449c/i);
  assert.doesNotMatch(light, /--gold:/, "light theme must not re-point gold to a hex");
  assert.match(css, /--text-on-gold:\s*var\(--on-accent\)/);
  assert.match(css, /--status-warn:\s*var\(--warn\)/);
  assert.match(css, /--focus-ring:\s*var\(--focus\)/);
  assert.match(root, /--toss:\s*#e7b341/i, "toss-up keeps its amber rating colour");
  assert.match(root, /--rate-toss:\s*#e7b341/i);
  for (const desk of ['html[data-theme="light"] .desk', 'html[data-theme="dark"] .desk']) assert.doesNotMatch(block(desk), /--gold:/);
});

test("situation monitor canvas: no gold, no glow, thin selection, round joins", () => {
  const src = read("app/results/monitor/Monitor.tsx");
  assert.doesNotMatch(src, /GOLD|255,217,138|176,122,0/);
  assert.doesNotMatch(src, /shadowBlur\s*=\s*(?!0\b)/, "no glowing outlines on the globe");
  assert.match(src, /ctx\.lineJoin = "round"/);
  for (const m of src.matchAll(/ctx\.lineWidth = ([^;]+);/g)) {
    for (const n of m[1].replace(/[<>]=?\s*[\d.]+/g, "").match(/\d+(\.\d+)?/g) ?? []) assert.ok(Number(n) <= 2 || Number(n) === 3 /* label halo */, `lineWidth ${m[1]}`);
  }
  const mcss = read("app/results/monitor/monitor.css");
  assert.doesNotMatch(mcss, /#ffd98a|#b07a00|255, 217, 138|176, 122, 0|#120d00/i);
});

test("SVG maps use the shared non-scaling tokens", () => {
  assert.match(read("app/components/opp/CountyExplorer.tsx"), /\.cx-out\{fill:none;stroke:var\(--map-select\);stroke-width:var\(--map-w-select\)/);
  const geo = read("app/components/opp/GeoMap.tsx");
  assert.doesNotMatch(geo, /\/ sc/, "GeoMap strokes no longer scale with the projection");
  assert.match(geo, /vectorEffect="non-scaling-stroke"/);
  assert.match(read("app/opp.css"), /\.opp \.cmap path\{[^}]*stroke-width:var\(--map-w-county\);vector-effect:non-scaling-stroke/);
  assert.match(read("app/results/2026/NightDesk.tsx"), /\.nd-svg path\.on\{stroke:var\(--map-select\);stroke-width:var\(--map-w-select\)\}/);
  assert.match(read("app/results/2026/results2026.css"), /\.u\.called path\.g \{ stroke: var\(--map-select\); stroke-width: var\(--map-w-state\)/);
});

test("no dark text left on an accent fill", () => {
  for (const f of ["app/results/monitor/monitor.css", "app/chrome.css", "app/opp.css", "app/news/news.css", "app/maps/electoral/electoral.css", "app/results/2026/results2026.css"]) {
    for (const r of read(f).match(/\{[^{}]*\}/g) ?? []) {
      if (/background(-color)?:\s*var\(--gold(-fill)?\)/.test(r)) assert.doesNotMatch(r, /(?<![-\w])color:\s*#(120d00|1a1200|160d00|1a1205|1a1206|1a1030)/i, `${f}: ${r.slice(0, 80)}`);
    }
  }
});

test("analytical categories keep their meaning", () => {
  assert.match(read("app/opp.css"), /\.opp \.pill\.t\{[^}]*color:var\(--toss\)/);
  assert.match(read("app/forecast/lib.ts"), /cat: "Toss up", lo: 0, hi: 2, color: "#e7b341"/);
  assert.match(read("app/results/2026/NightDesk.tsx"), /\.nd-test\{border-color:rgba\(var\(--warn-rgb\)/);
  assert.match(read("app/results/monitor/monitor.css"), /\.mon-test \{[^}]*color: var\(--warn\)/);
});
