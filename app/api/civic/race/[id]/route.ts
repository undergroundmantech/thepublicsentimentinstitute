// A caching proxy for one civicAPI race with its county results, trimmed to what the results pages read.
import { NextResponse } from "next/server";

type Cand = { name: string; party: string; votes: number; percent: number; winner?: boolean };
type Region = { name: string; type?: string; fips?: string; percent_reporting?: number; candidates?: Cand[] };

export const revalidate = 30;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{1,9}$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try {
    const r = await fetch(`https://civicapi.org/api/v2/race/${id}`, { next: { revalidate: 30 }, headers: { accept: "application/json" } });
    if (!r.ok) return NextResponse.json({ error: `civicAPI ${r.status}` }, { status: 502 });
    const j = await r.json();
    const regions: Record<string, unknown> = {};
    for (const [k, v] of Object.entries((j.region_results || {}) as Record<string, Region>)) {
      regions[v.fips || k] = { n: v.name, t: v.type, pr: v.percent_reporting ?? 0, c: (v.candidates || []).map((c) => [c.name, c.party, c.votes ?? 0, c.percent ?? 0, c.winner ? 1 : 0]) };
    }
    return NextResponse.json({
      id: Number(id), name: j.election_name, type: j.election_type, province: j.province, district: j.district, pr: j.percent_reporting ?? 0,
      close: j.polls_close ?? null, updated: j.last_updated ?? null, test: !!j.test_data,
      c: (j.candidates || []).map((c: Cand) => [c.name, c.party, c.votes ?? 0, c.percent ?? 0, c.winner ? 1 : 0]), regions,
    }, { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ error: "civicAPI unreachable" }, { status: 502 });
  }
}
