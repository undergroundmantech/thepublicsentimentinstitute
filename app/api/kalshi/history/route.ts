// Daily Kalshi price history for one race: GET /api/kalshi/history?id=sen-GA&days=60. Reads Kalshi's public
// candlesticks for each side of the race, so the game can draw the real market in its own pixel chart.
import { NextResponse } from "next/server";
import { KALSHI_API, eventTickers, readEvent } from "@/app/kalshi";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type Pt = { t: number; p: number };
const num = (v: unknown) => { const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN; return isFinite(n) ? n : null; };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams; const id = q.get("id") ?? "";
  const days = Math.max(7, Math.min(120, Number(q.get("days")) || 60));
  if (!/^(sen|gov|house)-[A-Z]{2}(-\d{1,2})?$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  for (const t of eventTickers(id)) {
    try {
      const r = await fetch(`${KALSHI_API}/events/${encodeURIComponent(t)}?with_nested_markets=true`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const k = readEvent(id, await r.json()); if (!k) continue;
      const end = Math.floor(Date.now() / 1000), start = end - days * 86400;
      const tick = k.sides.map((x) => x.ticker).join(",");
      const c = await fetch(`${KALSHI_API}/markets/candlesticks?market_tickers=${encodeURIComponent(tick)}&start_ts=${start}&end_ts=${end}&period_interval=1440`, { next: { revalidate: 900 }, signal: AbortSignal.timeout(8000) });
      const j = c.ok ? await c.json() : { markets: [] };
      const by: Record<string, Pt[]> = {};
      for (const m of j.markets ?? []) {
        by[m.market_ticker] = (m.candlesticks ?? []).map((x: Record<string, Record<string, string>> & { end_period_ts: number }) => {
          const close = num(x.price?.close_dollars), bid = num(x.yes_bid?.close_dollars), ask = num(x.yes_ask?.close_dollars);
          const p = close ?? (bid != null && ask != null ? (bid + ask) / 2 : null);
          return p == null ? null : { t: x.end_period_ts, p };
        }).filter(Boolean) as Pt[];
      }
      return NextResponse.json({ id, event: k.event, title: k.title, sides: k.sides.map((x) => ({ party: x.party, name: x.name, price: x.price, pts: by[x.ticker] ?? [] })), at: new Date().toISOString() },
        { headers: { "cache-control": "public, s-maxage=900, stale-while-revalidate=3600" } });
    } catch { /* next spelling */ }
  }
  return NextResponse.json({ id, sides: [] }, { headers: { "cache-control": "public, s-maxage=300" } });
}
