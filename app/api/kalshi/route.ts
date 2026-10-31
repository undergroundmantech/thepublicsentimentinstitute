// Live Kalshi prices for On Point races: GET /api/kalshi?ids=sen-GA,gov-AZ. Reads Kalshi's public market data, no key.
// Oct 31 2026: requests go out four at a time with a retry when Kalshi rate limits, a race found in the last two minutes is
// served from memory, and up to 120 ids are taken, so every race in the game gets a price. A race Kalshi does not list
// comes back null; the game and pages carry on without it.
import { NextResponse } from "next/server";
import { fetchRace, type KalshiRace } from "@/app/kalshi";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CACHE = new Map<string, { at: number; k: KalshiRace | null }>();
const FRESH = 120_000, MISS = 600_000;

async function one(id: string): Promise<KalshiRace | null> {
  const c = CACHE.get(id), now = Date.now();
  if (c && now - c.at < (c.k ? FRESH : MISS)) return c.k;
  const k = await fetchRace(id);
  if (k || !c?.k) CACHE.set(id, { at: now, k });
  return k ?? c?.k ?? null;
}

export async function GET(req: Request) {
  const ids = [...new Set((new URL(req.url).searchParams.get("ids") ?? "").split(",").map((x) => x.trim()).filter((x) => /^(sen|gov|house)-[A-Z]{2}(-\d{1,2})?$/.test(x)))].slice(0, 120);
  const out: Record<string, KalshiRace | null> = {};
  const q = [...ids];
  await Promise.all(Array.from({ length: Math.min(4, q.length) }, async () => { for (let id = q.shift(); id; id = q.shift()) out[id] = await one(id); }));
  return NextResponse.json({ at: new Date().toISOString(), races: out }, { headers: { "cache-control": "public, s-maxage=120, stale-while-revalidate=600" } });
}
