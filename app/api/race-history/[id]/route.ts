// Public race history for one race. Reads only what is already stored: the frozen dataset of verified published forecasts and,
// when a durable recorder store is configured, recorded live projections and result observations. It never calls an election
// provider, so page traffic cannot become upstream traffic. The CDN absorbs repeat requests.
import { NextResponse } from "next/server";
import { resolveStore } from "@/app/lib/intelligence/captureStore";
import { prepareHistory, type PreparedHistory } from "@/app/lib/intelligence/raceHistory";
import { frozenPointsFor, loadFrozenDataset, loadRaceHistory } from "@/app/lib/intelligence/raceHistoryStore";

export const runtime = "nodejs";

const RACE = /^(sen|gov|house)-[A-Z]{2}(-[0-9A-Z]{1,3})?$/;
const CACHE = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!RACE.test(id)) return NextResponse.json({ error: "unknown race" }, { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" } });
  let known = false;
  try { known = id in loadFrozenDataset().races; } catch { /* dataset unreadable: fall through to the store alone */ }

  let history: PreparedHistory | null = null;
  let partial = false;
  const { store } = resolveStore(process.env);
  if (store?.durable) {
    try { history = (await loadRaceHistory(store, id, { surface: "PUBLIC" })).prepared; } catch { partial = true; }
  }
  if (!history) {
    if (!known) return NextResponse.json({ error: "unknown race" }, { status: 404, headers: { "Cache-Control": "public, s-maxage=300" } });
    try { history = prepareHistory(id, frozenPointsFor(id), { surface: "PUBLIC" }); } catch {
      return NextResponse.json({ error: "history unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  return NextResponse.json({ history, nowMs: Date.now(), partial }, { headers: { "Cache-Control": CACHE } });
}
