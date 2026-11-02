// The election-night race desk: the five reporting fields sit in one framed strip, the desk beside the monitor's globe
// does not draw a second county map, selected controls are not gold, and the page opens on the forecast view until a
// county reports. REPO=<tree> checks another worktree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.env.REPO || process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");
const tsx = read("app/results/2026/NightDesk.tsx");
const mon = read("app/results/monitor/Monitor.tsx");
const theme = tsx.slice(tsx.indexOf("const THEME_CSS"));

test("header keeps all five reporting fields in one strip", () => {
  for (const label of ["Last updated", "Reported votes", "Estimated reporting", "civicAPI reporting", "Race status"])
    assert.ok(tsx.includes(label), `missing ${label}`);
  assert.match(theme, /\.desk\.nd \.race-meta\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\);gap:0;border:1px solid var\(--line2\)/);
  assert.match(theme, /@media\(max-width:720px\)\{\.desk\.nd \.race-meta\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  const label = theme.slice(theme.indexOf(".desk.nd .meta-block span{"));
  assert.doesNotMatch(label.slice(0, label.indexOf("}")), /ellipsis|nowrap/, "labels wrap rather than clip");
});

test("embedded desk beside the globe hides its own county map but keeps the county table", () => {
  assert.match(tsx, /@media\(min-width:1101px\)\{[^}]*\.nd-embed #nd-counties>\.rd-map[^}]*\{display:none\}/);
  assert.doesNotMatch(tsx, /@media\(min-width:1101px\)\{[^}]*rd-county[^}]*\{display:none\}/);
  assert.match(tsx, /className="nd-mapnote"/);
});

test("opening a desk in the monitor flies the globe to that race", () => {
  assert.match(mon, /useEffect\(\(\) => \{\s*const r = desk \?[\s\S]{0,200}fly\.current\(r\.st\);\s*setPick\(r\.id\);\s*\}, \[desk\]\)/);
});

test("county view starts on the forecast and switches to results once counties report", () => {
  assert.match(tsx, /useState<"forecast" \| "results">\("forecast"\)/);
  assert.match(tsx, /if \(reporting\) setView\("results"\)/);
});

test("selected controls, tabs and the kicker are not gold; the test-return warning stays", () => {
  for (const sel of [".race-kicker{", ".rd-county-sorts button.on{", ".rd-view-toggles button.on,", "a[aria-current=\"page\"]::after{", "a.nd-main{"]) {
    const i = theme.indexOf(sel);
    assert.ok(i >= 0, `missing ${sel}`);
    assert.doesNotMatch(theme.slice(i, theme.indexOf("}", i)), /gold|255,217,138/, sel);
  }
  assert.match(tsx, /nd-test/);
});
