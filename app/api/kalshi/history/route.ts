// Daily Kalshi price history for one race: GET /api/kalshi/history?id=sen-GA&days=60. Reads Kalshi's public daily
// candlesticks for each side of the race, so the game can draw the real market in its own pixel chart.
// Oct 31 2026: each side is read from /series/{series}/markets/{ticker}/candlesticks, the endpoint Kalshi serves publicly;
// the batch endpoint used before answered with an error, so the chart always said there was no history.
import { NextResponse } from "next/server";
import { KALSHI_API, fetchRace, kalshiGet } from "@/app/kalshi";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Pt = { t: number; p: number };
const num = (v: unknown) => { const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN; return isFinite(n) ? n : null; };
type Candle = { end_period_ts: number; price?: Record<string, unknown>; yes_bid?: Record<string, unknown>; yes_ask?: Record<string, unknown> };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams; const id = q.get("id") ?? "";
  const days = Math.max(7, Math.min(120, Number(q.get("days")) || 60));
  if (!/^(sen|gov|house)-[A-Z]{2}(-\d{1,2})?$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const k = await fetchRace(id);
  if (!k) return NextResponse.json({ id, sides: [] }, { headers: { "cache-control": "public, s-maxage=300" } });
  const end = Math.floor(Date.now() / 1000), start = end - days * 86400;
  const sides = await Promise.all(k.sides.map(async (x) => {
    const r = await kalshiGet(`${KALSHI_API}/series/${encodeURIComponent(k.series)}/markets/${encodeURIComponent(x.ticker)}/candlesticks?start_ts=${start}&end_ts=${end}&period_interval=1440`, 900, 8000);
    let pts: Pt[] = [];
    if (r && r.ok) {
      try {
        const j = (await r.json()) as { candlesticks?: Candle[] };
        pts = (j.candlesticks ?? []).map((c) => {
          const close = num(c.price?.close_dollars) ?? (num(c.price?.close) != null ? num(c.price?.close)! / 100 : null);
          const bid = num(c.yes_bid?.close_dollars), ask = num(c.yes_ask?.close_dollars);
          const p = close ?? (bid != null && ask != null ? (bid + ask) / 2 : null);
          return p == null ? null : { t: c.end_period_ts, p };
        }).filter(Boolean) as Pt[];
      } catch { pts = []; }
    }
    return { party: x.party, name: x.name, price: x.price, pts };
  }));
  return NextResponse.json({ id, event: k.event, title: k.title, sides, at: new Date().toISOString() },
    { headers: { "cache-control": "public, s-maxage=900, stale-while-revalidate=3600" } });
}
