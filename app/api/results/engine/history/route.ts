// Chart history from stored engine states, cut at `at` on the server: GET ?source=…&at=…[&race=ID].
import { NextResponse } from "next/server";
import { history } from "@/app/lib/engine/serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const r = await history(q.get("source") ?? "live", q.get("at"), q.get("race"));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ points: r.points }, { headers: { "cache-control": "private, max-age=60" } });
}
