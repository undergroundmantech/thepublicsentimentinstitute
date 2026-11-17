// Pure arithmetic behind the national dashboard: what each category has counted, and the bar beside a watched race.
// Nothing here estimates a result; it only counts what civicAPI reports, On Point's own calls (the winner flags the
// pages carry are those and nothing else: useLive.ts) and the established forecast.
import { hasReturns, liveMargin } from "../monitor/seatMath";
import { isInd, sides, type CRace, type XRace } from "./live";
import { certainParty } from "./onpointCalls";

/** `called`: seats decided (On Point's calls, plus seats contested only within one party); `onPoint`: On Point's calls alone */
export type Tally = { cD: number; cR: number; cO: number; lD: number; lR: number; counting: number; votes: number; n: number; called: number; onPoint: number; oneParty: number };

/**
 * On Point's calls by party, races leading by party, races counting and votes in, for one set of races. An unopposed
 * winner counts as called with no votes reported at all, and a seat contested only within one party counts for that
 * party once votes are in, before the winner is called.
 */
export function tally(rs: XRace[], byId: Record<string, CRace>): Tally {
  let cD = 0, cR = 0, cO = 0, lD = 0, lR = 0, counting = 0, votes = 0, onPoint = 0, oneParty = 0;
  for (const r of rs) {
    const c = byId[r.id]; const w = c?.c.find((y) => y[4]);
    if (hasReturns(c)) { counting++; votes += c!.c.reduce((s, x) => s + x[2], 0); } else if (!w) continue;
    const m = liveMargin(r, c), sure = w ? null : certainParty(c);
    if (w) { onPoint++; const p = w[1].toLowerCase(); if (p.startsWith("rep")) cR++; else if (p.startsWith("dem")) cD++; else cO++; }
    else if (sure) { oneParty++; if (sure === "D") cD++; else cR++; }
    else if (m != null) { if (m < 0) lD++; else lR++; }
  }
  return { cD, cR, cO, lD, lR, counting, votes, n: rs.length, called: cD + cR + cO, onPoint, oneParty };
}

export type WatchBar = { pD: number; ind: boolean; label: string; caption: "Reported vote share" | "Pre-election forecast" };

/**
 * The bar on a watched race. With votes counted it is the first side's share of the two-way vote actually reported;
 * before that it is the established pre-election forecast chance, captioned as such. Margin, turnout and percent
 * reporting are never turned into a probability. Returns null when there is nothing honest to draw.
 */
export function watchBar(r: XRace, c: CRace | undefined, live: boolean): WatchBar | null {
  const ind = isInd(r), side = r.k === "measure" ? "Yes" : ind ? "Independent" : "Democratic";
  if (live) {
    if (!hasReturns(c)) return null;
    const s = sides(r, c!.c); if (s.a + s.b <= 0) return null;
    const pD = s.a / (s.a + s.b);
    return { pD, ind, caption: "Reported vote share", label: `Reported two-way vote share: ${side} ${(pD * 100).toFixed(1)}%` };
  }
  if (r.pR == null) return null;
  return { pD: 1 - r.pR, ind, caption: "Pre-election forecast", label: `Pre-election forecast, not a result: ${side} ${((1 - r.pR) * 100).toFixed(1)}% chance` };
}
