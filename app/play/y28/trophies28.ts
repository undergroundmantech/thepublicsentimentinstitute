// Trophies for Campaign 2028: earned at the end of a run and kept in a case on this device.
import type * as E from "./engine28";
import type { Game } from "./ui28";
import * as MO from "./more28";

export const TROPHIES: { id: string; name: string; how: string }[] = [
  { id: "nominee", name: "The nominee", how: "Win your party's nomination." },
  { id: "recount", name: "Every vote counted", how: "Flip a state your way in a recount." },
  { id: "coattails", name: "Coattails", how: "Win and carry your party to 51 Senate seats." },
  { id: "endorsed", name: "Endorsement sweep", how: "Earn six endorsements in one campaign." },
  { id: "ironman", name: "Ironman", how: "Win the presidency in ironman mode." },
  { id: "hardwin", name: "Against the odds", how: "Win the presidency in hard mode." },
  { id: "daily", name: "Daily winner", how: "Win the daily challenge." },
  { id: "sweep", name: "Early sweep", how: "Win every early state contest." },
  { id: "floor", name: "Floor fight", how: "Win the nomination at a contested convention." },
  { id: "deal", name: "Dealmaker", how: "Talk a rival into dropping out and endorsing you." },
  { id: "potus", name: "Hail to the chief", how: "Win the presidency." },
  { id: "landslide", name: "Landslide", how: "Win 400 or more electoral votes." },
  { id: "squeaker", name: "Squeaker", how: "Win with 280 electoral votes or fewer." },
  { id: "comeback", name: "Comeback", how: "Win after your win chance fell under 25 percent." },
  { id: "underdog", name: "Underdog", how: "Win the general starting under 30 percent." },
  { id: "steal", name: "Behind enemy lines", how: "Win a state the other party carried by 8 or more in 2024." },
  { id: "perfect", name: "Perfect delivery", how: "Land three perfect debate answers in one run." },
  { id: "surprise", name: "Surprise survivor", how: "Survive the October surprise and win." },
  { id: "oppo", name: "Oppo artist", how: "Land two opposition research hits." },
  { id: "ground", name: "Ground game", how: "Run field programs in ten states." },
  { id: "popular", name: "So close", how: "Win the popular vote and lose the electoral college." },
  { id: "banked", name: "Banked it", how: "Lead the early vote in eight battleground states." },
  { id: "coalition", name: "Coalition builder", how: "Gain three points or more with five voter groups." },
  { id: "army", name: "The army", how: "Build a volunteer army of 100,000." },
  { id: "staffed", name: "Full staff", how: "Hire an A rated pollster and every senior staffer." },
];
const KEY = "opp_play28_trophies";
export function trophyCase(): string[] { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]; } catch { return []; } }
export function addTrophies(ids: string[]) { try { localStorage.setItem(KEY, JSON.stringify([...new Set([...trophyCase(), ...ids])])); } catch { /* storage blocked */ } }

/** What this run earned. */
export function earned(d: E.Data, g: Game): string[] {
  const out: string[] = []; const P = g.P, S = g.Gn, R = g.night;
  if (P) {
    if (P.nominee === g.me) out.push("nominee");
    if (P.nominee === g.me && P.contested) out.push("floor");
    const early = d.primary[P.party].cal.filter((c) => c[1] === 1).map((c) => c[0]);
    if (early.length && early.every((st) => P.results[st]?.win === g.me)) out.push("sweep");
    if (P.field[0].endorse.some((e) => e.startsWith("deal:"))) out.push("deal");
  }
  if ((P?.perfect ?? 0) + (S?.perfect ?? 0) >= 3) out.push("perfect");
  if (S && R) {
    if (R.win) out.push("potus");
    if (R.win && R.ev >= 400) out.push("landslide");
    if (R.win && R.ev <= 280) out.push("squeaker");
    if (R.win && (S.lowP ?? 1) < 0.25) out.push("comeback");
    if (R.win && (S.trend[0]?.p ?? 1) < 0.3) out.push("underdog");
    if (R.win && S.surprise) out.push("surprise");
    const sg = S.party === "R" ? 1 : -1;
    if (R.calls.some((c) => c.win && d.states[c.i].p24 != null && -sg * (d.states[c.i].p24 as number) >= 8)) out.push("steal");
    if ((S.oppo ?? []).filter((h) => h.used && h.hit).length >= 2) out.push("oppo");
    if (S.offices.length >= 10) out.push("ground");
    if (!R.win && R.pop > 0) out.push("popular");
    const bank = S.bank ?? [], bm = S.bankM ?? []; if (d.states.filter((x, i) => (bank[i] ?? 0) > 0 && bm[i] / bank[i] > 0 && Math.abs(x.m) < 8).length >= 8) out.push("banked");
    if (Object.keys(S.gsup ?? {}).filter((k) => (S.gsup![k] ?? 0) - (S.opGsup?.[k] ?? 0) >= 3).length >= 5) out.push("coalition");
    if ((S.vol ?? 0) >= 100000) out.push("army");
    if (R.win && (R.rc ?? []).some((r) => r.after != null && r.after > 0 && r.m <= 0)) out.push("recount");
    if (R.win && S.mo && MO.senateCount(d, S, R.calls.slice().sort((a, b) => a.i - b.i).map((c) => c.m)).mine >= 51) out.push("coattails");
    if ((S.mo?.endorsed.length ?? 0) >= 6) out.push("endorsed");
    if (R.win && g.iron) out.push("ironman");
    if (R.win && g.hard) out.push("hardwin");
    if (R.win && g.daily) out.push("daily");
    if (S.staff?.pollster === 3 && S.staff.media && S.staff.field && S.staff.digital && S.staff.oppo) out.push("staffed");
  }
  return out;
}
