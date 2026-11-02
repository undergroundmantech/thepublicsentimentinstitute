// Pointy is Theme-only on every page: no walker, route, footprints, bubble or cameo in Pro Dark or Pro Light, and
// nothing in his place. Content that lived in a bubble has a plain Pro equivalent.
// Run: node --test scripts/test-pointy-modes.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("every Pointy cameo is hidden outside Theme by pre-paint CSS, with no speech-bubble or route exception", () => {
  const src = read("app/components/home/Mascot.tsx");
  const fn = src.slice(src.indexOf("export function Pointy("));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  assert.doesNotMatch(body, /return null/, "Pointy must not unmount by mode: Theme keeps him in the server HTML");
  assert.doesNotMatch(src, /usePathname|useSiteMode/, "no route or hook exception");
  assert.match(read("app/components/home/pointy.css"), /:root:not\(\[data-mode="themed"\]\) \.pty-cameo \{ display: none !important; \}/);
  // data-mode is written before first paint, so Pro never flashes him and Theme never pops him in
  assert.match(read("app/lib/theme.ts"), /data-mode/);
});

test("direct Mascot renders outside a cameo are hidden in Pro too", () => {
  assert.match(read("app/polls/timeline/Timeline.tsx"), /className=\{`tl-runner/);
  assert.match(read("app/polls/timeline/timeline.css"), /:root:not\(\[data-mode="themed"\]\) \.tl-runner \{ display: none; \}/);
});

test("early-vote explainers keep their text in Pro without Pointy or an empty column", () => {
  const tsx = read("app/maps/early-vote/Benchmarks.tsx");
  assert.match(tsx, /<p key=\{`p-\$\{topic\}`\} className="evb-plain" role="tabpanel">\{say\[topic\]\}<\/p>/);
  const css = read("app/maps/early-vote/evconsole.css");
  assert.match(css, /:root\[data-mode="themed"\] \.evb-plain \{ display: none; \}/);
  assert.match(css, /:root:not\(\[data-mode="themed"\]\) \.evh-lede \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

test("the video promo keeps working in Pro: Pointy is absolutely placed, so hiding him leaves no blank space", () => {
  const tsx = read("app/components/VideoPromo.tsx");
  assert.match(tsx, /<Pointy[^>]*className="vpp-pty/);
  assert.doesNotMatch(tsx, /useSiteMode/, "the promo itself is never gated by mode");
});

test("the only direct Mascot render on the home page is the globe walker", () => {
  const page = read("app/page.tsx");
  assert.doesNotMatch(page, /<Mascot\b/);
  assert.doesNotMatch(read("app/components/home/HomeWhatIf.tsx"), /<Mascot\b/);
});

test("the home globe gates the walking canvasser and its tour on Theme, with Pro copy", () => {
  const src = read("app/components/home/HomeGlobe.tsx");
  assert.match(src, /const themed = useSiteMode\(\) === "themed"/);
  assert.match(src, /if \(!geo \|\| !themed\) return \[\]/);
  assert.ok(src.includes("The 2026 midterms on one interactive globe. Explore the closest races, examine state forecasts, and select any state for detailed projections."));
  const pro = src.split("The 2026 midterms on one interactive globe")[1].split("</p>")[0];
  assert.doesNotMatch(pro, /Pointy|canvasser/);
});

