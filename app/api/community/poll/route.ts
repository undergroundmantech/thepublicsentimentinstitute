// The weekly reader poll. GET returns the tally and the reader's own pick; POST casts one vote per reader per week.
// Votes are kept one object per voter, so the tally can always be rebuilt; the running tally is one small object.
import { NextResponse } from "next/server";
import { currentPoll, pollOf } from "@/app/lib/community/contests";
import { adminOk, getJson, listKeys, putJson, storeReady } from "@/app/lib/community/store";
import { visitor, visitorCookie } from "@/app/lib/community/visitor";

export const dynamic = "force-dynamic";
type Tally = { n: number; c: Record<string, number>; at: string };
const tallyKey = (w: string) => `poll/${w}/tally.json`;

async function recount(week: string): Promise<Tally> {
  const keys = await listKeys(`poll/${week}/votes/`); const c: Record<string, number> = {};
  for (const k of keys) { const opt = k.split("/")[3]; if (opt) c[opt] = (c[opt] ?? 0) + 1; }
  const t = { n: keys.length, c, at: new Date().toISOString() }; await putJson(tallyKey(week), t); return t;
}

export async function GET(req: Request) {
  const u = new URL(req.url); const p = pollOf(u.searchParams.get("week") ?? "") ?? currentPoll();
  if (!storeReady()) return NextResponse.json({ ok: true, week: p.week, tally: { n: 0, c: {} }, mine: null });
  let t = await getJson<Tally>(tallyKey(p.week));
  if (!t || (u.searchParams.get("recount") && adminOk(u.searchParams.get("key")))) t = await recount(p.week);
  const v = await visitor(); const mine = await getJson<{ k: string }>(`poll/${p.week}/voters/${v.id}.json`);
  return NextResponse.json({ ok: true, week: p.week, tally: { n: t.n, c: t.c }, mine: mine?.k ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  if (!storeReady()) return NextResponse.json({ ok: false, error: "Voting opens soon." }, { status: 503 });
  let b: { week?: string; k?: string }; try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const p = pollOf(b.week ?? "") ?? currentPoll();
  if (p.week !== currentPoll().week) return NextResponse.json({ ok: false, error: "This week's poll has closed." }, { status: 400 });
  if (!p.options.some((o) => o.k === b.k)) return NextResponse.json({ ok: false, error: "Pick one of the answers." }, { status: 400 });
  const v = await visitor();
  const ipVotes = (await listKeys(`poll/${p.week}/ip/${v.ip}/`)).length;
  if (ipVotes >= 6) return NextResponse.json({ ok: false, error: "Too many votes from this network this week." }, { status: 429 });
  const first = await putJson(`poll/${p.week}/voters/${v.id}.json`, { k: b.k, at: new Date().toISOString() }, { ifAbsent: true });
  const res = (t: Tally, mine: string, already = false) => {
    const r = NextResponse.json({ ok: true, week: p.week, tally: { n: t.n, c: t.c }, mine, already });
    if (v.fresh) r.cookies.set(visitorCookie(v.fresh)); return r;
  };
  if (first === "EXISTS") { const m = await getJson<{ k: string }>(`poll/${p.week}/voters/${v.id}.json`); const t = (await getJson<Tally>(tallyKey(p.week))) ?? (await recount(p.week)); return res(t, m?.k ?? b.k!, true); }
  await putJson(`poll/${p.week}/votes/${b.k}/${v.id}.json`, { at: new Date().toISOString() });
  await putJson(`poll/${p.week}/ip/${v.ip}/${v.id}.json`, { at: new Date().toISOString() });
  const t = (await getJson<Tally>(tallyKey(p.week))) ?? { n: 0, c: {}, at: "" };
  t.n += 1; t.c[b.k!] = (t.c[b.k!] ?? 0) + 1; t.at = new Date().toISOString();
  await putJson(tallyKey(p.week), t);
  return res(t, b.k!);
}
