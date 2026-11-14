// The engine state every results page reads: GET ?source=live|historical/<id>|simulated/<id>&at=<ISO>.
// Which sources may be served is decided on the server (app/lib/engine/gate.ts). Nothing after `at` is returned.
import { NextResponse } from "next/server";
import { stateView } from "@/app/lib/engine/serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const r = await stateView(q.get("source") ?? "live", q.get("at"));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const live = r.view.live;
  return NextResponse.json({ info: r.info, view: r.view }, { headers: { "cache-control": live ? "public, max-age=30, s-maxage=60" : "private, max-age=300" } });
}
