// Live Brazil runoff returns: the national race and all 27 state races from civicAPI in one compact payload, with
// the On Point projection already worked out, so every Brazil page polls one cached URL.
import { NextResponse } from "next/server";
import expJson from "@/app/brasil/exp.json";
import br from "@/public/brasil/br.json";
import { projectAll, type Exp, type RawState } from "@/app/brasil/project";

export const revalidate = 30;
const exp = expJson as unknown as Exp;
type Cand = { name: string; party?: string; votes?: number; winner?: boolean };
type Region = { name: string; type?: string; percent_reporting?: number; candidates?: Cand[] };
const key = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const isF = (c: Cand) => c.party === "PL" || /bolsonaro/i.test(c.name);
const isL = (c: Cand) => c.party === "PT" || /lula/i.test(c.name);
function two(cs: Cand[] = []) {
  let fv = 0, lv = 0, win: "F" | "L" | null = null;
  for (const c of cs) { if (isF(c)) { fv += c.votes ?? 0; if (c.winner) win = "F"; } else if (isL(c)) { lv += c.votes ?? 0; if (c.winner) win = "L"; } }
  return { fv, lv, win };
}
async function race(id: number) {
  const r = await fetch(`https://civicapi.org/api/v2/race/${id}`, { next: { revalidate: 30 }, headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
const STATE_KEY: Record<string, string> = Object.fromEntries(Object.entries(exp.states).map(([uf, s]) => [key(s[4]), uf]));

const CLOSE = Date.parse("2026-10-25T20:00:00Z");   // 17h in Brasília: nothing is published before every poll closes

export async function GET() {
  // civicAPI can carry test numbers before the polls close; they never reach the pages
  if (Date.now() < CLOSE) return NextResponse.json(projectAll({}, { pr: 0, fv: 0, lv: 0 }, exp, new Date().toISOString(), false), { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" } });
  const civic = (br as { civic: Record<string, number> }).civic;
  const ufs = Object.keys(civic).filter((k) => k !== "BR");
  const [natR, ...stR] = await Promise.allSettled([race(civic.BR), ...ufs.map((uf) => race(civic[uf]))]);
  const raw: Record<string, RawState> = {};
  let nat = { pr: 0, fv: 0, lv: 0, win: null as "F" | "L" | null }, test = false, t = new Date().toISOString();
  if (natR.status === "fulfilled") {
    const j = natR.value; const s = two(j.candidates); test = !!j.test_data; t = j.last_updated ?? t;
    nat = { pr: j.percent_reporting ?? 0, ...s };
    for (const v of Object.values((j.region_results || {}) as Record<string, Region>)) {
      const uf = /exterior/i.test(v.name) ? "ZZ" : STATE_KEY[key(v.name)]; if (!uf) continue;
      const x = two(v.candidates); raw[uf] = { pr: v.percent_reporting ?? 0, fv: x.fv, lv: x.lv, m: {}, win: x.win };
    }
  }
  stR.forEach((res, i) => {
    if (res.status !== "fulfilled") return;
    const uf = ufs[i], j = res.value, s = two(j.candidates), m: RawState["m"] = {};
    let sp = j.percent_reporting ?? 0;
    for (const v of Object.values((j.region_results || {}) as Region[] | Record<string, Region>)) {
      const x = two(v.candidates);
      if (v.type === "State") { sp = Math.max(sp, v.percent_reporting ?? 0); continue; }
      if (x.fv + x.lv > 0) m[key(v.name)] = [x.fv, x.lv, v.percent_reporting ?? 0];
    }
    const prev = raw[uf];
    // the state race and the national race's state row can update a moment apart; take whichever has counted more
    if (!prev || s.fv + s.lv >= prev.fv + prev.lv) raw[uf] = { pr: Math.max(sp, prev?.pr ?? 0), fv: s.fv, lv: s.lv, m, win: s.win ?? prev?.win ?? null };
    else raw[uf] = { ...prev, m };
  });
  if (natR.status === "rejected" && stR.every((r) => r.status === "rejected")) return NextResponse.json({ error: "civicAPI unreachable" }, { status: 502 });
  return NextResponse.json(projectAll(raw, nat, exp, t, test), { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" } });
}
