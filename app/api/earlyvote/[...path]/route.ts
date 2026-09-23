import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for civicAPI's early vote feed.
 *
 * Everything the Early Vote page reads goes through here, for three reasons:
 * the browser never has to care whether civicAPI sends CORS headers, the
 * upstream host appears in exactly one file, and responses are cached so a
 * page that switches categories and states does not hammer them.
 *
 * civicAPI is public and needs no key. Attribution is required for
 * non-personal use and the page carries it.
 */
const BASE = "https://civicapi.org/api/v2/early-vote";

// the feed publishes one snapshot a day, so five minutes is plenty
export const revalidate = 300;

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const clean = (path ?? []).filter((p) => /^[A-Za-z0-9_-]+$/.test(p));
  if (!clean.length) return NextResponse.json({ error: "no path" }, { status: 400 });

  const url = new URL(`${BASE}/${clean.join("/")}`);
  const by = req.nextUrl.searchParams.get("by");
  if (by && /^[a-z]+$/.test(by)) url.searchParams.set("by", by);

  try {
    const r = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      next: { revalidate },
    });
    const body = await r.text();
    // A 400 here is normal: it is how the feed says a breakdown is not
    // published for that state and category. Pass the status through so the
    // page can fall back rather than treat it as an outage.
    return new NextResponse(body, {
      status: r.status,
      headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
