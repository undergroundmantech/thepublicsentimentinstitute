import { NextResponse } from "next/server";
import { AGGREGATES, buildAggregate } from "@/app/_polling/lib/aggregates";
import { pollHref } from "@/app/polls/registry";

// Public JSON for every tracked average, so outlets can cite the number:
//   /api/polls/trump-approval, /api/polls/generic-ballot, /api/polls/oh-sen-2026 ...
// { avg, updated, series, polls }. /api/polls/index lists every id.
export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ avg: "index" }, ...AGGREGATES.map((d) => ({ avg: d.id }))];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export async function GET(_req: Request, { params }: { params: Promise<{ avg: string }> }) {
  const { avg } = await params;
  if (avg === "index") {
    return NextResponse.json({
      averages: AGGREGATES.map((d) => ({ id: d.id, label: d.label, category: d.category, page: `https://onpointpolitics.com${pollHref(d.id)}`, json: `https://onpointpolitics.com/api/polls/${d.id}` })),
    });
  }
  const def = AGGREGATES.find((d) => d.id === avg);
  if (!def) return NextResponse.json({ error: "unknown average", index: "/api/polls/index" }, { status: 404 });
  const b = buildAggregate(def);
  const last = b.daily[b.daily.length - 1];
  return NextResponse.json({
    avg: {
      id: def.id, title: def.title, label: def.label, category: def.category,
      a: { label: def.seriesA.label, value: b.latest ? r1(b.latest.a) : null },
      b: { label: def.seriesB.label, value: b.latest ? r1(b.latest.b) : null },
      margin: b.latest ? r1(b.latest.net) : null,
      marginText: b.latest ? def.fmtMargin(b.latest.net) : null,
      marginDefinition: `${def.seriesA.label} minus ${def.seriesB.label}`,
      page: `https://onpointpolitics.com${pollHref(def.id)}`,
      source: "OnPoint Politics polling average, The Public Sentiment Institute",
    },
    updated: last ? last.date : null,
    series: b.daily.map((d) => ({ date: d.date, a: r1(d.a), b: r1(d.b), margin: r1(d.net) })),
    polls: b.polls.map((p) => ({ pollster: p.pollster, date: p.date, sampleSize: p.sampleSize, sampleType: p.sampleType, a: p.a, b: p.b, margin: r1(p.margin) })),
  }, { headers: { "Cache-Control": "public, max-age=900, s-maxage=3600", "Access-Control-Allow-Origin": "*" } });
}
