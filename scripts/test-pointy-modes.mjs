// Pointy is Theme-only: absent from Pro Dark and Pro Light everywhere, including the 404 page.
// Run: node --test scripts/test-pointy-modes.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const walk = (d, out = []) => {
  for (const f of readdirSync(join(ROOT, d))) {
    const p = join(d, f);
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, out);
    else if (/\.(tsx|css)$/.test(f)) out.push(p);
  }
  return out;
};

test("modes.css hides every Pointy element outside Theme, with no exceptions", () => {
  const css = read("app/modes.css");
  assert.match(css, /:root:not\(\[data-mode="themed"\]\) :is\(\.pty, \.pty-fig, \.hg-man, \.tl-runner\) \{ display: none !important; \}/);
  assert.doesNotMatch(css, /:not\(\.essential\)/);
});

test("no component opts Pointy back in with an .essential class", () => {
  for (const f of walk("app")) assert.doesNotMatch(read(f), /\bessential\b/, f);
});

test("Pointy renders the figure only when themed, and nothing for quips in Pro", () => {
  const src = read("app/components/home/Mascot.tsx");
  assert.match(src, /const themed = useSiteMode\(\) === "themed";/);
  assert.match(src, /if \(!themed && \(!say \|\| className\?\.split\(\/\\s\+\/\)\.includes\("quip"\)\)\) return null;/);
  assert.match(src, /\{themed \? <div className="pty-fig">/);
});

test("the home globe gates the walking canvasser and its tour on Theme, with Pro copy", () => {
  const src = read("app/components/home/HomeGlobe.tsx");
  assert.match(src, /const themed = useSiteMode\(\) === "themed"/);
  assert.match(src, /if \(!geo \|\| !themed\) return \[\]/);
  assert.ok(src.includes("The 2026 midterms on one interactive globe. Explore the closest races, examine state forecasts, and select any state for detailed projections."));
  const pro = src.split("The 2026 midterms on one interactive globe")[1].split("</p>")[0];
  assert.doesNotMatch(pro, /Pointy|canvasser/);
});

test("the timeline runner and its copy are Theme-only", () => {
  const src = read("app/polls/timeline/Timeline.tsx");
  assert.match(src, /themed \? "Scroll to walk the line with Pointy\." : "Scroll to move along the line\."/);
  assert.match(src, /themed \? "Pointy walks the line" : "the line advances"/);
});

test("the 404 cameo is a quip, so Pro renders nothing", () => {
  assert.match(read("app/not-found.tsx"), /className="cam-404 keep quip"/);
});
