import { NextResponse } from "next/server";
import { AGGREGATES, buildAggregate } from "@/app/_polling/lib/aggregates";

// One polling average fully built, exactly what the averages page draws: the daily line and every poll with its
// weight. Built once per deploy for every average, so switching averages on a phone is a download, not a rebuild.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return AGGREGATES.map((d) => ({ avg: d.id }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ avg: string }> }) {
  const { avg } = await params;
  const def = AGGREGATES.find((d) => d.id === avg);
  if (!def) return NextResponse.json({ error: "unknown average" }, { status: 404 });
  return NextResponse.json(buildAggregate(def), { headers: { "cache-control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=86400" } });
}
