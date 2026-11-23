// The weekly leaderboard. GET returns this week's boards and last week's winners; POST enters a finished race by its
// share code. The server checks the code against the map: the electoral votes must add up from the states it says
// each side carried, so a typed in score is turned away. Each board keeps its top ten; one name holds one spot per board.
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { decodeRes, unpackWins } from "@/app/play/share28";
import { states } from "@/app/play/r/data";
import { CATS, emptyBoard, prevWeek, scores, weekOf, type Board, type Row } from "@/app/play/board28";
import { getJson, putJson, storeReady } from "@/app/lib/community/store";
import { visitor, visitorCookie } from "@/app/lib/community/visitor";

export const dynamic = "force-dynamic";
const key = (w: string) => `play/board/${w}.json`;
const clean = (s: string) => s.replace(/[^\p{L}\p{N} ._'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20);

export async function GET() {
  const w = weekOf();
  if (!storeReady()) return NextResponse.json({ ok: true, week: w, board: emptyBoard(w), last: null });
  const [b, l] = await Promise.all([getJson<Board>(key(w)), getJson<Board>(key(prevWeek(w)))]);
  return NextResponse.json({ ok: true, week: w, board: b ?? emptyBoard(w), last: l }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
}

export async function POST(req: Request) {
  if (!storeReady()) return NextResponse.json({ ok: false, error: "The leaderboard opens soon." }, { status: 503 });
  let b: { code?: string; name?: string }; try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const name = clean(String(b.name ?? "")); if (name.length < 2) return NextResponse.json({ ok: false, error: "Pick a name for the board, 2 to 20 letters." }, { status: 400 });
  const r = decodeRes(String(b.code ?? "")); if (!r) return NextResponse.json({ ok: false, error: "That result could not be read." }, { status: 400 });
  // the electoral votes have to add up from the map the code carries
  const S = states(); const w = unpackWins(r.w, S.length); let dEv = 0; S.forEach((x, i) => { if (w[i]) dEv += x.ev; });
  const mine = r.p === "D" ? dEv : 538 - dEv;
  if (Math.abs(mine - r.ev) > 0 || r.win !== r.ev >= 270 || !r.seed) return NextResponse.json({ ok: false, error: "That result does not add up, so it was not entered." }, { status: 400 });
  if (!r.win) return NextResponse.json({ ok: false, error: "Only wins go on the board. Run it back." }, { status: 400 });
  const v = await visitor(); const wk = weekOf();
  const lim = (await getJson<{ n: number }>(`play/sub/${wk}/${v.id}.json`)) ?? { n: 0 };
  if (lim.n >= 40) return NextResponse.json({ ok: false, error: "That's the most entries one player can send this week." }, { status: 429 });
  await putJson(`play/sub/${wk}/${v.id}.json`, { n: lim.n + 1 });
  const code = String(b.code); const row: Row = { name, me: r.me, op: r.op, p: r.p, ev: r.ev, pop: r.pop, sp: r.sp ?? 0, code, at: new Date().toISOString(), fl: r.fl, sc: r.sc };
  const board = (await getJson<Board>(key(wk))) ?? emptyBoard(wk); board.n += 1;
  const sc = scores(row); const ranks: Record<string, number> = {};
  for (const c of CATS) {
    const s = sc[c.k]; if (s == null) continue; const list = board.cats[c.k];
    const old = list.findIndex((x) => x.name.toLowerCase() === name.toLowerCase());
    if (old >= 0) { if ((scores(list[old])[c.k] ?? -Infinity) >= s) continue; list.splice(old, 1); }
    if (list.some((x) => x.code === code)) continue;
    list.push(row); list.sort((a, b2) => (scores(b2)[c.k] ?? 0) - (scores(a)[c.k] ?? 0)); board.cats[c.k] = list.slice(0, 10);
    const at = board.cats[c.k].findIndex((x) => x.code === code); if (at >= 0) ranks[c.title] = at + 1;
  }
  await putJson(key(wk), board);
  await putJson(`play/entries/${wk}/${crypto.createHash("sha1").update(code).digest("hex").slice(0, 16)}.json`, row);
  const res = NextResponse.json({ ok: true, week: wk, ranks, board });
  if (v.fresh) res.cookies.set(visitorCookie(v.fresh)); return res;
}
