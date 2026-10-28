// Focused checks for the two P0 result-clarity fixes. Run: node --test scripts/test-result-clarity.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { callCopy, callKind } from "../app/results/callStatus.ts";
import { paintUnit, leanStroke } from "../app/results/monitor/paint.ts";

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("P0-1 official call: check and definitive wording", () => {
  const t = callCopy(callKind(true, true), "Charles McCall", "the Republican runoff");
  assert.equal(t.mark, "✓");
  assert.equal(t.headline, "Charles McCall wins the Republican runoff");
  assert.match(t.eyebrow, /race called/);
});

test("P0-1 projection: no check, no 'wins', labelled OnPoint Projection", () => {
  const t = callCopy(callKind(false, true), "Charles McCall", "the Republican runoff");
  assert.equal(t.mark, "");
  assert.equal(t.headline, "Charles McCall projected to win the Republican runoff");
  assert.doesNotMatch(t.headline, /\bwins\b/);
  assert.match(t.eyebrow, /OnPoint Projection · not an official call/);
  assert.equal(t.chip, "OnPoint Projection");
});

test("P0-1 uncalled: no band at all", () => {
  assert.equal(callKind(false, false), null);
});

test("P0-1 boards: projections never render the check or 'wins'", () => {
  for (const f of ["app/results/2026-08-25/OklahomaBoard.tsx", "app/results/2026-08-18/FloridaBoard.tsx", "app/results/2026/NightDesk.tsx"]) {
    const s = src(f);
    assert.doesNotMatch(s, /won=\{[^}]*isProjected/, `${f}: projected candidate gets the check`);
    assert.doesNotMatch(s, /topline-lead won">On Point Polling projected/, `${f}: projection styled as a call`);
    assert.doesNotMatch(s, /projected(Key)?\s*\n?\s*\?\s*`\$\{[^}]+\} wins`/, `${f}: projection headline says wins`);
    assert.doesNotMatch(s, /Winner · \{[^}]*projection/, `${f}: projection under a Winner eyebrow`);
  }
});

test("P0-2 zero reporting: every unit is expected, none reported", () => {
  const units = [[null, 4.2], [undefined, -12], [null, null]].map(([m, e]) => paintUnit(m, e));
  assert.deepEqual(units.map((u) => u.kind), ["expected", "expected", "none"]);
});

test("P0-2 partial reporting: reported units keep their exact margins", () => {
  const units = [[3.14159, 10], [null, -8], [-0.5, 2]].map(([m, e]) => paintUnit(m, e));
  assert.deepEqual(units, [{ kind: "reported", m: 3.14159 }, { kind: "expected", m: -8 }, { kind: "reported", m: -0.5 }]);
});

test("P0-2 completed reporting: all reported, values untouched, zero margin still reported", () => {
  const margins = [0, 12.5, -33.3];
  assert.deepEqual(margins.map((m) => paintUnit(m, 99)), margins.map((m) => ({ kind: "reported", m })));
});

test("P0-2 seat lean keeps the forecast thresholds", () => {
  assert.match(leanStroke(0.5), /231, 179, 65/);
  assert.match(leanStroke(0.1), /61, 123, 255/);
  assert.match(leanStroke(0.9), /255, 59, 92/);
});

test("P0-2 monitor: expectations are hatched or outlined, never a faint party fill", () => {
  const m = src("app/results/monitor/Monitor.tsx"), c = src("app/results/monitor/Chambers.tsx");
  assert.doesNotMatch(m, /fillStyle = shade\(em/);
  assert.doesNotMatch(m, /fillStyle = gh;/);
  assert.doesNotMatch(m, /fill: shade\(e, undefined, isInd\(r\)\), a: 0\.2/);
  assert.doesNotMatch(c, /leanFill/);
  assert.match(m, /Hatched: no votes yet, expected lean/);
  for (const s of [m, src("app/results/monitor/RaceBrief.tsx"), src("app/results/2026/NightDesk.tsx")]) assert.doesNotMatch(s, /"Not linked/);
});
