// Oct 31 2026: the site's adjusted average rules for the down ballot races. For every poll in the down ballot research
// files this writes the same correction the Senate and governor averages use: the measured lean of its firm or of its
// side's internals, and the pollster grade weight. usage: npx tsx scripts/forecast/downballot/lean_export.ts OUT.json FILES...
import fs from "node:fs";
import { R_LEAN_ESTIMATES } from "../../../app/_polling/lib/aggregates";
import { leanFirms, getPollsterWeight, isExcludedPollster } from "../../../app/_polling/lib/buildDailyModel";
const [out, ...files] = process.argv.slice(2);
const polls: Record<string, { firms: string[]; dir: "R" | "D" | null; lean: number; weight: number; excluded: boolean }> = {};
for (const f of files) {
  for (const r of JSON.parse(fs.readFileSync(f, "utf8"))) for (const p of r.polls ?? []) {
    const name = String(p.source ?? ""); if (!name || polls[name]) continue;
    const firms = leanFirms(name);
    const est = firms.map((id) => R_LEAN_ESTIMATES[id]).filter(Boolean);
    const dir = est[0]?.dir ?? null;
    const same = est.filter((e) => e.dir === dir);
    const lean = same.length ? same.reduce((s, e) => s + e.lean, 0) / same.length : 0;
    polls[name] = { firms, dir, lean: Math.round(lean * 100) / 100, weight: getPollsterWeight(name), excluded: isExcludedPollster(name) };
  }
}
fs.writeFileSync(out, JSON.stringify({ estimates: R_LEAN_ESTIMATES, polls }, null, 1));
console.log(Object.keys(polls).length, "pollsters");
