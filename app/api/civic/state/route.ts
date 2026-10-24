// Every November 3 civicAPI race in one state, trimmed, so the state results pages can list the races the forecast
// does not cover (university boards, treasurers, auditors, commissions and the rest) and link each to its own page.
import { NextResponse } from "next/server";

type Cand = { name: string; party: string; votes: number; percent: number; winner?: boolean };
type Race = { id: number; type: string; province: string; district: string | null; election_name: string; percent_reporting: number; candidates: Cand[] };
const LEG = /^(state senate|state house|state assembly|house of delegates|state legislature)$/i;

export const revalidate = 60;

export async function GET(req: Request) {
  const st = (new URL(req.url).searchParams.get("st") || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(st)) return NextResponse.json({ error: "bad state" }, { status: 400 });
  try {
    const r = await fetch(`https://civicapi.org/api/v2/race/search?startDate=2026-11-03&endDate=2026-11-03&limit=5000&province=${st}`, { next: { revalidate: 60 }, headers: { accept: "application/json" } });
    if (!r.ok) return NextResponse.json({ error: `civicAPI ${r.status}` }, { status: 502 });
    const j = (await r.json()) as { races: Race[] };
    const races = (j.races || [])
      .filter((x) => x.province?.toUpperCase() === st && !(LEG.test(x.type) && x.district))   // legislative districts have their own chamber pages
      .map((x) => ({ id: x.id, type: x.type, district: x.district, name: x.election_name, pr: x.percent_reporting ?? 0,
        c: (x.candidates || []).map((c) => [c.name, c.party, c.votes ?? 0, c.percent ?? 0, c.winner ? 1 : 0]) }));
    return NextResponse.json({ st, at: new Date().toISOString(), races }, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch {
    return NextResponse.json({ error: "civicAPI unreachable" }, { status: 502 });
  }
}
