// Live Kalshi prices for On Point races: GET /api/kalshi?ids=sen-GA,gov-AZ. Reads Kalshi's public market data, no key,
// each event at most every two minutes. A race Kalshi does not list comes back null; the game and pages carry on without it.
import { NextResponse } from "next/server";
import { KALSHI_API, eventTickers, readEvent, type KalshiRace } from "@/app/kalshi";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

async function one(id: string): Promise<KalshiRace | null> {
  for (const t of eventTickers(id)) {
    try {
      const r = await fetch(`${KALSHI_API}/events/${encodeURIComponent(t)}?with_nested_markets=true`, { next: { revalidate: 120 }, headers: { accept: "application/json" }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const k = readEvent(id, await r.json());
      if (k) return k;
    } catch { /* try the next spelling */ }
  }
  return null;
}

export async function GET(req: Request) {
  const ids = [...new Set((new URL(req.url).searchParams.get("ids") ?? "").split(",").map((x) => x.trim()).filter((x) => /^(sen|gov|house)-[A-Z]{2}(-\d{1,2})?$/.test(x)))].slice(0, 80);
  const out: Record<string, KalshiRace | null> = {};
  const q = [...ids];
  await Promise.all(Array.from({ length: Math.min(8, q.length) }, async () => { for (let id = q.shift(); id; id = q.shift()) out[id] = await one(id); }));
  return NextResponse.json({ at: new Date().toISOString(), races: out }, { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" } });
}
