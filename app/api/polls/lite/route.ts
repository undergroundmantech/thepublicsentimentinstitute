import { NextResponse } from "next/server";
import { AGGREGATES, buildAggregate, liteBuilt } from "@/app/_polling/lib/aggregates";

// Summaries of every polling average for the averages page's boards, tiles and maps: the last 90 days of each line,
// the latest reading, the poll count and a sparkline. Built once per deploy, so a phone never builds 84 averages.
export const dynamic = "force-static";

export async function GET() {
  const out: Record<string, ReturnType<typeof liteBuilt>> = {};
  for (const d of AGGREGATES) out[d.id] = liteBuilt(buildAggregate(d));
  return NextResponse.json(out, { headers: { "cache-control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400" } });
}
