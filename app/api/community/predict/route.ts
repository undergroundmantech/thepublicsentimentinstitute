// Call the next poll. GET returns the crowd's average guess, the reader's own entry and, once the poll is out, the
// leaderboard; POST saves or updates the reader's entry while the contest is open.
import { NextResponse } from "next/server";
import { contestOf, currentContest, isOpen, type Contest } from "@/app/lib/community/contests";
import { getJson, listKeys, putJson, storeReady } from "@/app/lib/community/store";
import { visitor, visitorCookie } from "@/app/lib/community/visitor";

export const dynamic = "force-dynamic";
type Entry = { name: string; v: Record<string, number>; at: string };
type Tally = { n: number; sum: Record<string, number>; at: string };
type Board = { rows: { name: string; miss: number; v: Record<string, number> }[]; n: number; at: string };

const clean = (s: string) => s.replace(/[^\p{L}\p{N} ._'-]/gu, "").trim().slice(0, 24);
async function entries(c: Contest) {
  const keys = (await listKeys(`predict/${c.id}/entries/`)).filter((k) => k.endsWith(".json")); const out: Entry[] = [];
  for (let i = 0; i < keys.length; i += 25) for (const e of await Promise.all(keys.slice(i, i + 25).map((k) => getJson<Entry>(k)))) if (e) out.push(e);
  return out;
}
async function board(c: Contest): Promise<Board | null> {
  if (!c.actual) return null;
  const old = await getJson<Board>(`predict/${c.id}/board.json`); if (old) return old;
  const rows = (await entries(c)).map((e) => ({ name: e.name, v: e.v, miss: Math.round(c.fields.reduce((a, f) => a + Math.abs((e.v[f.k] ?? 0) - (c.actual![f.k] ?? 0)), 0) * 10) / 10 }))
    .sort((a, b) => a.miss - b.miss);
  const b = { rows: rows.slice(0, 100), n: rows.length, at: new Date().toISOString() }; await putJson(`predict/${c.id}/board.json`, b); return b;
}
const avg = (t: Tally | null) => (t && t.n ? Object.fromEntries(Object.entries(t.sum).map(([k, s]) => [k, Math.round((s / t.n) * 10) / 10])) : {});

export async function GET(req: Request) {
  const c = contestOf(new URL(req.url).searchParams.get("id") ?? "") ?? currentContest();
  if (!storeReady()) return NextResponse.json({ ok: true, id: c.id, n: 0, crowd: {}, mine: null, board: null });
  const v = await visitor(); const [t, mine, b] = await Promise.all([getJson<Tally>(`predict/${c.id}/tally.json`), getJson<Entry>(`predict/${c.id}/entries/${v.id}.json`), board(c)]);
  return NextResponse.json({ ok: true, id: c.id, n: t?.n ?? 0, crowd: avg(t), mine, board: b }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  if (!storeReady()) return NextResponse.json({ ok: false, error: "The contest opens soon." }, { status: 503 });
  let b: { id?: string; name?: string; v?: Record<string, unknown> }; try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const c = contestOf(b.id ?? "") ?? currentContest();
  if (!isOpen(c)) return NextResponse.json({ ok: false, error: "Entries for this poll have closed." }, { status: 400 });
  const name = clean(String(b.name ?? "")); if (name.length < 2) return NextResponse.json({ ok: false, error: "Pick a name for the leaderboard, 2 to 24 letters." }, { status: 400 });
  const vals: Record<string, number> = {};
  for (const f of c.fields) { const x = Number(b.v?.[f.k]); if (!Number.isFinite(x) || x < f.min || x > f.max) return NextResponse.json({ ok: false, error: `${f.label} must be between ${f.min} and ${f.max}.` }, { status: 400 }); vals[f.k] = Math.round(x / f.step) * f.step; }
  const v = await visitor(); const key = `predict/${c.id}/entries/${v.id}.json`;
  const old = await getJson<Entry>(key); const e: Entry = { name, v: vals, at: new Date().toISOString() };
  await putJson(key, e);
  const t = (await getJson<Tally>(`predict/${c.id}/tally.json`)) ?? { n: 0, sum: {}, at: "" };
  if (!old) t.n += 1;
  for (const f of c.fields) t.sum[f.k] = (t.sum[f.k] ?? 0) + vals[f.k] - (old?.v[f.k] ?? 0);
  t.at = e.at; await putJson(`predict/${c.id}/tally.json`, t);
  const r = NextResponse.json({ ok: true, id: c.id, n: t.n, crowd: avg(t), mine: e, board: null }); if (v.fresh) r.cookies.set(visitorCookie(v.fresh)); return r;
}
