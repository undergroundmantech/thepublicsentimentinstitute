// The site's own polling averages for every 2026 Senate and governor race, as the polls pages show them, for the
// forecast's polling leg. usage: npx tsx scripts/forecast/site_averages.ts OUT.json
import fs from "node:fs";
import { AGGREGATES, buildAggregate } from "../../app/_polling/lib/aggregates";
const out: Record<string, unknown>[] = [];
for (const def of AGGREGATES) {
  const cat = String(def.category || "");
  if (!/2026/.test(cat) || !/Senate|overnor/i.test(cat)) continue;
  try {
    const b = buildAggregate(def);
    const last = b.daily[b.daily.length - 1];
    out.push({ id: def.id, category: cat, title: (def as any).title ?? (def as any).name ?? null, A: def.seriesA.label, B: def.seriesB.label,
      keyA: def.keyA, keyB: def.keyB, a: b.latest?.a ?? last?.a ?? null, b: b.latest?.b ?? last?.b ?? null, date: last?.date ?? null, polls: b.polls.length });
  } catch (e) { out.push({ id: def.id, category: cat, error: String(e) }); }
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(out.length, "averages");
