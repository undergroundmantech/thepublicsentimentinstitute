import { AGGREGATES } from "@/app/_polling/lib/aggregates";
const out = AGGREGATES.map((d) => ({
  id: d.id, category: d.category, title: d.title, keyA: d.keyA, keyB: d.keyB,
  aParty: d.seriesA.party ?? null, bParty: d.seriesB.party ?? null, aLabel: d.seriesA.label, bLabel: d.seriesB.label,
  polls: d.polls.map((p: any) => ({ pollster: p.pollster, start: p.startDate ?? null, end: p.endDate, n: p.sampleSize, type: p.sampleType,
    a: p.results?.[d.keyA] ?? null, b: p.results?.[d.keyB] ?? null })),
}));
console.log(JSON.stringify(out));
