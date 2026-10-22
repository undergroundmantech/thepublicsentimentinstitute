// A caching proxy for civicAPI's race search on November 3, 2026. Every visitor to the results monitor reads the
// same copy for 30 seconds, so civicAPI sees one request per race type per half minute however many people watch.
import { NextResponse } from "next/server";

const BASE = "https://civicapi.org/api/v2/race/search";
const TYPES = new Set(["US Senate", "Governor", "House of Representatives", "US House", "State Senate", "State House", "State Assembly", "House of Delegates",
  "Proposition", "Referendum", "Ballot Measure", "Initiative", "Amendment", "Constitutional Amendment", "Question", "Issue",
  "Lieutenant Governor", "Attorney General", "Secretary of State", "State Treasurer", "Treasurer", "Auditor", "State Auditor", "Comptroller", "Controller",
  "Agriculture Commissioner", "Commissioner of Agriculture and Industries", "Secretary of Agriculture", "Commissioner of Agriculture", "Land Commissioner",
  "Commissioner of State Lands", "Commissioner of Public Lands", "Superintendent of Public Instruction", "Superintendent", "Insurance Commissioner",
  "Labor Commissioner", "Commissioner of Labor", "State Mine Inspector", "Public Service Commissioner", "Public Service Commission", "Railroad Commissioner",
  "State Board of Education", "Education", "Supreme Court", "Judicial", "Mayor"]);

type Cand = { name: string; party: string; votes: number; percent: number; winner?: boolean; color?: string; seats?: number };
type Race = { id: number; type: string; province: string; district: string | null; election_name: string; percent_reporting: number; seats?: number; candidates: Cand[] };

export const revalidate = 30;

export async function GET(req: Request) {
  const type = new URL(req.url).searchParams.get("type") || "";
  if (!TYPES.has(type)) return NextResponse.json({ error: "unknown race type" }, { status: 400 });
  const url = `${BASE}?startDate=2026-11-03&endDate=2026-11-03&limit=20000&type=${encodeURIComponent(type)}`;
  try {
    const r = await fetch(url, { next: { revalidate: 30 }, headers: { accept: "application/json" } });
    if (!r.ok) return NextResponse.json({ error: `civicAPI ${r.status}` }, { status: 502 });
    const j = (await r.json()) as { count: number; races: Race[] };
    const races = (j.races || []).map((x) => ({
      id: x.id, type: x.type, province: x.province, district: x.district, name: x.election_name, pr: x.percent_reporting ?? 0, seats: x.seats,
      c: (x.candidates || []).map((c) => [c.name, c.party, c.votes ?? 0, c.percent ?? 0, c.winner ? 1 : 0, c.seats ?? null]),
    }));
    return NextResponse.json({ type, at: new Date().toISOString(), count: races.length, races }, { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ error: "civicAPI unreachable" }, { status: 502 });
  }
}
