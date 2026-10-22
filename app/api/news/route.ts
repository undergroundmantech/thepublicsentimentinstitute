// The news desk's live wire: every outlet's public feed, read at most every ten minutes, grouped into stories.
import { NextResponse } from "next/server";
import { cluster, readAll } from "@/app/news/feed";

export const revalidate = 600;
export const maxDuration = 20;

export async function GET() {
  const { items, status } = await readAll(48);
  const stories = cluster(items).slice(0, 220);
  const byOutlet: Record<string, { ok: number; fail: number; items: number }> = {};
  for (const s of status) { const b = (byOutlet[s.o] ??= { ok: 0, fail: 0, items: 0 }); if (s.ok) b.ok++; else b.fail++; b.items += s.n; }
  return NextResponse.json({ at: new Date().toISOString(), items: items.length, stories, outlets: byOutlet },
    { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=1200" } });
}
