// Fixture checks for the national dashboard's counting and watch-bar logic. Run: node scripts/test-national-tally.mjs
// Compiles the real sources with TypeScript; no framework is installed in this repo.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const ts = require("typescript");
const cache = new Map();
const stub = { hemiLayout: () => [], TILE: {} };
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const m = { exports: {} }; cache.set(file, m);
  const req = (spec) => {
    if (spec === "react" || spec.startsWith("@/app/components/")) return { ...stub, default: {} };
    const base = path.resolve(path.dirname(file), spec);
    const hit = [".ts", ".tsx", ""].map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
    return hit ? load(hit) : require(spec);
  };
  new Function("exports", "require", "module", out)(m.exports, req, m);
  return m.exports;
}
const { tally, watchBar } = load(path.join(root, "app/results/2026/nationalTally.ts"));

const race = (id, k, st, c, extra = {}) => ({ id, k, st, nm: `${st} ${k}`, off: k, c, civ: {}, ...extra });
const sen = race("sen-ga", "sen", "GA", [["Jon Ossoff", "D", 48], ["Mike Collins", "R", 46]], { pR: 0.4 });
const house = race("house-GA-01", "house", "GA", [["A Dem", "D", 45], ["B Rep", "R", 55]], { pR: 0.8 });
const gov = race("gov-ga", "gov", "GA", [["C Dem", "D", 49], ["D Rep", "R", 49]], { pR: 0.5 });
const meas = race("measure-ga-1", "measure", "GA", [["Yes", "Y", 55], ["No", "N", 45]], { yes: 55 });
const stt = race("ag-ga", "state", "GA", [["E Dem", "D", 47], ["F Rep", "R", 53]], { pR: 0.7 });
const races = [sen, house, gov, meas, stt];
const cr = (id, pr, c) => ({ id: 1, type: "x", province: "GA", district: null, name: id, pr, c });
const cand = (n, p, v, w = 0) => [n, p, v, 0, w, null];
const byKind = (byId) => ({ sen: tally([sen], byId), house: tally([house], byId), gov: tally([gov], byId), other: tally([meas, stt], byId) });

// no returns, provider missing, delayed (empty read)
for (const byId of [{}]) {
  const t = byKind(byId);
  for (const k of Object.keys(t)) assert.deepEqual([t[k].counting, t[k].called, t[k].votes], [0, 0, 0], `${k} empty`);
  assert.equal(t.sen.n, 1); assert.equal(t.other.n, 2);
}
// pre-election test returns are blanked by useLive to zero votes and pr 0: they must read as no returns
const blanked = { [sen.id]: cr("s", 0, [cand("Jon Ossoff", "Democratic", 0), cand("Mike Collins", "Republican", 0)]) };
assert.equal(tally([sen], blanked).counting, 0);
assert.equal(watchBar(sen, blanked[sen.id], true), null);

// mixed reporting across every category at once: each summary comes from the same byId, whichever tab is open
const mixed = {
  [sen.id]: cr("s", 40, [cand("Jon Ossoff", "Democratic", 480), cand("Mike Collins", "Republican", 420)]),
  [house.id]: cr("h", 90, [cand("A Dem", "Democratic", 400), cand("B Rep", "Republican", 600, 1)]),
  [gov.id]: cr("g", 12, [cand("C Dem", "Democratic", 100), cand("D Rep", "Republican", 130)]),
  [meas.id]: cr("m", 20, [cand("Yes", "", 30), cand("No", "", 10)]),
};
const t = byKind(mixed);
assert.deepEqual([t.sen.counting, t.sen.lD, t.sen.lR, t.sen.called], [1, 1, 0, 0], "sen leading D, uncalled");
assert.deepEqual([t.house.counting, t.house.cR, t.house.lR, t.house.called], [1, 1, 0, 1], "house call is a call, not a lead");
assert.deepEqual([t.gov.counting, t.gov.lR, t.gov.called], [1, 1, 0], "gov leading R, uncalled");
assert.deepEqual([t.other.counting, t.other.votes, t.other.n], [1, 40, 2], "other: measure counting, ag not");
assert.equal(t.sen.counting + t.house.counting + t.gov.counting + t.other.counting, 4);
// switching tabs does not change totals: the tally is a pure function of the shared read
assert.deepEqual(byKind(mixed), t);

// the bar: reported share is a share of counted two-way votes, independent of percent reporting and margin math
const a = watchBar(sen, mixed[sen.id], true);
assert.equal(a.caption, "Reported vote share"); assert.ok(Math.abs(a.pD - 480 / 900) < 1e-9);
assert.match(a.label, /Reported two-way vote share: Democratic 53\.3%/);
const late = { ...mixed[sen.id], pr: 95 };
assert.equal(watchBar(sen, late, true).pD, a.pD, "percent reporting must not move the bar");
const pre = watchBar(sen, undefined, false);
assert.equal(pre.caption, "Pre-election forecast"); assert.equal(pre.pD, 0.6); assert.match(pre.label, /not a result/);
assert.equal(watchBar(meas, undefined, false), null, "no forecast probability, no bar");
assert.equal(watchBar(sen, undefined, true), null, "live mode without votes draws nothing");
assert.equal(watchBar(sen, cr("s", 5, [cand("Jon Ossoff", "Democratic", 0), cand("Mike Collins", "Republican", 0)]), true), null, "zero two-way votes draws nothing");

// source guards: no margin-derived probability, one live subscription
const desk = fs.readFileSync(path.join(root, "app/results/2026/NationalDesk.tsx"), "utf8");
assert.ok(!/margin \/ 80|m \/ 80/.test(desk), "no implied win probability from margin");
assert.ok(!/useLive\(/.test(desk), "NationalDesk reads the shared subscription");
const hub = fs.readFileSync(path.join(root, "app/results/2026/RacesHub.tsx"), "utf8");
assert.ok(/useLive\(shared \? null : ix/.test(hub), "RacesHub only subscribes when standalone");
console.log("national tally fixtures: all checks passed");
